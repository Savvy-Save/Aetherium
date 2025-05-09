/**
 * Utility Module
 *
 * Purpose: Contains general-purpose helper functions used across different
 *          parts of the application, such as generating passwords and displaying
 *          temporary UI notifications.
 */

/**
 * Generates a random password string of a specified length.
 * Prioritizes using the cryptographically secure `window.crypto.getRandomValues` API
 * for randomness if available in the browser. Falls back to the less secure
 * `Math.random` if the Crypto API is not supported (and logs a warning).
 *
 * @param {number} [length=12] - The desired length of the generated password. Defaults to 12.
 * @returns {string} The randomly generated password string containing uppercase letters,
 *                   lowercase letters, numbers, and special symbols.
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
 * Displays a temporary notification message overlay at the top center of the screen.
 * The notification fades in, stays for a specified duration, and then fades out.
 * It's automatically removed from the DOM after fading out.
 *
 * @param {string} message - The text content to display in the notification.
 * @param {'success'|'error'} [type='success'] - Determines the notification's appearance (background color).
 *                                               Corresponds to CSS classes `.notification.success` or `.notification.error`.
 * @param {number} [duration=3000] - The time in milliseconds the notification should remain fully visible
 *                                   before starting its fade-out animation.
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

/**
 * Toggles the visibility of a password input field and updates the toggle button's icon.
 * @param {HTMLInputElement} passwordInput - The password input field element.
 * @param {HTMLElement} toggleButton - The button or span element used to toggle visibility.
 */
function togglePasswordVisibility(passwordInput, toggleButton) {
    if (!passwordInput || !toggleButton) return;
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleButton.textContent = "🙈"; // Or any other icon for "hide"
    } else {
        passwordInput.type = "password";
        toggleButton.textContent = "👁️"; // Or any other icon for "show"
    }
}

/**
 * Shows the loading overlay.
 */
function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

/**
 * Hides the loading overlay.
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// --- Exports ---
// Make the utility functions available for other modules to import.
export { showNotification, generatePassword, togglePasswordVisibility, showLoadingOverlay, hideLoadingOverlay };
