import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDX2mOPJqAUguPJNPGj9sxEVVr1dA1_8CQ",
  authDomain: "react-cms-pro.firebaseapp.com",
  databaseURL: "https://react-cms-pro-default-rtdb.firebaseio.com",
  projectId: "react-cms-pro",
  storageBucket: "react-cms-pro.firebasestorage.app",
  messagingSenderId: "688990713402",
  appId: "1:688990713402:web:c878e47dcda581b35e2703",
  measurementId: "G-TCF06KE1SK"
};

const app = initializeApp(firebaseConfig);

export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

export default app;
