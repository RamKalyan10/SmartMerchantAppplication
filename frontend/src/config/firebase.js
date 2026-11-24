import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smartmerchant-f0350.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smartmerchant-f0350",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smartmerchant-f0350.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "574625059723",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:574625059723:web:1b980ae97480ef1f8c958e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-TG55CGQKB0"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore Database
export const db = getFirestore(app);

export default app;
