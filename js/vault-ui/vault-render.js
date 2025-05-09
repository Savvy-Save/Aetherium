/**
 * Vault Rendering Module
 * Handles rendering the list of vaults in the UI.
 */

import { vaultsCache } from '../vault-logic.js';

/**
 * Renders the list of vaults in the #vaults-container element.
 * @param {Array} vaultsToRender - Array of vault objects to render.
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
        const item = document.createElement('div');
        item.classList.add('vault-item');
        item.dataset.vaultId = vault.id;
        if (vault.decryptionError) {
            item.classList.add('decryption-error');
        }
        if (vault.isMasterProtected) {
            item.classList.add('master-protected');
        }

        const header = document.createElement('div');
        header.classList.add('vault-header');

        const iconContainer = document.createElement('div');
        iconContainer.classList.add('vault-item-icon');
        if (vault.imageData && !vault.decryptionError) {
            const img = document.createElement('img');
            img.src = vault.imageData;
            img.alt = `${vault.title || 'Vault'} Icon`;
            img.loading = 'lazy';
            iconContainer.appendChild(img);
        } else {
            let iconText = '🔒';
            if (vault.decryptionError) {
                iconText = '⚠️';
            } else if (vault.isMasterProtected) {
                iconText = '🛡️';
            }
            iconContainer.textContent = iconText;
        }
        header.appendChild(iconContainer);

        const titleEl = document.createElement('h3');
        titleEl.textContent = vault.title || 'Untitled Vault';
        header.appendChild(titleEl);

        item.appendChild(header);

        if (!vault.decryptionError) {
            const details = document.createElement('div');
            details.classList.add('vault-details');
            if (vault.isMasterProtected) {
                details.innerHTML = `
                    <p><strong>Username:</strong> ${vault.username || 'N/A'}</p>
                    <p><strong>Email:</strong> ${vault.email || 'N/A'}</p>
                    <p><em>🛡️ Master Password Protected</em></p>
                    <p><em>(Enter Master Password to view/edit details)</em></p>
                    <div class="vault-actions">
                        <button class="action-button view-master-button">View/Edit</button>
                        <button class="action-button delete-button">Delete</button>
                    </div>`;
            } else {
                details.innerHTML = `
                    <p><strong>Username:</strong> ${vault.username || 'N/A'}</p>
                    <p><strong>Email:</strong> ${vault.email || 'N/A'}</p>
                    <p class="password-display">
                        <strong>Password:</strong>
                        <span class="password-dots">••••••••</span>
                        <span class="password-text hidden">${vault.password || ''}</span>
                        <button class="action-button show-password-button">Show</button>
                    </p>
                    ${vault.pin ? '<p><strong>PIN Protected</strong></p>' : ''}
                    <div class="vault-actions">
                        <button class="action-button edit-button">Edit</button>
                        <button class="action-button delete-button">Delete</button>
                    </div>`;
            }
            item.appendChild(details);
        } else {
             const errorDetails = document.createElement('div');
             errorDetails.classList.add('vault-details');
             errorDetails.innerHTML = `<p>Could not load vault details due to a decryption error.</p>`;
             item.appendChild(errorDetails);
        }

        container.appendChild(item);
    });
}

export { renderVaultsUI };
