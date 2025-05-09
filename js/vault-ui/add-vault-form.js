/**
 * Add Vault Form UI Module
 * Handles the logic for adding new vaults via the form.
 */

import { showNotification } from '../utils.js';
import { auth } from '../auth.js';
import { fetchAndDecryptVaults, addVaultWithHistory } from '../vault-logic.js';
import { renderVaultsUI } from './vault-render.js';

/**
 * Resets optional fields in the add vault form.
 */
function resetOptionalFields() {
    const fields = ['username', 'email', 'pin'];
    fields.forEach(field => {
        const checkbox = document.getElementById(`use-${field}`);
        const fieldDiv = document.getElementById(`${field}-field`);
        if (checkbox) checkbox.checked = false;
        if (fieldDiv) {
            fieldDiv.classList.add('hidden');
            const input = fieldDiv.querySelector('input');
            if (input) input.value = '';
        }
    });
    // Also reset Master Password fields
    const masterCheckbox = document.getElementById('use-master-password');
    const masterFieldsDiv = document.getElementById('master-password-fields');
    if (masterCheckbox) masterCheckbox.checked = false;
    if (masterFieldsDiv) {
        masterFieldsDiv.classList.add('hidden');
        const masterInput = document.getElementById('vault-master-password');
        const confirmInput = document.getElementById('vault-confirm-master-password');
        if (masterInput) masterInput.value = '';
        if (confirmInput) confirmInput.value = '';
    }
}

/**
 * Handles the submission of the add vault form.
 * @param {Event} event
 */
async function handleAddVaultSubmit(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
        showNotification("Not logged in.", "error");
        return;
    }

    const form = document.getElementById('add-vault-form');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleInput = document.getElementById('vault-title');
    const usernameInput = document.getElementById('vault-username');
    const emailInput = document.getElementById('vault-email');
    const passwordInput = document.getElementById('vault-password');
    const pinInput = document.getElementById('vault-pin');
    const imageInput = document.getElementById('vault-image');
    const useUsernameCheckbox = document.getElementById('use-username');
    const useEmailCheckbox = document.getElementById('use-email');
    const usePinCheckbox = document.getElementById('use-pin');
    const useMasterPasswordCheckbox = document.getElementById('use-master-password');
    const masterPasswordInput = document.getElementById('vault-master-password');
    const confirmMasterPasswordInput = document.getElementById('vault-confirm-master-password');

    if (!titleInput?.value) { showNotification("Vault title is required.", "error"); titleInput?.focus(); return; }
    if (!passwordInput?.value) { showNotification("Password is required.", "error"); passwordInput?.focus(); return; }
    if (usePinCheckbox?.checked && !pinInput?.value) { showNotification("PIN is required when 'Use PIN' is checked.", "error"); pinInput?.focus(); return; }

    let masterPasswordValue = null;
    const isMasterProtected = useMasterPasswordCheckbox?.checked;
    if (isMasterProtected) {
        if (!masterPasswordInput?.value) { showNotification("Master Password is required when protection is enabled.", "error"); masterPasswordInput?.focus(); return; }
        if (!confirmMasterPasswordInput?.value) { showNotification("Please confirm the Master Password.", "error"); confirmMasterPasswordInput?.focus(); return; }
        if (masterPasswordInput.value !== confirmMasterPasswordInput.value) { showNotification("Master Passwords do not match.", "error"); confirmMasterPasswordInput.focus(); return; }
        if (masterPasswordInput.value.length < 8) { showNotification("Master Password should be at least 8 characters long.", "error"); masterPasswordInput.focus(); return; }
        masterPasswordValue = masterPasswordInput.value;
    }

    const file = imageInput?.files[0];
    let plaintextData = {
        title: titleInput.value,
        username: useUsernameCheckbox?.checked ? usernameInput?.value : null,
        email: useEmailCheckbox?.checked ? emailInput?.value : null,
        password: passwordInput.value,
        pin: usePinCheckbox?.checked ? pinInput?.value : null,
        imageData: null,
        isMasterProtected: isMasterProtected,
        masterPassword: masterPasswordValue
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    const processSave = async (imageData) => {
        plaintextData.imageData = imageData;
        try {
            await addVaultWithHistory(plaintextData);
            const updatedVaults = await fetchAndDecryptVaults();
            renderVaultsUI(updatedVaults);
            form.reset();
            resetOptionalFields();
            showNotification("Vault created successfully!", "success");
        } catch (error) {
            console.error("Error adding vault:", error);
            showNotification(error.message || "Error creating vault.", "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Vault';
        }
    };

    if (file) {
        if (file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = e => processSave(e.target.result);
            reader.onerror = e => {
                console.error("File read error", e);
                showNotification("Error reading image file.", "error");
                submitButton.disabled = false;
                submitButton.textContent = 'Add Vault';
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Invalid image file (must be image type, under 20MB).', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Add Vault';
        }
    } else {
        await processSave(null);
    }
}

export { resetOptionalFields, handleAddVaultSubmit };
