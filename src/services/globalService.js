import { database } from "../lib/firebase";
import { ref, get, set, onValue } from "firebase/database";
import contentSyncService from "./contentSyncService";
import activityLogService from "./activityLogService";

export const globalService = {
  async get(websiteId, locale = "en") {
    try {
      const globalRef = ref(database, `global/${websiteId}/locales/${locale}`);
      const snapshot = await get(globalRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return {
        logo: "",
        phone: "",
        email: "",
        address: "",
        footer: "",
        socialLinks: [],
        settings: {}
      };
    } catch (error) {
      console.error(`Failed to fetch global content for website ${websiteId}:`, error);
      throw error;
    }
  },

  async update(websiteId, locale, data, publish = false) {
    try {
      const globalRef = ref(database, `global/${websiteId}/locales/${locale}`);
      const updatedData = {
        ...data,
        updatedAt: Date.now()
      };

      await set(globalRef, updatedData);

      // Sync to draft sync path
      await contentSyncService.syncDraft(websiteId, "global", locale, updatedData);

      // Sync to published sync path if requested
      if (publish) {
        await contentSyncService.syncPublished(websiteId, "global", locale, {
          ...updatedData,
          publishedAt: Date.now()
        });

        await activityLogService.logActivity(
          "global_published",
          "Global content published",
          `Published global content for locale "${locale}"`,
          websiteId
        );
      } else {
        await activityLogService.logActivity(
          "global_updated",
          "Global content updated",
          `Updated global content draft for locale "${locale}"`,
          websiteId
        );
      }

      return updatedData;
    } catch (error) {
      console.error(`Failed to update global content for website ${websiteId}:`, error);
      throw error;
    }
  },

  subscribe(websiteId, locale = "en", callback) {
    const globalRef = ref(database, `global/${websiteId}/locales/${locale}`);
    return onValue(globalRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback({
          logo: "",
          phone: "",
          email: "",
          address: "",
          footer: "",
          socialLinks: [],
          settings: {}
        });
      }
    }, (error) => {
      console.error(`Subscription error for global content:`, error);
    });
  }
};

export default globalService;
