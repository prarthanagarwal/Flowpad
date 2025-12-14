// ===== DROPDOWN MANAGEMENT =====
// Handles font family, formatting, and other dropdown menus

// Toggle font family dropdown
export function toggleFontDropdown() {
    const dropdown = document.getElementById('fontDropdownContent');
    dropdown.classList.toggle('show');
    // Close other dropdowns if open
    closeFontSizeDropdown();
    closeFormattingDropdown();
}

// Close font dropdown
export function closeFontDropdown() {
    const dropdown = document.getElementById('fontDropdownContent');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Font size dropdown (legacy - now sizes are in formatting dropdown)
export function toggleFontSizeDropdown() { }
export function closeFontSizeDropdown() { }

// Toggle formatting dropdown
export function toggleFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    dropdown.classList.toggle('show');
    // Close other dropdowns if open
    closeFontDropdown();
    closeFontSizeDropdown();
}

// Close formatting dropdown
export function closeFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Close all dropdowns
export function closeAllDropdowns() {
    closeFontDropdown();
    closeFontSizeDropdown();
    closeFormattingDropdown();
}

// Initialize dropdown event listeners
export function initDropdowns() {
    // Font dropdown
    const fontBtn = document.getElementById('fontBtn');
    if (fontBtn) {
        fontBtn.addEventListener('click', toggleFontDropdown);
    }
    
    // Formatting dropdown
    const formatBtn = document.getElementById('formatBtn');
    if (formatBtn) {
        formatBtn.addEventListener('click', toggleFormattingDropdown);
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.font-family-dropdown')) {
            closeFontDropdown();
        }
        if (!e.target.closest('.font-size-dropdown')) {
            closeFontSizeDropdown();
        }
        if (!e.target.closest('.formatting-dropdown')) {
            closeFormattingDropdown();
        }
    });
}
