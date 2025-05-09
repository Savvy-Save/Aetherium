/**
 * History UI Module
 *
 * Handles the UI for displaying, searching, selecting, and deleting vault history.
 * Integrates with Firestore via database.js and supports theming/dark mode.
 *
 * Dependencies:
 *  - js/database.js: For getHistory, deleteHistory, deleteMultipleHistory, queryHistory.
 *  - js/auth.js: For current user.
 *  - js/utils.js: For notifications.
 */

import { getHistory, deleteHistory, deleteMultipleHistory, queryHistory } from './database.js';
import { auth } from './auth.js';
import { showNotification } from './utils.js';

let historyCache = [];
let selectedHistoryIds = new Set();
let currentActionFilter = ''; // Store the selected action filter value

function formatDateTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
}

function renderHistoryUI(historyList) {
    const container = document.getElementById('history-container');
    if (!container) return;
    container.innerHTML = '';

    // Controls: search, filter, select all, delete selected, clear all
    const controls = document.createElement('div');
    controls.className = 'history-controls';

    // --- Custom Dropdown Structure ---
    const customDropdownHTML = `
        <div class="custom-dropdown" id="history-action-filter-custom" data-value="${currentActionFilter}">
            <button type="button" class="dropdown-button">
                <span>${currentActionFilter ? currentActionFilter.charAt(0).toUpperCase() + currentActionFilter.slice(1) : 'All Actions'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
            <div class="dropdown-options hidden">
                <div class="dropdown-option" data-value="">All Actions</div>
                <div class="dropdown-option" data-value="created">Created</div>
                <div class="dropdown-option" data-value="edited">Edited</div>
                <div class="dropdown-option" data-value="deleted">Deleted</div>
            </div>
        </div>
    `;

    controls.innerHTML = `
        <input type="date" id="history-date-filter" />
        ${customDropdownHTML}
        <button id="history-search-btn">Search</button>
        <button id="history-delete-selected-btn" disabled>Delete Selected</button>
        <button id="history-clear-btn">Clear All</button>
    `;
    container.appendChild(controls);

    // --- Custom Dropdown Logic ---
    const dropdownElement = container.querySelector('#history-action-filter-custom');
    const dropdownButton = dropdownElement?.querySelector('.dropdown-button');
    const optionsContainer = dropdownElement?.querySelector('.dropdown-options');

    if (dropdownButton && optionsContainer) {
        // Toggle dropdown visibility
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from immediately closing via document listener
            optionsContainer.classList.toggle('hidden');
            dropdownButton.setAttribute('aria-expanded', !optionsContainer.classList.contains('hidden'));
        });

        // Handle option selection
        optionsContainer.querySelectorAll('.dropdown-option').forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                const text = option.textContent;
                currentActionFilter = value; // Update state variable
                dropdownElement.dataset.value = value; // Store value on container
                dropdownButton.querySelector('span').textContent = text; // Update button text
                optionsContainer.classList.add('hidden'); // Hide options
                dropdownButton.setAttribute('aria-expanded', 'false');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (dropdownElement && !dropdownElement.contains(e.target) && !optionsContainer.classList.contains('hidden')) {
                optionsContainer.classList.add('hidden');
                dropdownButton.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Table/List
    const table = document.createElement('table');
    table.className = 'history-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>
                    <input type="checkbox" id="history-select-all-checkbox" title="Select All" />
                </th>
                <th>Action</th>
                <th>Vault Title</th>
                <th>Vault ID</th>
                <th>Date/Time</th>
                <th>Delete</th>
            </tr>
        </thead>
        <tbody>
            ${historyList.map(entry => `
                <tr data-history-id="${entry.id}">
                    <td><input type="checkbox" class="history-checkbox" data-history-id="${entry.id}" ${selectedHistoryIds.has(entry.id) ? 'checked' : ''}></td>
                    <td>${entry.action}</td>
                    <td>${entry.vaultTitle || ''}</td>
                    <td>${entry.vaultId}</td>
                    <td>${formatDateTime(entry.timestamp)}</td>
                    <td><button class="history-delete-btn" data-history-id="${entry.id}">🗑️</button></td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);

    // Set initial state for "Select All" checkbox after rendering
    const selectAllCheckbox = container.querySelector('#history-select-all-checkbox');
    const tableBody = container.querySelector('.history-table tbody');
    if (selectAllCheckbox && tableBody) {
        const initialVisibleCheckboxes = Array.from(tableBody.querySelectorAll('.history-checkbox'));
        selectAllCheckbox.checked = initialVisibleCheckboxes.length > 0 && initialVisibleCheckboxes.every(cb => selectedHistoryIds.has(cb.dataset.historyId));
        selectAllCheckbox.disabled = initialVisibleCheckboxes.length === 0;

        // Add event listener for select all
        selectAllCheckbox.addEventListener('change', () => {
            const checkboxes = Array.from(tableBody.querySelectorAll('.history-checkbox'));
            checkboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
                if (cb.checked) {
                    selectedHistoryIds.add(cb.dataset.historyId);
                } else {
                    selectedHistoryIds.delete(cb.dataset.historyId);
                }
            });
            updateDeleteSelectedBtn();
        });

        // Add event listeners for individual checkboxes
        tableBody.querySelectorAll('.history-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    selectedHistoryIds.add(cb.dataset.historyId);
                } else {
                    selectedHistoryIds.delete(cb.dataset.historyId);
                }
                // Update select all checkbox state
                const allChecked = Array.from(tableBody.querySelectorAll('.history-checkbox')).every(c => c.checked);
                selectAllCheckbox.checked = allChecked;
                updateDeleteSelectedBtn();
            });
        });
    } else if (selectAllCheckbox) {
        selectAllCheckbox.disabled = true;
    }

    // Attach listeners for buttons (these might need delegation too if controls are re-rendered)
    const deleteSelectedBtn = container.querySelector('#history-delete-selected-btn');
    const clearBtn = container.querySelector('#history-clear-btn');
    const searchBtn = container.querySelector('#history-search-btn');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
    if (clearBtn) clearBtn.addEventListener('click', handleClearAll);
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    // Attach listeners for individual delete buttons (delegation might be better here too)
    container.querySelectorAll('.history-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.historyId;
            await handleDeleteHistory(id);
        });
    });

    updateDeleteSelectedBtn(); // Update button state after render
}

function updateDeleteSelectedBtn() {
    const btn = document.getElementById('history-delete-selected-btn');
    if (btn) btn.disabled = selectedHistoryIds.size === 0;
}

// Removed initHistoryUI function and historyUIInitialized flag

async function loadHistory() {
    const user = auth.currentUser;
    if (!user) return;
    // Removed initHistoryUI call
    historyCache = await getHistory(user.uid);
    selectedHistoryIds.clear();
    renderHistoryUI(historyCache);
}

async function handleDeleteHistory(id) {
    const user = auth.currentUser;
    if (!user) return;
    if (!confirm('Delete this history entry?')) return;
    await deleteHistory(user.uid, id);
    showNotification('History entry deleted.', 'success');
    await loadHistory();
}

async function handleDeleteSelected() {
    const user = auth.currentUser;
    if (!user) return;
    if (selectedHistoryIds.size === 0) return;
    if (!confirm('Delete selected history entries?')) return;
    await deleteMultipleHistory(user.uid, Array.from(selectedHistoryIds));
    showNotification('Selected history deleted.', 'success');
    await loadHistory();
}

async function handleClearAll() {
    const user = auth.currentUser;
    if (!user) return;
    if (!confirm('Clear all history?')) return;
    const ids = historyCache.map(entry => entry.id);
    if (ids.length === 0) return;
    await deleteMultipleHistory(user.uid, ids);
    showNotification('All history cleared.', 'success');
    await loadHistory();
}

async function handleSearch() {
    const user = auth.currentUser;
    if (!user) return;
    const dateInput = document.getElementById('history-date-filter');
    // Read value from custom dropdown state
    const actionVal = currentActionFilter;
    const dateVal = dateInput.value;
    let startDate = null, endDate = null;
    if (dateVal) {
        const d = new Date(dateVal);
        startDate = new Date(d.setHours(0,0,0,0));
        endDate = new Date(d.setHours(23,59,59,999));
    }
    const results = await queryHistory(user.uid, {
        actionType: actionVal || undefined,
        startDate,
        endDate
    });
    selectedHistoryIds.clear();
    renderHistoryUI(results);
}

// Expose for main page
export {
    loadHistory,
    renderHistoryUI
};
