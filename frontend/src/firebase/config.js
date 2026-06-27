// src/firebase/config.js
// Firebase configuration and initialization for HireSense
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let auth = null;

// Only initialize Firebase if the API key is present
if (firebaseConfig.apiKey) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase:", e);
  }
} else {
  console.warn("Firebase env vars not set. Auth features disabled.");
}

export { auth };
