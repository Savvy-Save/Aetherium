/**
 * Database Module (using Firebase Firestore)
 *
 * Purpose: Handles all interactions with the Firebase Firestore database.
 *          This includes managing user profile data and performing CRUD (Create, Read, Update, Delete)
 *          operations on user vaults. It defines the data structure within Firestore.
 *
 * Data Structure:
 *  - users (collection)
 *      - {userId} (document, ID = Firebase Auth UID)
 *          - username: string
 *          - email: string
 *          - birthday: string (or Timestamp)
 *          - gender: string
 *          - salt: string (Base64 encoded)
 *          - createdAt: Timestamp
 *          - vaults (subcollection)
 *              - {vaultId} (document, auto-generated ID)
 *                  - title: string
 *                  - username: string | null
 *                  - email: string | null
 *                  - encryptedPassword: { iv: string, ciphertext: string } | null
 *                  - encryptedPin: { iv: string, ciphertext: string } | null
 *                  - imageData: string (Base64 data URL) | null
 *                  - createdAt: Timestamp
 *                  - updatedAt: Timestamp (optional)
 *
 * Dependencies:
 *  - js/firebase-config.js: Provides the necessary Firebase project configuration.
 *  - Firebase SDK (via CDN): Provides the core Firestore functions.
 */

// --- Firebase SDK Imports ---
// Import functions from the Firebase SDK modules loaded via CDN URLs.
// initializeApp: Function to initialize the Firebase app instance. Required once per app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Firestore specific functions:
import {
    getFirestore, // Function to get the Firestore service instance for the app.
    doc,          // Function to create a DocumentReference to a specific document path (e.g., /users/userId).
    setDoc,       // Function to write or overwrite data to a specific document.
    getDoc,       // Function to read data from a single document.
    collection,   // Function to create a CollectionReference to a specific collection path (e.g., /users or /users/userId/vaults).
    addDoc,       // Function to add a new document to a collection with an auto-generated ID.
    getDocs,      // Function to read all documents matching a collection reference or query.
    updateDoc,    // Function to update specific fields within an existing document without overwriting the entire document.
    deleteDoc,    // Function to delete a document from Firestore.
    query,        // Function to create a query against a collection, allowing filtering and ordering.
    orderBy,      // Function to specify the field and direction for ordering query results.
    Timestamp     // Firestore's specific Timestamp object, used for storing dates/times consistently.
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // CDN URL for Firestore functions.
// Import the project-specific Firebase configuration object required for initialization.
import { firebaseConfig } from "./firebase-config.js";
import { showLoadingOverlay, hideLoadingOverlay } from "./utils.js";

// --- Firebase Initialization ---
// Initialize the Firebase app instance using the imported configuration.
// Firebase SDK handles multiple initializations gracefully, returning the existing instance if already initialized.
const app = initializeApp(firebaseConfig);
// Get the Firebase Firestore service instance associated with the initialized app.
// This 'db' object will be used for all subsequent database operations in this module.
const db = getFirestore(app);

// --- User Profile Functions ---

/**
 * Saves or updates user profile data in Firestore.
 * Creates/overwrites a document in the 'users' collection, using the user's
 * Firebase Authentication UID as the document ID. This function is typically called
 * during sign-up to store initial profile details like username and the encryption salt.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID (obtained from `auth.currentUser.uid`).
 * @param {object} profileData - An object containing the profile data fields to save.
 *                               Expected fields: { username, email, birthday, gender, salt, createdAt }.
 * @returns {Promise<void>} A promise that resolves when the data is successfully written to Firestore.
 * @throws {Error} Throws an error if `userId` or `profileData` is missing, or if the Firestore `setDoc` operation fails.
 */
async function saveUserProfile(userId, profileData) {
    showLoadingOverlay();
    // Basic validation for required parameters.
    if (!userId || !profileData) {
        hideLoadingOverlay();
        throw new Error("User ID and profile data are required to save profile.");
    }
    try {
        // Create a DocumentReference pointing to the specific user's document path within the 'users' collection.
        const userDocRef = doc(db, "users", userId);
        // Use setDoc with merge: true to write or update the profileData to the specified document.
        // If the document doesn't exist, it's created.
        // If it exists, the provided fields are merged with existing data (or overwritten if the field already exists).
        await setDoc(userDocRef, profileData, { merge: true });
        console.log("User profile data saved/updated successfully for user:", userId); // Log success for debugging.
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error saving user profile data:", error);
        throw new Error("Failed to save user profile.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Fetches a user's profile data document from Firestore.
 * This is primarily used during login to retrieve the user's stored salt for key derivation.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID whose profile needs to be fetched.
 * @returns {Promise<object | null>} A promise that resolves with the user profile data object
 *                                   (containing fields like username, salt, etc.) if the document exists,
 *                                   or resolves with `null` if the document does not exist.
 * @throws {Error} Throws an error if `userId` is missing or if the Firestore `getDoc` operation fails.
 */
async function getUserProfile(userId) {
    showLoadingOverlay();
    // Basic validation.
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to get profile.");
    }
    try {
        // Create a DocumentReference to the user's document.
        const userDocRef = doc(db, "users", userId);
        // Attempt to read the document snapshot.
        const docSnap = await getDoc(userDocRef);

        // Check if the document exists in Firestore.
        if (docSnap.exists()) {
            console.log("User profile data retrieved for:", userId); // Log success for debugging.
            // Return the data contained within the document.
            return docSnap.data();
        } else {
            // It's possible a user exists in Auth but not Firestore if profile saving failed during signup.
            console.log("No profile document found for user:", userId);
            return null; // Return null to indicate the profile wasn't found.
        }
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error getting user profile data:", error);
        throw new Error("Failed to get user profile.");
    } finally {
        hideLoadingOverlay();
    }
}


// ==================== VAULT CRUD OPERATIONS ====================
// These functions operate on the 'vaults' subcollection within a specific user's document (/users/{userId}/vaults).

/**
 * Adds a new vault document to the specified user's 'vaults' subcollection in Firestore.
 * Automatically adds a 'createdAt' timestamp.
 * Assumes sensitive data within `vaultData` (like password, pin) has already been encrypted.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID of the owner of the vault.
 * @param {object} vaultData - The vault data object to save. Should contain fields like title,
 *                             username, email, encryptedPassword, encryptedPin, imageData.
 * @returns {Promise<string>} A promise that resolves with the auto-generated Firestore document ID of the newly created vault.
 * @throws {Error} Throws an error if required parameters are missing or if the Firestore `addDoc` operation fails.
 */
async function addVault(userId, vaultData) {
    showLoadingOverlay();
    // Basic validation.
    if (!userId || !vaultData) {
        hideLoadingOverlay();
        throw new Error("User ID and vault data are required to add vault.");
    }
    try {
        // Prepare the data to be saved, including adding a server-side timestamp for creation time.
        const dataToSave = {
            ...vaultData,
            createdAt: Timestamp.now() // Use Firestore's Timestamp for consistency.
        };
        // Get a reference to the 'vaults' subcollection for the specific user.
        const vaultsColRef = collection(db, "users", userId, "vaults");
        // Add the new document to the subcollection. Firestore auto-generates the document ID.
        const docRef = await addDoc(vaultsColRef, dataToSave);
        console.log("Vault added successfully with ID:", docRef.id); // Log success for debugging.
        // Return the ID of the newly created document.
        return docRef.id;
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error adding vault:", error);
        throw new Error("Failed to add vault.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Retrieves all vault documents from a specific user's 'vaults' subcollection in Firestore.
 * Results are ordered alphabetically by title (ascending).
 * Note: The retrieved data will contain encrypted fields which need to be decrypted by the caller.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID whose vaults are to be retrieved.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of vault objects.
 *                                   Each object includes its Firestore document ID (`id` property)
 *                                   and the data stored in the document. Resolves with an empty array if no vaults exist.
 * @throws {Error} Throws an error if `userId` is missing or if the Firestore `getDocs` operation fails.
 */
async function getVaults(userId) {
    showLoadingOverlay();
    // Basic validation.
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to get vaults.");
    }
    try {
        const vaults = []; // Initialize an empty array to hold the results.
        // Get a reference to the 'vaults' subcollection for the specific user.
        const vaultsColRef = collection(db, "users", userId, "vaults");
        // Create a query to order the vaults by title alphabetically (A-Z).
        // Other ordering options (e.g., by createdAt) are commented out but possible.
        const q = query(vaultsColRef, orderBy("title", "asc"));
        // const q = query(vaultsColRef, orderBy("createdAt", "desc")); // Example: Order by newest first

        // Execute the query to get a snapshot of the documents.
        const querySnapshot = await getDocs(q);
        // Iterate over each document snapshot in the result.
        querySnapshot.forEach((doc) => {
            // Push an object containing the document ID and its data into the results array.
            vaults.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Retrieved ${vaults.length} vaults for user:`, userId); // Log count for debugging.
        // Return the array of vault objects (caller needs to handle decryption).
        return vaults;
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error getting vaults:", error);
        throw new Error("Failed to retrieve vaults.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Updates specific fields within an existing vault document in Firestore.
 * Automatically adds an 'updatedAt' timestamp.
 * Assumes sensitive data within `updatedData` has already been encrypted.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID of the vault owner.
 * @param {string} vaultId - The Firestore document ID of the vault to update.
 * @param {object} updatedData - An object containing only the fields and values to be updated or added.
 *                               Sensitive fields (password, pin) should be pre-encrypted objects.
 * @returns {Promise<void>} A promise that resolves when the document is successfully updated.
 * @throws {Error} Throws an error if required parameters are missing or if the Firestore `updateDoc` operation fails.
 */
async function updateVault(userId, vaultId, updatedData) {
    showLoadingOverlay();
    // Basic validation.
    if (!userId || !vaultId || !updatedData) {
        hideLoadingOverlay();
        throw new Error("User ID, Vault ID, and updated data are required.");
    }
    try {
        // Create a DocumentReference to the specific vault document.
        const vaultDocRef = doc(db, "users", userId, "vaults", vaultId);
        // Prepare the data for update, including adding/updating an 'updatedAt' timestamp.
        const dataToUpdate = {
            ...updatedData,
            updatedAt: Timestamp.now() // Use Firestore's Timestamp.
        };
        // Perform the update operation. This only modifies the fields specified in dataToUpdate.
        await updateDoc(vaultDocRef, dataToUpdate);
        console.log("Vault updated successfully:", vaultId); // Log success for debugging.
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error updating vault:", error);
        throw new Error("Failed to update vault.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes a specific vault document from the user's 'vaults' subcollection in Firestore.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID of the vault owner.
 * @param {string} vaultId - The Firestore document ID of the vault to delete.
 * @returns {Promise<void>} A promise that resolves when the document is successfully deleted.
 * @throws {Error} Throws an error if required parameters are missing or if the Firestore `deleteDoc` operation fails.
 */
async function deleteVaultDoc(userId, vaultId) {
    showLoadingOverlay();
    // Basic validation.
    if (!userId || !vaultId) {
        hideLoadingOverlay();
        throw new Error("User ID and Vault ID are required to delete vault.");
    }
    try {
        // Create a DocumentReference to the specific vault document.
        const vaultDocRef = doc(db, "users", userId, "vaults", vaultId);
        // Perform the delete operation.
        await deleteDoc(vaultDocRef);
        console.log("Vault deleted successfully:", vaultId); // Log success for debugging.
    } catch (error) {
        // Log the detailed Firestore error and throw a user-friendly error.
        console.error("Error deleting vault:", error);
        throw new Error("Failed to delete vault.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes all vault documents within a user's 'vaults' subcollection.
 * This is typically called as part of the account deletion process.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID whose vaults are to be deleted.
 * @returns {Promise<void>} A promise that resolves when all vault documents have been deleted (or if none existed).
 * @throws {Error} Throws an error if `userId` is missing or if any Firestore deletion operation fails.
 */
async function deleteAllUserVaults(userId) {
    showLoadingOverlay();
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to delete vaults.");
    }
    try {
        // Get a reference to the user's vaults subcollection.
        const vaultsColRef = collection(db, "users", userId, "vaults");
        // Get all documents in the subcollection.
        const querySnapshot = await getDocs(vaultsColRef);

        // Check if there are any documents to delete.
        if (querySnapshot.empty) {
            console.log("No vaults found to delete for user:", userId);
            return; // Nothing to do.
        }

        // Create an array of promises for each deletion.
        const deletePromises = [];
        querySnapshot.forEach((docSnapshot) => {
            // Add the delete operation promise to the array.
            deletePromises.push(deleteDoc(docSnapshot.ref));
        });

        // Wait for all delete operations to complete.
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${deletePromises.length} vaults for user:`, userId);

    } catch (error) {
        console.error("Error deleting all user vaults:", error);
        // Consider if partial deletion occurred and how to handle it.
        // For now, throw a generic error.
        throw new Error("Failed to delete all user vaults.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes a user's main profile document from the 'users' collection in Firestore.
 * This is typically called after deleting the user from Firebase Authentication.
 *
 * @async
 * @param {string} userId - The Firebase Authentication user ID whose profile document is to be deleted.
 * @returns {Promise<void>} A promise that resolves when the document is successfully deleted.
 * @throws {Error} Throws an error if `userId` is missing or if the Firestore `deleteDoc` operation fails.
 */
async function deleteUserProfile(userId) {
    showLoadingOverlay();
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to delete user profile.");
    }
    try {
        // Create a DocumentReference to the user's document in the 'users' collection.
        const userDocRef = doc(db, "users", userId);
        // Perform the delete operation.
        await deleteDoc(userDocRef);
        console.log("User profile document deleted successfully for user:", userId);
    } catch (error) {
        console.error("Error deleting user profile document:", error);
        throw new Error("Failed to delete user profile document.");
    } finally {
        hideLoadingOverlay();
    }
}


/**
 * Adds a history entry to the user's 'history' subcollection in Firestore.
 * @async
 * @param {string} userId - The Firebase Authentication user ID.
 * @param {object} historyData - The history data object to save. Should contain fields like action, vaultId, vaultTitle, timestamp, etc.
 * @returns {Promise<string>} The auto-generated Firestore document ID of the new history entry.
 */
async function addHistory(userId, historyData) {
    showLoadingOverlay();
    if (!userId || !historyData) {
        hideLoadingOverlay();
        throw new Error("User ID and history data are required to add history.");
    }
    try {
        const dataToSave = {
            ...historyData,
            timestamp: Timestamp.now()
        };
        const historyColRef = collection(db, "users", userId, "history");
        const docRef = await addDoc(historyColRef, dataToSave);
        console.log("History entry added with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding history entry:", error);
        throw new Error("Failed to add history entry.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Retrieves all history entries for a user, ordered by timestamp descending.
 * @async
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function getHistory(userId) {
    showLoadingOverlay();
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to get history.");
    }
    try {
        const history = [];
        const historyColRef = collection(db, "users", userId, "history");
        const q = query(historyColRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() });
        });
        return history;
    } catch (error) {
        console.error("Error getting history:", error);
        throw new Error("Failed to retrieve history.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes a single history entry.
 * @async
 * @param {string} userId
 * @param {string} historyId
 * @returns {Promise<void>}
 */
async function deleteHistory(userId, historyId) {
    showLoadingOverlay();
    if (!userId || !historyId) {
        hideLoadingOverlay();
        throw new Error("User ID and History ID are required to delete history.");
    }
    try {
        const historyDocRef = doc(db, "users", userId, "history", historyId);
        await deleteDoc(historyDocRef);
        console.log("History entry deleted:", historyId);
    } catch (error) {
        console.error("Error deleting history entry:", error);
        throw new Error("Failed to delete history entry.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Deletes multiple history entries by their IDs.
 * @async
 * @param {string} userId
 * @param {Array<string>} historyIds
 * @returns {Promise<void>}
 */
async function deleteMultipleHistory(userId, historyIds) {
    showLoadingOverlay();
    if (!userId || !Array.isArray(historyIds)) {
        hideLoadingOverlay();
        throw new Error("User ID and array of History IDs are required.");
    }
    try {
        const deletePromises = historyIds.map((historyId) => {
            const historyDocRef = doc(db, "users", userId, "history", historyId);
            return deleteDoc(historyDocRef);
        });
        await Promise.all(deletePromises);
        console.log(`Deleted ${historyIds.length} history entries for user:`, userId);
    } catch (error) {
        console.error("Error deleting multiple history entries:", error);
        throw new Error("Failed to delete multiple history entries.");
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Queries history entries by action type and/or date range.
 * @async
 * @param {string} userId
 * @param {object} options - { actionType?: string, startDate?: Date, endDate?: Date }
 * @returns {Promise<Array<object>>}
 */
async function queryHistory(userId, options = {}) {
    showLoadingOverlay();
    if (!userId) {
        hideLoadingOverlay();
        throw new Error("User ID is required to query history.");
    }
    try {
        let historyColRef = collection(db, "users", userId, "history");
        let q = historyColRef;
        const filters = [];
        if (options.actionType) {
            filters.push(orderBy("action"));
        }
        if (options.startDate) {
            filters.push(orderBy("timestamp"));
        }
        // For more advanced filtering, Firestore requires composite indexes.
        // For now, fetch all and filter in JS if needed.
        q = query(historyColRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        let results = [];
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });
        // Filter in JS for actionType and date range
        if (options.actionType) {
            results = results.filter(h => h.action === options.actionType);
        }
        if (options.startDate) {
            results = results.filter(h => h.timestamp.toDate() >= options.startDate);
        }
        if (options.endDate) {
            results = results.filter(h => h.timestamp.toDate() <= options.endDate);
        }
        return results;
    } catch (error) {
        console.error("Error querying history:", error);
        throw new Error("Failed to query history.");
    } finally {
        hideLoadingOverlay();
    }
}

// --- Exports ---
// Make the Firestore db instance and the defined functions available for other modules.
export {
    db,                 // The initialized Firestore database instance.
    saveUserProfile,    // Function to save/update user profile data.
    getUserProfile,     // Function to fetch user profile data.
    addVault,           // Function to add a new vault document.
    getVaults,          // Function to retrieve all vaults for a user.
    updateVault,        // Function to update an existing vault document.
    deleteVaultDoc,     // Function to delete a single vault document.
    deleteAllUserVaults,// Function to delete all vaults for a user.
    deleteUserProfile,  // Function to delete the user's profile document.
    addHistory,         // Function to add a history entry.
    getHistory,         // Function to get all history entries.
    deleteHistory,      // Function to delete a single history entry.
    deleteMultipleHistory, // Function to delete multiple history entries.
    queryHistory        // Function to query history by type/date.
};
