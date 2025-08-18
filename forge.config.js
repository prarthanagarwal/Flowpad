const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');
const packageJson = require('./package.json');

module.exports = {
  packagerConfig: {
    asar: true,
    // App metadata from electron-builder config
    name: 'Flowpad',
    productName: 'Flowpad',
    executableName: 'Flowpad',
    appBundleId: 'com.flowpad.app',
    appCategoryType: 'public.app-category.productivity',
    appCopyright: 'Copyright © 2025 Flowpad Developer',
    
    // Icons
    icon: 'assets/icon', // Will auto-select .ico on Windows, .icns on macOS
    
    // Optimization settings for smaller app size
    prune: true,
    ignore: [
      // Exclude unnecessary files to reduce app size
      /^\/\.git/,
      /^\/\.github/,
      /^\/docs/,
      /^\/Release Notes/,
      /^\/dist/,
      /^\/out/,
      /RELEASE_NOTES.*\.md$/,
      /\.md$/,
      /\.map$/,
      /\.log$/,
      /\.git/,
      /node_modules\/.*\/test/,
      /node_modules\/.*\/tests/,
      /node_modules\/.*\/\.github/,
      /node_modules\/.*\/docs/,
      /node_modules\/.*\/example/,
      /node_modules\/.*\/examples/,
      /node_modules\/.*\/benchmark/,
      /node_modules\/.*\/README/,
      /node_modules\/.*\/CHANGELOG/,
      /node_modules\/.*\/CONTRIBUTING/,
      /node_modules\/.*\/LICENSE/,
      /node_modules\/.*\/\.nyc_output/,
      /node_modules\/.*\/coverage/,
    ],
    
    // Platform-specific configurations
    win32metadata: {
      CompanyName: 'Prarthan Agarwal',
      FileDescription: 'a minimal notepad for your thoughts to flow',
      OriginalFilename: 'Flowpad.exe',
      ProductName: 'Flowpad',
      InternalName: 'Flowpad',
      LegalTrademarks: 'Flowpad',
      RequestedExecutionLevel: 'asInvoker',
    },
    
    // macOS specific - only include if on macOS or building for macOS
    ...(process.platform === 'darwin' || process.env.BUILD_MAC === 'true' ? {
      darwinDarkModeSupport: true,
      osxSign: false, // Disable signing for now, enable when certificates are available
      osxNotarize: false,
    } : {}),
    
    // General optimizations
    derefSymlinks: true,
    junk: true, // Remove unnecessary files
    
    // Auto-update configuration
    extraResource: [
      // We'll create this file in the post-make hook
    ]
  },
  
  rebuildConfig: {
    force: true,
  },
  
  makers: [
    // Windows Squirrel Installer with desktop shortcuts
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'flowpad',
        authors: 'Prarthan Agarwal',
        description: 'a minimal notepad for your thoughts to flow',
        setupIcon: 'assets/icon.ico',
        iconUrl: 'https://raw.githubusercontent.com/PrarthanAgarwal/Flowpad/main/assets/icon.ico',
        noMsi: true,
        ...(process.env.WINDOWS_CERTIFICATE_FILE ? {
          certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
          certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
        } : {}),
      },
      platforms: ['win32'],
    },
    
    // Windows ZIP (portable version)
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['win32'],
    },
    
    // macOS DMG Installer
    {
      name: '@electron-forge/maker-dmg',
      config: {
        // Let Electron Forge handle the default configuration
      },
      platforms: ['darwin'],
    },
    
    // macOS ZIP (for auto-updates)
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['darwin'],
    },
  ],
  
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'PrarthanAgarwal',
          name: 'Flowpad'
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
    
    // Fuses for security and optimization
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false, // Reduces bundle size
    }),
  ],
  
  // Hooks for additional optimization
  hooks: {
    packageAfterPrune: async (config, buildPath) => {
      console.log('🔧 Post-prune optimization...');
      
      // Additional cleanup could be done here
      const fs = require('fs');
      const path = require('path');
      
      // Remove any remaining development files
      const devFiles = [
        '.nyc_output',
        'coverage',
        '.github',
        'test',
        'tests',
        'spec',
        'example',
        'examples'
      ];
      
      for (const file of devFiles) {
        const filePath = path.join(buildPath, file);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`🗑️  Removed: ${file}`);
        }
      }
    },
    

  },
};
