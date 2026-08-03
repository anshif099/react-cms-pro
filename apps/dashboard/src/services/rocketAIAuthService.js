import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { firebaseConfig } from "../lib/firebase";

const ROCKET_APP_NAME = "rocket-ai";
const rocketApp = getApps().find((app) => app.name === ROCKET_APP_NAME)
  || initializeApp(firebaseConfig, ROCKET_APP_NAME);

export const rocketAIAuth = getAuth(rocketApp);

function publicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "Google user",
    photoURL: user.photoURL || ""
  };
}

function friendlyAuthError(error) {
  if (error?.code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }
  if (error?.code === "auth/popup-blocked") {
    return "The browser blocked the Google sign-in window. Allow pop-ups and try again.";
  }
  if (error?.code === "auth/unauthorized-domain") {
    return "This website domain is not authorized in Firebase Authentication.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication.";
  }
  if (error?.code === "auth/network-request-failed") {
    return "Google sign-in could not reach Firebase. Check the internet connection.";
  }
  return error?.message || "Google sign-in failed.";
}

export const rocketAIAuthService = {
  currentUser() {
    return publicUser(rocketAIAuth.currentUser);
  },

  subscribe(callback) {
    return onAuthStateChanged(rocketAIAuth, (user) => callback(publicUser(user)));
  },

  async signInWithGoogle() {
    try {
      await setPersistence(rocketAIAuth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(rocketAIAuth, provider);
      return publicUser(credential.user);
    } catch (error) {
      throw new Error(friendlyAuthError(error), { cause: error });
    }
  },

  async signOut() {
    await signOut(rocketAIAuth);
  }
};

export default rocketAIAuthService;
