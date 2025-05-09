/**
 * PIN Overlay UI Module
 * Handles the PIN request overlay logic for vault actions.
 */
import { vaultsCache, vaultHasPin, validatePin, getVaultById, editVaultWithHistory, fetchAndDecryptVaults } from '../vault-logic.js';
import { showNotification, togglePasswordVisibility } from '../utils.js';
import { reauthenticateUser } from '../auth.js';
import { displayVaults } from '../vault-ui.js'; // Corrected import: To refresh display

let currentVaultIdForPinReset = null; // Renamed for clarity in the new flow
let pinRequestCallback = null; // Original callback for successful PIN entry
let pinActionType = null; // Original action type

// DOM Elements for new overlays
let reauthOverlay, reauthForm, reauthPasswordInput, reauthMessage, cancelReauthButton;
let pinResetActionOverlay, pinResetActionTitle, removePinButton, setNewPinButton, setNewPinForm, newPinInput, confirmNewPinInput, cancelPinResetActionButton, pinResetActionMessage;

/**
 * Initializes DOM elements for the new PIN reset overlays.
 * Should be called once when the module loads or when script.js initializes UI.
 */
function initializePinResetElements() {
    reauthOverlay = document.getElementById('reauth-for-pin-reset-overlay');
    reauthForm = document.getElementById('reauth-for-pin-reset-form');
    reauthPasswordInput = document.getElementById('reauth-main-password');
    reauthMessage = document.getElementById('reauth-pin-reset-message');
    cancelReauthButton = document.getElementById('cancel-reauth-pin-reset-button');

    pinResetActionOverlay = document.getElementById('pin-reset-action-overlay');
    pinResetActionTitle = document.getElementById('pin-reset-action-title').querySelector('span');
    removePinButton = document.getElementById('remove-vault-pin-button');
    setNewPinButton = document.getElementById('set-new-vault-pin-button');
    setNewPinForm = document.getElementById('set-new-pin-form');
    newPinInput = document.getElementById('new-vault-pin');
    confirmNewPinInput = document.getElementById('confirm-new-vault-pin');
    cancelPinResetActionButton = document.getElementById('cancel-pin-reset-action-button');
    pinResetActionMessage = document.getElementById('pin-reset-action-message');

    if (reauthForm) {
        reauthForm.addEventListener('submit', handleReauthenticationForPinReset);
        const reauthToggle = reauthForm.querySelector('.password-toggle');
        if (reauthToggle) {
            reauthToggle.addEventListener('click', () => togglePasswordVisibility(reauthPasswordInput, reauthToggle));
        }
    }
    if (cancelReauthButton) cancelReauthButton.addEventListener('click', closeReauthOverlay);

    if (removePinButton) removePinButton.addEventListener('click', handleRemoveVaultPin);
    if (setNewPinButton) setNewPinButton.addEventListener('click', () => {
        setNewPinForm.classList.remove('hidden');
        setNewPinForm.style.display = 'block';
    });
    if (setNewPinForm) setNewPinForm.addEventListener('submit', handleSetNewVaultPin);
    if (cancelPinResetActionButton) cancelPinResetActionButton.addEventListener('click', closePinResetActionOverlay);

    // Add password toggle for new PIN form if elements exist
    const newPinToggle = document.getElementById('new-vault-pin')?.nextElementSibling;
    const confirmNewPinToggle = document.getElementById('confirm-new-vault-pin')?.nextElementSibling;

    if (newPinToggle && newPinInput && newPinToggle.classList.contains('password-toggle')) {
        newPinToggle.addEventListener('click', () => togglePasswordVisibility(newPinInput, newPinToggle));
    }
    if (confirmNewPinToggle && confirmNewPinInput && confirmNewPinToggle.classList.contains('password-toggle')) {
        confirmNewPinToggle.addEventListener('click', () => togglePasswordVisibility(confirmNewPinInput, confirmNewPinToggle));
    }
}
// Call initialization when script loads
document.addEventListener('DOMContentLoaded', initializePinResetElements);


let currentVaultIdForPin = null; // Original variable for PIN request

/**
 * Requests a PIN for a given vault action.
 * @param {string} vaultId
 * @param {string} actionType
 * @param {Function} callback
 */
function requestPinForAction(vaultId, actionType, callback) { // This is the original function
    const vault = vaultsCache.find(v => v.id === vaultId);
    if (!vault) {
        console.error("Vault not found in cache for PIN request:", vaultId);
        showNotification("Vault not found.", "error");
        return;
    }
    // If the vault is master-protected, this "Forgot PIN" flow won't apply to its master password.
    // It only applies if a separate PIN was set that's *not* the master password.
    // The vaultHasPin check correctly identifies if a non-master PIN exists.
    if (!vaultHasPin(vaultId) && !vault.isMasterProtected) { // Only proceed if there's a standard PIN to forget
        if (callback) callback();
        return;
    }
     if (vault.isMasterProtected && !vaultHasPin(vaultId)) {
        // If it's master protected AND has no separate PIN, the "forgot" link shouldn't apply to the master password itself via this flow.
        // The forgot link should ideally only be active for standard PINs.
        // For now, we let it proceed, but the reset logic will clarify it's for the item's PIN.
    }


    currentVaultIdForPin = vaultId; // Keep track for original PIN submission
    pinActionType = actionType;     // Keep track for original PIN submission
    pinRequestCallback = callback;  // Keep track for original PIN submission

    const overlay = document.getElementById('pin-request-overlay');
    const input = document.getElementById('pin-input');
    const forgotPinLink = document.getElementById('forgot-vault-pin-link');

    if (overlay && input && forgotPinLink) {
        input.value = '';
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        input.focus();

        // Add event listener for the forgot PIN link if not already added
        // It's safer to remove any existing listener before adding a new one to prevent duplicates
        forgotPinLink.removeEventListener('click', handleForgotVaultPin);
        forgotPinLink.addEventListener('click', handleForgotVaultPin);

    } else {
        console.error("PIN overlay/input/forgot link not found");
        showNotification("UI Error: Cannot request PIN.", "error");
    }
}

/**
 * Handles the "Forgot PIN/Password" link click.
 */
async function handleForgotVaultPin(event) {
    event.preventDefault();
    if (!currentVaultIdForPin) {
        showNotification("No vault selected for PIN recovery.", "error");
        return;
    }

    // This is the original PIN request overlay, not the new ones.
    const originalPinOverlay = document.getElementById('pin-request-overlay');
    if (originalPinOverlay) {
        originalPinOverlay.classList.add('hidden');
        originalPinOverlay.style.display = 'none';
    }
    // Store the vault ID for the reset process
    currentVaultIdForPinReset = currentVaultIdForPin; // Use the ID from the active PIN request

    const vault = getVaultById(currentVaultIdForPinReset);
    if (!vault) {
        showNotification("Vault details not found for PIN reset.", "error");
        return;
    }
    if (vault.isMasterProtected) {
        showNotification("PIN reset for Master Password protected items must be handled differently. This flow is for standard PINs.", "warning", 6000);
        // Optionally, you could prevent opening the reauth dialog here if it's master protected
        // and you decide this flow *only* applies to non-master-protected PINs.
        // For now, let it proceed, but the options later will be limited.
    }


    // Show the re-authentication overlay
    if (reauthOverlay && reauthPasswordInput) {
        reauthPasswordInput.value = '';
        reauthMessage.textContent = '';
        reauthMessage.classList.add('hidden');
        reauthOverlay.classList.remove('hidden');
        reauthOverlay.style.display = 'flex';
        reauthPasswordInput.focus();
    } else {
        console.error("Re-authentication overlay not found.");
        showNotification("UI Error: Cannot initiate PIN reset.", "error");
    }
}

async function handleReauthenticationForPinReset(event) {
    event.preventDefault();
    if (!reauthPasswordInput || !reauthMessage) return;

    const password = reauthPasswordInput.value;
    if (!password) {
        reauthMessage.textContent = "Please enter your main account password.";
        reauthMessage.classList.remove('hidden');
        return;
    }

    try {
        await reauthenticateUser(password); // From auth.js
        reauthMessage.textContent = "Re-authentication successful.";
        reauthMessage.classList.remove('hidden');
        reauthMessage.classList.add('success'); // Assuming you have a .success class
        
        setTimeout(() => {
            closeReauthOverlay();
            openPinResetActionOverlay();
        }, 1000);

    } catch (error) {
        console.error("Re-authentication failed:", error);
        reauthMessage.textContent = error.message || "Re-authentication failed. Please try again.";
        reauthMessage.classList.remove('hidden');
        reauthMessage.classList.remove('success');
        reauthPasswordInput.focus();
    }
}

function closeReauthOverlay() {
    if (reauthOverlay && reauthPasswordInput && reauthMessage) {
        reauthOverlay.classList.add('hidden');
        reauthOverlay.style.display = 'none';
        reauthPasswordInput.value = '';
        reauthMessage.textContent = '';
        reauthMessage.classList.add('hidden');
    }
}

function openPinResetActionOverlay() {
    if (!pinResetActionOverlay || !currentVaultIdForPinReset || !pinResetActionTitle) return;

    const vault = getVaultById(currentVaultIdForPinReset);
    if (!vault) {
        showNotification("Vault not found.", "error");
        closePinResetActionOverlay();
        return;
    }

    pinResetActionTitle.textContent = vault.title;
    pinResetActionMessage.textContent = '';
    pinResetActionMessage.classList.add('hidden');
    setNewPinForm.classList.add('hidden');
    setNewPinForm.style.display = 'none';
    newPinInput.value = '';
    confirmNewPinInput.value = '';

    // If the vault is master-protected, disable PIN modification options
    // as the PIN (if any) is part of the master-encrypted payload.
    // This flow is primarily for non-master-protected PINs.
    if (vault.isMasterProtected) {
        removePinButton.disabled = true;
        setNewPinButton.disabled = true;
        pinResetActionMessage.textContent = "This vault is Master Password protected. Its PIN cannot be reset or removed through this process.";
        pinResetActionMessage.classList.remove('hidden');
    } else {
        removePinButton.disabled = false;
        setNewPinButton.disabled = false;
    }


    pinResetActionOverlay.classList.remove('hidden');
    pinResetActionOverlay.style.display = 'flex';
}

function closePinResetActionOverlay() {
    if (pinResetActionOverlay) {
        pinResetActionOverlay.classList.add('hidden');
        pinResetActionOverlay.style.display = 'none';
    }
    currentVaultIdForPinReset = null; // Clear the vault ID for reset
}

async function handleRemoveVaultPin() {
    if (!currentVaultIdForPinReset || !pinResetActionMessage) return;

    const vault = getVaultById(currentVaultIdForPinReset);
    if (!vault || vault.isMasterProtected) { // Double check it's not master protected here
        showNotification("Cannot remove PIN for this vault type or vault not found.", "error");
        pinResetActionMessage.textContent = "Cannot remove PIN for this vault type.";
        pinResetActionMessage.classList.remove('hidden');
        return;
    }

    try {
        // Prepare data for update: effectively setting PIN to null
        const updatedVaultData = { ...vault, pin: null };
        // We need to pass the original decrypted vault for comparison if editVaultWithHistory expects it
        // For simplicity here, we assume editVaultWithHistory can handle `pin: null` to mean removal.
        // Or, more robustly, vault-logic.js should have a specific function for updating just the PIN.
        // For now, we'll construct the data as if we are editing.
        
        // The `editVaultWithHistory` expects the full plaintext data.
        // We need to ensure the password field is correctly handled.
        // If the original vault had a password, we need to include it.
        const dataToSave = {
            title: vault.title,
            username: vault.username,
            email: vault.email,
            password: vault.password, // Keep original password
            imageData: vault.imageData, // Keep original image data
            pin: null, // Set PIN to null
            // isMasterProtected should remain as is, but this flow targets non-master-protected PINs
        };

        await editVaultWithHistory(currentVaultIdForPinReset, dataToSave, vault);

        pinResetActionMessage.textContent = "PIN successfully removed.";
        pinResetActionMessage.classList.remove('hidden');
        pinResetActionMessage.classList.add('success');
        showNotification("Vault PIN removed successfully!", "success");
        
        await fetchAndDecryptVaults(); // Refresh cache
        displayVaults(); // Corrected function call: Refresh UI

        setTimeout(() => {
            closePinResetActionOverlay();
        }, 1500);

    } catch (error) {
        console.error("Error removing vault PIN:", error);
        pinResetActionMessage.textContent = error.message || "Failed to remove PIN.";
        pinResetActionMessage.classList.remove('hidden');
        pinResetActionMessage.classList.remove('success');
        showNotification("Error removing PIN: " + error.message, "error");
    }
}

async function handleSetNewVaultPin(event) {
    event.preventDefault();
    if (!currentVaultIdForPinReset || !newPinInput || !confirmNewPinInput || !pinResetActionMessage) return;

    const newPin = newPinInput.value;
    const confirmPin = confirmNewPinInput.value;

    if (!newPin || !confirmPin) {
        pinResetActionMessage.textContent = "Please enter and confirm the new PIN.";
        pinResetActionMessage.classList.remove('hidden');
        return;
    }
    if (newPin !== confirmPin) {
        pinResetActionMessage.textContent = "New PINs do not match.";
        pinResetActionMessage.classList.remove('hidden');
        return;
    }
    if (!/^\d{4,16}$/.test(newPin)) {
        pinResetActionMessage.textContent = "PIN must be 4-16 digits.";
        pinResetActionMessage.classList.remove('hidden');
        return;
    }

    const vault = getVaultById(currentVaultIdForPinReset);
     if (!vault || vault.isMasterProtected) { // Double check
        showNotification("Cannot set new PIN for this vault type or vault not found.", "error");
        pinResetActionMessage.textContent = "Cannot set new PIN for this vault type.";
        pinResetActionMessage.classList.remove('hidden');
        return;
    }

    try {
        const dataToSave = {
            title: vault.title,
            username: vault.username,
            email: vault.email,
            password: vault.password, // Keep original password
            imageData: vault.imageData, // Keep original image data
            pin: newPin, // Set new PIN
        };

        await editVaultWithHistory(currentVaultIdForPinReset, dataToSave, vault);

        pinResetActionMessage.textContent = "New PIN successfully set.";
        pinResetActionMessage.classList.remove('hidden');
        pinResetActionMessage.classList.add('success');
        showNotification("Vault PIN updated successfully!", "success");

        await fetchAndDecryptVaults(); // Refresh cache
        displayVaults(); // Corrected function call: Refresh UI

        setTimeout(() => {
            closePinResetActionOverlay();
        }, 1500);

    } catch (error) {
        console.error("Error setting new vault PIN:", error);
        pinResetActionMessage.textContent = error.message || "Failed to set new PIN.";
        pinResetActionMessage.classList.remove('hidden');
        pinResetActionMessage.classList.remove('success');
        showNotification("Error setting new PIN: " + error.message, "error");
    }
}


/**
 * Handles PIN submission from the original overlay.
 */
function handlePinSubmit() { // This is the original function
    const input = document.getElementById('pin-input');
    const overlay = document.getElementById('pin-request-overlay');
    const enteredPin = input.value;

    if (validatePin(enteredPin, currentVaultIdForPin)) { // currentVaultIdForPin is for the original PIN prompt
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        if (pinRequestCallback) pinRequestCallback();
    } else {
        showNotification('Incorrect PIN. Please try again.', 'error');
        input.focus();
    }
    input.value = '';
    // Clear original PIN request state, not the reset state
    currentVaultIdForPin = null;
    pinRequestCallback = null;
    pinActionType = null;
}

/**
 * Handles cancellation of the original PIN overlay.
 */
function handlePinCancel() { // This is the original function
    const overlay = document.getElementById('pin-request-overlay');
    const input = document.getElementById('pin-input');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    if (input) input.value = '';
    // Clear original PIN request state
    currentVaultIdForPin = null;
    pinRequestCallback = null;
    pinActionType = null;
}

// Export original functions and the new entry point for "forgot PIN"
export { requestPinForAction, handlePinSubmit, handlePinCancel, handleForgotVaultPin, initializePinResetElements };
