const rcedit = require('rcedit');
const path = require('path');
const fs = require('fs');

async function updateExecutableMetadata() {
  const distPath = path.join(__dirname, '..', 'dist');
  const winUnpackedPath = path.join(distPath, 'win-unpacked');
  const executablePath = path.join(winUnpackedPath, 'Notes App.exe');

  // Check if the executable exists
  if (!fs.existsSync(executablePath)) {
    console.log('Executable not found at:', executablePath);
    return;
  }

  console.log('Updating executable metadata...');

  try {
    await rcedit(executablePath, {
      'version-string': {
        'CompanyName': 'Notes App Developer',
        'ProductName': 'Notes App',
        'FileDescription': 'A minimal note-taking application',
        'InternalName': 'notes-app',
        'OriginalFilename': 'Notes App.exe',
        'LegalCopyright': 'Copyright © 2025 Notes App Developer'
      },
      'file-version': '1.0.0.0',
      'product-version': '1.0.0.0',
      'icon': path.join(__dirname, '..', 'assets', 'icon.ico')
    });

    console.log('✅ Executable metadata updated successfully!');
  } catch (error) {
    console.error('❌ Failed to update executable metadata:', error);
  }
}

updateExecutableMetadata(); 