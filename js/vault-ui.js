/**
 * Vault UI Module
 *
 * Purpose: Handles all UI aspects related to vault management. This includes:
 *          - Rendering the list of vaults based on the decrypted cache.
 *          - Handling user interactions within the vault list (show password, edit, delete buttons).
 *          - Managing the display and interaction logic for the PIN request overlay.
 *          - Managing the display and interaction logic for the Edit Vault overlay.
 *          - Handling form submissions for adding and editing vaults.
 *          - Coordinating with `vault-logic.js` for data preparation, validation, and core logic.
 *          - Coordinating with `database.js` for saving/updating data in Firestore.
 *
 * Dependencies:
 *  - js/vault-logic.js: For accessing the decrypted vault cache, validating PINs, preparing data for DB, fetching/decrypting, and deletion logic.
 *  - js/database.js: For directly calling `addVault` and `updateVault` Firestore functions.
 *  - js/utils.js: For displaying notifications (`showNotification`).
 *  - js/auth.js: For getting the current user (`auth.currentUser`).
 *  - js/encryption.js: For crypto operations needed for Master Password decryption.
 */
// --- Module Imports ---
import { showNotification } from './utils.js';
import { auth } from './auth.js';
import {
    vaultsCache,
    vaultHasPin,
    validatePin,
    fetchAndDecryptVaults,
    addVaultWithHistory,
    editVaultWithHistory,
    deleteVault
} from './vault-logic.js';
// Import necessary crypto functions specifically for Master Password handling within UI
import { deriveKey, decryptData, base64ToUint8Array } from './encryption.js';


// ==================== STATE VARIABLES (UI specific) ====================
let vaultIdToEdit = null;
let currentVaultIdForPin = null;
let pinRequestCallback = null;
let pinActionType = null;
let currentVaultIdForMaster = null;
let masterPasswordCallback = null;

// NOTE: Removed top-level caching for Master Password elements due to errors.
// Will use getElementById directly within the functions.

// ==================== UI RENDERING ====================
import { renderVaultsUI } from './vault-ui/vault-render.js';

// ==================== PIN OVERLAY UI ====================
import { requestPinForAction, handlePinSubmit, handlePinCancel } from './vault-ui/pin-overlay.js';

// ==================== EDIT VAULT OVERLAY UI ====================
import { openEditVaultOverlay, handleEditVaultSubmit, handleEditVaultCancel } from './vault-ui/edit-vault-overlay.js';

// ==================== ADD VAULT FORM UI ====================
import { resetOptionalFields, handleAddVaultSubmit } from './vault-ui/add-vault-form.js';

// ==================== VAULT LIST EVENT HANDLING ====================
import { handleVaultActions as baseHandleVaultActions } from './vault-ui/vault-events.js';

// Wrap baseHandleVaultActions to add delete and view-master-button logic
function handleVaultActions(event) {
    baseHandleVaultActions(event);

    const target = event.target;
    const vaultItem = target.closest('.vault-item');
    if (!vaultItem || vaultItem.classList.contains('decryption-error')) return;

    const vaultId = vaultItem.dataset.vaultId;
    if (!vaultId) return;

    const vault = vaultsCache.find(v => v.id === vaultId);
    if (!vault) return;

    if (target.classList.contains('delete-button')) {
        const deleteAction = async () => {
            if (confirm("Are you sure you want to delete this vault? This action cannot be undone.")) {
                try {
                    if (vault.isMasterProtected) {
                        requestMasterPassword(vaultId, async () => {
                            console.log("Master Password verified for deletion of vault:", vaultId);
                            await deleteVault(vaultId);
                            showNotification('Vault deleted successfully.', 'success');
                            renderVaultsUI(vaultsCache);
                        });
                    } else {
                        requestPinForAction(vaultId, 'deleteVault', async () => {
                            await deleteVault(vaultId);
                            showNotification('Vault deleted successfully.', 'success');
                            renderVaultsUI(vaultsCache);
                        });
                    }
                } catch (error) {
                    console.error("Error deleting vault:", error);
                    showNotification(error.message || "Error deleting vault.", "error");
                }
            }
        };
        deleteAction();
    }
    else if (target.classList.contains('view-master-button')) {
        console.log("handleVaultActions: view-master-button clicked for vaultId:", vaultId);
        console.log(" - Checking overlay element before calling requestMasterPassword:", document.getElementById('master-password-request-overlay'));
        requestMasterPassword(vaultId, () => {
            console.log("Master Password verified for", vaultId, ". Checking for PIN before opening edit overlay.");
            if (vault.pin) {
                requestPinForAction(vaultId, 'editVault', () => {
                    openEditVaultOverlay(vaultId);
                });
            } else {
                openEditVaultOverlay(vaultId);
            }
        });
    }
}

// ==================== DISPLAY VAULTS (Trigger Function) ====================
async function displayVaults() {
    const container = document.getElementById('vaults-container');
    if (!container) return;
    container.innerHTML = '<p>Loading vaults...</p>';

    try {
        const currentVaults = await fetchAndDecryptVaults();
        renderVaultsUI(currentVaults);
    } catch (error) {
        console.error("Failed to display vaults:", error);
        showNotification(error.message || "Could not load vaults.", "error");
        container.innerHTML = `<p>Error loading vaults: ${error.message}. Please try again.</p>`;
    }
}


// ==================== EXPORTS ====================
export {
    displayVaults,
    handleAddVaultSubmit,
    handleEditVaultSubmit,
    handlePinSubmit,
    handlePinCancel,
    handleEditVaultCancel,
    handleVaultActions,
    resetOptionalFields,
    handleMasterPasswordSubmit, // Exported for script.js listener
    handleMasterPasswordCancel  // Exported for script.js listener
};

// ==================== MASTER PASSWORD PROMPT UI (NEW) ====================
function requestMasterPassword(vaultId, callback) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    if (!vault || !vault.isMasterProtected) {
        console.error("Cannot request Master Password: Vault not found or not protected.", vaultId);
        showNotification("Error: Cannot perform action on this vault.", "error");
        return;
    }

    currentVaultIdForMaster = vaultId;
    masterPasswordCallback = callback;

    // --- Get elements directly inside the function ---
    const overlay = document.getElementById('master-password-request-overlay');
    const titleSpan = document.getElementById('master-prompt-vault-title');
    const input = document.getElementById('master-password-input');
    const messageEl = document.getElementById('master-password-message');
    // --- END: Get elements directly inside the function ---

    // --- START: Add Detailed Logging ---
    console.log("requestMasterPassword: Checking elements...");
    console.log(" - Found overlay:", !!overlay);
    console.log(" - Found titleSpan:", !!titleSpan);
    console.log(" - Found input:", !!input);
    console.log(" - Found messageEl:", !!messageEl);
    // --- END: Add Detailed Logging ---

    if (overlay && titleSpan && input && messageEl) {
        titleSpan.textContent = vault.title || 'Untitled Vault';
        input.value = '';
        messageEl.classList.add('hidden');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        input.focus();
        // NOTE: Event listeners are handled statically in script.js
    } else {
        // Log which specific element was not found
        if (!overlay) console.error("Element not found: master-password-request-overlay");
        if (!titleSpan) console.error("Element not found: master-prompt-vault-title");
        if (!input) console.error("Element not found: master-password-input");
        if (!messageEl) console.error("Element not found: master-password-message");

        console.error("Master Password overlay elements (overlay, title, input, message) not found"); // Keep original error too
        showNotification("UI Error: Cannot request Master Password.", "error");
    }
}

async function handleMasterPasswordSubmit(event) {
    event.preventDefault();

    // Get elements directly inside the function
    const input = document.getElementById('master-password-input');
    const overlay = document.getElementById('master-password-request-overlay');
    const messageEl = document.getElementById('master-password-message');
    const submitButton = document.getElementById('submit-master-password-button');
    const enteredPassword = input?.value;

    if (!enteredPassword || !currentVaultIdForMaster) {
        showNotification("Please enter the Master Password.", "error");
        return;
    }

    const vault = vaultsCache.find(v => v.id === currentVaultIdForMaster);
    if (!vault || !vault.isMasterProtected || !vault.masterSalt || !vault.masterEncryptedPayload) {
        console.error("Master Password Submit: Vault data invalid or missing.", currentVaultIdForMaster);
        showNotification("Error: Could not process Master Password.", "error");
        handleMasterPasswordCancel();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Unlocking...';
    messageEl.classList.add('hidden');

    try {
        const masterSalt = base64ToUint8Array(vault.masterSalt);
        const masterKey = await deriveKey(enteredPassword, masterSalt);
        const iv = base64ToUint8Array(vault.masterEncryptedPayload.iv);
        const ciphertext = base64ToUint8Array(vault.masterEncryptedPayload.ciphertext);
        const decryptedPayloadString = await decryptData(masterKey, iv, ciphertext);
        const decryptedPayload = JSON.parse(decryptedPayloadString);

        console.log("Master Password decryption successful for vault:", currentVaultIdForMaster);
        vault.password = decryptedPayload.password;
        vault.pin = decryptedPayload.pin;
        // vault.isTemporarilyDecrypted = true; // Optional flag

        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        if (masterPasswordCallback) masterPasswordCallback();

    } catch (error) {
        console.error("Master Password decryption failed:", error);
        messageEl.textContent = "Incorrect Master Password or data corrupted.";
        messageEl.className = 'message error';
        messageEl.classList.remove('hidden');
        input.focus();
        input.select();
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Unlock';
    }
}

function handleMasterPasswordCancel() {
    // Get elements directly inside the function
    const overlay = document.getElementById('master-password-request-overlay');
    const input = document.getElementById('master-password-input');
    const messageEl = document.getElementById('master-password-message');

    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    if (input) input.value = '';
    if (messageEl) messageEl.classList.add('hidden');

    currentVaultIdForMaster = null;
    masterPasswordCallback = null;
}
