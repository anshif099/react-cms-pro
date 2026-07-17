import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

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
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  },

  async createUserProfile(uid, data) {
    const userDocRef = doc(db, "users", uid);
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
    await setDoc(userDocRef, profileData);

    // Bootstrap company document if not exists
    const companyDocRef = doc(db, "companies", profileData.companyId);
    const companyDoc = await getDoc(companyDocRef);
    if (!companyDoc.exists()) {
      await setDoc(companyDocRef, {
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
    const userDocRef = doc(db, "users", uid);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await updateDoc(userDocRef, updateData);

    // If company name was updated, update company doc as well if using default_company
    if (data.company) {
      const companyId = data.companyId || "default_company";
      const companyDocRef = doc(db, "companies", companyId);
      await setDoc(companyDocRef, {
        name: data.company,
        updatedAt: serverTimestamp()
      }, { merge: true });
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
