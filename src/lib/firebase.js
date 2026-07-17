import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Fallback configuration check to prevent app crashes if Vite environment variables are not loaded (e.g., if server needs restart)
if (!firebaseConfig.apiKey) {
  console.warn("Vite environment variables not detected. Using hardcoded fallback configuration.");
  firebaseConfig.apiKey = "AIzaSyDX2mOPJqAUguPJNPGj9sxEVVr1dA1_8CQ";
  firebaseConfig.authDomain = "react-cms-pro.firebaseapp.com";
  firebaseConfig.projectId = "react-cms-pro";
  firebaseConfig.storageBucket = "react-cms-pro.firebasestorage.app";
  firebaseConfig.messagingSenderId = "688990713402";
  firebaseConfig.appId = "1:688990713402:web:c878e47dcda581b35e2703";
  firebaseConfig.measurementId = "G-TCF06KE1SK";
}

const app = initializeApp(firebaseConfig);

export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
