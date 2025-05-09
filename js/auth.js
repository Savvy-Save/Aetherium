/**
 * Authentication Module (using Firebase)
 *
 * Purpose: Handles user authentication tasks including sign-up, login, logout,
 *          session state management, and email verification using the Firebase Authentication service.
 *
 * Dependencies:
 *  - js/firebase-config.js: Provides the necessary Firebase project configuration.
 *  - Firebase SDK (via CDN): Provides the core authentication functions.
 */

// Import from Firebase CDN URLs
// initializeApp: Function to initialize the Firebase app instance. Required once per app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Firebase Authentication service functions:
import {
    getAuth,                        // Function to get the Auth service instance for the app.
    createUserWithEmailAndPassword, // Function to create a new user account using email and password.
    sendEmailVerification,          // Function to send an email verification link to a user.
    signInWithEmailAndPassword,     // Function to sign in an existing user with email and password.
    onAuthStateChanged,             // Function to set up a listener that triggers when the user's sign-in state changes.
    signOut,                        // Function to sign out the currently signed-in user.
    sendPasswordResetEmail,         // Function to send a password reset email.
    setPersistence,                 // Function to set the auth persistence state.
    browserLocalPersistence,        // Persistence type: Stays logged in across browser sessions.
    browserSessionPersistence,      // Persistence type: Logs out when the browser session ends (tab/window closed).
    EmailAuthProvider,              // Provider for email/password credentials.
    reauthenticateWithCredential,   // Function to re-authenticate a user.
    deleteUser                      // Function to delete a user account.
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // Use CDN URL for Firebase Auth functions.
// Import Firebase Storage
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
// Import the project-specific Firebase configuration object required for initialization.
import { firebaseConfig } from "./firebase-config.js";
import { showLoadingOverlay, hideLoadingOverlay } from "./utils.js";

// --- Firebase Initialization ---
// Initialize the Firebase app instance using the imported configuration.
// Firebase SDK is designed to handle this gracefully if called multiple times; it returns the existing instance.
const app = initializeApp(firebaseConfig);
// Get the Firebase Authentication service instance associated with the initialized app.
// This 'auth' object will be used for all authentication operations.
const auth = getAuth(app);
// Get the Firebase Storage service instance
const storage = getStorage(app);

// --- Authentication Functions ---

/**
 * Signs up a new user account using Firebase Authentication.
 * Creates the user with the provided email and password, then triggers
 * Firebase to send a verification email to the user's address.
 *
 * @async
 * @param {string} email - The email address for the new user account.
 * @param {string} password - The chosen password for the new user account (must meet Firebase strength requirements).
 * @returns {Promise<import("firebase/auth").User>} A promise that resolves with the newly created Firebase User object upon successful signup and email dispatch.
 * @throws {Error} Throws a user-friendly error if signup fails (e.g., email already in use, weak password, invalid email)
 *                 or if sending the verification email encounters an issue.
 */
async function signUpUser(email, password) {
    showLoadingOverlay();
    try {
        // Attempt to create the user account in Firebase Authentication backend.
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Extract the user object from the credentials returned on success.
        const user = userCredential.user;

        // Trigger Firebase to send the standard verification email to the new user's address.
        await sendEmailVerification(user);
        console.log("Verification email sent to:", user.email); // Log success for debugging.

        // Note: Firebase automatically signs in the user upon successful account creation.
        // However, the application logic (in script.js via onAuthChange) should check
        // the `emailVerified` property before granting full access to sensitive features.
        return user; // Return the created user object.
    } catch (error) {
        // Log the detailed Firebase error for debugging purposes.
        console.error("Firebase signup error:", error);
        // Handle specific known error codes to provide clearer feedback to the user.
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("This email address is already registered.");
        } else if (error.code === 'auth/weak-password') {
            throw new Error("Password is too weak. Please choose a stronger password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Please enter a valid email address.");
        }
        throw new Error("Signup failed. Please try again."); // Generic fallback
    } finally {
        hideLoadingOverlay();
    }
}


/**
 * Re-authenticates the currently signed-in user using their password.
 * This is required for security-sensitive operations like account deletion.
 *
 * @async
 * @param {string} password - The user's current password.
 * @returns {Promise<void>} A promise that resolves if re-authentication is successful.
 * @throws {Error} Throws a user-friendly error if re-authentication fails (e.g., wrong password).
 */
async function reauthenticateUser(password) {
    showLoadingOverlay();
    const user = auth.currentUser;
    if (!user) {
        hideLoadingOverlay();
        throw new Error("No user is currently signed in.");
    }

    // Create a credential object using the user's email and the provided password.
    const credential = EmailAuthProvider.credential(user.email, password);

    try {
        // Attempt to re-authenticate the user with the provided credential.
        await reauthenticateWithCredential(user, credential);
        console.log("User re-authenticated successfully.");
    } catch (error) {
        console.error("Firebase re-authentication error:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error("Incorrect password. Please try again.");
        } else if (error.code === 'auth/user-mismatch') {
             throw new Error("Credential mismatch. Please log out and log back in.");
        } else if (error.code === 'auth/too-many-requests') {
             throw new Error("Too many attempts. Please try again later.");
        }
        throw new Error("Re-authentication failed. Please try again."); // Generic fallback
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes the currently signed-in user's account from Firebase Authentication.
 * IMPORTANT: This action is irreversible. Ensure the user has been re-authenticated recently before calling this.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves upon successful deletion.
 * @throws {Error} Throws an error if deletion fails (e.g., requires recent login, user not found).
 */
async function deleteCurrentUser() {
    showLoadingOverlay();
    const user = auth.currentUser;
    if (!user) {
        hideLoadingOverlay();
        throw new Error("No user is currently signed in to delete.");
    }

    try {
        await deleteUser(user);
        console.log("Firebase Authentication user deleted successfully:", user.uid);
    } catch (error) {
        console.error("Firebase user deletion error:", error);
        if (error.code === 'auth/requires-recent-login') {
            throw new Error("This operation requires you to have logged in recently. Please log out and log back in to delete your account.");
        }
        // Handle other potential errors if necessary
        throw new Error("Failed to delete user account from Firebase Authentication.");
    } finally {
        hideLoadingOverlay();
    }
}


/**
 * Logs in an existing user using their email and password via Firebase Authentication.
 * Crucially, it also checks if the user's email address has been verified.
 *
 * @async
 * @param {string} email - The user's registered email address.
 * @param {string} password - The user's password.
 * @returns {Promise<import("firebase/auth").User>} A promise that resolves with the Firebase User object if login is successful AND the email is verified.
 * @param {string} email - The user's registered email address.
 * @param {string} password - The user's password.
 * @param {boolean} rememberMe - If true, use local persistence; otherwise, use session persistence.
 * @returns {Promise<import("firebase/auth").User>} A promise that resolves with the Firebase User object if login is successful AND the email is verified.
 * @throws {Error} Throws a user-friendly error if login fails (invalid credentials, user not found, network error)
 *                 or specifically if the user's email address has not been verified yet.
 */
async function logInUser(email, password, rememberMe) {
    showLoadingOverlay();
    try {
        // Set persistence based on the rememberMe flag BEFORE attempting to sign in.
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);
        console.log(`Auth persistence set to: ${rememberMe ? 'local' : 'session'}`); // Log persistence type

        // Attempt to sign the user in using Firebase Authentication backend.
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Extract the user object from the credentials returned on success.
        const user = userCredential.user;

        // --- Email Verification Check ---
        // This is a critical security step for this application.
        if (!user.emailVerified) {
            // Log a warning for debugging/monitoring purposes.
            console.warn("Login attempt by unverified email:", user.email);
            // Throw a specific error to inform the user they need to verify.
            // This error is caught and displayed by the calling code (in script.js).
            throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
        }
        // If email is verified, proceed.

        console.log("Login successful for verified user:", user.email); // Log success for debugging.
        return user; // Return the authenticated and verified user object.
    } catch (error) {
        // Log the detailed Firebase error for debugging.
        console.error("Firebase login error:", error);
        // Handle specific known error codes for better user feedback.
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             // Combine common invalid login attempts into one message.
             throw new Error("Invalid email or password. Please try again.");
        } else if (error.code === 'auth/invalid-email') {
             throw new Error("Please enter a valid email address.");
        } else if (error.message.includes("verify your email")) {
            // Catch the custom error thrown above for unverified email
            throw error;
        }
        // Generic fallback for other errors (e.g., network issues)
        throw new Error("Login failed. Please try again later.");
    } finally {
        hideLoadingOverlay();
    }
}


/**
 * Sends a password reset email to the specified address using Firebase Authentication.
 *
 * @async
 * @param {string} email - The email address to send the reset link to.
 * @returns {Promise<void>} A promise that resolves when the email is successfully sent.
 * @throws {Error} Throws a user-friendly error if sending fails (e.g., user not found, invalid email).
 */
async function sendPasswordReset(email) {
    showLoadingOverlay();
    try {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent successfully to:", email); // Log success
    } catch (error) {
        console.error("Firebase password reset error:", error); // Log detailed error
        if (error.code === 'auth/user-not-found') {
            // Avoid confirming if an email exists for security reasons
            // Throw a generic success-like message even if user not found
            console.warn("Password reset attempted for non-existent user:", email);
            // Still resolve successfully to the user, but handle the message in the UI
            // No specific error thrown here to the user, message handled in UI
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Please enter a valid email address.");
        } else {
            throw new Error("Failed to send password reset email. Please try again."); // Generic fallback
        }
    } finally {
        hideLoadingOverlay();
    }
}


/**
 * Sets up a real-time listener for changes in the user's authentication state (logged in, logged out).
 * This is the primary mechanism for reacting to login/logout events throughout the application.
 *
 * @param {function(import("firebase/auth").User | null): void} callback
 *        The function to execute whenever the auth state changes.
 *        It receives the current Firebase User object if logged in, or null if logged out.
 *        This callback is typically defined in `script.js` to update the UI accordingly.
 * @returns {import("firebase/auth").Unsubscribe} A function that can be called to remove the listener when it's no longer needed (e.g., component unmount in frameworks, though not strictly necessary here if listener lives for app duration).
 */
function onAuthChange(callback) {
    // Attach the listener to the auth instance.
    // Firebase invokes the callback immediately with the current state, and then again whenever the state changes.
    return onAuthStateChanged(auth, callback);
}

/**
 * Logs out the currently authenticated user from Firebase.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when logout is complete.
 * @throws {Error} Throws a user-friendly error if the logout operation fails.
 */
async function logOutUser() {
    showLoadingOverlay();
    try {
        // Call the Firebase signOut function.
        await signOut(auth);
        console.log("User logged out successfully."); // Log success for debugging.
    } catch (error) {
        // Log the detailed error and throw a generic message.
        console.error("Firebase logout error:", error);
        throw new Error("Logout failed. Please try again.");
    } finally {
        hideLoadingOverlay();
    }
}

// --- Exports ---
// Make the auth instance and key functions available for other modules to import.
export {
    auth,                   // The initialized Firebase Auth instance.
    signUpUser,             // Function to handle user registration.
    logInUser,              // Function to handle user login (now includes persistence).
    onAuthChange,           // Function to listen for authentication state changes.
    logOutUser,             // Function to handle user logout.
    sendPasswordReset,      // Function to handle sending password reset emails.
    sendEmailVerification,  // Function to manually resend verification email (used in script.js).
    reauthenticateUser,     // Function to re-authenticate the user.
    deleteCurrentUser,      // Function to delete the user from Firebase Auth.
    // Export persistence types if needed elsewhere, though primarily used within logInUser here.
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    getCurrentUserEmail, // Export the new function
    storage                 // Export Firebase Storage instance
};

/**
 * Gets the email of the currently signed-in user.
 * @returns {string | null} The email of the current user, or null if no user is signed in.
 */
function getCurrentUserEmail() {
    const user = auth.currentUser;
    return user ? user.email : null;
}
