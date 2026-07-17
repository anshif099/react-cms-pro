import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getCountFromServer
} from "firebase/firestore";

export const activityLogService = {
  async logActivity(type, title, description, websiteId = null) {
    try {
      const activityData = {
        type,
        title,
        description,
        websiteId,
        timestamp: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, "activity_logs"), activityData);
      return docRef.id;
    } catch (error) {
      console.error("Failed to log activity", error);
      throw error;
    }
  },

  async getRecentLogs(limitCount = 10) {
    try {
      const q = query(
        collection(db, "activity_logs"),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle Firestore Timestamp formatting helper
          formattedTime: data.timestamp ? formatTimeAgo(data.timestamp.toDate()) : "Just now"
        };
      });
    } catch (error) {
      console.error("Failed to fetch activity logs", error);
      return [];
    }
  },

  async getTotalLogsCount() {
    try {
      const coll = collection(db, "activity_logs");
      const snapshot = await getCountFromServer(coll);
      return snapshot.data().count;
    } catch (error) {
      console.error("Failed to get total activity logs count", error);
      return 0;
    }
  }
};

// Helper for displaying time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval >= 1) return interval === 1 ? "1 year ago" : `${interval} years ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval === 1 ? "1 month ago" : `${interval} months ago`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval === 1 ? "1 day ago" : `${interval} days ago`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval === 1 ? "1 hour ago" : `${interval} hours ago`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval === 1 ? "1 min ago" : `${interval} mins ago`;
  return seconds < 10 ? "Just now" : `${Math.floor(seconds)} seconds ago`;
}

export default activityLogService;
