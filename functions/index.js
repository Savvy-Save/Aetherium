const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({origin: true}); // Initialize CORS middleware

// Initialize Firebase Admin SDK (if not already initialized)
// This is often done once, but checking ensures it's available.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configure your email transport using environment variables for security.
// IMPORTANT: Set these environment variables in your Firebase project:
// firebase functions:config:set sendgrid.apikey="YOUR_SENDGRID_API_KEY"
// firebase functions:config:set emailconfig.from_address="your-verified-sender@example.com"
//
// Replace "YOUR_SENDGRID_API_KEY" with your actual SendGrid API key.
// Replace "your-verified-sender@example.com" with an email address you've verified with SendGrid.

const sendgridApiKey = functions.config().sendgrid ? functions.config().sendgrid.apikey : null;
const fromEmailAddress = functions.config().emailconfig ? functions.config().emailconfig.from_address : null;

let transporter;
if (sendgridApiKey) {
  transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587, // or 465 for SSL
    secure: false, // true for 465, false for other ports
    auth: {
      user: "apikey", // This is literally "apikey" for SendGrid
      pass: sendgridApiKey,
    },
  });
} else {
  console.warn("SendGrid API key not configured. Email sending will not work.");
  // Fallback or error handling if API key is missing
  // For local testing without SendGrid, you might use a different transporter
  // like ethereal.email or a local SMTP server, but that's more complex.
}

exports.sendVaultRecoveryEmail = functions.https.onCall((data, context) => {
  // It's common to wrap onCall functions with cors for broader compatibility,
  // especially if you might call them from different origins or for local testing.
  // However, onCall is generally designed to handle this.
  // If issues persist, a common pattern for HTTP functions (not onCall) is:
  // return cors(req, res, async () => { ... your logic ... });
  // For onCall, the primary check is authentication.

  // Check if the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
    );
  }

  if (!transporter) {
    console.error("Email transporter not initialized. Check SendGrid configuration.");
    throw new functions.https.HttpsError(
        "internal",
        "Email service is not configured correctly.",
    );
  }

  const userEmail = context.auth.token.email; // Email of the logged-in user
  const vaultTitle = data.vaultTitle;
  const vaultDetails = data.vaultDetails; // This is the string we prepared client-side

  if (!userEmail || !vaultTitle || !vaultDetails) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing data: userEmail, vaultTitle, or vaultDetails.",
    );
  }

  const mailOptions = {
    from: `"Password Vault Manager" <${fromEmailAddress}>`, // Sender address (must be verified with SendGrid)
    to: userEmail,
    subject: `Vault Recovery Information for "${vaultTitle}"`,
    text: `Hello,\n\nHere is the recovery information for your vault item "${vaultTitle}":\n\n${vaultDetails}\n\nIf you did not request this, please secure your account.\n\nRegards,\nPassword Vault Manager Team`,
    html: `<p>Hello,</p><p>Here is the recovery information for your vault item "<strong>${vaultTitle}</strong>":</p><pre>${vaultDetails}</pre><p>If you did not request this, please secure your account.</p><p>Regards,<br/>Password Vault Manager Team</p>`,
  };

  // For onCall, explicit CORS handling like below is less common but can be added if direct HTTP invocation is mixed
  // or if specific preflight issues occur. The primary defense for onCall is the auth check.
  // The `cors` middleware is more typically used with `functions.https.onRequest`.
  // However, if the `FirebaseError: internal` is due to the function crashing before sending a response,
  // CORS might appear as the symptom. Let's ensure the core logic is robust.

  // The main logic remains the same, but we ensure it's wrapped if we were using onRequest.
  // For onCall, the framework should handle CORS. The `FirebaseError: internal` is more concerning.
  // Let's ensure the promise chain is correct. `onCall` expects a promise to be returned.

  return new Promise((resolve, reject) => {
    if (!transporter) {
      console.error("Email transporter not initialized. Check SendGrid configuration.");
      reject(new functions.https.HttpsError(
          "internal",
          "Email service is not configured correctly.",
      ));
      return;
    }

    transporter.sendMail(mailOptions)
      .then(() => {
        console.log("Recovery email sent to:", userEmail);
        resolve({ success: true, message: "Recovery email sent successfully." });
      })
      .catch((error) => {
        console.error("Error sending email:", error);
        let errorMessage = "Failed to send recovery email.";
        if (error.response && error.response.body && error.response.body.errors) {
            errorMessage += ` Details: ${error.response.body.errors.map((e) => e.message).join(", ")}`;
        } else if (error.message) {
            errorMessage += ` Details: ${error.message}`;
        }
        reject(new functions.https.HttpsError("internal", errorMessage));
      });
  });


  /* Original try-catch, which is fine for async/await with onCall */
  // try {
  //   await transporter.sendMail(mailOptions);
  //   console.log("Recovery email sent to:", userEmail);
  //   return { success: true, message: "Recovery email sent successfully." };
  // } catch (error) {
  //   console.error("Error sending email:", error);
    // It's good to check the error structure from SendGrid/Nodemailer for more specific messages
    let errorMessage = "Failed to send recovery email.";
    if (error.response && error.response.body && error.response.body.errors) {
        errorMessage += ` Details: ${error.response.body.errors.map((e) => e.message).join(", ")}`;
    } else if (error.message) {
        errorMessage += ` Details: ${error.message}`;
    }
    throw new functions.https.HttpsError("internal", errorMessage);
  // } // This was the stray curly brace from the original try-catch
});
