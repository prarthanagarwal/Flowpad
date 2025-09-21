// ===== FILE-BASED STORAGE MODULE =====
// Handles all note file operations, migration, and directory management

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Store = require('electron-store');
const { 
  generateNoteFilename,
  createFrontmatter,
  parseFrontmatter,
  convertHtmlToMarkdown,
  convertMarkdownToHtml
} = require('../shared/utils');

// ===== CONFIGURATION =====
// Use Application Support directory to avoid Documents permission issues
const NOTES_DIR = path.join(os.homedir(), 'Documents', 'Flowpad');

// Encryption configuration for API keys
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const HMAC_ALGORITHM = 'sha256';
const HMAC_KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256 bits for key derivation

// Generate or retrieve encryption key for API keys
function getEncryptionKey() {
  try {
    // Try to get existing key from store
    let key = store.get('encryptionKey');
    
    if (!key) {
      // Generate new key if none exists
      key = crypto.randomBytes(ENCRYPTION_KEY_LENGTH).toString('hex');
      store.set('encryptionKey', key);
    }
    
    return Buffer.from(key, 'hex');
  } catch (error) {
    console.error('Error getting encryption key:', error);
    // Fallback: generate a new key
    const key = crypto.randomBytes(ENCRYPTION_KEY_LENGTH).toString('hex');
    store.set('encryptionKey', key);
    return Buffer.from(key, 'hex');
  }
}

// Generate or retrieve HMAC key for authentication
function getHMACKey() {
  try {
    // Try to get existing HMAC key from store
    let hmacKey = store.get('hmacKey');
    
    if (!hmacKey) {
      // Generate new HMAC key if none exists
      hmacKey = crypto.randomBytes(HMAC_KEY_LENGTH).toString('hex');
      store.set('hmacKey', hmacKey);
    }
    
    return Buffer.from(hmacKey, 'hex');
  } catch (error) {
    console.error('Error getting HMAC key:', error);
    // Fallback: generate a new HMAC key
    const hmacKey = crypto.randomBytes(HMAC_KEY_LENGTH).toString('hex');
    store.set('hmacKey', hmacKey);
    return Buffer.from(hmacKey, 'hex');
  }
}

// Derive encryption key from password using PBKDF2
function deriveKeyFromPassword(password, salt) {
  try {
    return crypto.pbkdf2Sync(password, salt, 100000, ENCRYPTION_KEY_LENGTH, 'sha256');
  } catch (error) {
    console.error('Error deriving key from password:', error);
    throw error;
  }
}

// Generate HMAC signature for data integrity
function generateHMAC(data, key) {
  try {
    const hmac = crypto.createHmac(HMAC_ALGORITHM, key);
    hmac.update(data);
    return hmac.digest('hex');
  } catch (error) {
    console.error('Error generating HMAC:', error);
    throw error;
  }
}

// Verify HMAC signature
function verifyHMAC(data, signature, key) {
  try {
    const expectedSignature = generateHMAC(data, key);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    // Check if buffers have the same length before comparing
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Error verifying HMAC:', error);
    return false;
  }
}

// Encrypt API key with HMAC authentication
function encryptApiKey(apiKey) {
  try {
    if (!apiKey) return '';
    
    const key = getEncryptionKey();
    const hmacKey = getHMACKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Create the data to be authenticated (IV + encrypted data)
    const dataToAuthenticate = iv.toString('hex') + ':' + encrypted;
    
    // Generate HMAC signature for integrity verification
    const signature = generateHMAC(dataToAuthenticate, hmacKey);
    
    // Combine IV + encrypted data + HMAC signature
    const combined = dataToAuthenticate + ':' + signature;
    return combined;
  } catch (error) {
    console.error('Error encrypting API key:', error);
    return apiKey; // Return plain text as fallback
  }
}

// Decrypt API key with HMAC verification
function decryptApiKey(encryptedApiKey) {
  try {
    if (!encryptedApiKey) return '';
    
    // Check if it's already plain text (for backward compatibility)
    if (!encryptedApiKey.includes(':')) {
      return encryptedApiKey;
    }
    
    const key = getEncryptionKey();
    const hmacKey = getHMACKey();
    const parts = encryptedApiKey.split(':');
    
    // Handle different formats for backward compatibility
    if (parts.length === 2) {
      // Old format without HMAC (IV:encrypted)
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else if (parts.length === 3) {
      // New format with HMAC (IV:encrypted:signature)
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const signature = parts[2];
      
      // Verify HMAC signature
      const dataToVerify = parts[0] + ':' + parts[1];
      if (!verifyHMAC(dataToVerify, signature, hmacKey)) {
        console.error('HMAC verification failed - data may have been tampered with');
        throw new Error('Data integrity check failed');
      }
      
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else {
      return encryptedApiKey; // Return as-is if format is wrong
    }
  } catch (error) {
    console.error('Error decrypting API key:', error);
    return encryptedApiKey; // Return as-is if decryption fails
  }
}

// Initialize electron-store for settings (we still use this for app preferences)
const store = new Store({
  name: 'flowpad-data',
  cwd: process.platform === 'darwin' 
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Flowpad')
    : undefined // Use default for Windows/Linux
});

// ===== DIRECTORY MANAGEMENT =====
async function ensureNotesDirectory() {
  try {
    await fs.access(NOTES_DIR);
  } catch (error) {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  }
}

// ===== NOTE FILE OPERATIONS =====
async function saveNote(noteData) {
  try {
    await ensureNotesDirectory();
    
    const noteId = noteData.id || Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const note = {
      id: noteId,
      title: noteData.title || 'New Note',
      content: noteData.content,
      createdAt: noteData.createdAt || timestamp,
      updatedAt: noteData.updatedAt || timestamp, // Preserve provided timestamp if given
      tags: noteData.tags || [],
      fontSize: noteData.fontSize || 16,
      fontFamily: noteData.fontFamily || 'Aeonik',
      folder: noteData.folder || null,
      folderName: noteData.folderName || null
    };
    
    // Convert HTML content to Markdown for storage
    const markdownContent = await convertHtmlToMarkdown(note.content);
    
    // Create file content with frontmatter
    const fileContent = createFrontmatter(note) + markdownContent;
    
    // Generate filename
    const filename = generateNoteFilename(note);
    const filepath = path.join(NOTES_DIR, filename);
    
    // Check if this is an update to existing note
    const files = await fs.readdir(NOTES_DIR);
    const existingFile = files.find(file => {
      if (file.endsWith('.md')) {
        try {
          const content = fsSync.readFileSync(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          return metadata.id === noteId;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    // If updating existing note, remove old file
    if (existingFile) {
      const oldFilePath = path.join(NOTES_DIR, existingFile);
      await fs.unlink(oldFilePath);
    }
    
    // Write the new/updated note
    await fs.writeFile(filepath, fileContent, 'utf8');
    
    return { success: true, note };
  } catch (error) {
    console.error('Storage: Error saving note:', error);
    return { success: false, error: error.message };
  }
}

async function loadNotes() {
  try {
    await ensureNotesDirectory();
    
    const files = await fs.readdir(NOTES_DIR);
    const notes = [];
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const filepath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          const { metadata, content: markdownContent } = parseFrontmatter(content);
          
          // Convert Markdown back to HTML for the editor
          const htmlContent = await convertMarkdownToHtml(markdownContent);
          
          const note = {
            id: metadata.id || Date.now().toString(),
            title: metadata.title || 'New Note',
            content: htmlContent,
            createdAt: metadata.createdAt || new Date().toISOString(),
            updatedAt: metadata.updatedAt || new Date().toISOString(),
            tags: metadata.tags || [],
            fontSize: metadata.fontSize || 16,
            fontFamily: metadata.fontFamily || 'Aeonik',
            folder: metadata.folder || null,
            folderName: metadata.folderName || null
          };
          
          // Debug font loading for non-default fonts
          if (metadata.fontSize !== 16 || (metadata.fontFamily && metadata.fontFamily !== 'Aeonik')) {
            console.log(`Storage: Loading note with custom fonts - fontSize: ${metadata.fontSize}, fontFamily: "${metadata.fontFamily}" for note: "${note.title}"`);
          }
          
          notes.push(note);
        } catch (fileError) {
          console.error(`Storage: Error reading note file ${file}:`, fileError);
        }
      }
    }
    
    // Sort notes by updatedAt (newest first)
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return { success: true, notes };
  } catch (error) {
    console.error('Storage: Error loading notes:', error);
    return { success: false, error: error.message };
  }
}

async function deleteNote(noteId) {
  try {
    await ensureNotesDirectory();
    
    const files = await fs.readdir(NOTES_DIR);
    const targetFile = files.find(file => {
      if (file.endsWith('.md')) {
        try {
          const content = fsSync.readFileSync(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          return metadata.id === noteId;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    if (targetFile) {
      const filepath = path.join(NOTES_DIR, targetFile);
      await fs.unlink(filepath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
}

// ===== MIGRATION =====
async function migrateNotesToFiles() {
  try {
    // Get notes from current electron-store
    const existingNotes = store.get('notes', []);
    let migratedCount = 0;
    let totalNotesToMigrate = existingNotes.length;
    
    // Check for notes in the legacy location (without -data suffix)
    let legacyNotes = [];
    const legacyConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'flowpad', 'config.json');
    
    try {
      if (fsSync.existsSync(legacyConfigPath)) {
        console.log(`Found legacy config file at ${legacyConfigPath}`);
        const legacyConfig = JSON.parse(fsSync.readFileSync(legacyConfigPath, 'utf8'));
        if (legacyConfig.notes && Array.isArray(legacyConfig.notes)) {
          legacyNotes = legacyConfig.notes;
          console.log(`Found ${legacyNotes.length} notes in legacy config`);
          totalNotesToMigrate += legacyNotes.length;
        }
      }
    } catch (legacyError) {
      console.error('Error reading legacy config:', legacyError);
    }
    
    if (totalNotesToMigrate > 0) {
      console.log(`Migrating ${totalNotesToMigrate} notes to file-based storage...`);
      await ensureNotesDirectory();
      
      // First migrate notes from current store
      for (const note of existingNotes) {
        try {
          await migrateNote(note);
          migratedCount++;
        } catch (noteError) {
          console.error(`Error migrating note ${note.id}:`, noteError);
        }
      }
      
      // Then migrate notes from legacy location
      for (const note of legacyNotes) {
        try {
          await migrateNote(note);
          migratedCount++;
        } catch (noteError) {
          console.error(`Error migrating legacy note ${note.id}:`, noteError);
        }
      }
      
      // Clear the old notes from electron-store after successful migration
      if (existingNotes.length > 0) {
        store.set('notes', []);
      }
      
      // Try to clear legacy notes if they exist
      if (legacyNotes.length > 0) {
        try {
          if (fsSync.existsSync(legacyConfigPath)) {
            const legacyConfig = JSON.parse(fsSync.readFileSync(legacyConfigPath, 'utf8'));
            legacyConfig.notes = [];
            fsSync.writeFileSync(legacyConfigPath, JSON.stringify(legacyConfig, null, 2), 'utf8');
          }
        } catch (clearError) {
          console.error('Error clearing legacy notes:', clearError);
        }
      }
      
      console.log(`Migration completed! Migrated ${migratedCount} of ${totalNotesToMigrate} notes.`);
    } else {
      console.log('No notes found to migrate.');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Helper function to migrate a single note
async function migrateNote(note) {
  // Add default font settings for backward compatibility
  const noteWithFonts = {
    ...note,
    fontSize: note.fontSize || 16,
    fontFamily: note.fontFamily || 'Aeonik'
  };
  
  // Convert HTML content to Markdown
  const markdownContent = await convertHtmlToMarkdown(noteWithFonts.content);
  
  // Create file content with frontmatter
  const fileContent = createFrontmatter(noteWithFonts) + markdownContent;
  
  // Generate filename
  const filename = generateNoteFilename(noteWithFonts);
  const filepath = path.join(NOTES_DIR, filename);
  
  // Write the note file
  await fs.writeFile(filepath, fileContent, 'utf8');
  console.log(`Migrated note: ${filename}`);
}

// ===== SETTINGS MANAGEMENT =====
function getAppSettings() {
  return store.get('settings', {
    fontSize: 16,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true,
    aiApiKey: '',
    aiEnabled: false
  });
}

function saveAppSettings(settings) {
  try {
    store.set('settings', settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== AI SETTINGS MANAGEMENT =====
function getAISettings() {
  const settings = getAppSettings();
  return {
    aiApiKey: decryptApiKey(settings.aiApiKey || ''),
    aiEnabled: settings.aiEnabled || false
  };
}

function saveAISettings(aiSettings) {
  try {
    const currentSettings = getAppSettings();
    const updatedSettings = {
      ...currentSettings,
      aiApiKey: encryptApiKey(aiSettings.aiApiKey || ''),
      aiEnabled: aiSettings.aiEnabled || false
    };
    store.set('settings', updatedSettings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== WINDOW STATE MANAGEMENT =====
function getWindowBounds() {
  return store.get('windowBounds', {
    width: 900,  // Smaller default size
    height: 700, // Smaller default size
    x: undefined,
    y: undefined,
    isMaximized: false
  });
}

function saveWindowBounds(bounds) {
  try {
    store.set('windowBounds', bounds);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== DIRECTORY ACCESS =====
function getNotesDirectory() {
  return NOTES_DIR;
}

// ===== FOLDER MANAGEMENT =====
async function getFolders() {
  try {
    const folders = store.get('folders', []);
    return { success: true, folders };
  } catch (error) {
    console.error('Error getting folders:', error);
    return { success: false, error: error.message };
  }
}

async function saveFolder(folderData) {
  try {
    const folders = store.get('folders', []);
    const folderId = folderData.id || Date.now().toString();
    
    const folder = {
      id: folderId,
      name: folderData.name,
      createdAt: folderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Check if folder exists
    const existingIndex = folders.findIndex(f => f.id === folderId);
    if (existingIndex > -1) {
      folders[existingIndex] = folder;
    } else {
      folders.push(folder);
    }
    
    store.set('folders', folders);
    return { success: true, folder };
  } catch (error) {
    console.error('Error saving folder:', error);
    return { success: false, error: error.message };
  }
}

async function deleteFolder(folderId) {
  try {
    const folders = store.get('folders', []);
    const updatedFolders = folders.filter(f => f.id !== folderId);
    store.set('folders', updatedFolders);
    
    // Also update any notes that were in this folder to have no folder
    const result = await loadNotes();
    if (result.success) {
      const notesToUpdate = result.notes.filter(note => note.folder === folderId);
      for (const note of notesToUpdate) {
        await saveNote({ ...note, folder: null });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return { success: false, error: error.message };
  }
}

// ===== EXPORTS =====
module.exports = {
  // Note operations
  saveNote,
  loadNotes,
  deleteNote,

  // Folder operations
  getFolders,
  saveFolder,
  deleteFolder,

  // Migration
  migrateNotesToFiles,

  // Settings
  getAppSettings,
  saveAppSettings,

  // AI Settings
  getAISettings,
  saveAISettings,

  // Window state
  getWindowBounds,
  saveWindowBounds,

  // Directory management
  ensureNotesDirectory,
  getNotesDirectory
}; 