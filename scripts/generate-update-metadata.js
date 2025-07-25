const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  windowsInstallerPath: path.join(__dirname, '../out/make/squirrel.windows/x64'),
  windowsStageDir: path.join(__dirname, '../out/make/squirrel.windows/x64'),
  
  // macOS build paths (if you're also building for macOS)
  macInstallerPath: path.join(__dirname, '../out'),
  macStageDir: path.join(__dirname, '../out'),
  
  // Update config
  updateUrlPrefix: 'https://github.com/PrarthanAgarwal/Flowpad/releases/download/v' + packageJson.version
};

/**
 * Calculate SHA512 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {string} - SHA512 hash
 */
function calculateSha512(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha512');
  hashSum.update(fileBuffer);
  return hashSum.digest('base64');
}

/**
 * Generates the latest.yml file for Windows builds
 */
async function generateWindowsUpdateMetadata() {
  try {
    console.log('Generating Windows update metadata...');
    
    // Find the installer file (NSIS installer from electron-forge)
    const installerFiles = fs.readdirSync(config.windowsStageDir)
      .filter(file => file.endsWith('.exe') && file.includes('Setup'));
    
    if (installerFiles.length === 0) {
      throw new Error('No Windows installer found in ' + config.windowsStageDir);
    }
    
    const installerFile = installerFiles[0];
    const installerPath = path.join(config.windowsStageDir, installerFile);
    const stats = fs.statSync(installerPath);
    const sha512 = calculateSha512(installerPath);
    
    // Generate latest.yml manually
    const yamlContent = `version: ${config.version}
files:
  - url: ${installerFile}
    sha512: ${sha512}
    size: ${stats.size}
path: ${installerFile}
sha512: ${sha512}
releaseDate: ${new Date().toISOString()}`;

    // Write the YAML file
    const yamlPath = path.join(config.windowsStageDir, 'latest.yml');
    fs.writeFileSync(yamlPath, yamlContent);
    
    console.log('Windows update metadata generated successfully');
    
    // Copy latest.yml to app-update.yml for embedding in the app
    const appUpdateContent = `provider: github
owner: ${config.githubOwner}
repo: ${config.githubRepo}
updaterCacheDirName: ${config.appName}-updater`;

    fs.writeFileSync(
      path.join(config.windowsStageDir, 'app-update.yml'),
      appUpdateContent
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
    const stats = fs.statSync(dmgPath);
    const sha512 = calculateSha512(dmgPath);
    
    // Generate latest-mac.yml manually
    const yamlContent = `version: ${config.version}
files:
  - url: ${dmgFile}
    sha512: ${sha512}
    size: ${stats.size}
path: ${dmgFile}
sha512: ${sha512}
releaseDate: ${new Date().toISOString()}`;

    // Write the YAML file
    const yamlPath = path.join(config.macStageDir, 'latest-mac.yml');
    fs.writeFileSync(yamlPath, yamlContent);
    
    console.log('macOS update metadata generated successfully');
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
  if (process.platform === 'win32') {
    await generateWindowsUpdateMetadata();
  } else if (process.platform === 'darwin') {
    await generateMacUpdateMetadata();
  } else {
    // Generate both if running in CI
    await generateWindowsUpdateMetadata();
    await generateMacUpdateMetadata();
  }
  
  console.log('Update metadata generation completed');
}

// Run the script
generateUpdateMetadata().catch(err => {
  console.error('Failed to generate update metadata:', err);
  process.exit(1);
}); 