// Derive the UI from the browser's fullscreen state, including native Escape exits.
export async function toggleFullscreen() {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
    } catch (error) {
        console.error('Fullscreen failed:', error);
    }
}

export function isFullscreen() {
    return !!document.fullscreenElement;
}

export function initFullscreen() {
    const button = document.getElementById('fullscreenBtn');
    button.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
        document.querySelector('.app-container').classList.toggle('fullscreen-mode', isFullscreen());
        button.querySelector('span').textContent = isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen';
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isFullscreen()) document.exitFullscreen();
    });
}
