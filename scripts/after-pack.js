const fs = require('fs');
const path = require('path');
const { generateYaml } = require('electron-updater-yaml');
const packageJson = require('../package.json');

/**
 * This script runs after electron-builder packs the app
 * It generates the latest-mac.yml file for auto-updates
 */
module.exports = async function(context) {
  console.log('Running after-pack script for macOS...');
  
  try {
    const { appOutDir, outDir, arch, targets } = context;
    
    // Only run for macOS DMG builds
    const macDmgTarget = targets.find(target => 
      target.name === 'dmg' && target.arch.includes(arch)
    );
    
    if (!macDmgTarget) {
      console.log('No macOS DMG target found, skipping update metadata generation');
      return;
    }
    
    console.log(`Generating update metadata for macOS ${arch}...`);
    
    // Find the DMG file
    const dmgFiles = fs.readdirSync(outDir)
      .filter(file => file.endsWith('.dmg') && file.includes(packageJson.version));
    
    if (dmgFiles.length === 0) {
      console.log('No DMG file found, skipping update metadata generation');
      return;
    }
    
    const dmgFile = dmgFiles[0];
    const dmgPath = path.join(outDir, dmgFile);
    
    console.log(`Found DMG: ${dmgFile}`);
    
    // Generate latest-mac.yml
    const updateUrlPrefix = `https://github.com/PrarthanAgarwal/Flowpad/releases/download/v${packageJson.version}`;
    
    await generateYaml({
      installerFile: dmgPath,
      outputFile: path.join(outDir, 'latest-mac.yml'),
      packageJson: packageJson,
      updateUrlPrefix: updateUrlPrefix,
      platform: 'mac',
      releaseType: 'release'
    });
    
    console.log('Generated latest-mac.yml for auto-updates');
    
    // Create app-update.yml for embedding in the app
    const appUpdatePath = path.join(appOutDir, 'Flowpad.app', 'Contents', 'Resources', 'app-update.yml');
    
    // Create the app-update.yml content
    const appUpdateContent = `provider: github
owner: PrarthanAgarwal
repo: Flowpad
updaterCacheDirName: flowpad-updater
`;
    
    // Ensure the directory exists
    const appUpdateDir = path.dirname(appUpdatePath);
    if (!fs.existsSync(appUpdateDir)) {
      fs.mkdirSync(appUpdateDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(appUpdatePath, appUpdateContent, 'utf8');
    
    console.log(`Created app-update.yml at: ${appUpdatePath}`);
    
    console.log('macOS update metadata generation completed successfully');
  } catch (error) {
    console.error('Error generating macOS update metadata:', error);
  }
}; 