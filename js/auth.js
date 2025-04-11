// Authentication module using Firebase

// Import from CDN URLs instead of bare specifiers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Signs up a new user with email and password, then sends a verification email.
 * @param {string} email - User's email address.
 * @param {string} password - User's chosen password.
 * @returns {Promise<import("firebase/auth").User>} The created user object.
 * @throws {Error} Firebase Auth error if signup or email sending fails.
 */
async function signUpUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send verification email
        await sendEmailVerification(user);
        console.log("Verification email sent to:", user.email);

        // Note: User is technically logged in after creation, but we'll enforce
        // email verification check before granting full access in the UI logic.
        return user;
    } catch (error) {
        console.error("Firebase signup error:", error);
        // Provide more user-friendly error messages based on error.code
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("This email address is already registered.");
        } else if (error.code === 'auth/weak-password') {
            throw new Error("Password is too weak. Please choose a stronger password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Please enter a valid email address.");
        }
        throw new Error("Signup failed. Please try again."); // Generic fallback
    }
}

/**
 * Logs in a user with email and password.
 * Checks for email verification before granting access.
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<import("firebase/auth").User>} The logged-in user object.
 * @throws {Error} Firebase Auth error or if email is not verified.
 */
async function logInUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            // Optional: Allow login but restrict access, or force verification.
            // Forcing verification is generally more secure for this type of app.
            console.warn("Login attempt by unverified email:", user.email);
            // Optional: Could trigger resend verification email here if needed.
            throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
        }

        console.log("Login successful for:", user.email);
        return user;
    } catch (error) {
        console.error("Firebase login error:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             throw new Error("Invalid email or password. Please try again.");
        } else if (error.code === 'auth/invalid-email') {
             throw new Error("Please enter a valid email address.");
        } else if (error.message.includes("verify your email")) {
            // Catch the custom error thrown above for unverified email
            throw error;
        }
        // Generic fallback for other errors (e.g., network issues)
        throw new Error("Login failed. Please try again later.");
    }
}

/**
 * Sets up a listener for Firebase authentication state changes.
 * Calls the provided callback function whenever the user's login state changes.
 * @param {function(import("firebase/auth").User | null): void} callback - Function to call with the user object or null.
 * @returns {import("firebase/auth").Unsubscribe} Function to unsubscribe the listener.
 */
function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Logs out the current user.
 * @returns {Promise<void>}
 * @throws {Error} Firebase Auth error if logout fails.
 */
async function logOutUser() {
    try {
        await signOut(auth);
        console.log("User logged out successfully.");
    } catch (error) {
        console.error("Firebase logout error:", error);
        throw new Error("Logout failed. Please try again.");
    }
}

// Export functions to be used by other modules (e.g., script.js)
export { auth, signUpUser, logInUser, onAuthChange, logOutUser }; // Export auth instance and functions
