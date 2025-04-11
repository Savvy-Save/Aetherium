// Vault management module
// Depends on: utils.js, database.js, auth.js, encryption.js
import { showNotification } from './utils.js';
import { auth } from './auth.js';
import { getVaults, addVault, updateVault, deleteVaultDoc } from './database.js';
import { encryptData, decryptData, arrayBufferToBase64, base64ToUint8Array } from './encryption.js';

// ==================== STATE VARIABLES ====================
let vaultsCache = []; // Local cache of DECRYPTED vaults for the current user
let vaultIdToEdit = null; // Firestore ID of vault currently being edited
let currentVaultIdForPin = null; // Firestore ID of vault currently requesting PIN
let pinRequestCallback = null; // Callback to run after successful PIN entry
let pinActionType = null; // Action type for PIN request ('revealPassword', 'editVault', 'deleteVault')
let currentEncryptionKey = null; // Store the session key when vault module is initialized/used

// Function to set the encryption key for the vault module
function setVaultEncryptionKey(key) {
    currentEncryptionKey = key;
    console.log("Vault module encryption key set.");
}

// ==================== PIN MANAGEMENT ====================

/**
 * Check if a vault with a given Firestore ID has a PIN set.
 * Uses the local cache.
 */
function vaultHasPin(vaultId) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    return !!vault && vault.pin !== null && vault.pin !== "" && vault.pin !== undefined;
}

/**
 * Validate entered PIN against stored DECRYPTED PIN for a vault.
 * Uses the local cache which should hold decrypted data.
 */
function validatePin(enteredPin, vaultId) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    // Assumes vault.pin in cache is already decrypted plaintext
    return !!vault && vault.pin === enteredPin;
}

/**
 * Show PIN overlay and set callback for after successful PIN entry.
 */
function requestPinForAction(vaultId, actionType, callback) {
    const vault = vaultsCache.find(v => v.id === vaultId);
    if (!vault) {
        console.error("Vault not found in cache for PIN request:", vaultId);
        showNotification("Vault not found.", "error");
        return;
    }

    // If revealing password and no PIN is set for this vault, skip PIN entry
    if (actionType === 'revealPassword' && !vaultHasPin(vaultId)) {
        if (callback) callback();
        return;
    }
    // Always require PIN for edit/delete if it exists
    if ((actionType === 'editVault' || actionType === 'deleteVault') && !vaultHasPin(vaultId)) {
         if (callback) callback(); // No PIN set, proceed directly
         return;
    }


    currentVaultIdForPin = vaultId;
    pinActionType = actionType;
    pinRequestCallback = callback;

    const overlay = document.getElementById('pin-request-overlay');
    const input = document.getElementById('pin-input');

    if (overlay && input) {
        input.value = '';
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        input.focus();
    } else {
        console.error("PIN overlay/input not found");
        showNotification("UI Error: Cannot request PIN.", "error");
    }
}

/**
 * Handle PIN submit button click.
 */
function handlePinSubmit() {
    const input = document.getElementById('pin-input');
    const overlay = document.getElementById('pin-request-overlay');
    const enteredPin = input.value;

    if (validatePin(enteredPin, currentVaultIdForPin)) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        if (pinRequestCallback) pinRequestCallback(); // Execute the original action (reveal, edit, delete)
    } else {
        showNotification('Incorrect PIN. Please try again.', 'error');
        input.focus();
    }

    input.value = ''; // Clear PIN input regardless of success/failure
    // Reset state after handling
    currentVaultIdForPin = null;
    pinRequestCallback = null;
    pinActionType = null;
}

/**
 * Handle PIN cancel button click.
 */
function handlePinCancel() {
    const overlay = document.getElementById('pin-request-overlay');
    const input = document.getElementById('pin-input');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    if (input) input.value = '';
    // Reset state
    currentVaultIdForPin = null;
    pinRequestCallback = null;
    pinActionType = null;
}

// ==================== VAULT CRUD ====================

/**
 * Delete a vault by its Firestore ID. Confirmation happens before calling this.
 */
async function deleteVault(vaultId) {
    const user = auth.currentUser;
    if (!user) {
        showNotification("Not logged in.", "error");
        return;
    }

    try {
        await deleteVaultDoc(user.uid, vaultId);
        showNotification('Vault deleted successfully.', 'success');
        // Refresh display by removing from cache and re-rendering
        vaultsCache = vaultsCache.filter(v => v.id !== vaultId);
        renderVaultsUI(vaultsCache); // Use a separate rendering function
    } catch (error) {
        console.error("Error deleting vault from Firestore:", error);
        showNotification(error.message || "Error deleting vault.", "error");
    }
}

/**
 * Open edit overlay and populate with vault data.
 */
function openEditVaultOverlay(vaultId) {
    vaultIdToEdit = vaultId; // Store Firestore ID
    const vault = vaultsCache.find(v => v.id === vaultId);

    const overlay = document.getElementById('edit-vault-overlay');
    const verifySection = document.getElementById('edit-pin-verify-section');
    const usePinCheckbox = document.getElementById('edit-use-pin');
    const pinField = document.getElementById('edit-pin-field');

    if (!vault || !overlay || !verifySection || !usePinCheckbox || !pinField) {
        console.error("Could not open edit overlay");
        showNotification("Error: Could not open edit form.", "error");
        return;
    }

    // Fill form fields
    document.getElementById('edit-vault-title').value = vault.title || '';
    document.getElementById('edit-vault-username').value = vault.username || '';
    document.getElementById('edit-vault-email').value = vault.email || '';
    // TODO: Decrypt password before showing? Or just allow setting new one? For now, clear it.
    document.getElementById('edit-vault-password').value = ''; // Don't show stored password
    document.getElementById('edit-vault-pin').value = ''; // Clear PIN input field
    usePinCheckbox.checked = vaultHasPin(vaultId);
    document.getElementById('edit-vault-image').value = ''; // Clear file input
    document.getElementById('edit-verify-pin').value = ''; // Clear verify PIN input

    // Show/hide PIN fields based on whether vault has PIN
    pinField.classList.toggle('hidden', !usePinCheckbox.checked);
    verifySection.classList.toggle('hidden', !usePinCheckbox.checked);

    // Toggle PIN fields on checkbox change
    usePinCheckbox.addEventListener('change', () => {
        pinField.classList.toggle('hidden', !usePinCheckbox.checked);
        verifySection.classList.toggle('hidden', !usePinCheckbox.checked);
    });

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

/**
 * Handle edit vault form submit.
 */
async function handleEditVaultSubmit(event) {
    event.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification("Not logged in.", "error");
        return;
    }
    if (vaultIdToEdit === null) {
        console.error("No vault ID selected for edit");
        showNotification("Error: Could not save changes.", "error");
        return;
    }

    const originalVault = vaultsCache.find(v => v.id === vaultIdToEdit); // Find from DECRYPTED cache
    if (!originalVault) {
         console.error("Original vault not found in cache for edit:", vaultIdToEdit);
         showNotification("Error: Could not find vault to save changes.", "error");
         return;
    }


    const verifySection = document.getElementById('edit-pin-verify-section');
    const verifyPinInput = document.getElementById('edit-verify-pin');
    const usePinCheckbox = document.getElementById('edit-use-pin');
    const newPinInput = document.getElementById('edit-vault-pin');
    const imageInput = document.getElementById('edit-vault-image');
    const overlay = document.getElementById('edit-vault-overlay');
    const form = document.getElementById('edit-vault-form');
    const submitButton = form.querySelector('button[type="submit"]');

    let pinVerified = true;
    const needsPinVerification = vaultHasPin(vaultIdToEdit) && !verifySection.classList.contains('hidden');

    // Verify current PIN if the vault has one and the verification section is shown
    if (needsPinVerification) {
        // Compare against the decrypted PIN from the cache
        if (!validatePin(verifyPinInput.value, vaultIdToEdit)) {
            showNotification('Incorrect current PIN. Changes not saved.', 'error');
            pinVerified = false;
        }
    }

    if (!pinVerified) {
        verifyPinInput.focus();
        return;
    }

    // Get updated data from form
    // Prepare data to be potentially saved (still plaintext at this stage)
    let dataToSave = {
        title: document.getElementById('edit-vault-title').value,
        username: document.getElementById('edit-vault-username').value || null,
        email: document.getElementById('edit-vault-email').value || null,
        // Password and PIN will be handled below based on changes
    };

    const newPassword = document.getElementById('edit-vault-password').value;
    const newPin = newPinInput.value;

    // Determine final PIN value (plaintext for now)
    let finalPin = null;
    if (usePinCheckbox.checked) {
        finalPin = newPin || originalVault.pin; // Keep original if new is empty? Or require new? Require new.
        if (!newPin) {
             showNotification("Please enter a new PIN or uncheck the 'Use PIN' box.", "error");
             newPinInput.focus();
             return; // Stop if PIN is checked but empty
        }
        finalPin = newPin;
    }
    dataToSave.pin = finalPin; // Store plaintext PIN temporarily

    // Determine final password value (plaintext for now)
    if (newPassword) {
        dataToSave.password = newPassword;
    } else {
         dataToSave.password = originalVault.password; // Keep original decrypted password if not changed
    }

    const file = imageInput.files[0];

    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    const processSave = async (imageData) => {
        if (imageData !== undefined) {
             dataToSave.imageData = imageData;
        } else {
            dataToSave.imageData = originalVault.imageData;
        }

        // Encrypt sensitive fields before saving
        if (!currentEncryptionKey) {
            showNotification("Encryption key not available. Cannot save vault.", "error");
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
            return;
        }

        try {
            // Encrypt password if it exists
            if (dataToSave.password) {
                const encryptedPass = await encryptData(currentEncryptionKey, dataToSave.password);
                dataToSave.encryptedPassword = { // Store as object
                    iv: arrayBufferToBase64(encryptedPass.iv),
                    ciphertext: arrayBufferToBase64(encryptedPass.ciphertext)
                };
            }
             delete dataToSave.password; // Remove plaintext password

            // Encrypt PIN if it exists
            if (dataToSave.pin) {
                const encryptedPin = await encryptData(currentEncryptionKey, dataToSave.pin);
                dataToSave.encryptedPin = { // Store as object
                    iv: arrayBufferToBase64(encryptedPin.iv),
                    ciphertext: arrayBufferToBase64(encryptedPin.ciphertext)
                };
            }
            delete dataToSave.pin; // Remove plaintext PIN


            // --- Save encrypted data to Firestore ---
            await updateVault(user.uid, vaultIdToEdit, dataToSave);

            // --- Update local DECRYPTED cache ---
            const index = vaultsCache.findIndex(v => v.id === vaultIdToEdit);
            if (index !== -1) {
                 // Update cache with the *plaintext* values used in the form
                 vaultsCache[index] = {
                     ...vaultsCache[index], // Keep original non-updated fields
                     title: dataToSave.title,
                     username: dataToSave.username,
                     email: dataToSave.email,
                     password: newPassword || originalVault.password, // Use new plaintext pass if provided, else old decrypted one
                     pin: finalPin, // Use new plaintext PIN if provided/checked, else null
                     imageData: dataToSave.imageData,
                     // Keep encrypted fields out of the main cache object if desired
                 };
            }

            renderVaultsUI(vaultsCache); // Re-render UI from updated cache
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            form.reset();
            verifySection.classList.add('hidden');
            vaultIdToEdit = null;
            showNotification("Vault changes saved successfully!", "success");
        } catch (error) {
            console.error("Error updating vault in Firestore:", error);
            showNotification(error.message || "Error saving changes.", "error");
        } finally {
             submitButton.disabled = false;
             submitButton.textContent = 'Save Changes';
        }
    };

    // Handle image update
     const removeImageButton = document.getElementById('remove-edit-vault-image');
     // Check if image was explicitly removed (input cleared) but maybe not via button?
     // A robust way is needed, maybe a hidden input flag set by the remove button.
     // For now, assume if file input is empty, keep original unless a new file is chosen.
     let imageDataToSave = undefined; // Use undefined to signal no change unless file processed

    if (file) {
        if (file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024) { // 20MB limit
            const reader = new FileReader();
            reader.onload = e => processSave(e.target.result); // Process with new base64 data
            reader.onerror = e => {
                console.error("File read error", e);
                showNotification("Error reading image file.", "error");
                submitButton.disabled = false;
                submitButton.textContent = 'Save Changes';
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Invalid image file (must be image type, under 20MB).', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
        }
    } else {
         // If no new file, check if the user *intended* to remove it (e.g., clicked remove button)
         // This logic needs refinement. Let's assume for now: if no file, keep original.
         // To allow removal, we'd need a flag or check if originalVault.imageData exists but input is empty.
         // Let's add a simple check: if original had image but input is now empty, assume removal.
         if (originalVault.imageData && imageInput.value === '') {
             imageDataToSave = null; // Explicitly set to null for removal
         }
        processSave(imageDataToSave); // Process with potentially null or undefined imageData
    }
}

/**
 * Cancel edit vault overlay.
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
    vaultIdToEdit = null; // Reset edited vault ID
}

/**
 * Reset optional fields in Add Vault form.
 */
function resetOptionalFields() {
    document.getElementById('use-username').checked = false;
    document.getElementById('use-email').checked = false;
    document.getElementById('use-pin').checked = false;

    const usernameField = document.getElementById('username-field');
    const emailField = document.getElementById('email-field');
    const pinField = document.getElementById('pin-field');

    usernameField.classList.add('hidden');
    usernameField.querySelector('input').value = '';

    emailField.classList.add('hidden');
    emailField.querySelector('input').value = '';

    pinField.classList.add('hidden');
    pinField.querySelector('input').value = '';
}

/**
 * Handle Add Vault form submit.
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
    const title = document.getElementById('vault-title').value;
    const username = document.getElementById('vault-username').value;
    const email = document.getElementById('vault-email').value;
    const password = document.getElementById('vault-password').value;
    const pin = document.getElementById('vault-pin').value;
    const imageInput = document.getElementById('vault-image');
    const useUsername = document.getElementById('use-username').checked;
    const useEmail = document.getElementById('use-email').checked;
    const usePinCheckbox = document.getElementById('use-pin').checked;

    const file = imageInput.files[0];

    // Prepare vault data object (plaintext initially)
    let vaultData = {
        title: title,
        username: useUsername ? username : null,
        email: useEmail ? email : null,
        password: password,
        pin: usePinCheckbox ? pin : null,
        imageData: null
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    const processSave = async (imageData) => {
        vaultData.imageData = imageData;

        // Encrypt sensitive fields before saving
        if (!currentEncryptionKey) {
            showNotification("Encryption key not available. Cannot save vault.", "error");
            submitButton.disabled = false;
            submitButton.textContent = 'Add Vault';
            return;
        }

        let dataToSave = { ...vaultData }; // Clone data for encryption

        try {
            // Encrypt password if it exists
            if (dataToSave.password) {
                const encryptedPass = await encryptData(currentEncryptionKey, dataToSave.password);
                dataToSave.encryptedPassword = {
                    iv: arrayBufferToBase64(encryptedPass.iv),
                    ciphertext: arrayBufferToBase64(encryptedPass.ciphertext)
                };
            }
            delete dataToSave.password; // Remove plaintext

            // Encrypt PIN if it exists
            if (dataToSave.pin) {
                const encryptedPin = await encryptData(currentEncryptionKey, dataToSave.pin);
                dataToSave.encryptedPin = {
                    iv: arrayBufferToBase64(encryptedPin.iv),
                    ciphertext: arrayBufferToBase64(encryptedPin.ciphertext)
                };
            }
            delete dataToSave.pin; // Remove plaintext


            // --- Save encrypted data to Firestore ---
            const newVaultId = await addVault(user.uid, dataToSave);

            // --- Add DECRYPTED data to local cache and re-render ---
            // Use the original vaultData with plaintext password/pin for the cache
            vaultsCache.push({ id: newVaultId, ...vaultData });
            vaultsCache.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            renderVaultsUI(vaultsCache);

            form.reset();
            resetOptionalFields(); // Reset optional field UI
            showNotification("Vault created successfully!", "success");
        } catch (error) {
            console.error("Error adding vault to Firestore:", error);
            showNotification(error.message || "Error creating vault.", "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Vault';
        }
    };

    // Handle image processing
    if (file) {
        if (file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024) { // 20MB limit
            const reader = new FileReader();
            reader.onload = e => processSave(e.target.result); // Process with base64 data
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
        processSave(null); // Process without image data
    }
}

/**
 * Renders the vaults from the local cache into the UI.
 * @param {Array<object>} vaultsToRender - The array of vault objects (from cache).
 */
function renderVaultsUI(vaultsToRender) {
    const container = document.getElementById('vaults-container');
    if (!container) return;

    container.innerHTML = ''; // Clear previous content

    if (!vaultsToRender || vaultsToRender.length === 0) {
        container.innerHTML = '<p>No vaults added yet.</p>';
        return;
    }

    vaultsToRender.forEach((vault) => {
        // Data in vaultsToRender is assumed to be DECRYPTED plaintext
        const item = document.createElement('div');
        item.classList.add('vault-item');
        item.dataset.vaultId = vault.id; // Store Firestore ID on the element

        const header = document.createElement('div');
        header.classList.add('vault-header');

        const iconContainer = document.createElement('div');
        iconContainer.classList.add('vault-item-icon');
        if (vault.imageData) {
            const img = document.createElement('img');
            img.src = vault.imageData;
            img.alt = `${vault.title || 'Vault'} Icon`;
            img.loading = 'lazy';
            iconContainer.appendChild(img);
        } else {
            iconContainer.textContent = '🔒';
        }
        header.appendChild(iconContainer);

        const titleEl = document.createElement('h3');
        titleEl.textContent = vault.title || 'Untitled Vault';
        header.appendChild(titleEl);

        item.appendChild(header);

        const details = document.createElement('div');
        details.classList.add('vault-details');
        details.innerHTML = `
            <p><strong>Username:</strong> ${vault.username || 'N/A'}</p>
            <p><strong>Email:</strong> ${vault.email || 'N/A'}</p>
            <p class="password-display">
                <strong>Password:</strong>
                <span class="password-dots">••••••••</span>
                <span class="password-text hidden">${vault.password || ''}</span> <!-- Display decrypted password -->
                <button class="action-button show-password-button">Show</button>
            </p>
            ${vault.pin ? '<p><strong>PIN Protected</strong></p>' : ''} <!-- Check decrypted PIN -->
            <div class="vault-actions">
                <button class="action-button edit-button">Edit</button>
                <button class="action-button delete-button">Delete</button>
            </div>
        `;
        item.appendChild(details);

        container.appendChild(item);
    });
}

/**
 * Handle clicks inside vault list (show/hide password, edit, delete).
 */
function handleVaultActions(event) {
    const target = event.target;
    const vaultItem = target.closest('.vault-item');
    if (!vaultItem) return;

    const vaultId = vaultItem.dataset.vaultId; // Get Firestore ID
    if (!vaultId) return;

    const vault = vaultsCache.find(v => v.id === vaultId); // Find from DECRYPTED cache
    if (!vault) {
        console.error("Vault data not found in cache for action:", vaultId);
        return;
    }


    if (target.classList.contains('show-password-button')) {
        const dots = vaultItem.querySelector('.password-dots');
        const text = vaultItem.querySelector('.password-text'); // This element holds the decrypted password from cache
        const button = target;

        const reveal = () => {
            // Password in 'text' element is already decrypted (from cache)
            dots.classList.add('hidden');
            text.classList.remove('hidden');
            button.textContent = 'Hide';
        };

        if (button.textContent === 'Show') {
            // Check if PIN is required for this vault
            if (vaultHasPin(vaultId)) {
                requestPinForAction(vaultId, 'revealPassword', reveal);
            } else {
                reveal(); // No PIN, reveal directly
            }
        } else {
            // Hide password
            dots.classList.remove('hidden');
            text.classList.add('hidden');
            button.textContent = 'Show';
        }
    } else if (target.classList.contains('edit-button')) {
        const editAction = () => openEditVaultOverlay(vaultId);
        if (vaultHasPin(vaultId)) {
            requestPinForAction(vaultId, 'editVault', editAction);
        } else {
            editAction(); // No PIN, open edit directly
        }
    } else if (target.classList.contains('delete-button')) {
        const deleteAction = () => {
             if (confirm("Are you sure you want to delete this vault? This action cannot be undone.")) {
                deleteVault(vaultId); // Call async delete function
             }
        };
        if (vaultHasPin(vaultId)) {
            requestPinForAction(vaultId, 'deleteVault', deleteAction);
        } else {
            deleteAction(); // No PIN, confirm and delete directly
        }
    }
}

/**
 * Fetches vaults from Firestore and updates the UI.
 * Should be called after login or when a refresh is needed.
 */
async function displayVaults() {
    const user = auth.currentUser;
    const container = document.getElementById('vaults-container');
    if (!container) return;

    if (!user) {
        vaultsCache = []; // Clear cache
        renderVaultsUI(vaultsCache);
        return;
    }
    // Ensure encryption key is available
    if (!currentEncryptionKey) {
        console.error("Encryption key not available. Cannot display vaults securely.");
        showNotification("Session error. Please log in again.", "error");
        // Optionally log out user here if key is missing when expected
        container.innerHTML = '<p>Error: Secure session not established.</p>';
        return;
    }


    container.innerHTML = '<p>Loading vaults...</p>';

    try {
        const rawVaults = await getVaults(user.uid); // Get raw, potentially encrypted vaults

        // Decrypt vaults and store in cache
        const decryptedVaults = [];
        for (const vault of rawVaults) {
            let decryptedPassword = null;
            let decryptedPin = null;

            try {
                if (vault.encryptedPassword) {
                    const iv = base64ToUint8Array(vault.encryptedPassword.iv);
                    const ciphertext = base64ToUint8Array(vault.encryptedPassword.ciphertext);
                    decryptedPassword = await decryptData(currentEncryptionKey, iv, ciphertext);
                }
                 if (vault.encryptedPin) {
                    const iv = base64ToUint8Array(vault.encryptedPin.iv);
                    const ciphertext = base64ToUint8Array(vault.encryptedPin.ciphertext);
                    decryptedPin = await decryptData(currentEncryptionKey, iv, ciphertext);
                }
                 decryptedVaults.push({
                     ...vault, // Keep other fields like title, username, email, imageData, id
                     password: decryptedPassword, // Store decrypted password
                     pin: decryptedPin, // Store decrypted PIN
                     encryptedPassword: vault.encryptedPassword, // Keep original encrypted data if needed for edit logic? Maybe not.
                     encryptedPin: vault.encryptedPin
                 });
            } catch (decryptionError) {
                 console.error(`Failed to decrypt vault ${vault.id}:`, decryptionError);
                 // Handle vaults that fail decryption (e.g., show an error state for that vault)
                 decryptedVaults.push({
                     ...vault,
                     title: vault.title + " (Decryption Failed)",
                     password: null,
                     pin: null,
                     decryptionError: true
                 });
            }
        }

        vaultsCache = decryptedVaults; // Update cache with decrypted data
        renderVaultsUI(vaultsCache); // Render UI using decrypted data

    } catch (error) {
        console.error("Failed to display vaults:", error);
        showNotification(error.message || "Could not load vaults.", "error");
        container.innerHTML = '<p>Error loading vaults. Please try again.</p>';
    }
}


// Export functions needed by script.js
export {
    setVaultEncryptionKey, // Allow script.js to set the key
    displayVaults,
    handleAddVaultSubmit,
    handleEditVaultSubmit,
    handlePinSubmit,
    handlePinCancel,
    handleEditVaultCancel,
    handleVaultActions
};
