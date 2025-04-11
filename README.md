# Password Vault Manager

A secure, modular, single-page web application for managing passwords and sensitive vault data.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Application Flow](#application-flow)
- [Modules](#modules)
- [UI Navigation](#ui-navigation)
- [Vault Management](#vault-management)
- [Future Features](#future-features)
- [File Descriptions](#file-descriptions)

---

## Overview

This is a **single-page application (SPA)** built with vanilla JavaScript, HTML, and CSS. It allows users to:

- Sign up and log in (currently simulated)
- Add, edit, delete password vaults
- Protect vaults with optional PIN codes
- Generate strong passwords
- Store vault data in browser localStorage

---

## Project Structure

```
Current files (Edit here)/
├── index.html            # Main HTML file, contains all UI sections
├── script.js             # Main UI logic and event handling
├── js/
│   ├── utils.js          # Helper functions (password generation, notifications)
│   ├── storage.js        # LocalStorage persistence
│   ├── vault.js          # Vault management and PIN protection
│   ├── auth.js           # Placeholder for future authentication logic
│   ├── encryption.js     # Placeholder for future encryption logic
│   ├── database.js       # Placeholder for future database logic
├── css/                  # Modular CSS files
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── sections.css
│   └── utilities.css
├── spider-cursor/        # Spider cursor effect assets
└── README.md             # This documentation
```

---

## Application Flow

### 1. **Startup**

- The app starts when the browser loads `index.html`.
- `script.js` runs on `DOMContentLoaded`.
- It **caches all DOM elements** and **initializes the UI**.

### 2. **Initial State**

- By default, the **Sign Up** form is shown.
- The app **simulates** login/signup (no real backend yet).
- Navigation bars (`authNav` and `mainNav`) are toggled based on login state.

### 3. **Navigation**

- Clicking nav items **shows/hides sections** (`signup`, `login`, `vault`, `accounts`, `settings`, etc.).
- Navigation is **dynamic**; no page reloads.

### 4. **Sign Up / Log In**

- Forms are **simulated**; no real user accounts yet.
- On submit, the app **switches to the main app view** and reveals vault management.

### 5. **Vault Management**

- Vaults are **stored in localStorage** as an array.
- Users can:
  - **Add vaults** with optional username, email, PIN, and image.
  - **Edit vaults** (requires PIN if set).
  - **Delete vaults** (requires PIN if set).
  - **Show/hide passwords** (requires PIN if set).
- PIN entry is handled via an **overlay**.

### 6. **Password Generation**

- Users can generate strong passwords using the **crypto API**.
- Password strength is shown during signup.

### 7. **Data Persistence**

- All vault data is saved in **localStorage**.
- No backend or encryption yet (planned for future).

---

## Modules

- **`script.js`**: UI logic, event listeners, navigation, form handling.
- **`vault.js`**: Vault CRUD, PIN protection, vault display.
- **`storage.js`**: Save/load vaults from localStorage.
- **`utils.js`**: Password generation, notifications.
- **`auth.js`**: Placeholder for real authentication (future).
- **`encryption.js`**: Placeholder for encryption logic (future).
- **`database.js`**: Placeholder for backend database integration (future).

---

## UI Navigation

- **Auth Navigation** (`authNav`):
  - Sign Up
  - Log In
  - About Us
- **Main Navigation** (`mainNav`):
  - Vault
  - Accounts
  - History
  - Settings
  - Log Out

Navigation **toggles sections** dynamically without reloading the page.

---

## Vault Management

- Vaults are **objects** with:
  - `title`
  - `username` (optional)
  - `email` (optional)
  - `password`
  - `pin` (optional)
  - `imageData` (optional, base64)
- Vaults are **stored in localStorage** as an array.
- PINs protect sensitive actions (view, edit, delete).
- Vaults can be **added, edited, deleted** via forms and overlays.

---

## Future Features

- **Authentication**:
  - Real user accounts
  - Session management
  - Implemented in `auth.js`
- **Encryption**:
  - Encrypt vault data before saving
  - Decrypt on load
  - Implemented in `encryption.js`
- **Database**:
  - Replace localStorage with backend database
  - Implemented in `database.js`

---

## File Descriptions

- **index.html**: Contains all UI sections, loaded once.
- **script.js**: Starts app, handles UI, navigation, form events.
- **js/vault.js**: Vault CRUD, PIN overlays, vault display.
- **js/storage.js**: LocalStorage read/write.
- **js/utils.js**: Password generator, notifications.
- **js/auth.js**: Placeholder for login/signup logic.
- **js/encryption.js**: Placeholder for encryption functions.
- **js/database.js**: Placeholder for backend API/database calls.
- **css/**: Modular stylesheets for layout, components, utilities.

---

## Summary

This project is a **modular, single-page password manager** designed for easy future expansion. It uses **vanilla JavaScript** with clear separation of concerns, making it straightforward to add authentication, encryption, and database features later.

All important code is **heavily commented** to help you understand the flow and logic.
