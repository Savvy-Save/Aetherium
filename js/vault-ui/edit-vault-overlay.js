/**
 * Edit Vault Overlay UI Module
 * Handles the logic for editing vaults via the overlay.
 */

import { vaultsCache, validatePin, fetchAndDecryptVaults, editVaultWithHistory } from '../vault-logic.js';
import { showNotification } from '../utils.js';
import { auth } from '../auth.js';
import { renderVaultsUI } from './vault-render.js';

let vaultIdToEdit = null;

/**
 * Opens the edit vault overlay for a given vault.
 * @param {string} vaultId
 */
function openEditVaultOverlay(vaultId) {
    vaultIdToEdit = vaultId;
    const vault = vaultsCache.find(v => v.id === vaultId);
    const overlay = document.getElementById('edit-vault-overlay');
    const verifySection = document.getElementById('edit-pin-verify-section');
    const usePinCheckbox = document.getElementById('edit-use-pin');
    const pinField = document.getElementById('edit-pin-field');
    const form = document.getElementById('edit-vault-form');

    if (!vault || !overlay || !verifySection || !usePinCheckbox || !pinField || !form) {
        console.error("Could not open edit overlay - elements missing");
        showNotification("Error: Could not open edit form.", "error");
        return;
    }

    document.getElementById('edit-vault-title').value = vault.title || '';
    document.getElementById('edit-vault-username').value = vault.username || '';
    document.getElementById('edit-vault-email').value = vault.email || '';
    document.getElementById('edit-vault-password').value = vault.password || '';
    document.getElementById('edit-vault-pin').value = vault.pin || '';
    document.getElementById('edit-vault-image').value = '';
    document.getElementById('edit-verify-pin').value = '';

    const hasPin = !!vault.pin;
    usePinCheckbox.checked = hasPin;
    pinField.classList.toggle('hidden', !hasPin);
    verifySection.classList.toggle('hidden', !hasPin);

    // Ensure listener is correctly attached (handle potential re-cloning issues)
    const currentUsePinCheckbox = document.getElementById('edit-use-pin');
    const newUsePinCheckbox = currentUsePinCheckbox.cloneNode(true);
    currentUsePinCheckbox.parentNode.replaceChild(newUsePinCheckbox, currentUsePinCheckbox);
    newUsePinCheckbox.addEventListener('change', () => {
        const currentPinField = document.getElementById('edit-pin-field');
        const currentVerifySection = document.getElementById('edit-pin-verify-section');
        currentPinField.classList.toggle('hidden', !newUsePinCheckbox.checked);
        currentVerifySection.classList.toggle('hidden', !newUsePinCheckbox.checked);
        if (!newUsePinCheckbox.checked) {
             document.getElementById('edit-vault-pin').value = '';
             document.getElementById('edit-verify-pin').value = '';
        }
    });

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

/**
 * Handles the submission of the edit vault form.
 * @param {Event} event
 */
async function handleEditVaultSubmit(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || vaultIdToEdit === null) return;

    const originalVault = vaultsCache.find(v => v.id === vaultIdToEdit);
    if (!originalVault) return;

    const form = document.getElementById('edit-vault-form');
    const submitButton = form.querySelector('button[type="submit"]');
    const verifyPinInput = document.getElementById('edit-verify-pin');
    const usePinCheckbox = document.getElementById('edit-use-pin');
    const newPinInput = document.getElementById('edit-vault-pin');
    const imageInput = document.getElementById('edit-vault-image');
    const overlay = document.getElementById('edit-vault-overlay');

    const needsPinVerification = !!originalVault.pin && usePinCheckbox.checked;

    if (needsPinVerification && !validatePin(verifyPinInput.value, vaultIdToEdit)) {
        showNotification('Incorrect current PIN. Changes not saved.', 'error');
        verifyPinInput.focus();
        return;
    }

    const newPassword = document.getElementById('edit-vault-password').value;
    const newPin = newPinInput.value;
    let finalPinValue = usePinCheckbox.checked ? (newPin || originalVault.pin) : null;

    if (usePinCheckbox.checked && !finalPinValue) {
        showNotification("Please enter a PIN or uncheck the 'Use PIN' box.", "error");
        newPinInput.focus();
        return;
    }

    let updatedPlaintextData = {
        title: document.getElementById('edit-vault-title').value,
        username: document.getElementById('edit-vault-username').value || null,
        email: document.getElementById('edit-vault-email').value || null,
        password: newPassword || originalVault.password,
        pin: finalPinValue,
        imageData: undefined
        // TODO: Add logic for Master Password editing
    };

    const file = imageInput.files[0];
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    const processSave = async (imageDataForDb) => {
        updatedPlaintextData.imageData = imageDataForDb;
        try {
            await editVaultWithHistory(vaultIdToEdit, updatedPlaintextData, originalVault);
            const updatedVaults = await fetchAndDecryptVaults();
            renderVaultsUI(updatedVaults);
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            form.reset();
            document.getElementById('edit-pin-verify-section').classList.add('hidden');
            vaultIdToEdit = null;
            showNotification("Vault changes saved successfully!", "success");
        } catch (error) {
            console.error("Error updating vault:", error);
            showNotification(error.message || "Error saving changes.", "error");
        } finally {
             submitButton.disabled = false;
             submitButton.textContent = 'Save Changes';
        }
    };

    let imageDataToSave = undefined;
    if (file) {
        if (file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = e => processSave(e.target.result);
            reader.onerror = e => {
                console.error("File read error", e);
                showNotification("Error reading image file.", "error");
                submitButton.disabled = false;
                submitButton.textContent = 'Save Changes';
            };
            reader.readAsDataURL(file);
            return;
        } else {
            showNotification('Invalid image file (must be image type, under 20MB).', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
            return;
        }
    } else {
        imageDataToSave = (originalVault.imageData && imageInput.value === '') ? null : originalVault.imageData;
        await processSave(imageDataToSave);
    }
}

/**
 * Handles cancellation of the edit vault overlay.
 */
function handleEditVaultCancel() {
    const overlay = document.getElementById('edit-vault-overlay');
    const form = document.getElementById('edit-vault-form');
    const verifySection = document.getElementById('edit-pin-verify-section');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
   if (form) form.reset();
   if (verifySection) verifySection.classList.add('hidden');
    vaultIdToEdit = null;
}

export { openEditVaultOverlay, handleEditVaultSubmit, handleEditVaultCancel };
