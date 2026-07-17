import { database } from "../lib/firebase";
import { ref, get, update, serverTimestamp } from "firebase/database";

export const notificationService = {
  async getAll() {
    try {
      const notificationsRef = ref(database, "notifications");
      const snapshot = await get(notificationsRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        // Sort descending by createdAt
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return list;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      return [];
    }
  },

  async markRead(id) {
    try {
      const notifRef = ref(database, `notifications/${id}`);
      await update(notifRef, {
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
