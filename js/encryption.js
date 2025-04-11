// Encryption module using Web Crypto API (AES-GCM)

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password - The user's password.
 * @param {Uint8Array} salt - A unique salt for the user (should be stored).
 * @returns {Promise<CryptoKey>} The derived CryptoKey for AES-GCM.
 */
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    // Use PBKDF2 to derive the AES key
    // Iterations should be high (e.g., 100000 or more)
    // Salt should be unique per user, at least 16 bytes
    // Key length 256 bits (32 bytes) for AES-256
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true, // Key is extractable (false is generally better if not needed)
        ["encrypt", "decrypt"]
    );
}

/**
 * Generates a random salt.
 * @param {number} length - Length of the salt in bytes (e.g., 16).
 * @returns {Uint8Array} The generated salt.
 */
function generateSalt(length = 16) {
    return window.crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Encrypts data using AES-GCM.
 * @param {CryptoKey} key - The AES-GCM key derived via deriveKey.
 * @param {string} plaintext - The data to encrypt.
 * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>} Object containing IV and ciphertext.
 */
async function encryptData(key, plaintext) {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        enc.encode(plaintext)
    );
    return { iv, ciphertext };
}

/**
 * Decrypts data using AES-GCM.
 * @param {CryptoKey} key - The AES-GCM key derived via deriveKey.
 * @param {Uint8Array} iv - The Initialization Vector used during encryption.
 * @param {ArrayBuffer} ciphertext - The encrypted data.
 * @returns {Promise<string>} The original plaintext data.
 * @throws {Error} If decryption fails (e.g., wrong key, tampered data).
 */
async function decryptData(key, iv, ciphertext) {
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            ciphertext
        );
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt data. Key might be incorrect or data corrupted.");
    }
}

/**
 * Helper function to convert ArrayBuffer to Base64 string for storage.
 * @param {ArrayBuffer} buffer
 * @returns {string} Base64 encoded string.
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Helper function to convert Base64 string back to Uint8Array.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}


export {
    deriveKey,
    generateSalt,
    encryptData,
    decryptData,
    arrayBufferToBase64,
    base64ToUint8Array
};
