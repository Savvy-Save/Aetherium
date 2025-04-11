// Main UI logic for Password Vault Manager
// Depends on: utils.js, storage.js, vault.js, auth.js, database.js, encryption.js
import { showNotification, generatePassword } from './js/utils.js'; // Import necessary utils
import { signUpUser, logInUser, onAuthChange, logOutUser, auth } from './js/auth.js'; // Import Firebase auth functions (including auth instance for sendEmailVerification)
import { saveUserProfile, getUserProfile } from './js/database.js'; // Import Firestore functions
import { generateSalt, arrayBufferToBase64, deriveKey, base64ToUint8Array } from './js/encryption.js'; // Import encryption utils
// Import vault functions
import {
    setVaultEncryptionKey, // Import function to set key in vault module
    displayVaults,
    handleAddVaultSubmit,
    handleEditVaultSubmit,
    handlePinSubmit,
    handlePinCancel,
    handleEditVaultCancel,
    handleVaultActions
} from './js/vault.js';

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

    // Optional checkboxes (username, email, pin)
    const optionalCheckboxes = document.querySelectorAll('.optional-checkbox input[type="checkbox"]');

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
            const submitButton = loginForm.querySelector('button[type="submit"]');

            // For now, assume identifier is email. Add username lookup later if needed.
            // For now, assume identifier is email. Add username lookup later if needed.
            const email = identifierInput.value.trim();
            const password = passwordInput.value; // Get password

            if (!email || !password) {
                showNotification("Please enter both email and password.", "error");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Logging In...';

            // Store password VERY temporarily ONLY for key derivation after login success
            temporaryLoginPassword = password;

            try {
                // logInUser checks email/password AND verification status
                const user = await logInUser(email, password);
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
                // Stay on signup/login page, prompt user to verify email
                showSection('login'); // Switch to login section after successful signup

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
    const devToggleContainer = document.querySelector('.dev-toggle-container[data-page="welcome"]');
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

                    // 4. Pass the key to the vault module
                    setVaultEncryptionKey(sessionEncryptionKey);

                    // 5. NOW set up the logged-in UI
                    authNav.classList.add('hidden');
                    mainNav.classList.remove('hidden');
                    showSection('vault'); // Default to vault view
                    mainNavItems.forEach(item => {
                        const section = item.dataset.section;
                        if (section === 'accounts' || section === 'settings') {
                            item.classList.remove('hidden');
                            item.style.display = 'block';
                        }
                    });
                    // Load user data (profile, vaults) from Firestore
                    displayVaults(); // Call function from vault.js to fetch and render vaults
                    // TODO: Load user profile data for settings page (using userProfile fetched above)
                    // Example: if(userProfile) document.getElementById('settings-username').textContent = userProfile.username;

                } catch (keyError) {
                     // Handle errors during profile fetch or key derivation
                     console.error("Failed to get profile or derive key:", keyError);
                     showNotification("Login failed: Could not prepare secure session. Please log in again.", "error", 5000);
                     sessionEncryptionKey = null; // Ensure key is null
                     temporaryLoginPassword = null; // Clear temp password
                     setVaultEncryptionKey(null); // Clear key in vault module
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
                setVaultEncryptionKey(null); // Clear key in vault module

                authNav.classList.remove('hidden'); // Show auth nav (login/signup)
                mainNav.classList.add('hidden');   // Hide main app nav
                showSection('login'); // Default to login view when logged out

                    // Display a message prompting verification
                    const loginContainer = loginSection.querySelector('.auth-form');
                    if (loginContainer) {
                        // Check if the verification message already exists
                        let verificationMsg = document.getElementById('email-verification-message');
                    verificationMsg.style.marginTop = '15px';
                    verificationMsg.style.padding = '10px';
                    verificationMsg.style.border = '1px solid orange';
                    verificationMsg.style.backgroundColor = '#fff3e0';
                    verificationMsg.innerHTML = `
                        Please check your email (<b>${user.email}</b>) and click the verification link to activate your account. <br/>If you don't see it, check your spam folder.
                        <button id="resend-verification-btn" style="margin-left: 10px; padding: 5px; margin-top: 5px;">Resend Verification Email</button>
                    `;
                    // Insert message at the top of the form
                    loginContainer.prepend(verificationMsg);

                    // Add event listener for resend button
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if (resendBtn) {
                        resendBtn.addEventListener('click', async () => {
                            // The 'user' object from onAuthChange should be the correct one here
                            if (!user) return; // Should not happen in this block, but safety check
                            try {
                                // Dynamically import sendEmailVerification from CDN URL
                                const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
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
            setVaultEncryptionKey(null); // Clear key in vault module

            // Set UI to logged-out state
            authNav.classList.remove('hidden');
            mainNav.classList.add('hidden');
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
});

