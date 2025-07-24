const fs = require('fs');
const path = require('path');
const { generateYaml } = require('electron-updater-yaml');
const packageJson = require('../package.json');

// Configuration
const config = {
  // Get these values from package.json
  appId: 'com.flowpad.app',
  appName: packageJson.productName || 'Flowpad',
  version: packageJson.version,
  
  // GitHub repository info
  githubOwner: 'PrarthanAgarwal',
  githubRepo: 'Flowpad',
  
  // Build paths - adjust as needed
  outputDir: path.join(__dirname, '../out'),
  
  // Windows build paths
  windowsInstallerPath: path.join(__dirname, '../out/make/squirrel.windows/x64/Flowpad-*.exe'),
  windowsNugetPath: path.join(__dirname, '../out/make/squirrel.windows/x64/*.nupkg'),
  windowsStageDir: path.join(__dirname, '../out/make/squirrel.windows/x64'),
  
  // macOS build paths (if you're also building for macOS)
  macInstallerPath: path.join(__dirname, '../out/Flowpad-*.dmg'),
  macStageDir: path.join(__dirname, '../out'),
  
  // Update config
  updateUrlPrefix: 'https://github.com/PrarthanAgarwal/Flowpad/releases/download/v' + packageJson.version
};

/**
 * Generates the latest.yml file for Windows builds
 */
async function generateWindowsUpdateMetadata() {
  try {
    console.log('Generating Windows update metadata...');
    
    // Find the installer file
    const installerFiles = fs.readdirSync(config.windowsStageDir)
      .filter(file => file.endsWith('.exe') && file.includes('Setup'));
    
    if (installerFiles.length === 0) {
      throw new Error('No Windows installer found in ' + config.windowsStageDir);
    }
    
    const installerFile = installerFiles[0];
    const installerPath = path.join(config.windowsStageDir, installerFile);
    
    // Generate latest.yml
    await generateYaml({
      installerFile: installerPath,
      outputFile: path.join(config.windowsStageDir, 'latest.yml'),
      packageJson: packageJson,
      updateUrlPrefix: config.updateUrlPrefix,
      releaseType: 'release'
    });
    
    console.log('Windows update metadata generated successfully');
    
    // Copy latest.yml to app-update.yml for embedding in the app
    fs.copyFileSync(
      path.join(config.windowsStageDir, 'latest.yml'),
      path.join(config.windowsStageDir, 'app-update.yml')
    );
    
    console.log('Created app-update.yml for embedding in the app');
  } catch (error) {
    console.error('Error generating Windows update metadata:', error);
  }
}

/**
 * Generates the latest-mac.yml file for macOS builds
 */
async function generateMacUpdateMetadata() {
  try {
    console.log('Generating macOS update metadata...');
    
    // Find the DMG file
    const dmgFiles = fs.readdirSync(config.macStageDir)
      .filter(file => file.endsWith('.dmg'));
    
    if (dmgFiles.length === 0) {
      console.log('No macOS DMG found, skipping macOS metadata generation');
      return;
    }
    
    const dmgFile = dmgFiles[0];
    const dmgPath = path.join(config.macStageDir, dmgFile);
    
    // Generate latest-mac.yml
    await generateYaml({
      installerFile: dmgPath,
      outputFile: path.join(config.macStageDir, 'latest-mac.yml'),
      packageJson: packageJson,
      updateUrlPrefix: config.updateUrlPrefix,
      platform: 'mac',
      releaseType: 'release'
    });
    
    console.log('macOS update metadata generated successfully');
    
    // Copy latest-mac.yml to app-update.yml for embedding in the app
    fs.copyFileSync(
      path.join(config.macStageDir, 'latest-mac.yml'),
      path.join(config.macStageDir, 'app-update.yml')
    );
    
    console.log('Created app-update.yml for macOS for embedding in the app');
  } catch (error) {
    console.error('Error generating macOS update metadata:', error);
  }
}

/**
 * Main function to generate all update metadata
 */
async function generateUpdateMetadata() {
  console.log('Starting update metadata generation...');
  console.log(`App: ${config.appName} v${config.version}`);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  // Generate platform-specific metadata
  await generateWindowsUpdateMetadata();
  // Uncomment if you're also building for macOS
  // await generateMacUpdateMetadata();
  
  console.log('Update metadata generation completed');
}

// Run the script
generateUpdateMetadata().catch(err => {
  console.error('Failed to generate update metadata:', err);
  process.exit(1);
}); 