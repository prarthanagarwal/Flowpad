const rcedit = require('rcedit');
const path = require('path');
const fs = require('fs');

async function fixExecutableCompletely() {
  const executablePath = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Notes App.exe');
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  // Check if files exist
  if (!fs.existsSync(executablePath)) {
    console.error('❌ Executable not found at:', executablePath);
    return;
  }

  if (!fs.existsSync(iconPath)) {
    console.error('❌ Icon not found at:', iconPath);
    return;
  }

  console.log('🔧 Fixing executable metadata and icon...');
  console.log('📍 Executable:', executablePath);
  console.log('🖼️ Icon:', iconPath);

  try {
    // Apply comprehensive metadata and icon
    await rcedit(executablePath, {
      'version-string': {
        'CompanyName': 'Notes App Developer',
        'ProductName': 'Notes App',
        'FileDescription': 'A minimal note-taking application',
        'InternalName': 'Notes App',
        'OriginalFilename': 'Notes App.exe',
        'LegalCopyright': 'Copyright © 2025 Notes App Developer',
        'ProductVersion': '1.0.0',
        'FileVersion': '1.0.0'
      },
      'file-version': '1.0.0.0',
      'product-version': '1.0.0.0',
      'icon': iconPath
    });

    console.log('✅ SUCCESS! Executable metadata and icon updated!');
    console.log('');
    console.log('🎯 What was fixed:');
    console.log('  • Product Name: Notes App');
    console.log('  • Company Name: Notes App Developer');
    console.log('  • Icon: Custom notepad icon');
    console.log('  • File Description: A minimal note-taking application');
    console.log('  • Version: 1.0.0');
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Test the executable: dist\\win-unpacked\\Notes App.exe');
    console.log('  2. Check Task Manager - should show "Notes App"');
    console.log('  3. If satisfied, rebuild installers: npm run build-win');

  } catch (error) {
    console.error('❌ Failed to fix executable:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('  • Make sure no Notes App instances are running');
    console.log('  • Close the executable if it\'s open');
    console.log('  • Run this script as Administrator if needed');
  }
}

fixExecutableCompletely(); 