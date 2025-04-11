/**
 * Storage module for vault data.
 * Handles saving, loading, and updating vaults in browser localStorage.
 * 
 * Future improvements:
 * - Add encryption before saving vaults
 * - Replace with database calls when backend is added
 */

/**
 * Load all vaults from localStorage.
 * @returns {Array<Object>} Array of vault objects, or empty array if none.
 */
function loadVaults() {
    const vaultsData = localStorage.getItem('vaults');
    try {
        if (vaultsData && vaultsData !== 'null' && vaultsData !== 'undefined') {
            return JSON.parse(vaultsData);
        }
    } catch (e) {
        console.error("Error parsing vaults data:", e);
        showNotification("Error loading vaults. Data might be corrupted.", "error");
    }
    return [];
}

/**
 * Save a new vault to localStorage.
 * @param {Object} vault - Vault object to save.
 * @returns {boolean} True if saved successfully, false otherwise.
 */
function saveVault(vault) {
    let vaults = loadVaults();
    vaults.push(vault);
    try {
        localStorage.setItem('vaults', JSON.stringify(vaults));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error('LocalStorage quota exceeded.', e);
            showNotification('Storage full. Cannot save vault.', 'error', 5000);
        } else {
            console.error('Could not save vault.', e);
            showNotification('Could not save vault. ' + e.message, 'error');
        }
        return false;
    }
}

/**
 * Overwrite all vaults in localStorage.
 * Used after editing or deleting vaults.
 * @param {Array<Object>} vaults - Array of vault objects.
 * @returns {boolean} True if saved successfully, false otherwise.
 */
function updateAllVaults(vaults) {
    try {
        localStorage.setItem('vaults', JSON.stringify(vaults));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error('LocalStorage quota exceeded.', e);
            showNotification('Storage full. Cannot save changes.', 'error', 5000);
        } else {
            console.error('Could not save vault changes.', e);
            showNotification('Could not save vault changes. ' + e.message, 'error');
        }
        return false;
    }
}
