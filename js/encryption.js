/**
 * Encryption Module (using Web Crypto API - AES-GCM)
 *
 * Purpose: Provides functions for deriving cryptographic keys from passwords,
 *          generating salts, encrypting plaintext data using AES-GCM, and
 *          decrypting ciphertext. Also includes helper functions for Base64
 *          encoding/decoding required for storing binary crypto data (like salts, IVs)
 *          in text-based storage like Firestore.
 *
 * Security: Uses PBKDF2 for key derivation and AES-GCM for authenticated encryption.
 *           Relies on the browser's built-in Web Crypto API implementation.
 */

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password - The user's password.
 * @param {Uint8Array} salt - A unique salt for the user (should be stored).
 * @returns {Promise<CryptoKey>} The derived CryptoKey for AES-GCM.
 * @throws {Error} Throws an error if the Web Crypto API operations fail.
 */
async function deriveKey(password, salt) {
    // TextEncoder is used to convert the password string into a Uint8Array (UTF-8 bytes).
    const enc = new TextEncoder();
    // 1. Import the raw password bytes into a CryptoKey suitable for PBKDF2.
    // This step treats the password as the base material from which the actual key will be derived.
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",                     // Indicates the format of the key data is raw bytes.
        enc.encode(password),      // The password converted into a Uint8Array.
        { name: "PBKDF2" },        // Specifies the algorithm context for this key material.
        false,                     // `extractable` is false: the key material cannot be exported from the CryptoKey object.
        ["deriveKey"]              // Specifies the only permitted operation for this key material is key derivation.
    );

    // 2. Derive the actual encryption/decryption key using PBKDF2 algorithm.
    // PBKDF2 applies a pseudorandom function (like HMAC) along with salt and iterations
    // to the input password key material, producing a strong cryptographic key.
    return window.crypto.subtle.deriveKey(
        // PBKDF2 parameters:
        {
            name: "PBKDF2",            // The key derivation algorithm name.
            salt: salt,                // The unique per-user salt (Uint8Array). Prevents rainbow table attacks.
            iterations: 100000,        // The number of iterations. Higher numbers increase security but also derivation time. 100k is a reasonable starting point.
            hash: "SHA-256",           // The hash function to use internally within PBKDF2. SHA-256 is standard.
        },
        // Base key material:
        keyMaterial,               // The CryptoKey derived from the password in step 1.
        // Derived key algorithm and properties:
        { name: "AES-GCM", length: 256 }, // Specifies the desired algorithm (AES-GCM) and key length (256 bits) for the final derived key.
        // Derived key exportability:
        true,                      // `extractable` is true: Allows the derived key's raw bytes to be potentially exported (e.g., for debugging, though generally `false` is safer if not needed).
        // Derived key permitted usages:
        ["encrypt", "decrypt"]     // Specifies that the derived key can be used for both encryption and decryption operations.
    );
}

/**
 * Generates a random salt.
 * @param {number} length - Length of the salt in bytes (e.g., 16).
 * @returns {Uint8Array} The generated salt.
 */
function generateSalt(length = 16) {
    // `window.crypto.getRandomValues` is the standard browser API for generating
    // cryptographically secure random numbers/bytes.
    // It fills the provided TypedArray (here, a Uint8Array of the specified length)
    // with random values.
    return window.crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Encrypts data using AES-GCM.
 * @param {CryptoKey} key - The AES-GCM key derived via deriveKey.
 * @param {string} plaintext - The data to encrypt.
 * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>} Object containing IV and ciphertext.
 * @throws {Error} Throws an error if the encryption operation fails.
 */
async function encryptData(key, plaintext) {
    // TextEncoder converts the plaintext string into a Uint8Array of UTF-8 bytes.
    const enc = new TextEncoder();
    // Generate a random Initialization Vector (IV) for this specific encryption operation.
    // A 12-byte (96-bit) IV is recommended for AES-GCM for performance and security reasons.
    // CRITICAL: A unique IV MUST be generated for every encryption performed with the same key.
    // Reusing an IV with the same key severely compromises the security of AES-GCM.
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    // Perform the encryption using the Web Crypto API's encrypt function.
    const ciphertext = await window.crypto.subtle.encrypt(
        // Algorithm parameters for AES-GCM:
        {
            name: "AES-GCM", // Specify the AES-GCM algorithm.
            iv: iv,          // Provide the unique Initialization Vector generated above.
            // Optional: 'additionalData': AAD (Additional Authenticated Data) could be included here.
            // AAD is data that needs integrity protection but not confidentiality (e.g., metadata).
            // If used, the exact same AAD must be provided during decryption.
        },
        // The CryptoKey (derived using deriveKey) to use for encryption.
        key,
        // The plaintext data, converted to a Uint8Array.
        enc.encode(plaintext)
    );
    // Return an object containing both the generated IV and the resulting ciphertext (as an ArrayBuffer).
    // Both pieces of information are required for successful decryption later.
    // The IV does not need to be kept secret, just stored alongside the ciphertext.
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
        // Attempt to decrypt the ciphertext using the Web Crypto API's decrypt function.
        // It requires the same key and IV that were used during encryption.
        // AES-GCM automatically verifies the integrity of the data using an authentication tag
        // embedded within the ciphertext during encryption. If the data was tampered with,
        // or if the key/IV is incorrect, the decrypt operation will fail.
        const decrypted = await window.crypto.subtle.decrypt(
            // Algorithm parameters for AES-GCM decryption:
            {
                name: "AES-GCM", // Specify the AES-GCM algorithm.
                iv: iv,          // Provide the Initialization Vector used during encryption.
                // Optional: Provide the same 'additionalData' (AAD) here if it was used during encryption.
            },
            // The CryptoKey (derived using deriveKey) to use for decryption. Must match the encryption key.
            key,
            // The ArrayBuffer containing the ciphertext received from storage.
            ciphertext
        );
        // If decryption is successful, 'decrypted' will be an ArrayBuffer containing the original plaintext bytes.
        // TextDecoder is used to convert the decrypted bytes back into a UTF-8 string.
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (error) {
        // Log the specific error for debugging purposes.
        // Decryption failures often indicate an incorrect key (wrong password), incorrect IV,
        // or that the ciphertext was corrupted or tampered with.
        console.error("Decryption failed:", error);
        // Throw a generic, user-friendly error. Avoid leaking specific cryptographic details.
        throw new Error("Failed to decrypt data. Key might be incorrect or data corrupted.");
    }
}

// --- Base64 Helper Functions ---
// Firestore (and many other text-based storage systems like localStorage or JSON)
// cannot directly store raw binary data like ArrayBuffers or Uint8Arrays, which are
// produced by the Web Crypto API (e.g., salts, IVs, ciphertext).
// Base64 encoding provides a way to represent binary data using only printable ASCII characters.
// These functions convert between binary formats (ArrayBuffer/Uint8Array) and Base64 strings.

/**
 * Helper function to convert an ArrayBuffer or Uint8Array to a Base64 encoded string.
 * This is used before storing binary cryptographic data (salt, IV, ciphertext) in Firestore.
 *
 * @param {ArrayBuffer | Uint8Array} buffer - The binary data (e.g., from crypto operations) to encode.
 * @returns {string} The Base64 encoded string representation of the binary data.
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    // Ensure we are working with individual bytes using Uint8Array.
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    // Iterate through each byte and convert it to its corresponding character code.
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    // Use the built-in browser function `btoa` (binary-to-ASCII) to perform the Base64 encoding
    // on the resulting binary string.
    return window.btoa(binary);
}

/**
 * Helper function to convert a Base64 encoded string back into a Uint8Array.
 * This is used after retrieving Base64 encoded data (salt, IV, ciphertext) from Firestore,
 * before passing it to the Web Crypto API functions which expect binary formats.
 *
 * @param {string} base64 - The Base64 encoded string retrieved from storage.
 * @returns {Uint8Array} The decoded binary data as a Uint8Array.
 */
function base64ToUint8Array(base64) {
    // Use the built-in browser function `atob` (ASCII-to-binary) to decode the Base64 string
    // into a 'binary string' (where each character's code point represents a byte value).
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    // Create a Uint8Array with the same length as the binary string.
    const bytes = new Uint8Array(len);
    // Iterate through the binary string and get the character code (byte value) for each character,
    // assigning it to the corresponding index in the Uint8Array.
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    // Return the populated Uint8Array containing the original binary data.
    return bytes;
}

// --- Exports ---
// Make the core encryption/decryption functions and helper utilities available
// for other modules (like vault-logic.js, auth.js, script.js) to import and use.
export {
    deriveKey,            // Derives the main encryption key from password and salt.
    generateSalt,         // Generates a new random salt for key derivation.
    encryptData,          // Encrypts plaintext data using AES-GCM.
    decryptData,          // Decrypts AES-GCM ciphertext.
    arrayBufferToBase64,  // Helper to encode binary data (ArrayBuffer/Uint8Array) to Base64 string.
    base64ToUint8Array    // Helper to decode Base64 string back to Uint8Array.
};
