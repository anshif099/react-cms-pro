import { database } from "../lib/firebase";
import {
  ref,
  get,
  push,
  set,
  query,
  limitToLast,
  serverTimestamp
} from "firebase/database";

export const activityLogService = {
  async logActivity(type, title, description, websiteId = null) {
    try {
      const logsRef = ref(database, "activity_logs");
      const newLogRef = push(logsRef);
      
      const activityData = {
        type,
        title,
        description,
        websiteId,
        timestamp: serverTimestamp()
      };
      await set(newLogRef, activityData);
      return newLogRef.key;
    } catch (error) {
      console.error("Failed to log activity", error);
      throw error;
    }
  },

  async getRecentLogs(limitCount = 10) {
    try {
      const logsRef = ref(database, "activity_logs");
      const q = query(logsRef, limitToLast(limitCount));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list = Object.keys(val).map(key => {
          const data = val[key];
          // Realtime Database serverTimestamp is resolved to raw milliseconds on retrieve
          const dateObj = typeof data.timestamp === "number" ? new Date(data.timestamp) : new Date();
          return {
            id: key,
            ...data,
            formattedTime: formatTimeAgo(dateObj)
          };
        });
        // Realtime Database returns limitToLast sorted chronological, reverse for newest first
        list.reverse();
        return list;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
      return [];
    }
  },

  async getTotalLogsCount() {
    try {
      const logsRef = ref(database, "activity_logs");
      const snapshot = await get(logsRef);
      if (snapshot.exists()) {
        return Object.keys(snapshot.val()).length;
      }
      return 0;
    } catch (error) {
      console.error("Failed to get total activity logs count:", error);
      return 0;
    }
  }
};

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
