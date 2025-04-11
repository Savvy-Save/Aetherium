/**
 * Utility module
 * Contains helper functions used throughout the app.
 */

/**
 * Generate a secure random password.
 * Uses crypto.getRandomValues if available, falls back to Math.random.
 * @param {number} length - Password length (default 12)
 * @returns {string} Generated password
 */
function generatePassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    const randomValues = new Uint32Array(length);

    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            password += charset[randomValues[i] % charset.length];
        }
    } else {
        console.warn("Crypto API not available, using Math.random() (less secure)");
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
    }
    return password;
}

/**
 * Show a notification message on the screen.
 * @param {string} message - Message text
 * @param {'success'|'error'} type - Notification type
 * @param {number} duration - Duration in ms (default 3000)
 */
function showNotification(message, type = 'success', duration = 3000) {
    const div = document.createElement('div');
    div.classList.add('notification', type);
    div.textContent = message;
    document.body.appendChild(div);

    div.style.opacity = 0;
    requestAnimationFrame(() => {
        div.style.transition = 'opacity 0.5s ease';
        div.style.opacity = 1;
    });

    setTimeout(() => {
        div.style.opacity = 0;
        div.addEventListener('transitionend', () => {
            if (div.parentNode) div.remove();
        });
        setTimeout(() => {
            if (div.parentNode) div.remove();
        }, 500);
    }, duration);
}

export { showNotification, generatePassword };
