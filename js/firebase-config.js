/**
 * Firebase Configuration Module
 *
 * Purpose: Defines and exports the configuration object required to initialize
 *          and connect to the Firebase project associated with this application.
 *          This object contains project-specific identifiers and keys.
 *
 * Usage: Imported by other Firebase-related modules (e.g., auth.js, database.js)
 *        to ensure they connect to the correct Firebase backend project.
 */

// Firebase project configuration object (replace with your actual Firebase project config)
const firebaseConfig = {
  apiKey: "AIzaSyCf46RfaCH8n5mZyjLgJBXiuCOeODWnJnE",
  authDomain: "aetherium-cba98.firebaseapp.com",
  projectId: "aetherium-cba98",
  storageBucket: "aetherium-cba98.appspot.com", // Corrected storage bucket domain
  messagingSenderId: "762695289238",
  appId: "1:762695289238:web:d1c0f2c6032ede0c34b5b7",
  measurementId: "G-ZTEB69HVDH"
};

// Export the config object for use in other modules
export { firebaseConfig };
