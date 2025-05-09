// Main UI logic for Password Vault Manager
// Depends on: utils.js, storage.js, vault.js, auth.js, database.js, encryption.js
import { showNotification, generatePassword, showLoadingOverlay, hideLoadingOverlay } from './js/utils.js'; // Import necessary utils (ADDED show/hideLoadingOverlay)
// Import Firebase auth functions (including sendPasswordReset)
import {
    signUpUser,
    logInUser,
    onAuthChange,
    logOutUser,
    auth,
    sendEmailVerification,
    sendPasswordReset,
    reauthenticateUser, // Added import
    deleteCurrentUser   // Added import
    // Removed storage import
} from './js/auth.js';
// Removed Firebase Storage function imports
// Import Firestore functions (including delete functions)
import {
    saveUserProfile,
    getUserProfile,
    deleteAllUserVaults, // Added import
    deleteUserProfile    // Added import
} from './js/database.js';
import { generateSalt, arrayBufferToBase64, deriveKey, base64ToUint8Array } from './js/encryption.js'; // Import encryption utils
// Import vault logic functions
import { setVaultEncryptionKey } from './js/vault-logic.js';
// Import vault UI functions
import {
    displayVaults,
    handleAddVaultSubmit,
    handleEditVaultSubmit,
    handlePinSubmit,
    handlePinCancel,
    handleEditVaultCancel,
    handleVaultActions,
    // --- START: Import Master Password handlers ---
    handleMasterPasswordSubmit,
    handleMasterPasswordCancel
    // --- END: Import Master Password handlers ---
} from './js/vault-ui.js';
import { initializePinResetElements } from './js/vault-ui/pin-overlay.js'; // Import for new PIN reset flow
import { loadHistory } from './js/history-ui.js'; // Import history UI loader

document.addEventListener('DOMContentLoaded', function () {
    // This event ensures all HTML elements are loaded before running JS

    // ==================== CACHE DOM ELEMENTS ====================
    // Navigation elements
    const mainNav = document.getElementById('main-nav'); // Main app navigation bar (Vault, Accounts, etc.)
    const authNav = document.getElementById('auth-nav'); // Authentication navigation bar (Sign Up, Log In, About Us)
    const allNavItems = document.querySelectorAll('.nav-item'); // All navigation items (both nav bars)
    const mainNavItems = mainNav.querySelectorAll('.nav-list li.nav-item'); // Only main app nav items

    // Sections (pages) of the app
    const signupSection = document.getElementById('signup-section'); // Sign Up form section
    const loginSection = document.getElementById('login-section'); // Log In form section
    const vaultSection = document.getElementById('vault-section'); // Vault management section
    const accountsSection = document.getElementById('accounts-section'); // Accounts list section
    const historySection = document.getElementById('history-section'); // History section
    const settingsSection = document.getElementById('settings-section'); // User settings section
    const allSections = document.querySelectorAll('.auth-section, .password-manager-section'); // All main content sections

    // Auth toggle links
    const signupLink = document.getElementById('signup-link'); // Link to switch to Sign Up form
    const loginLink = document.getElementById('login-link'); // Link to switch to Log In form
    const logoutButton = document.querySelector('.nav-item[data-section="logout"]'); // Log Out button

    // Forms
    const signupForm = document.getElementById('signup-form'); // Sign Up form element
    const loginForm = document.getElementById('login-form'); // Log In form element
    const addVaultForm = document.getElementById('add-vault-form'); // Add Vault form
    const editVaultForm = document.getElementById('edit-vault-form'); // Edit Vault form

    // Password strength indicator elements (Sign Up form)
    const signupPasswordInput = document.getElementById('signup-password'); // Password input in Sign Up form
    const passwordStrengthIndicator = document.getElementById('password-strength-indicator'); // Container for strength bar
    const strengthBar = document.getElementById('strength-bar'); // Visual strength bar
    const strengthText = document.getElementById('strength-text'); // Text description of strength

    // Password generation buttons (Add Vault and Edit Vault forms)
    const generatePasswordButtons = document.querySelectorAll('.generate-password-button');

    // Vault image removal buttons
    const removeVaultImageButton = document.getElementById('remove-vault-image'); // Add Vault form
    const removeEditVaultImageButton = document.getElementById('remove-edit-vault-image'); // Edit Vault form

    // Vault list container
    const vaultsContainer = document.getElementById('vaults-container');

    // PIN request overlay elements
    const pinRequestOverlay = document.getElementById('pin-request-overlay');
    const submitPinButton = document.getElementById('submit-pin-button');
    const cancelPinButton = document.getElementById('cancel-pin-button');

    // Edit vault overlay elements
    const editVaultOverlay = document.getElementById('edit-vault-overlay');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editUsePinCheckbox = document.getElementById('edit-use-pin');
    const editPinField = document.getElementById('edit-pin-field');
    const editPinVerifySection = document.getElementById('edit-pin-verify-section');

    // Forgot Password elements
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordOverlay = document.getElementById('forgot-password-overlay');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const cancelForgotPasswordButton = document.getElementById('cancel-forgot-password-button');
    const forgotPasswordMessage = document.getElementById('forgot-password-message');
    const sendResetLinkButton = document.getElementById('send-reset-link-button'); // Added

    // Remember Me checkbox
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Delete Account elements
    const deleteAccountButton = document.getElementById('delete-account-button');
    const deleteAccountConfirmOverlay = document.getElementById('delete-account-confirm-overlay');
    const deleteAccountConfirmForm = document.getElementById('delete-account-confirm-form');
    const deleteConfirmPasswordInput = document.getElementById('delete-confirm-password');
    const cancelDeleteButton = document.getElementById('cancel-delete-button');
    const confirmDeleteButton = document.getElementById('confirm-delete-button');
    const deleteAccountMessage = document.getElementById('delete-account-message');

    // --- START: Cache Master Password Overlay Elements ---
    const masterPasswordRequestOverlay = document.getElementById('master-password-request-overlay');
    const masterPasswordRequestForm = document.getElementById('master-password-request-form');
    const cancelMasterPasswordButton = document.getElementById('cancel-master-password-button');
    // Note: Input/Title/Message elements are accessed directly in vault-ui.js when needed
    // --- END: Cache Master Password Overlay Elements ---

    // Optional checkboxes (username, email, pin)
    const optionalCheckboxes = document.querySelectorAll('.optional-checkbox input[type="checkbox"]');
    const darkModeToggle = document.getElementById('dark-mode-toggle'); // Dark mode toggle switch
    const themeColorRadios = document.querySelectorAll('input[name="theme-color"]'); // Theme color radio buttons
    const themeStyleRadios = document.querySelectorAll('input[name="theme-style"]'); // Theme style radio buttons
    const devToggleContainer = document.querySelector('.dev-toggle-container'); // Developer Toggle

    // Master Password elements (Add Vault form)
    const useMasterPasswordCheckbox = document.getElementById('use-master-password');
    const masterPasswordFieldsContainer = document.getElementById('master-password-fields');
    const masterPasswordInput = document.getElementById('vault-master-password');
    const confirmMasterPasswordInput = document.getElementById('vault-confirm-master-password');

    // Auto-logout warning element (will be created if not found, or use one from HTML)
    let autoLogoutWarningElement = null;

    // Initialize elements for the new PIN reset overlays
    initializePinResetElements();

    // Profile Feature Elements
    const profileFeatureContainer = document.getElementById('profile-feature-container');
    const profilePicture = document.getElementById('profile-picture');
    const profileDropdown = document.getElementById('profile-dropdown');
    const dropdownUsernameValue = document.getElementById('dropdown-username-value');
    const dropdownEmailValue = document.getElementById('dropdown-email-value');
    const dropdownChangePictureButton = document.getElementById('dropdown-change-picture-button');
    const dropdownLogoutButton = document.getElementById('dropdown-logout-button');
    const profilePictureInput = document.getElementById('profile-picture-input'); // Cache file input


    // ==================== AUTO LOGOUT CONFIG & STATE ====================
    const INACTIVITY_TIMEOUT_DURATION = 20000; // 20 seconds for testing
    const WARNING_COUNTDOWN_DURATION = 10000;  // 10 seconds warning
    let inactivityTimerId = null;
    let warningTimerId = null;
    let countdownIntervalId = null;


    // ==================== STATE ====================
    let currentSectionId = 'signup'; // Tracks which section is currently visible
    let sessionEncryptionKey = null; // Holds the derived CryptoKey for the session
    let temporaryLoginPassword = null; // VERY temporary storage for password during login key derivation

    // ==================== NAVIGATION ====================
    // Show a specific section by ID, hide all others
    function showSection(sectionId) {
        allSections.forEach(section => {
            section.classList.add('hidden');
            section.style.display = 'none';
        });

        const sectionToShow = document.getElementById(sectionId + '-section');
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');
            sectionToShow.style.display = 'block';
            currentSectionId = sectionId;
            updateNavStyles();

            // Load history if navigating to the history section
            if (sectionId === 'history') {
                loadHistory();
            }
        } else {
            console.error(`Section with ID ${sectionId}-section not found.`);
            showSection('signup'); // Fallback to signup
        }
    }

    // Update active nav item styling based on current section
    function updateNavStyles() {
        allNavItems.forEach(navItem => {
            navItem.classList.remove('active');
            if (navItem.dataset.section === currentSectionId) {
                navItem.classList.add('active');
            }
        });
    }

    // Handle clicks on all nav items (both nav bars)
    allNavItems.forEach(navItem => {
        navItem.addEventListener('click', function(event) {
            const sectionId = this.dataset.section;
            if (sectionId && sectionId !== 'logout') {
                event.preventDefault();
                showSection(sectionId);
            }
            // Logout handled separately
        });
    });

    // ==================== AUTH NAV TOGGLE LINKS ====================
    if (signupLink) {
        signupLink.addEventListener('click', function(event) {
            event.preventDefault();
            authNav.classList.remove('hidden');
            mainNav.classList.add('hidden');
            showSection('signup');
        });
    }

    if (loginLink) {
        loginLink.addEventListener('click', function(event) {
            event.preventDefault();
            authNav.classList.remove('hidden');
            mainNav.classList.add('hidden');
            showSection('login');
        });
    }

    // ==================== PASSWORD VISIBILITY TOGGLE ====================
    function togglePasswordVisibility(toggleElement) {
        const passwordContainer = toggleElement.closest('.password-container');
        if (!passwordContainer) return;
        const passwordInput = passwordContainer.querySelector('input[type="password"], input[type="text"]');
        if (!passwordInput) return;

        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        toggleElement.innerHTML = type === 'password' ? '👁️' : '👁️‍🗨️';
    }

    // Delegate password toggle clicks
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('password-toggle')) {
            togglePasswordVisibility(event.target);
        }
    });

    // ==================== PASSWORD STRENGTH METER ====================
    if (signupPasswordInput && passwordStrengthIndicator && strengthBar && strengthText) {
        signupPasswordInput.addEventListener('input', function() {
            let strength = 0;
            const password = signupPasswordInput.value;

            passwordStrengthIndicator.classList.toggle('hidden', password.length === 0);

            if (password.length >= 8) strength++;
            if (/[a-z]/.test(password)) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/\d/.test(password)) strength++;
            if (/[^a-zA-Z0-9]/.test(password)) strength++;

            const percent = (strength / 5) * 100;
            strengthBar.style.width = `${percent}%`;

            let text = 'Strength: ';
            let color = 'red';

            if (percent < 25) { text += 'Very Weak'; color = 'red'; }
            else if (percent < 50) { text += 'Weak'; color = 'orange'; }
            else if (percent < 75) { text += 'Medium'; color = 'yellow'; }
            else if (percent < 90) { text += 'Strong'; color = 'lightgreen'; }
            else { text += 'Very Strong'; color = 'darkgreen'; }

            strengthText.textContent = text;
            strengthBar.style.backgroundColor = color;
        });
    }

    // ==================== PASSWORD GENERATION BUTTONS ====================
    generatePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const form = this.closest('form');
            if (!form) return;
            const passwordInput = form.querySelector('input[name$="password"]');
            if (passwordInput) {
                passwordInput.value = generatePassword();
                if (passwordInput.id === 'signup-password') {
                    passwordInput.dispatchEvent(new Event('input'));
                }
            }
        });
    });

    // ==================== IMAGE REMOVAL BUTTONS ====================
    if (removeVaultImageButton) {
        removeVaultImageButton.addEventListener('click', () => {
            const input = document.getElementById('vault-image');
            if (input) input.value = '';
        });
    }
    if (removeEditVaultImageButton) {
        removeEditVaultImageButton.addEventListener('click', () => {
            const input = document.getElementById('edit-vault-image');
            if (input) input.value = '';
        });
    }

    // ==================== OPTIONAL FIELD CHECKBOXES ====================
    optionalCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const fieldId = this.id.replace(/^(edit-)?use-/, '') + '-field';
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.toggle('hidden', !this.checked);
            }
            if (this.id === 'edit-use-pin' && editPinVerifySection) {
                if (!this.checked) {
                    editPinVerifySection.classList.add('hidden');
                }
            }
        });
    });

    // --- Master Password Checkbox Listener ---
    if (useMasterPasswordCheckbox && masterPasswordFieldsContainer) {
        useMasterPasswordCheckbox.addEventListener('change', function() {
            masterPasswordFieldsContainer.classList.toggle('hidden', !this.checked);
            // Clear master password fields when hiding
            if (!this.checked) {
                if (masterPasswordInput) masterPasswordInput.value = '';
                if (confirmMasterPasswordInput) confirmMasterPasswordInput.value = '';
            }
        });
    }

    // --- START: Add Master Password Overlay Listeners ---
    if (masterPasswordRequestOverlay) {
        // Cancel button
        if (cancelMasterPasswordButton) {
            // Use handleMasterPasswordCancel from vault-ui.js (needs to be imported)
            // Use the imported handleMasterPasswordCancel function
            cancelMasterPasswordButton.addEventListener('click', handleMasterPasswordCancel);
        }
        // Click outside box
        masterPasswordRequestOverlay.addEventListener('click', (event) => {
            if (event.target === masterPasswordRequestOverlay) {
                // Use the imported handleMasterPasswordCancel function
                handleMasterPasswordCancel();
            }
        });
        // Form submission
        if (masterPasswordRequestForm) {
            // Use the imported handleMasterPasswordSubmit function
            masterPasswordRequestForm.addEventListener('submit', handleMasterPasswordSubmit);
        }
    }
     // --- END: Add Master Password Overlay Listeners ---


    // ==================== FORM SUBMISSIONS ====================
    if (addVaultForm) {
        addVaultForm.addEventListener('submit', handleAddVaultSubmit); // Re-enable listener
    }
    if (editVaultForm) {
        editVaultForm.addEventListener('submit', handleEditVaultSubmit); // Re-enable listener
    }
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const identifierInput = document.getElementById('login-identifier');
            const passwordInput = document.getElementById('login-password');
            const rememberMeInput = document.getElementById('remember-me'); // Get remember me checkbox
            const submitButton = loginForm.querySelector('button[type="submit"]');

            // For now, assume identifier is email. Add username lookup later if needed.
            const email = identifierInput.value.trim();
            const password = passwordInput.value;
            const rememberMeChecked = rememberMeInput.checked; // Get checked state

            if (!email || !password) {
                showNotification("Please enter both email/username and password.", "error");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Logging In...';

            // Store password VERY temporarily ONLY for key derivation after login success
            temporaryLoginPassword = password;

            try {
                // Pass rememberMeChecked state to logInUser
                const user = await logInUser(email, password, rememberMeChecked);
                console.log("Login successful, user verified:", user.uid);
                // NOTE: UI updates are now handled by onAuthChange after key derivation succeeds

                // Clear password from input field immediately after successful auth call
                passwordInput.value = '';

            } catch (error) {
                console.error("Login failed:", error);
                showNotification(error.message || "Login failed. Please try again.", "error");
                temporaryLoginPassword = null; // Clear temp password on any login failure
                passwordInput.value = ''; // Clear password field on error too
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Log In';
                // DO NOT clear temporaryLoginPassword here, needed by onAuthChange
            }

            // Removed duplicated block below
        });
    }

    // Forgot Password Form Submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const email = forgotEmailInput.value.trim();
            if (!email) {
                showNotification("Please enter your email address.", "error");
                return;
            }

            // Disable button, show loading state
            sendResetLinkButton.disabled = true;
            sendResetLinkButton.textContent = 'Sending...';
            forgotPasswordMessage.classList.add('hidden'); // Hide previous messages

            try {
                await sendPasswordReset(email);
                // Show success message regardless of whether user exists (security)
                forgotPasswordMessage.textContent = "If an account exists for " + email + ", you will receive a password reset link shortly. Please check your inbox (and spam folder).";
                forgotPasswordMessage.className = 'message success'; // Use success styling
                forgotPasswordMessage.classList.remove('hidden');
                forgotPasswordForm.reset(); // Clear the form
                // Optionally hide overlay after a delay
                // setTimeout(() => {
                //     if (forgotPasswordOverlay) forgotPasswordOverlay.classList.add('hidden');
                // }, 5000);
            } catch (error) {
                console.error("Forgot password error:", error);
                // Show specific error if available, otherwise generic
                forgotPasswordMessage.textContent = error.message || "Failed to send reset email. Please try again.";
                forgotPasswordMessage.className = 'message error'; // Use error styling
                forgotPasswordMessage.classList.remove('hidden');
            } finally {
                // Re-enable button
                sendResetLinkButton.disabled = false;
                sendResetLinkButton.textContent = 'Send Reset Link';
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const usernameInput = document.getElementById('signup-username');
            const emailInput = document.getElementById('signup-email');
            const passwordInput = document.getElementById('signup-password');
            const confirmPasswordInput = document.getElementById('signup-confirm-password');
            const birthdayInput = document.getElementById('signup-birthday');
            const genderInput = document.getElementById('signup-gender');
            const submitButton = signupForm.querySelector('button[type="submit"]');

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const username = usernameInput.value.trim();
            const birthday = birthdayInput.value;
            const gender = genderInput.value;

            // Basic validation
            if (password !== confirmPassword) {
                showNotification("Passwords do not match.", "error");
                confirmPasswordInput.focus();
                return;
            }
            if (password.length < 6) {
                // Firebase enforces 6 chars min, but good to check client-side too
                showNotification("Password must be at least 6 characters long.", "error");
                passwordInput.focus();
                return;
            }
            if (!username) {
                showNotification("Please enter a username.", "error");
                usernameInput.focus();
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Signing Up...';

            try {
                const user = await signUpUser(email, password); // Creates user & sends initial verification email
                console.log("Signup successful for user:", user.uid);

                // Generate a salt for the new user
                const salt = generateSalt();
                const saltBase64 = arrayBufferToBase64(salt); // Convert salt to base64 for storage

                // Save additional user info (including salt) to Firestore
                try {
                    await saveUserProfile(user.uid, {
                        username,
                        email, // Store email for potential lookup/display
                        birthday,
                        gender,
                        salt: saltBase64, // Store the salt
                        createdAt: new Date() // Use JS Date, Firestore converts it
                    });
                    console.log("User profile saved for:", user.uid);
                } catch (profileError) {
                    console.error("Failed to save user profile (including salt):", profileError);
                    // Non-critical error, proceed with signup flow but maybe log it
                    showNotification("Signup complete, but failed to save profile details.", "error");
                }

                showNotification("Signup successful! Please check your email (" + email + ") to verify your account before logging in.", "success", 10000); // Longer duration
                signupForm.reset();
                passwordStrengthIndicator.classList.add('hidden');
                // Stay on signup page to show verification message
                showSection('signup'); // Stay on signup section after successful signup

            } catch (error) {
                console.error("Signup failed:", error);
                showNotification(error.message || "Signup failed. Please try again.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Sign Up';
            }
        });
    }

    // ==================== OVERLAY BUTTONS ====================
    // These listeners were already present and should work with imported functions
    if (submitPinButton) submitPinButton.addEventListener('click', handlePinSubmit);
    if (cancelPinButton) cancelPinButton.addEventListener('click', handlePinCancel);
    if (cancelEditButton) cancelEditButton.addEventListener('click', handleEditVaultCancel);
    // Forgot Password Overlay Controls
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (forgotPasswordOverlay) {
                forgotPasswordOverlay.classList.remove('hidden');
                forgotPasswordMessage.classList.add('hidden'); // Hide any old messages
                forgotPasswordForm.reset(); // Clear form on open
            }
        });
    }
    if (cancelForgotPasswordButton) {
        cancelForgotPasswordButton.addEventListener('click', () => {
            if (forgotPasswordOverlay) forgotPasswordOverlay.classList.add('hidden');
        });
    }
    // Close overlay if clicking outside the box
    if (forgotPasswordOverlay) {
        forgotPasswordOverlay.addEventListener('click', (event) => {
            if (event.target === forgotPasswordOverlay) { // Check if click is on the background
                forgotPasswordOverlay.classList.add('hidden');
            }
        });
    }


    // ==================== VAULT LIST EVENT DELEGATION ====================
    // This listener was already present and should work with imported function
    if (vaultsContainer) {
        vaultsContainer.addEventListener('click', handleVaultActions);
    }

    // ==================== LOG OUT BUTTON ====================
    if (logoutButton) {
        logoutButton.addEventListener('click', async function(event) {
            event.preventDefault();
            if (confirm('Are you sure you want to log out?')) {
                try {
                    await logOutUser();
                    // UI changes will be handled by onAuthChange listener
                    showNotification("Logged out successfully.", "success");
                    // Clear any sensitive UI elements if needed (e.g., vault list)
                    if (vaultsContainer) vaultsContainer.innerHTML = '<p>Logged out.</p>';
                } catch (error) {
                    console.error("Logout failed:", error);
                    showNotification(error.message || "Logout failed.", "error");
                }
            }
        });
    }

    // ==================== Developer Toggle ====================
    // const devToggleContainer = document.querySelector('.dev-toggle-container[data-page="welcome"]'); // Selector moved to top
    if (devToggleContainer) {
      const toggleButton = devToggleContainer.querySelector('.dev-toggle-button');
      const content = devToggleContainer.querySelector('.dev-content');

      toggleButton.addEventListener('click', () => {
        if (!devToggleContainer.classList.contains('open')) {
          // Opening: move button up first
          devToggleContainer.classList.add('open');
          setTimeout(() => {
            content.classList.remove('hidden');
            content.classList.add('show');
          }, 400); // wait for button to move up
        } else {
          // Closing: hide content first
          content.classList.remove('show');
          content.classList.add('hidden');
          devToggleContainer.classList.add('closing');
          setTimeout(() => {
            devToggleContainer.classList.remove('open');
            devToggleContainer.classList.remove('closing');
          }, 400); // wait for panel to close before moving button down
        }
        });
    }

    // Delete Account Button Listener (in Settings)
    if (deleteAccountButton) {
        deleteAccountButton.addEventListener('click', () => {
            if (deleteAccountConfirmOverlay) {
                deleteAccountConfirmOverlay.classList.remove('hidden');
                deleteAccountMessage.classList.add('hidden'); // Hide old messages
                deleteAccountConfirmForm.reset(); // Clear form
            }
        });
    }

    // Delete Account Confirmation Overlay Listeners
    if (deleteAccountConfirmOverlay) {
        // Cancel button
        if (cancelDeleteButton) {
            cancelDeleteButton.addEventListener('click', () => {
                deleteAccountConfirmOverlay.classList.add('hidden');
            });
        }
        // Click outside box
        deleteAccountConfirmOverlay.addEventListener('click', (event) => {
            if (event.target === deleteAccountConfirmOverlay) {
                deleteAccountConfirmOverlay.classList.add('hidden');
            }
        });
        // Form submission
        if (deleteAccountConfirmForm) {
            deleteAccountConfirmForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const password = deleteConfirmPasswordInput.value;
                const user = auth.currentUser;

                if (!user) {
                    showNotification("Not logged in.", "error");
                    deleteAccountConfirmOverlay.classList.add('hidden');
                    return;
                }
                if (!password) {
                    deleteAccountMessage.textContent = "Please enter your password.";
                    deleteAccountMessage.className = 'message error';
                    deleteAccountMessage.classList.remove('hidden');
                    return;
                }

                confirmDeleteButton.disabled = true;
                confirmDeleteButton.textContent = 'Deleting...';
                deleteAccountMessage.classList.add('hidden');

                try {
                    // 1. Re-authenticate
                    console.log("Attempting re-authentication for deletion...");
                    await reauthenticateUser(password);
                    console.log("Re-authentication successful.");

                    // 2. Delete Firestore Vaults (Subcollection)
                    console.log("Attempting to delete Firestore vaults...");
                    await deleteAllUserVaults(user.uid);
                    console.log("Firestore vaults deleted.");

                    // 3. Delete Firestore User Profile (Document)
                    console.log("Attempting to delete Firestore user profile...");
                    await deleteUserProfile(user.uid);
                    console.log("Firestore user profile deleted.");

                    // 4. Delete Firebase Auth User (MUST be last)
                    console.log("Attempting to delete Firebase Auth user...");
                    await deleteCurrentUser();
                    console.log("Firebase Auth user deleted.");

                    // Success! onAuthChange will handle UI update to logged-out state.
                    deleteAccountConfirmOverlay.classList.add('hidden'); // Hide overlay
                    showNotification("Account deleted successfully.", "success");

                } catch (error) {
                    console.error("Account deletion failed:", error);
                    deleteAccountMessage.textContent = error.message || "Account deletion failed. Please try again.";
                    deleteAccountMessage.className = 'message error';
                    deleteAccountMessage.classList.remove('hidden');
                } finally {
                    confirmDeleteButton.disabled = false;
                    confirmDeleteButton.textContent = 'Delete My Account';
                    // Clear password field regardless of outcome
                    deleteConfirmPasswordInput.value = '';
                }
            });
        }
    }




    // ==================== AUTH STATE LISTENER ====================
    // This replaces the old initializeApp function
    onAuthChange(async (user) => { // Make the callback async to use await inside
        console.log("Auth state changed. User:", user ? user.uid : null, "Verified:", user ? user.emailVerified : null);
        // Clear any previous verification messages
        const existingVerificationMsg = document.getElementById('email-verification-message');
        if (existingVerificationMsg) existingVerificationMsg.remove();

        // Clear sensitive state on any auth change, before evaluating new state
        sessionEncryptionKey = null;
        // Don't clear temporaryLoginPassword here yet, might be needed if user just logged in

        if (user) {
            // User is logged in, now check verification status
            if (user.emailVerified) {
                // --- User is logged in and verified ---
                console.log("User logged in and verified. Attempting to derive key...");

                // Check if we have the temporary password from the login attempt.
                // This password is only available right after a successful login form submission.
                // If the user refreshes the page while logged in, temporaryLoginPassword will be null.
                // We need the password to derive the key. If it's null, we must force logout.
                if (!temporaryLoginPassword) {
                     // This happens on page refresh or if login flow failed before setting temp password.
                     // We cannot proceed without the password to derive the key.
                     console.warn("Password not available for key derivation (likely page refresh). Forcing logout.");
                     showNotification("Session expired or invalid. Please log in again.", "error", 5000);
                     logOutUser(); // Force logout
                     // UI update will happen in the 'else' block below when onAuthChange triggers again after logout
                     return;
                }

                // --- Proceed with key derivation ---
                try {
                    // 1. Fetch user profile to get salt
                    const userProfile = await getUserProfile(user.uid);
                    if (!userProfile || !userProfile.salt) {
                        console.error("User profile or salt not found for user:", user.uid);
                        throw new Error("User profile incomplete. Cannot derive encryption key.");
                    }
                    const salt = base64ToUint8Array(userProfile.salt);

                    // 2. Derive the encryption key
                    sessionEncryptionKey = await deriveKey(temporaryLoginPassword, salt);
                    console.log("Encryption key derived successfully for session.");

                    // 3. Clear the temporary password IMMEDIATELY after successful derivation
                    temporaryLoginPassword = null;

                    // 4. Pass the key to the vault logic module
                    setVaultEncryptionKey(sessionEncryptionKey); // From vault-logic.js

                    // 5. NOW set up the logged-in UI
                    authNav.classList.add('hidden');
                    mainNav.classList.remove('hidden');
                    if (devToggleContainer) devToggleContainer.classList.add('hidden'); // Hide dev toggle on main page
                    showSection('vault'); // Default to vault view
                    mainNavItems.forEach(item => {
                        const section = item.dataset.section;
                        if (section === 'accounts' || section === 'settings') {
                            item.classList.remove('hidden');
                            item.style.display = 'block';
                        }
                    });
                    // Load user data (profile, vaults) from Firestore
                    displayVaults(); // Call function from vault-ui.js to fetch and render vaults

                    // Populate Settings Page
                    if (userProfile) {
                        document.getElementById('settings-username').textContent = userProfile.username || 'N/A';
                        document.getElementById('settings-email').textContent = userProfile.email || 'N/A';
                        // Password is not stored/displayed
                        document.getElementById('settings-birthday').textContent = userProfile.birthday || 'N/A';
                        document.getElementById('settings-gender').textContent = userProfile.gender || 'N/A';
                    } else {
                         // Clear settings if profile somehow missing
                         document.getElementById('settings-username').textContent = 'Error loading';
                         document.getElementById('settings-email').textContent = 'Error loading';
                         document.getElementById('settings-birthday').textContent = 'Error loading';
                         document.getElementById('settings-gender').textContent = 'Error loading';
                    }


                } catch (keyError) {
                     // Handle errors during profile fetch or key derivation
                     console.error("Failed to get profile or derive key:", keyError);
                     showNotification("Login failed: Could not prepare secure session. Please log in again.", "error", 5000);
                     sessionEncryptionKey = null; // Ensure key is null
                     temporaryLoginPassword = null; // Clear temp password
                     setVaultEncryptionKey(null); // Clear key in vault-logic.js
                     logOutUser(); // Log the user out
                     // UI update will happen in the 'else' block below when onAuthChange triggers again after logout
                     return;
                }

            } else {
                // --- User is logged in but email NOT verified ---
                console.log("User logged in but email not verified.");
                // Clear any potentially stored temp password if user isn't verified
                temporaryLoginPassword = null;
                sessionEncryptionKey = null; // No key if not verified
                setVaultEncryptionKey(null); // Clear key in vault-logic.js

                authNav.classList.remove('hidden'); // Show auth nav (login/signup)
                mainNav.classList.add('hidden');   // Hide main app nav
                if (devToggleContainer) devToggleContainer.classList.remove('hidden'); // Show dev toggle on auth pages
                // If user is unverified, ensure they are on signup or login page.
                // If they just signed up, currentSectionId will be 'signup' due to the change above.
                // If they try to log in unverified, currentSectionId will be 'login'.
                // We want the message on the signup page if they just signed up.
                // If they are on login page and unverified, it's also okay to show it there,
                // but the primary request is for after signup.
                // For simplicity, we will always try to show it on signup page if unverified.
                // If signupSection is not visible, this won't show, which is fine.
                // The user will be redirected to 'login' by logInUser if they try to log in unverified.

                // Display a message prompting verification on the SIGNUP section
                const signupContainerParent = signupSection; // The whole section
                const signupAuthToggleLink = signupSection.querySelector('.auth-toggle-link'); // The "Already have an account?" link div

                if (signupContainerParent && signupAuthToggleLink) {
                    // Remove existing message first if present
                    let existingVerificationMsg = document.getElementById('email-verification-message');
                    if (existingVerificationMsg) existingVerificationMsg.remove();

                    // Create the new verification message element
                    let verificationMsg = document.createElement('div');
                    verificationMsg.id = 'email-verification-message'; // Assign ID
                    verificationMsg.classList.add('verification-message-container'); // Add class for styling
                    // Remove inline styles, will be handled by CSS
                    // verificationMsg.style.marginTop = '20px';
                    // verificationMsg.style.marginBottom = '15px';
                    // verificationMsg.style.padding = '10px';
                    // verificationMsg.style.border = '1px solid orange';
                    // verificationMsg.style.backgroundColor = '#fff3e0';
                    // verificationMsg.style.textAlign = 'center';
                    verificationMsg.innerHTML = `
                        Please check your email (<b>${user.email}</b>) and click the verification link to activate your account. <br/>If you don't see it, check your spam folder.
                        <button id="resend-verification-btn" class="auth-button verification-resend-button">Resend Verification Email</button>
                    `;
                    // Insert message before the "Already have an account? Log in" link
                    signupContainerParent.insertBefore(verificationMsg, signupAuthToggleLink);

                    // Add event listener for resend button
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if (resendBtn) {
                        resendBtn.addEventListener('click', async () => {
                            // The 'user' object from onAuthChange should be the correct one here
                            if (!user) return; // Should not happen in this block, but safety check
                            try {
                                // Use the imported sendEmailVerification function
                                await sendEmailVerification(user);
                                showNotification("Verification email resent. Please check your inbox.", "success");
                                resendBtn.disabled = true; // Disable after sending
                                resendBtn.textContent = 'Sent!';
                                // Re-enable after a delay? Optional.
                                // setTimeout(() => {
                                //     if(resendBtn) {
                                //         resendBtn.disabled = false;
                                //         resendBtn.textContent = 'Resend Verification Email';
                                //     }
                                // }, 60000); // e.g., re-enable after 60 seconds
                            } catch (error) {
                                console.error("Error resending verification email:", error);
                                showNotification("Failed to resend verification email. Please try again later.", "error");
                            }
                        });
                    }
                }
            }
        } else {
            // --- User is logged out ---
            console.log("User logged out.");
            // Ensure sensitive state is cleared
            sessionEncryptionKey = null;
            temporaryLoginPassword = null;
            setVaultEncryptionKey(null); // Clear key in vault-logic.js

            // Set UI to logged-out state
            authNav.classList.remove('hidden');
            mainNav.classList.add('hidden');
            if (devToggleContainer) devToggleContainer.classList.remove('hidden'); // Show dev toggle on auth pages
            showSection('login'); // Default to login view when logged out
            mainNavItems.forEach(item => {
                const section = item.dataset.section;
                if (section === 'accounts' || section === 'settings') {
                    item.classList.add('hidden');
                    item.style.display = 'none';
                }
            });
            // Clear sensitive data from UI
             if (vaultsContainer) vaultsContainer.innerHTML = '<p>Please log in to view vaults.</p>';
             // Potentially reset forms etc.
             loginForm.reset();
             signupForm.reset();
             passwordStrengthIndicator.classList.add('hidden');
        }
        updateNavStyles(); // Ensure nav highlighting is correct
    });

    // No need to call initializeApp() anymore, onAuthChange handles initial state

    // ==================== DARK MODE TOGGLE ====================
    function enableDarkMode() {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
        if (darkModeToggle) darkModeToggle.checked = true;
    }

    function disableDarkMode() {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
        if (darkModeToggle) darkModeToggle.checked = false;
    }

    // Check local storage on initial load
    if (localStorage.getItem('darkMode') === 'enabled') {
        enableDarkMode();
    } else {
        disableDarkMode(); // Default to light mode if no preference saved
    }

    // Add listener to the toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                enableDarkMode();
            } else {
                disableDarkMode();
            }
        });
    }

    // ==================== THEME SELECTION ====================
    function applyTheme(color, style) {
        document.body.dataset.themeColor = color;
        document.body.dataset.themeStyle = style;
        localStorage.setItem('themeColor', color);
        localStorage.setItem('themeStyle', style);
    }

    // Add listeners to theme color radios
    themeColorRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const selectedColor = radio.value;
            const selectedStyle = document.querySelector('input[name="theme-style"]:checked')?.value || 'gradient'; // Get current style or default
            applyTheme(selectedColor, selectedStyle);
        });
    });

    // Add listeners to theme style radios
    themeStyleRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const selectedStyle = radio.value;
            const selectedColor = document.querySelector('input[name="theme-color"]:checked')?.value || 'purple'; // Get current color or default
            applyTheme(selectedColor, selectedStyle);
        });
    });

    // Apply saved theme on initial load
    const savedColor = localStorage.getItem('themeColor') || 'purple'; // Default to purple
    const savedStyle = localStorage.getItem('themeStyle') || 'gradient'; // Default to gradient

    // Set the initial theme
    applyTheme(savedColor, savedStyle);

    // Update radio button checked state based on saved theme
    const savedColorRadio = document.querySelector(`input[name="theme-color"][value="${savedColor}"]`);
    if (savedColorRadio) {
        savedColorRadio.checked = true;
    }
    const savedStyleRadio = document.querySelector(`input[name="theme-style"][value="${savedStyle}"]`);
    if (savedStyleRadio) {
        savedStyleRadio.checked = true;
    }

    // ==================== AUTO LOGOUT FUNCTIONS ====================

    function ensureWarningElement() {
        if (!autoLogoutWarningElement) {
            autoLogoutWarningElement = document.getElementById('auto-logout-warning');
            if (!autoLogoutWarningElement) {
                // Create it if it doesn't exist in HTML
                autoLogoutWarningElement = document.createElement('div');
                autoLogoutWarningElement.id = 'auto-logout-warning';
                autoLogoutWarningElement.classList.add('auto-logout-warning', 'hidden'); // Add base class and hidden
                document.body.appendChild(autoLogoutWarningElement);
            }
        }
    }


    function updateCountdownMessage(secondsLeft) {
        ensureWarningElement();
        if (autoLogoutWarningElement) {
            autoLogoutWarningElement.textContent = `You will be logged out in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'} due to inactivity.`;
        }
    }

    function showLogoutWarning() {
        ensureWarningElement();
        console.log("Auto-logout: Showing warning.");
        if (autoLogoutWarningElement) {
            autoLogoutWarningElement.classList.remove('hidden');
        }

        let secondsRemaining = WARNING_COUNTDOWN_DURATION / 1000;
        updateCountdownMessage(secondsRemaining);

        // Clear previous interval if any
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        countdownIntervalId = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining > 0) {
                updateCountdownMessage(secondsRemaining);
            } else {
                // Handled by warningTimerId, but clear interval here
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
            }
        }, 1000);

        // Clear previous warning timer if any
        if (warningTimerId) clearTimeout(warningTimerId);
        warningTimerId = setTimeout(performAutoLogout, WARNING_COUNTDOWN_DURATION);
    }

    function performAutoLogout() {
        console.log("Auto-logout: Performing logout.");
        showNotification("You have been logged out due to inactivity.", "error", 10000);
        logOutUser(); // This will trigger onAuthChange, which should clean up timers/listeners
    }

    function clearLogoutTimersAndWarning() {
        console.log("Auto-logout: Clearing timers and warning.");
        if (inactivityTimerId) clearTimeout(inactivityTimerId);
        if (warningTimerId) clearTimeout(warningTimerId);
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        inactivityTimerId = null;
        warningTimerId = null;
        countdownIntervalId = null;

        ensureWarningElement();
        if (autoLogoutWarningElement) {
            autoLogoutWarningElement.classList.add('hidden');
            autoLogoutWarningElement.textContent = ''; // Clear text
        }
    }

    function startAutoLogoutTimers() {
        clearLogoutTimersAndWarning(); // Clear any existing timers first
        console.log("Auto-logout: Starting inactivity timer.");
        inactivityTimerId = setTimeout(showLogoutWarning, INACTIVITY_TIMEOUT_DURATION - WARNING_COUNTDOWN_DURATION);
    }

    function handleUserActivity() {
        // This function should only reset timers if they are active (i.e., user is logged in)
        // The onAuthChange logic will manage adding/removing listeners, so if this fires, timers should be relevant.
        console.log("Auto-logout: User activity detected, resetting timer.");
        startAutoLogoutTimers();
    }

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];

    function addActivityListeners() {
        console.log("Auto-logout: Adding activity listeners.");
        activityEvents.forEach(event => {
            window.addEventListener(event, handleUserActivity, { passive: true });
        });
    }

    function removeActivityListeners() {
        console.log("Auto-logout: Removing activity listeners.");
        activityEvents.forEach(event => {
            window.removeEventListener(event, handleUserActivity);
        });
    }

    // Modify onAuthChange to manage auto-logout
    const originalOnAuthChange = onAuthChange; // Keep a reference if needed, or replace directly
    // Replace onAuthChange listener
    onAuthChange(async (user) => { // Make the callback async to use await inside
        console.log("Auth state changed. User:", user ? user.uid : null, "Verified:", user ? user.emailVerified : null);
        const existingVerificationMsg = document.getElementById('email-verification-message');
        if (existingVerificationMsg) existingVerificationMsg.remove();

        sessionEncryptionKey = null;
        clearLogoutTimersAndWarning(); // Clear auto-logout timers on any auth state change first
        removeActivityListeners();     // Remove listeners too

        if (user) {
            if (user.emailVerified) {
                // --- User is logged in and verified ---
                // (Original key derivation and UI setup logic...)
                console.log("User logged in and verified. Attempting to derive key...");
                if (!temporaryLoginPassword) {
                     console.warn("Password not available for key derivation (likely page refresh). Forcing logout.");
                     showNotification("Session expired or invalid. Please log in again.", "error", 5000);
                     logOutUser();
                     return;
                }
                try {
                    const userProfile = await getUserProfile(user.uid);
                    if (!userProfile || !userProfile.salt) {
                        console.error("User profile or salt not found for user:", user.uid);
                        throw new Error("User profile incomplete. Cannot derive encryption key.");
                    }
                    const salt = base64ToUint8Array(userProfile.salt);
                    sessionEncryptionKey = await deriveKey(temporaryLoginPassword, salt);
                    console.log("Encryption key derived successfully for session.");
                    temporaryLoginPassword = null;
                    setVaultEncryptionKey(sessionEncryptionKey);

                    authNav.classList.add('hidden');
                    mainNav.classList.remove('hidden');
                    if (devToggleContainer) devToggleContainer.classList.add('hidden');
                    showSection('vault');
                    mainNavItems.forEach(item => {
                        const section = item.dataset.section;
                        if (section === 'accounts' || section === 'settings') {
                            item.classList.remove('hidden');
                            item.style.display = 'block';
                        }
                    });
                    displayVaults();
                    if (userProfile) {
                        document.getElementById('settings-username').textContent = userProfile.username || 'N/A';
                        document.getElementById('settings-email').textContent = userProfile.email || 'N/A';
                        document.getElementById('settings-birthday').textContent = userProfile.birthday || 'N/A';
                        document.getElementById('settings-gender').textContent = userProfile.gender || 'N/A';
                    } else {
                         document.getElementById('settings-username').textContent = 'Error loading';
                         document.getElementById('settings-email').textContent = 'Error loading';
                         document.getElementById('settings-birthday').textContent = 'Error loading';
                         document.getElementById('settings-gender').textContent = 'Error loading';
                    }

                    // START AUTO-LOGOUT FEATURE
                    startAutoLogoutTimers();
                    addActivityListeners();
                    // ---

                    // Show Profile Feature & Populate
                    if (profileFeatureContainer) profileFeatureContainer.classList.remove('hidden');
                    if (userProfile) {
                        if (dropdownUsernameValue) dropdownUsernameValue.textContent = userProfile.username || 'N/A';
                        if (dropdownEmailValue) dropdownEmailValue.textContent = userProfile.email || 'N/A';
                        // Set profile picture source
                        if (profilePicture) {
                            profilePicture.src = userProfile.photoURL || 'images/default-profile.png'; // Use photoURL or default
                        }
                    } else {
                        // Fallback if profile somehow missing after successful key derivation
                        if (profilePicture) profilePicture.src = 'images/default-profile.png';
                    }

                } catch (keyError) {
                     console.error("Failed to get profile or derive key:", keyError);
                     showNotification("Login failed: Could not prepare secure session. Please log in again.", "error", 5000);
                     sessionEncryptionKey = null;
                     temporaryLoginPassword = null;
                     setVaultEncryptionKey(null);
                     logOutUser();
                     return;
                }
            } else {
                // --- User is logged in but email NOT verified ---
                // (Original unverified user logic...)
                console.log("User logged in but email not verified.");
                temporaryLoginPassword = null;
                sessionEncryptionKey = null;
                setVaultEncryptionKey(null);
                authNav.classList.remove('hidden');
                mainNav.classList.add('hidden');
                if (profileFeatureContainer) profileFeatureContainer.classList.add('hidden'); // Hide profile feature
                if (devToggleContainer) devToggleContainer.classList.remove('hidden');

                const signupContainerParent = signupSection;
                const signupAuthToggleLink = signupSection.querySelector('.auth-toggle-link');
                if (signupContainerParent && signupAuthToggleLink) {
                    let existingVerificationMsg = document.getElementById('email-verification-message');
                    if (existingVerificationMsg) existingVerificationMsg.remove();
                    let verificationMsg = document.createElement('div');
                    verificationMsg.id = 'email-verification-message';
                    verificationMsg.classList.add('verification-message-container');
                    verificationMsg.innerHTML = `
                        Please check your email (<b>${user.email}</b>) and click the verification link to activate your account. <br/>If you don't see it, check your spam folder.
                        <button id="resend-verification-btn" class="auth-button verification-resend-button">Resend Verification Email</button>
                    `;
                    signupContainerParent.insertBefore(verificationMsg, signupAuthToggleLink);
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if (resendBtn) {
                        resendBtn.addEventListener('click', async () => {
                            if (!user) return;
                            try {
                                await sendEmailVerification(user);
                                showNotification("Verification email resent. Please check your inbox.", "success");
                                resendBtn.disabled = true;
                                resendBtn.textContent = 'Sent!';
                            } catch (error) {
                                console.error("Error resending verification email:", error);
                                showNotification("Failed to resend verification email. Please try again later.", "error");
                            }
                        });
                    }
                }
                 // Ensure user is on an auth page if not verified
                if (currentSectionId !== 'signup' && currentSectionId !== 'login' && currentSectionId !== 'about') {
                    showSection('login');
                }
            }
        } else {
            // --- User is logged out ---
            // (Original logged out logic...)
            console.log("User logged out.");
            sessionEncryptionKey = null;
            temporaryLoginPassword = null;
            setVaultEncryptionKey(null);
            authNav.classList.remove('hidden');
            mainNav.classList.add('hidden');
            if (profileFeatureContainer) profileFeatureContainer.classList.add('hidden'); // Hide profile feature
            if (profileDropdown) profileDropdown.classList.add('hidden'); // Ensure dropdown is hidden on logout
            if (devToggleContainer) devToggleContainer.classList.remove('hidden');
            showSection('login');
            mainNavItems.forEach(item => {
                const section = item.dataset.section;
                if (section === 'accounts' || section === 'settings') {
                    item.classList.add('hidden');
                    item.style.display = 'none';
                }
            });
            if (vaultsContainer) vaultsContainer.innerHTML = '<p>Please log in to view vaults.</p>';
            loginForm.reset();
            signupForm.reset();
            passwordStrengthIndicator.classList.add('hidden');
        }
        updateNavStyles();
    }); // This replaces the previous onAuthChange call.

    // ==================== PROFILE PICTURE FEATURE LISTENERS ====================
    if (profilePicture && profileDropdown) {
        profilePicture.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent click from immediately closing dropdown via window listener
            profileDropdown.classList.toggle('hidden');
            if (!profileDropdown.classList.contains('hidden')) {
                // Re-fetch and populate user info in case it changed or wasn't loaded initially
                const user = auth.currentUser;
                if (user && user.emailVerified) {
                    try {
                        const userProfile = await getUserProfile(user.uid);
                        if (userProfile) {
                            if (dropdownUsernameValue) dropdownUsernameValue.textContent = userProfile.username || 'N/A';
                            if (dropdownEmailValue) dropdownEmailValue.textContent = userProfile.email || 'N/A';
                            // Update profile picture source in dropdown view as well
                            if (profilePicture) {
                                profilePicture.src = userProfile.photoURL || 'images/default-profile.png';
                            }
                        }
                    } catch (error) {
                        console.error("Error fetching user profile for dropdown:", error);
                        if (dropdownUsernameValue) dropdownUsernameValue.textContent = 'Error';
                        if (dropdownEmailValue) dropdownEmailValue.textContent = 'Error';
                    }
                }
            }
        });
    }

    if (dropdownLogoutButton) {
        dropdownLogoutButton.addEventListener('click', async (event) => {
            event.preventDefault();
            // Could add a confirm dialog here if desired, similar to main logout
            // if (confirm('Are you sure you want to log out?')) {
            try {
                await logOutUser();
                showNotification("Logged out successfully.", "success");
                if (profileDropdown) profileDropdown.classList.add('hidden'); // Hide dropdown
                // Other UI changes handled by onAuthChange
            } catch (error) {
                console.error("Logout from dropdown failed:", error);
                showNotification(error.message || "Logout failed.", "error");
            }
            // }
        });
    }

    if (dropdownChangePictureButton && profilePictureInput) {
        dropdownChangePictureButton.addEventListener('click', () => {
            // Trigger the hidden file input
            profilePictureInput.click();
            if (profileDropdown) profileDropdown.classList.add('hidden'); // Hide dropdown
        });
    }

    // Listener for the hidden file input
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', handleProfilePictureChange);
    }

    async function handleProfilePictureChange(event) {
        console.log("handleProfilePictureChange triggered."); // Log function start
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return; // No file selected
        }
        console.log("File selected:", file.name, file.type, file.size);

        const user = auth.currentUser;
        if (!user) {
            console.error("User not logged in for profile picture change.");
            showNotification("You must be logged in to change your picture.", "error");
            return;
        }
        console.log("User ID:", user.uid);

        // Basic validation
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            console.warn("Invalid file type selected:", file.type);
            showNotification("Invalid file type. Please select a PNG, JPG, or GIF image.", "error");
            profilePictureInput.value = ''; // Reset input
            return;
        }
        console.log("File type validation passed.");

        // Size check - Firestore documents have a 1 MiB limit.
        // Base64 encoding adds ~33% overhead. Let's set a limit around 0.7MB for the original file.
        const maxSizeMB = 0.7;
        if (file.size > maxSizeMB * 1024 * 1024) {
             console.warn("File size exceeds limit for Firestore storage:", file.size);
             showNotification(`File is too large for profile picture (max ${maxSizeMB}MB).`, "error");
             profilePictureInput.value = ''; // Reset input
             return;
        }
        console.log("File size validation passed.");

        showNotification("Processing profile picture...", "success");
        showLoadingOverlay();
        console.log("Starting FileReader process...");

        const reader = new FileReader();

        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            console.log("FileReader success, Data URL length:", dataUrl.length);

            try {
                // Update Firestore user profile with the new photoURL (Data URL)
                console.log("Updating Firestore profile with Data URL...");
                await saveUserProfile(user.uid, { photoURL: dataUrl });
                console.log('User profile updated with new photoURL (Data URL).');

                // Update the profile picture image source in the UI
                if (profilePicture) {
                    console.log("Updating UI profile picture src with Data URL.");
                    profilePicture.src = dataUrl;
                } else {
                    console.warn("Profile picture element not found in UI to update src.");
                }

                showNotification("Profile picture updated successfully!", "success");

            } catch (error) {
                console.error("Error saving Data URL to Firestore:", error);
                showNotification("Failed to save profile picture. Please try again.", "error");
            } finally {
                console.log("Firestore update process finished (onload finally).");
                hideLoadingOverlay();
                profilePictureInput.value = ''; // Reset input value regardless of outcome
            }
        };

        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            showNotification("Failed to read image file.", "error");
            hideLoadingOverlay();
            profilePictureInput.value = ''; // Reset input value
        };

        // Read the file as Data URL
        reader.readAsDataURL(file);
    }

    // Close dropdown if clicking outside
    window.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
            if (!profileFeatureContainer.contains(event.target)) {
                profileDropdown.classList.add('hidden');
            }
        }
    });

});
