/**
 * Vault Core Logic Module
 *
 * Purpose: Manages the core state and logic related to user vaults, separate from UI concerns.
 *          Handles the in-memory cache of *decrypted* vaults, manages the session encryption key,
 *          validates PINs, prepares vault data for saving/updating (including encryption),
 *          fetches vault data from the database and decrypts it, and handles vault deletion logic.
 *
 * Dependencies:
 *  - js/auth.js: To get the current user's ID.
 *  - js/database.js: To interact with Firestore for vault CRUD operations.
 *  - js/encryption.js: To perform encryption/decryption and Base64 conversions.
 */
import { auth } from './auth.js';
import { getVaults, addVault, updateVault, deleteVaultDoc, addHistory } from './database.js';
import { encryptData, decryptData, arrayBufferToBase64, base64ToUint8Array, generateSalt, deriveKey } from './encryption.js';
import { showLoadingOverlay, hideLoadingOverlay } from './utils.js';

// ==================== STATE VARIABLES ====================

/**
 * @type {Array<Object>}
 * In-memory cache holding the user's vaults *after* they have been fetched
 * from Firestore and their sensitive fields (password, pin) have been decrypted.
 * This cache is used for quick access by the UI and for PIN validation.
 * It is cleared on logout or if the encryption key becomes unavailable.
 */
let vaultsCache = [];

/**
 * @type {CryptoKey | null}
 * Holds the AES-GCM CryptoKey derived from the user's password during a
 * successful login. This key is essential for encrypting data before saving
 * and decrypting data after fetching. It's kept only in memory for the session.
 */
let currentEncryptionKey = null;

// ==================== ENCRYPTION KEY MANAGEMENT ====================

function setVaultEncryptionKey(key) {
    currentEncryptionKey = key;
    console.log("Vault logic module encryption key set.");
    if (!key) {
        vaultsCache = [];
        console.log("Vault cache cleared due to encryption key removal.");
    }
}

// ==================== PIN LOGIC ====================

function vaultHasPin(vaultId) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    return !!vault && vault.pin !== null && vault.pin !== "" && vault.pin !== undefined;
}

function validatePin(enteredPin, vaultId) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    return !!vault && vault.pin === enteredPin;
}

// ==================== DATA FETCHING & DECRYPTION ====================

async function fetchAndDecryptVaults() {
    showLoadingOverlay();
    let rawVaults = [];
    let decryptedVaults = [];
    const user = auth.currentUser;

    if (!user) {
        hideLoadingOverlay();
        throw new Error("User not logged in. Cannot fetch vaults.");
    }
    if (!currentEncryptionKey) {
        hideLoadingOverlay();
        throw new Error("Encryption key not available. Cannot decrypt vaults.");
    }

    console.log("Fetching and decrypting vaults...");
    try {
        rawVaults = await getVaults(user.uid);

        for (const vault of rawVaults) {
            let decryptedPassword = null;
            let decryptedPin = null;
        let decryptionErrorOccurred = false;

        if (vault.isMasterProtected) {
            console.log(`Vault ${vault.id} is Master Protected. Skipping initial decryption.`);
            decryptedVaults.push({
                ...vault,
                password: null,
                pin: null,
                encryptedPassword: undefined,
                encryptedPin: undefined,
            });
            continue;
        }

        try {
            if (vault.encryptedPassword && vault.encryptedPassword.iv && vault.encryptedPassword.ciphertext) {
                const iv = base64ToUint8Array(vault.encryptedPassword.iv);
                const ciphertext = base64ToUint8Array(vault.encryptedPassword.ciphertext);
                decryptedPassword = await decryptData(currentEncryptionKey, iv, ciphertext);
            } else {
                decryptedPassword = null;
            }

            if (vault.encryptedPin && vault.encryptedPin.iv && vault.encryptedPin.ciphertext) {
                const iv = base64ToUint8Array(vault.encryptedPin.iv);
                const ciphertext = base64ToUint8Array(vault.encryptedPin.ciphertext);
                decryptedPin = await decryptData(currentEncryptionKey, iv, ciphertext);
            } else {
                decryptedPin = null;
            }

            decryptedVaults.push({
                ...vault,
                password: decryptedPassword,
                pin: decryptedPin,
                encryptedPassword: undefined,
                encryptedPin: undefined,
            });

        } catch (decryptionError) {
            console.error(`Failed to decrypt vault ${vault.id}:`, decryptionError);
            decryptionErrorOccurred = true;
            decryptedVaults.push({
                ...vault,
                title: vault.title + " (Decryption Failed)",
                password: null,
                pin: null,
                decryptionError: true,
                encryptedPassword: undefined,
                encryptedPin: undefined,
            });
        }
    }

    vaultsCache = decryptedVaults.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    console.log("Vaults fetched and decrypted. Cache updated:", vaultsCache.length, "items.");
    return vaultsCache;
    } catch (error) {
        console.error("Error in fetchAndDecryptVaults:", error);
        // vaultsCache will remain as it was or empty if this is the first load
        throw error; // Re-throw the error to be handled by the caller
    } finally {
        hideLoadingOverlay();
    }
}

// ==================== DATA PREPARATION FOR SAVE/UPDATE ====================
// Internal helper, not exported
async function prepareAddVaultData(plaintextData) {
    showLoadingOverlay();
    try {
        if (!plaintextData.isMasterProtected && !currentEncryptionKey) {
            throw new Error("Session encryption key not available. Cannot prepare vault data.");
        }
        if (plaintextData.isMasterProtected && !plaintextData.masterPassword) {
            throw new Error("Master Password is required but missing for protected vault item.");
        }

        let dataToSave = {
        title: plaintextData.title,
        username: plaintextData.username || null,
        email: plaintextData.email || null,
        imageData: plaintextData.imageData || null,
        isMasterProtected: plaintextData.isMasterProtected,
        encryptedPassword: null,
        encryptedPin: null,
        masterSalt: null,
        masterEncryptedPayload: null,
    };

    try {
        if (plaintextData.isMasterProtected) {
            console.log("Preparing data with Master Password protection.");
            const masterSalt = generateSalt();
            dataToSave.masterSalt = arrayBufferToBase64(masterSalt);
            const masterKey = await deriveKey(plaintextData.masterPassword, masterSalt);
            const sensitivePayload = JSON.stringify({
                password: plaintextData.password,
                pin: plaintextData.pin
            });
            const encryptedPayload = await encryptData(masterKey, sensitivePayload);
            dataToSave.masterEncryptedPayload = {
                iv: arrayBufferToBase64(encryptedPayload.iv),
                ciphertext: arrayBufferToBase64(encryptedPayload.ciphertext)
            };
            dataToSave.encryptedPassword = null;
            dataToSave.encryptedPin = null;
        } else {
            console.log("Preparing data with standard session key protection.");
            if (plaintextData.password) {
                const encryptedPass = await encryptData(currentEncryptionKey, plaintextData.password);
                dataToSave.encryptedPassword = {
                    iv: arrayBufferToBase64(encryptedPass.iv),
                    ciphertext: arrayBufferToBase64(encryptedPass.ciphertext)
                };
            }
            if (plaintextData.pin) {
                const encryptedPin = await encryptData(currentEncryptionKey, plaintextData.pin);
                dataToSave.encryptedPin = {
                    iv: arrayBufferToBase64(encryptedPin.iv),
                    ciphertext: arrayBufferToBase64(encryptedPin.ciphertext)
                };
            }
            dataToSave.masterSalt = null;
            dataToSave.masterEncryptedPayload = null;
        }
        return dataToSave;
    } catch (error) { // This is the inner catch for encryption logic
        console.error("Error preparing vault data for saving:", error);
        if (plaintextData.isMasterProtected && error instanceof Error && error.message.includes("deriveKey")) {
             throw new Error("Failed to derive key from Master Password.");
        } else if (plaintextData.isMasterProtected) {
             throw new Error("Failed to encrypt data with Master Password.");
         } else {
             throw new Error("Failed to encrypt vault data using session key.");
        }
    } // End of inner try-catch for encryption logic
    } catch (error) { // Outer catch for the main function logic and initial checks
        console.error("Error in prepareAddVaultData:", error);
        throw error; // Re-throw the error to be handled by the caller
    } finally { // Outer finally
        hideLoadingOverlay();
    }
}

async function addVaultWithHistory(plaintextData) {
    showLoadingOverlay();
    const user = auth.currentUser;
    if (!user) {
        hideLoadingOverlay();
        throw new Error("User not logged in. Cannot add vault.");
    }
    try {
        const dataToSave = await prepareAddVaultData(plaintextData); // This already handles its own overlay
        const vaultId = await addVault(user.uid, dataToSave);
        await addHistory(user.uid, {
            action: "created",
            vaultId,
            vaultTitle: plaintextData.title || "",
        });
        return vaultId;
    } catch (error) {
        console.error("Error in addVaultWithHistory:", error);
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

async function editVaultWithHistory(vaultId, updatedPlaintextData, originalDecryptedVault) {
    showLoadingOverlay();
    const user = auth.currentUser;
    if (!user) {
        hideLoadingOverlay();
        throw new Error("User not logged in. Cannot edit vault.");
    }
    try {
        const dataToUpdate = await prepareEditVaultData(updatedPlaintextData, originalDecryptedVault); // This already handles its own overlay
        await updateVault(user.uid, vaultId, dataToUpdate);
        await addHistory(user.uid, {
            action: "edited",
            vaultId,
            vaultTitle: updatedPlaintextData.title || "",
        });
    } catch (error) {
        console.error("Error in editVaultWithHistory:", error);
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

// Internal helper, not exported
async function prepareEditVaultData(updatedPlaintextData, originalDecryptedVault) {
    showLoadingOverlay();
    try {
        if (!currentEncryptionKey) {
            throw new Error("Encryption key not available. Cannot prepare vault data.");
        }
        if (!originalDecryptedVault) {
            throw new Error("Original vault data missing for comparison.");
        }

        let dataToUpdate = {};
    dataToUpdate.title = updatedPlaintextData.title;
    dataToUpdate.username = updatedPlaintextData.username || null;
    dataToUpdate.email = updatedPlaintextData.email || null;
    if (updatedPlaintextData.imageData !== undefined) {
         dataToUpdate.imageData = updatedPlaintextData.imageData;
    }

    try {
        if (updatedPlaintextData.password && updatedPlaintextData.password !== originalDecryptedVault.password) {
            console.log("Password changed, encrypting new password.");
            const encryptedPass = await encryptData(currentEncryptionKey, updatedPlaintextData.password);
            dataToUpdate.encryptedPassword = {
                iv: arrayBufferToBase64(encryptedPass.iv),
                ciphertext: arrayBufferToBase64(encryptedPass.ciphertext)
            };
        }
        if (updatedPlaintextData.pin !== originalDecryptedVault.pin) {
            if (updatedPlaintextData.pin) {
                console.log("PIN changed or added, encrypting new PIN.");
                const encryptedPin = await encryptData(currentEncryptionKey, updatedPlaintextData.pin);
                dataToUpdate.encryptedPin = {
                    iv: arrayBufferToBase64(encryptedPin.iv),
                    ciphertext: arrayBufferToBase64(encryptedPin.ciphertext)
                };
            } else {
                console.log("PIN removed.");
                dataToUpdate.encryptedPin = null;
            }
        }
        return dataToUpdate;
    } catch (error) { // This is the inner catch for encryption logic
        console.error("Error encrypting vault data for update:", error);
        throw new Error("Failed to encrypt vault data for update.");
    } // End of inner try-catch for encryption logic
    } catch (error) { // Outer catch for the main function logic and initial checks
        console.error("Error in prepareEditVaultData:", error);
        throw error; // Re-throw the error to be handled by the caller
    } finally { // Outer finally
        hideLoadingOverlay();
    }
}

// ==================== VAULT DELETION ====================

async function deleteVault(vaultId) {
    showLoadingOverlay();
    const user = auth.currentUser;
    if (!user) {
        hideLoadingOverlay();
        throw new Error("User not logged in. Cannot delete vault.");
    }
    const vault = vaultsCache.find(v => v.id === vaultId);
    try {
        await deleteVaultDoc(user.uid, vaultId);
        vaultsCache = vaultsCache.filter(v => v.id !== vaultId);
        await addHistory(user.uid, {
            action: "deleted",
            vaultId,
            vaultTitle: vault ? vault.title : "",
        });
        console.log("Vault deleted and history logged:", vaultId);
    } catch (error) {
        console.error("Error deleting vault:", error);
        throw new Error(error.message || "Error deleting vault.");
    } finally {
        hideLoadingOverlay();
    }
}

// ==================== HELPER FUNCTIONS ====================
/**
 * Retrieves a vault from the cache by its ID.
 * @param {string} vaultId The ID of the vault to retrieve.
 * @returns {Object | undefined} The vault object if found, otherwise undefined.
 */
function getVaultById(vaultId) {
    return vaultsCache.find(v => v.id === vaultId);
}

// ==================== EXPORTS ====================
export {
    vaultsCache,
    setVaultEncryptionKey,
    vaultHasPin,
    validatePin,
    fetchAndDecryptVaults,
    addVaultWithHistory,
    editVaultWithHistory,
    deleteVault,
    getVaultById, // Export the new function
    decryptData // Re-export decryptData from encryption.js
};
