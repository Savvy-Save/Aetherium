# Aetherium - Search Help

This document provides a searchable index to help you quickly locate specific features and functionalities within the Aetherium Password Vault Manager project. It outlines the relevant files, code sections, and key concepts for various aspects of the application.

## Table of Contents

- [Authentication](#authentication)
- [Vault Management](#vault-management)
- [PIN Protection](#pin-protection)
- [Encryption](#encryption)
- [UI Components](#ui-components)
- [Firebase](#firebase)
- [Dependencies (package.json)](#dependencies-packagejson)

---

## Authentication

### Sign Up

- **Functionality:** Creating a new user account with email and password, sending a verification email.
- **JS:** `js/auth.js#signUpUser`
    - Calls `createUserWithEmailAndPassword` (Firebase Auth).
    - Calls `sendEmailVerification` (Firebase Auth).
    - Generates and saves a salt to Firestore (`js/database.js#saveUserProfile`).
- **UI:** `index.html#signup-section` (Sign Up form)
    - Event listener attached to `index.html#signup-form` in `script.js`.

### Log In

- **Functionality:** Signing in an existing user with email and password, checking email verification status.
- **JS:** `js/auth.js#logInUser`
    - Calls `signInWithEmailAndPassword` (Firebase Auth).
    - Checks `user.emailVerified`.
- **UI:** `index.html#login-section` (Log In form)
    - Event listener attached to `index.html#login-form` in `script.js`.

### Email Verification

- **Functionality:** Sending a verification email to the user's registered email address.
- **JS:** `js/auth.js#sendEmailVerification` (Firebase Auth).
- **UI:** `index.html#login-section` (Resend verification email button, shown when email is not verified).

### Logout

- **Functionality:** Signing out the currently logged-in user.
- **JS:** `js/auth.js#logOutUser`
    - Calls `signOut` (Firebase Auth).
    - Clears session data.
- **UI:** `index.html#main-nav` (Log Out button)
    - Event listener attached to `index.html#logoutButton` in `script.js`.

### Authentication State Listener

- **Functionality:** Reacting to changes in the user's authentication state (logged in, logged out).
- **JS:** `js/auth.js#onAuthChange`
    - Sets up a listener using `onAuthStateChanged` (Firebase Auth).
    - The callback function in `script.js` handles UI updates, key derivation, and vault loading.

---

## Vault Management

### Adding a Vault

- **Functionality:** Adding a new password vault to the user's account.
- **JS:** `js/vault-ui.js#handleAddVaultSubmit`
    - Collects data from the 'Add Vault' form.
    - Calls `js/vault-logic.js#prepareAddVaultData` to encrypt sensitive data.
    - Calls `js/database.js#addVault` to save the vault to Firestore.
    - Calls `js/vault-logic.js#fetchAndDecryptVaults` to refresh the local cache.
    - Calls `js/vault-ui.js#renderVaultsUI` to update the UI.
- **UI:** `index.html#vault-section` (Add Vault form)
    - Event listener attached to `index.html#add-vault-form` in `script.js`.

### Editing a Vault

- **Functionality:** Editing an existing password vault.
- **JS:** `js/vault-ui.js#handleEditVaultSubmit`
    - Collects data from the 'Edit Vault' form.
    - Calls `js/vault-logic.js#prepareEditVaultData` to encrypt changed data.
    - Calls `js/database.js#updateVault` to update the vault in Firestore.
    - Calls `js/vault-logic.js#fetchAndDecryptVaults` to refresh the local cache.
    - Calls `js/vault-ui.js#renderVaultsUI` to update the UI.
- **UI:** `index.html#edit-vault-overlay` (Edit Vault form within overlay)
    - Event listener attached to `index.html#edit-vault-form` in `script.js`.

### Deleting a Vault

- **Functionality:** Deleting a password vault.
- **JS:** `js/vault-ui.js#handleVaultActions` -> `js/vault-logic.js#deleteVault`
    - Calls `js/database.js#deleteVaultDoc` to delete the vault from Firestore.
    - Removes the vault from the local cache.
    - Calls `js/vault-ui.js#renderVaultsUI` to update the UI.
- **UI:** `index.html#vaults-container` (Delete button within each vault item)
    - Event listener attached to `index.html#vaults-container` in `script.js` (event delegation).

### Displaying Vaults

- **Functionality:** Displaying the list of password vaults.
- **JS:** `js/vault-ui.js#displayVaults`
    - Calls `js/vault-logic.js#fetchAndDecryptVaults` to retrieve and decrypt the vault data.
    - Calls `js/vault-ui.js#renderVaultsUI` to generate the HTML for each vault item and add it to the DOM.
- **UI:** `index.html#vaults-container` (Container for vault items)

---

## PIN Protection

### Requesting PIN

- **Functionality:** Displaying the PIN request overlay and setting up the callback function to be executed after successful PIN entry.
- **JS:** `js/vault-ui.js#requestPinForAction`
    - Checks if the vault has a PIN using `js/vault-logic.js#vaultHasPin`.
    - Displays the PIN request overlay (`index.html#pin-request-overlay`).
    - Stores the vault ID, action type, and callback function in module state variables.
- **UI:** `index.html#pin-request-overlay` (PIN request overlay)

### Validating PIN

- **Functionality:** Validating the user-entered PIN against the stored PIN for a vault.
- **JS:** `js/vault-logic.js#validatePin`
    - Compares the entered PIN with the decrypted PIN stored in the local cache.
- **UI:** `index.html#pin-request-overlay` (PIN input field)
    - Called from `js/vault-ui.js#handlePinSubmit` after the user submits the PIN.

---

## Encryption

### Key Derivation

- **Functionality:** Deriving a strong cryptographic key from the user's password and salt using PBKDF2.
- **JS:** `js/encryption.js#deriveKey`
    - Uses the Web Crypto API to perform PBKDF2 key derivation.
    - Requires a unique salt for each user.
    - The derived key is used for AES-GCM encryption/decryption.

### Encryption and Decryption

- **Functionality:** Encrypting and decrypting sensitive vault data (passwords, PINs) using AES-GCM.
- **JS:** `js/encryption.js#encryptData` and `js/encryption.js#decryptData`
    - Use the Web Crypto API to perform AES-GCM encryption and decryption.
    - Requires a unique Initialization Vector (IV) for each encryption operation.

### Salt Generation

- **Functionality:** Generating a cryptographically secure random salt for each user.
- **JS:** `js/encryption.js#generateSalt`
    - Uses the Web Crypto API to generate a random salt.
    - The salt is stored in the user's Firestore profile.

### Base64 Conversion

- **Functionality:** Converting binary data (ArrayBuffers, Uint8Arrays) to Base64 strings for storage in Firestore, and vice versa.
- **JS:** `js/encryption.js#arrayBufferToBase64` and `js/encryption.js#base64ToUint8Array`
    - Use the browser's built-in `btoa` and `atob` functions for Base64 encoding and decoding.

---

## UI Components

### Navigation Bars

- **Files:** `index.html`, `css/components.css`
- **Description:**
    - `index.html#main-nav`: Main application navigation (visible when logged in).
    - `index.html#auth-nav`: Authentication navigation (visible when logged out).
    - Styles are defined in `css/components.css` and adjusted for responsiveness in `css/layout.css`.
    - Navigation logic is handled in `script.js` using `showSection` and `updateNavStyles`.

### Forms and Inputs

- **Files:** `index.html`, `css/components.css`
- **Description:**
    - Styles for forms, input fields, labels, and password visibility toggles are defined in `css/components.css`.
    - Form submission logic is handled in `script.js` and delegates data processing to other modules.

### Overlays (PIN Request, Edit Vault)

- **Files:** `index.html`, `css/components.css`, `js/vault-ui.js`
- **Description:**
    - `index.html#pin-request-overlay`: The PIN request overlay is used to prompt the user for their PIN before performing sensitive actions.
    - `index.html#edit-vault-overlay`: The Edit Vault overlay contains the form for editing vault details.
    - Styles for overlays and their content boxes are defined in `css/components.css`.
    - The display and interaction logic for these overlays is handled in `js/vault-ui.js`.

### Notifications

- **Files:** `css/components.css`, `js/utils.js`
- **Description:**
    - The `showNotification` function in `js/utils.js` is used to display temporary notification messages to the user.
    - Styles for success and error notifications are defined in `css/components.css`.

### Vault Items

- **Files:** `index.html`, `css/components.css`, `js/vault-ui.js`
- **Description:**
    - Styles for individual vault items in the vault list are defined in `css/components.css`.
    - The HTML structure for each vault item is generated by `js/vault-ui.js#renderVaultsUI`.
    - Event handling for actions within vault items (show password, edit, delete) is managed by `js/vault-ui.js#handleVaultActions`.

### Developer Toggle

- **Files:** `index.html`, `css/components.css`, `script.js`
- **Description:**
    - A cosmetic toggle on the welcome page to show developer names.
    - Styles are defined in `css/components.css`.
    - Toggle logic is handled in `script.js` using basic DOM manipulation and CSS transitions.

---

## Firebase

### Firebase Authentication

- **Files:** `js/auth.js`, `script.js`
- **Description:**
    - Handles user sign-up, login, logout, and email verification.
    - Uses Firebase Authentication SDK functions.
    - The `onAuthChange` listener in `script.js` is the core mechanism for reacting to authentication state changes.

### Firebase Firestore

- **Files:** `js/database.js`, `js/vault-logic.js`
- **Description:**
    - Stores user profiles and vault data.
    - Uses Firestore's document and collection structure.
    - Sensitive data (passwords, PINs) is encrypted before being stored.

### Firebase Configuration

- **File:** `js/firebase-config.js`
- **Description:**
    - Contains the Firebase project configuration object, including API keys, project ID, and other settings.
    - This file should be kept secure and not exposed publicly.

---

## Dependencies (package.json)

- **firebase**: The core Firebase JavaScript SDK, providing access to Firebase Authentication, Firestore, and other services.
    - Used in `js/auth.js` and `js/database.js` for authentication and database operations.
