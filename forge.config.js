const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const createLatestMacManifest = (artifactPath) => {
  const fileBuffer = fs.readFileSync(artifactPath);
  const { size } = fs.statSync(artifactPath);
  const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');
  const fileName = path.basename(artifactPath);
  const manifest = [
    `version: ${pkg.version}`,
    'files:',
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${fileName}`,
    `releaseDate: ${new Date().toISOString()}`
  ].join('\n');

  const manifestPath = path.join(path.dirname(artifactPath), 'latest-mac.yml');
  fs.writeFileSync(manifestPath, manifest);
  return manifestPath;
};

module.exports = {
  packagerConfig: {
    asar: true,
    // App metadata
    name: 'flowpad',
    productName: 'flowpad',
    executableName: 'flowpad',
    appBundleId: 'com.flowpad.app',
    appCategoryType: 'public.app-category.productivity',
    appCopyright: 'Copyright © 2025 Prarthan Agarwal and contributors',
    
    // Icons
    icon: 'assets/icon',
    
    // Windows metadata
    win32metadata: {
      CompanyName: 'Prarthan Agarwal',
      FileDescription: 'a minimal notepad for your thoughts to flow',
      OriginalFilename: 'flowpad.exe',
      ProductName: 'flowpad',
      InternalName: 'flowpad',
      RequestedExecutionLevel: 'asInvoker',
    },
    
    // macOS signing and notarization
    ...(process.platform === 'darwin' || process.env.BUILD_MAC === 'true' ? {
      darwinDarkModeSupport: true,
      osxSign: {
        identity: process.env.CSC_NAME || `Developer ID Application: Prarthan Agarwal (${process.env.APPLE_TEAM_ID || 'NYTQ72PV9X'})`,
        hardenedRuntime: true,
        entitlements: path.resolve(__dirname, 'entitlements.plist'),
        'entitlements-inherit': path.resolve(__dirname, 'entitlements.inherit.plist'),
        optionsForFile: (filePath) => {
          return {
            entitlements: path.resolve(__dirname, 'entitlements.plist'),
            'entitlements-inherit': path.resolve(__dirname, 'entitlements.inherit.plist')
          };
        }
      }
    } : {}),
    
    // Optimizations
    derefSymlinks: true,
    junk: true,
    

  },
  
  rebuildConfig: {
    force: true,
  },
  
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'flowpad',
        authors: 'Prarthan Agarwal',
        description: 'a minimal notepad for your thoughts to flow',
        setupIcon: 'assets/icon.ico',
        iconUrl: 'https://raw.githubusercontent.com/PrarthanAgarwal/Flowpad/main/assets/icon.ico',
        noMsi: true,
      },
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'PrarthanAgarwal',
          name: 'flowpad'
        },
        draft: true,
        prerelease: false,
        generateReleaseNotes: true,
        tagPrefix: 'v',
      }
    }
  ],
  
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    }),
  ],

  hooks: {
    postMake: async (_forgeConfig, makeResults) => {
      makeResults
        .filter((result) => result.platform === 'darwin')
        .forEach((result) => {
          const zipArtifact = result.artifacts.find((artifact) => artifact.endsWith('.zip'));
          if (!zipArtifact) {
            console.warn('No macOS zip artifact found; skipping latest-mac.yml generation.');
            return;
          }

          const manifestPath = createLatestMacManifest(zipArtifact);
          console.log(`Generated macOS auto-update manifest at ${manifestPath}`);
        });
    },
  },
};
