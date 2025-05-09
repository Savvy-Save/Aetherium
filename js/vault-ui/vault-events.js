/**
 * Vault List Event Handling Module
 * Handles user interactions within the vault list (show password, edit, delete, view master).
 */

import { vaultsCache } from '../vault-logic.js';
import { showNotification } from '../utils.js';
import { renderVaultsUI } from './vault-render.js';
import { requestPinForAction } from './pin-overlay.js';
import { openEditVaultOverlay } from './edit-vault-overlay.js';

/**
 * Handles all actions triggered from the vault list UI.
 * @param {Event} event
 */
function handleVaultActions(event) {
    const target = event.target;
    const vaultItem = target.closest('.vault-item');
    if (!vaultItem || vaultItem.classList.contains('decryption-error')) return;

    const vaultId = vaultItem.dataset.vaultId;
    if (!vaultId) return;

    const vault = vaultsCache.find(v => v.id === vaultId);
    if (!vault) {
        console.error("Vault data not found in cache for action:", vaultId);
        return;
    }

    if (target.classList.contains('show-password-button')) {
        const dots = vaultItem.querySelector('.password-dots');
        const text = vaultItem.querySelector('.password-text');
        const button = target;
        const reveal = () => {
            dots.classList.add('hidden');
            text.classList.remove('hidden');
            button.textContent = 'Hide';
        };
        if (button.textContent === 'Show') {
            requestPinForAction(vaultId, 'revealPassword', reveal);
        } else {
            dots.classList.remove('hidden');
            text.classList.add('hidden');
            button.textContent = 'Show';
        }
    }
    else if (target.classList.contains('edit-button')) {
        const editAction = () => openEditVaultOverlay(vaultId);
        requestPinForAction(vaultId, 'editVault', editAction);
    }
    // Note: The delete and view-master-button actions require additional dependencies (deleteVault, requestMasterPassword)
    // These will be handled in the main vault-ui.js to avoid circular dependencies.
}

export { handleVaultActions };
