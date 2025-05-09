# Password Vault Manager (Aetherium)

A secure, modular, single-page web application for managing passwords and sensitive vault data, utilizing Firebase for authentication and database storage, and the Web Crypto API for client-side encryption.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Application Flow](#application-flow)
- [Modules](#modules)
- [UI Navigation](#ui-navigation)
- [Vault Management & Security](#vault-management--security)
- [File Descriptions](#file-descriptions)

---

## Overview

This is a **single-page application (SPA)** built with vanilla JavaScript, HTML, and CSS. It allows users to:

- Sign up and log in securely using **Firebase Authentication** (with email verification).
- Add, edit, and delete password vaults stored securely in **Firebase Firestore**.
- Encrypt sensitive vault data (passwords, PINs) **client-side** using the **Web Crypto API (AES-GCM)** with a key derived from the user's password.
- Protect vaults with optional PIN codes.
- Generate strong random passwords.

---

## Project Structure

```
Aetherium/
├── index.html            # Main HTML file, contains all UI sections
├── script.js             # Main UI logic, event handling, auth state coordination
├── firebase.json         # Firebase hosting/functions configuration
├── package.json          # Project dependencies (e.g., Firebase CLI)
├── package-lock.json     # Dependency lock file
├── js/
│   ├── firebase-config.js# Firebase project credentials and initialization export
│   ├── auth.js           # Firebase Authentication logic (signup, login, logout, state)
│   ├── database.js       # Firebase Firestore interaction (user profiles, vault CRUD)
│   ├── encryption.js     # Web Crypto API logic (key derivation, encrypt/decrypt)
│   ├── vault-logic.js    # Core vault state, PIN validation, data prep, fetch/decrypt
│   ├── vault-ui.js       # Vault UI rendering, event handling, overlays
│   └── utils.js          # Helper functions (password generation, notifications)
├── css/                  # Modular CSS files
│   ├── base.css          # Base styles and reset
│   ├── layout.css        # Responsive layout adjustments
│   ├── components.css    # Styles for UI components (nav, buttons, forms, etc.)
│   ├── sections.css      # Styles specific to main content sections
│   └── utilities.css     # Utility classes (e.g., .hidden)
├── spider-cursor/        # Spider cursor effect assets
│   ├── spider-cursor.css
│   └── spider-cursor.js
└── README.md             # This documentation
```

---

## Application Flow

### 1. **Startup**
- Browser loads `index.html`. CSS files are linked.
- Deferred module scripts (`utils.js`, `auth.js`, `encryption.js`, `database.js`, `vault-logic.js`, `vault-ui.js`, `script.js`) are loaded.
- `script.js` runs on `DOMContentLoaded`.
- **Firebase Authentication listener (`onAuthChange` in `auth.js`) is set up** by `script.js` to monitor login state.

### 2. **Initial State & Authentication**
- If the user is **logged out**, the **Sign Up/Log In** forms (`auth-nav`, relevant sections) are shown.
- If the user is **logged in but email is not verified**, the Log In form is shown with a prompt to verify email (and a resend button).
- If the user is **logged in and verified**:
    - `script.js` retrieves the password entered during login (temporarily stored).
    - It fetches the user's **salt** from their Firestore profile (`database.js`).
    - It derives the **session encryption key** using the password and salt (`encryption.js`).
    - The key is passed to the vault logic module (`vault-logic.js`).
    - The main application UI (`main-nav`, relevant sections) is shown.
    - Vaults are fetched from Firestore, decrypted, and displayed (`vault-logic.js` + `vault-ui.js`).
- If the user refreshes while logged in, they are prompted to log in again because the password needed for key derivation is not persisted.

### 3. **Sign Up / Log In**
- **Sign Up:**
    - User enters details. `auth.js` calls `createUserWithEmailAndPassword`.
    - A **verification email** is sent automatically by Firebase.
    - A unique **salt** is generated (`encryption.js`) and saved to the user's Firestore profile along with other details (`database.js`).
    - User is prompted to check email and verify before logging in.
- **Log In:**
    - User enters credentials. `auth.js` calls `signInWithEmailAndPassword`.
    - **Email verification status is checked.** Access is denied if not verified.
    - On success, the `onAuthChange` listener proceeds with key derivation and UI setup.

### 4. **Navigation**
- Clicking nav items shows/hides sections dynamically using JavaScript and CSS utility classes (`.hidden`). No page reloads occur.
- The layout adjusts (sidebar vs. centered) based on login state (`main-nav` vs `auth-nav` visibility) using CSS `:has()`.

### 5. **Vault Management**
- Vaults are stored as documents in a **subcollection** under the user's document in **Firestore** (`users/{userId}/vaults`).
- **Encryption:** Before saving to Firestore, sensitive fields (`password`, `pin`) are **encrypted** using AES-GCM with the user's session key (`vault-logic.js` calls `encryption.js`). The IV is stored alongside the ciphertext.
- **Decryption:** When vaults are fetched, they are **decrypted** using the session key before being displayed or used (`vault-logic.js` calls `encryption.js`).
- **CRUD Operations:**
    - **Add:** Data collected from form, prepared/encrypted by `vault-logic.js`, saved via `database.js`. UI updated via `vault-ui.js`.
    - **Edit:** Data loaded into overlay, changes collected, prepared/encrypted by `vault-logic.js`, updated via `database.js`. UI updated. Requires PIN verification if set.
    - **Delete:** Confirmation requested, deletion performed via `database.js` (logic called from `vault-ui.js`). UI updated. Requires PIN verification if set.
- **PIN Protection:** Optional PINs (also encrypted) gate access to viewing passwords and performing edit/delete actions. PINs are validated against the decrypted value stored in the local cache (`vault-logic.js`).

### 6. **Password Generation**
- Users can generate strong random passwords using `window.crypto.getRandomValues` (`utils.js`).

---

## Modules

- **`script.js`**: Main coordinator. Initializes UI, sets up auth listener, handles navigation logic, wires up event listeners for forms/buttons to call functions in other modules. Manages session key derivation flow.
- **`firebase-config.js`**: Exports the Firebase project configuration object.
- **`auth.js`**: Handles all Firebase Authentication interactions (signup, login, logout, email verification, auth state listening).
- **`database.js`**: Handles all Firebase Firestore interactions (saving/getting user profiles, CRUD operations for vaults).
- **`encryption.js`**: Implements cryptographic operations using Web Crypto API (PBKDF2 key derivation, AES-GCM encryption/decryption, salt generation, Base64 helpers).
- **`vault-logic.js`**: Manages the decrypted vault cache (`vaultsCache`), holds the session encryption key, validates PINs, prepares vault data for saving/updating (calls encryption), fetches/decrypts vaults (calls database and encryption), handles vault deletion logic (calls database).
- **`vault-ui.js`**: Responsible for rendering the vault list, handling user interactions within the vault list (show password, edit, delete buttons), managing the PIN request and Edit Vault overlays, handling form submissions for adding/editing vaults (collects data, calls vault-logic and database).
- **`utils.js`**: Provides utility functions like password generation and UI notifications.

---

## UI Navigation

- **Auth Navigation** (`auth-nav`, shown when logged out):
  - Sign Up
  - Log In
  - About Us
- **Main Navigation** (`main-nav`, shown when logged in & verified):
  - Vault (Default view)
  - Accounts (Shows vault list)
  - History (Activity log)
  - Settings (User profile, theme, delete account)
  - Log Out

Navigation toggles content sections dynamically. Layout changes between centered (auth) and sidebar (main app) based on context.

---

## Vault Management & Security

- Vault data is stored in **Firestore**.
- **Passwords and PINs** are **encrypted client-side** using **AES-GCM** before being sent to Firestore.
- The encryption key is **derived from the user's password and a unique salt** (stored in their Firestore profile) using **PBKDF2** with 100,000 iterations.
- The **encryption key is only held in memory** during an active, verified session and is **never stored**. If the user refreshes or logs out, the key is lost, requiring re-login to derive it again.
- **PINs** provide an optional extra layer of security for viewing passwords or modifying/deleting vaults within an active session.
- **Email verification** is required before users can log in and access vault data.

---

## File Descriptions

- **index.html**: Single HTML file containing all UI sections and structure, now with comprehensive comments.
- **script.js**: Main application script; orchestrates modules and UI logic.
- **js/firebase-config.js**: Firebase configuration details.
- **js/auth.js**: Firebase Authentication logic.
- **js/database.js**: Firebase Firestore database logic.
- **js/encryption.js**: Web Crypto API encryption/decryption functions.
- **js/vault-logic.js**: Core vault data handling, encryption prep, decryption, state.
- **js/vault-ui.js**: Vault rendering, UI event handling, overlays.
- **js/utils.js**: Helper functions (password generator, notifications).
- **css/**: Modular stylesheets for base, layout, components, sections, utilities.
- **spider-cursor/**: Assets for the cosmetic spider cursor effect.

---

## Summary

This project is a **modular, single-page password manager** utilizing **Firebase** for backend services (Auth, Firestore) and the **Web Crypto API** for robust client-side encryption. It features a clear separation of concerns between UI, logic, authentication, database interaction, and encryption, making it maintainable and secure. The application flow ensures that sensitive data is encrypted before leaving the browser and can only be decrypted during an authenticated session using a key derived from the user's password.
