// Database module using Firebase Firestore

// Import from CDN URLs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc, // Need getDoc to fetch profile
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase (ensure this doesn't conflict if initialized elsewhere, Firebase handles it)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Saves additional user profile data to Firestore.
 * Creates a document in the 'users' collection with the user's UID as the document ID.
 * @param {string} userId - The Firebase Authentication user ID.
 * @param {object} profileData - An object containing profile data (e.g., { username, birthday, gender }).
 * @returns {Promise<void>}
 * @throws {Error} Firestore error if saving fails.
 */
async function saveUserProfile(userId, profileData) {
    if (!userId || !profileData) {
        throw new Error("User ID and profile data are required to save profile.");
    }
    try {
        const userDocRef = doc(db, "users", userId);
        // Use setDoc with merge: true if you want to update partially later,
        // or just setDoc to overwrite/create.
        await setDoc(userDocRef, profileData);
        console.log("User profile data saved successfully for user:", userId);
    } catch (error) {
        console.error("Error saving user profile data:", error);
        throw new Error("Failed to save user profile.");
    }
}

/**
 * Fetches user profile data from Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @returns {Promise<object | null>} User profile data object or null if not found.
 * @throws {Error} Firestore error if fetching fails.
 */
async function getUserProfile(userId) {
    if (!userId) {
        throw new Error("User ID is required to get profile.");
    }
    try {
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            console.log("User profile data retrieved for:", userId);
            return docSnap.data();
        } else {
            console.log("No profile document found for user:", userId);
            return null; // Or throw an error if profile is expected
        }
    } catch (error) {
        console.error("Error getting user profile data:", error);
        throw new Error("Failed to get user profile.");
    }
}


// ==================== VAULT CRUD OPERATIONS ====================

/**
 * Adds a new vault document to the user's vault subcollection in Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @param {object} vaultData - The vault data object (ensure sensitive fields are encrypted before calling).
 * @returns {Promise<string>} The ID of the newly created vault document.
 * @throws {Error} Firestore error if adding fails.
 */
async function addVault(userId, vaultData) {
    if (!userId || !vaultData) {
        throw new Error("User ID and vault data are required to add vault.");
    }
    try {
        // Add a timestamp for sorting or tracking
        const dataToSave = {
            ...vaultData,
            createdAt: Timestamp.now() // Use Firestore Timestamp
        };
        const vaultsColRef = collection(db, "users", userId, "vaults");
        const docRef = await addDoc(vaultsColRef, dataToSave);
        console.log("Vault added successfully with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding vault:", error);
        throw new Error("Failed to add vault.");
    }
}

/**
 * Retrieves all vaults for a specific user from Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @returns {Promise<Array<object>>} An array of vault objects, each including its Firestore ID.
 * @throws {Error} Firestore error if retrieval fails.
 */
async function getVaults(userId) {
    if (!userId) {
        throw new Error("User ID is required to get vaults.");
    }
    try {
        const vaults = [];
        const vaultsColRef = collection(db, "users", userId, "vaults");
        // Optional: Order vaults, e.g., by title or creation date
        const q = query(vaultsColRef, orderBy("title", "asc")); // Order by title A-Z
        // const q = query(vaultsColRef, orderBy("createdAt", "desc")); // Order by newest first

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            vaults.push({ id: doc.id, ...doc.data() }); // Include Firestore document ID
        });
        console.log(`Retrieved ${vaults.length} vaults for user:`, userId);
        return vaults; // Remember to decrypt sensitive fields after retrieval
    } catch (error) {
        console.error("Error getting vaults:", error);
        throw new Error("Failed to retrieve vaults.");
    }
}

/**
 * Updates a specific vault document in Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @param {string} vaultId - The Firestore document ID of the vault to update.
 * @param {object} updatedData - An object containing the fields to update (ensure sensitive fields are encrypted).
 * @returns {Promise<void>}
 * @throws {Error} Firestore error if update fails.
 */
async function updateVault(userId, vaultId, updatedData) {
    if (!userId || !vaultId || !updatedData) {
        throw new Error("User ID, Vault ID, and updated data are required.");
    }
    try {
        const vaultDocRef = doc(db, "users", userId, "vaults", vaultId);
        // Add an updated timestamp
        const dataToUpdate = {
            ...updatedData,
            updatedAt: Timestamp.now()
        };
        await updateDoc(vaultDocRef, dataToUpdate);
        console.log("Vault updated successfully:", vaultId);
    } catch (error) {
        console.error("Error updating vault:", error);
        throw new Error("Failed to update vault.");
    }
}

/**
 * Deletes a specific vault document from Firestore.
 * @param {string} userId - The Firebase Authentication user ID.
 * @param {string} vaultId - The Firestore document ID of the vault to delete.
 * @returns {Promise<void>}
 * @throws {Error} Firestore error if deletion fails.
 */
async function deleteVaultDoc(userId, vaultId) {
    if (!userId || !vaultId) {
        throw new Error("User ID and Vault ID are required to delete vault.");
    }
    try {
        const vaultDocRef = doc(db, "users", userId, "vaults", vaultId);
        await deleteDoc(vaultDocRef);
        console.log("Vault deleted successfully:", vaultId);
    } catch (error) {
        console.error("Error deleting vault:", error);
        throw new Error("Failed to delete vault.");
    }
}


// Export db instance and functions
export { db, saveUserProfile, getUserProfile, addVault, getVaults, updateVault, deleteVaultDoc };
