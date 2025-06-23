# Notes App

<img src="notes.png" alt="Notes App Screenshot" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">

A minimal, distraction-free note-taking application built with Electron.js, inspired by Freewrite applications. Designed for focused writing with a clean, modern interface and essential productivity features.

## ✨ Features

### 📝 **Writing Experience**
- **Clean Interface**: Distraction-free design with customizable dark/light themes
- **Rich Text Editor**: Full-featured contenteditable editor with formatting support
- **Auto-Focus**: Editor automatically focuses on startup for immediate writing
- **Formatting Reset**: Automatic formatting reset when pressing Enter for clean new lines
- **Live Word Count**: Real-time word count display in the bottom toolbar

### 🎨 **Formatting Tools**
- **Text Formatting**: Bold, italic, underline, strikethrough
- **Lists**: Bullet lists and numbered lists
- **Todo Items**: Interactive checkboxes with toggle functionality
- **Keyboard Shortcuts**: Standard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, etc.)
- **Toolbar Controls**: Accessible formatting toolbar with dropdown menus

### 📚 **Note Management**
- **Smart History**: Right-side collapsible sidebar with all notes
- **Auto-Save**: Automatic saving every 3 seconds
- **Search Functionality**: Live search through note titles and content
- **Date Organization**: Notes displayed with creation/modification dates
- **Quick Actions**: Easy note deletion and navigation
- **Export Support**: Export notes as .txt or .md files

### 🎛️ **Customization**
- **Dual Themes**: Dark mode (default) and warm light mode
- **Font Control**: Multiple font families (Inter, Arial, Georgia, Times New Roman, Courier New, Helvetica)
- **Font Sizing**: Adjustable font sizes from 12px to 24px
- **Persistent Settings**: All preferences saved across app sessions
- **Dynamic UI**: Theme-aware title bar and interface elements

### ⚡ **Performance & UX**
- **Instant Launch**: Fast startup with no loading screens
- **Smooth Animations**: Optimized CSS animations with GPU acceleration
- **Responsive Design**: Adapts to different window sizes
- **Auto-Close Sidebar**: Sidebar closes automatically when selecting notes
- **Live Time Display**: Current system time updated every second

## 🚀 Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **Windows 10/11** (primary target platform)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd notes-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Launch the application**
   ```bash
   npm start
   ```

### Building for Distribution

Create a Windows installer:
```bash
npm run build
```

The installer will be generated in the `dist/` folder.

## 📖 Usage Guide

### Basic Operations

| Action | Method | Shortcut |
|--------|--------|----------|
| New Note | Click "New" button | `Ctrl+N` |
| Save Note | Auto-saves every 3s | `Ctrl+S` (manual) |
| Toggle History | Click "History" button | `Ctrl+H` |
| Search Notes | Type in search box | - |
| Switch Theme | Click theme button | - |

### Text Formatting

| Format | Shortcut | Button |
|--------|----------|---------|
| **Bold** | `Ctrl+B` | **B** |
| *Italic* | `Ctrl+I` | *I* |
| <u>Underline</u> | `Ctrl+U` | U |
| ~~Strikethrough~~ | - | ~~S~~ |
| • Bullet List | - | ⚫ |
| 1. Numbered List | - | 1. |
| ☑ Todo Item | - | ✓ |

### Advanced Features

#### Theme Switching
- **Dark Mode**: Default theme optimized for low-light writing
- **Light Mode**: Warm white theme (#fefae0) for daytime use
- **Dynamic Title Bar**: Title bar colors change with theme

#### Todo Management
1. Select text or place cursor
2. Click the todo button (✓) in formatting toolbar
3. Click checkboxes to toggle completion status
4. Completed items are visually crossed out

#### Font Customization
- Access via Font dropdown in bottom-left toolbar
- Choose from 6 different font families
- Adjust size from 12px to 24px
- Changes apply instantly and persist

## 🏗️ Technical Architecture

### Project Structure
```
notes-app/
├── main.js              # Electron main process
├── preload.js           # IPC bridge (context isolation)
├── index.html           # Application UI structure
├── styles.css           # Complete styling (900+ lines)
├── app.js               # Frontend logic (700+ lines)
├── package.json         # Dependencies & build config
├── README.md            # Documentation
└── renderer/            # Future modular components
    ├── components/      # (Prepared for expansion)
    └── utils/           # (Prepared for expansion)
```

### Technology Stack
- **Electron**: v36.5.0 (Latest stable)
- **electron-store**: v8.1.0 (Persistent data storage)
- **electron-builder**: v24.9.1 (Application packaging)
- **Pure JavaScript**: No external UI frameworks
- **CSS3**: Modern styling with animations and themes
- **HTML5**: Semantic structure with accessibility support

### Security Features
- ✅ **Context Isolation**: Enabled
- ✅ **Node Integration**: Disabled in renderer
- ✅ **Preload Script**: Secure IPC communication
- ✅ **Content Security**: Sanitized user input
- ✅ **File System**: Controlled access via main process

### Data Storage
- **Format**: JSON files via electron-store
- **Location**: OS-specific app data directory
- **Structure**: Array of note objects with metadata
- **Backup**: Automatic atomic writes prevent corruption
- **Schema**: 
  ```json
  {
    "id": "timestamp-string",
    "title": "Note Title",
    "content": "HTML content",
    "createdAt": "ISO-date",
    "updatedAt": "ISO-date",
    "tags": ["array"]
  }
  ```

## ⚙️ Configuration

### Application Settings
Settings are automatically saved and include:
- `fontSize`: 12-24px (default: 16)
- `fontFamily`: Font selection (default: Inter)
- `theme`: "dark" or "light" (default: dark)
- `autoSave`: Always enabled (3-second interval)
- `wordWrap`: Always enabled

### Build Configuration
The app is configured for Windows distribution with:
- **Target**: NSIS installer
- **App ID**: com.notesapp.app
- **Auto-updater**: Ready for implementation
- **Icon**: Configurable (assets/icon.ico)

## 🔧 Development

### Running in Development
```bash
npm start
```

### Debugging
```bash
# Enable DevTools and logging
npm start -- --enable-logging
```

### Code Style
- **ES6+**: Modern JavaScript features
- **Modular Design**: Separated concerns and responsibilities
- **Event-Driven**: Clean event handling and IPC
- **Responsive**: Mobile-friendly CSS (media queries)

## 🚨 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| App won't start | Check Node.js version (≥16) |
| Notes not saving | Verify app data directory permissions |
| Formatting buttons inactive | Ensure editor has focus |
| Sidebar animation glitchy | Update to latest version |
| Theme not persisting | Check electron-store permissions |

### Debug Mode
Open DevTools in development:
```javascript
// In main.js, add:
mainWindow.webContents.openDevTools();
```

### Data Recovery
Notes are stored in:
- **Windows**: `%APPDATA%/notes-app/config.json`

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and structure
- Test all formatting and theme functionality
- Ensure cross-platform compatibility
- Update documentation for new features

## 📄 License

**MIT License** - See LICENSE file for details.

## 🙏 Acknowledgments

- **Freewrite**: Inspiration for distraction-free writing
- **Inter Font**: Primary typography choice
- **Electron**: Cross-platform desktop framework
- **Community**: Contributors and users

## 🔮 Roadmap

### Planned Features
- [ ] Multiple window support
- [ ] Note categories/tags
- [ ] Advanced search filters
- [ ] Import/export formats (JSON, PDF)
- [ ] Plugin system
- [ ] Cloud sync options
- [ ] Collaborative editing

### Version History
- **v1.0.0**: Initial release with core features
- Current: Stable release with themes and formatting

---

**Built with ❤️ for focused writing and productivity** 