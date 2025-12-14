// ===== FULLSCREEN MANAGEMENT =====
// Handles fullscreen toggle functionality

import { focusEditor } from '../../utils/dom.js';

// Toggle fullscreen mode
export function toggleFullscreen() {
    const appContainer = document.querySelector('.app-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const editor = document.getElementById('editor');

    appContainer.classList.toggle('fullscreen-mode');

    if (appContainer.classList.contains('fullscreen-mode')) {
        fullscreenBtn.querySelector('span').textContent = 'Exit Fullscreen';

        // Request fullscreen API if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        fullscreenBtn.querySelector('span').textContent = 'Fullscreen';

        // Exit fullscreen API if available
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Adjust editor focus
    setTimeout(() => {
        focusEditor(editor);
    }, 100);
}

// Check if currently in fullscreen mode
export function isFullscreen() {
    return document.querySelector('.app-container').classList.contains('fullscreen-mode');
}

// Initialize fullscreen module
export function initFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Listen for ESC key to exit fullscreen
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isFullscreen()) {
            toggleFullscreen();
        }
    });
}
