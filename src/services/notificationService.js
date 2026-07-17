import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

export const notificationService = {
  async getAll() {
    try {
      const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      return [];
    }
  },

  async markRead(id) {
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, {
        read: true,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  },

  async markAllRead() {
    try {
      const notifications = await this.getAll();
      const promises = notifications
        .filter(n => !n.read)
        .map(n => this.markRead(n.id));
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      throw error;
    }
  }
};

export default notificationService;
