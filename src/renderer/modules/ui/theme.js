// ===== THEME MANAGEMENT =====
// Handles light/dark theme toggling and persistence

import { settings, setSettings } from '../../state.js';

// Toggle between light and dark themes
export function toggleTheme() {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    setSettings({ theme: newTheme });
    
    document.body.className = newTheme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    
    // Update title bar colors
    window.electronAPI.updateTitleBarTheme(newTheme);
    
    // Save settings
    saveThemeSettings();
}

// Update theme button text and icon
export function updateThemeButton() {
    const themeBtn = document.getElementById('themeBtn');
    if (!themeBtn) return;
    
    const span = themeBtn.querySelector('span');
    const icon = themeBtn.querySelector('i');
    
    if (settings.theme === 'light') {
        if (span) span.textContent = 'Dark Mode';
        themeBtn.setAttribute('title', 'Switch to Dark Mode');
        if (icon) icon.className = 'ph ph-moon';
    } else {
        if (span) span.textContent = 'Light Mode';
        themeBtn.setAttribute('title', 'Switch to Light Mode');
        if (icon) icon.className = 'ph ph-sun';
    }
}

// Apply theme from settings
export function applyTheme() {
    document.body.className = settings.theme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    
    // Update title bar theme on startup
    window.electronAPI.updateTitleBarTheme(settings.theme);
}

// Save theme settings
async function saveThemeSettings() {
    try {
        await window.electronAPI.saveAppSettings(settings);
    } catch (error) {
        console.error('Error saving theme settings:', error);
    }
}

// Initialize theme module
export function initTheme() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    applyTheme();
}
