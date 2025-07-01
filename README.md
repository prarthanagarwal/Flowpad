# Flowpad

<img src="assets\notes.png" alt="Flowpad Screenshot" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">

A minimal, distraction-free note-taking application built with Electron.js, inspired by Freewrite applications. Designed for focused writing with a clean, modern interface, beautiful typography, and essential productivity features.

> **✨ NEW**: Now featuring custom fonts, Phosphor icons, categorized note history, and surprise font functionality!

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
- **Categorized History**: Intelligent sidebar with time-based categories (Today, Yesterday, Last 7 days, Last 30 days, Older)
- **Auto-Save**: Automatic saving every 3 seconds with visual feedback
- **Search Functionality**: Live search through note titles and content
- **Smart Date Display**: Shows time for recent notes, dates for older ones
- **Clean Organization**: Minimal design without individual note backgrounds
- **Quick Actions**: Easy note deletion and navigation with hover effects
- **Export Support**: Export notes as .txt or .md files

### 🎛️ **Customization**
- **Dual Themes**: Dark mode (default) and warm light mode with seamless switching
- **Custom Typography**: Beautiful fonts including Aeonik, Baskervville, Instrument Serif, Neue Regrade, Patrick Hand, and Courier New
- **Font Sizing**: Adjustable font sizes from 16px to 28px with live preview
- **Surprise Font**: ✨ Random font selection with visual feedback
- **Phosphor Icons**: Modern, consistent iconography throughout the interface
- **Persistent Settings**: All preferences saved across app sessions
- **Dynamic UI**: Theme-aware title bar with app icon and interface elements

### ⚡ **Performance & UX**
- **Instant Launch**: Fast startup with no loading screens
- **Smooth Animations**: Optimized CSS animations with GPU acceleration and hover effects
- **Responsive Design**: Adapts to different window sizes with mobile considerations
- **Auto-Close Sidebar**: Sidebar closes automatically when selecting notes
- **Live Time Display**: Current system time updated every second
- **Local Font Loading**: Self-contained custom fonts for offline reliability
- **Clean Interface**: Minimal design with focused interaction patterns

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flowpad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Launch the application**
   ```bash
   npm start
   # For development with auto-reload:
   npm run dev
   ```

4. **Build for production**
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
| Surprise Font | Click "Surprise" button | - |
| Change Font | Font dropdown menu | - |
| Adjust Size | Font size dropdown | - |

### Text Formatting

| Format | Shortcut | Button |
|--------|----------|---------|
| **Bold** | `Ctrl+B` | **B** |
| *Italic* | `Ctrl+I` | *I* |
| <u>Underline</u> | `Ctrl+U` | U |
| ~~Strikethrough~~ | - | ~~S~~ |


## 🏗️ Technical Architecture

### Project Structure
```
flowpad/
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

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request


## 📄 License

**MIT License** - See LICENSE file for details.

## 🙏 Acknowledgments

- **Freewrite**: Inspiration for distraction-free writing
- **Custom Fonts**: Aeonik, Baskervville, Instrument Serif, Neue Regrade, Patrick Hand
- **Phosphor Icons**: Beautiful, consistent iconography
- **Electron**: Cross-platform desktop framework
- **electronmon**: Development workflow enhancement
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
- [ ] Clickable links
- [ ] Tom Riddle Mode 

### Version History
- **v1.0.0**: Initial release with core features
- **v1.0.1**: Icon fix and improvements
- **Current**: Enhanced with custom fonts, Phosphor icons, categorized history, and surprise features

---

**Built because windows needs it** 