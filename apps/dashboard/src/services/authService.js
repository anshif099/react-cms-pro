import { auth, database } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { ref, get, set, update, serverTimestamp } from "firebase/database";

export const authService = {
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error("Login error", error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      return true;
    } catch (error) {
      console.error("Logout error", error);
      throw error;
    }
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  async getUserProfile(uid) {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  },

  async createUserProfile(uid, data) {
    const userRef = ref(database, `users/${uid}`);
    const profileData = {
      uid,
      email: data.email,
      name: data.name || "Admin User",
      role: data.role || "Administrator",
      phone: data.phone || "",
      company: data.company || "",
      companyId: data.companyId || "default_company",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await set(userRef, profileData);

    // Bootstrap company document if not exists
    const companyRef = ref(database, `companies/${profileData.companyId}`);
    const companySnapshot = await get(companyRef);
    if (!companySnapshot.exists()) {
      await set(companyRef, {
        id: profileData.companyId,
        name: profileData.company || "ReactCMS Ltd.",
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    return profileData;
  },

  async updateUserProfile(uid, data) {
    const userRef = ref(database, `users/${uid}`);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await update(userRef, updateData);

    // If company name was updated, update company doc as well if using default_company
    if (data.company) {
      const companyId = data.companyId || "default_company";
      const companyRef = ref(database, `companies/${companyId}`);
      await update(companyRef, {
        name: data.company,
        updatedAt: serverTimestamp()
      });
    }

    return updateData;
  },

  async changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found.");

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, newPassword);
    return { success: true };
  }
};

export default authService;
