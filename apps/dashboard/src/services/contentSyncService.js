import { database } from "../lib/firebase";
import { ref, set, remove } from "firebase/database";
import { encodeFirebaseObject } from "@anshif.rainhopes/shared";

export const contentSyncService = {
  async syncPublished(websiteId, type, id, data) {
    try {
      const contentRef = ref(database, `content/${websiteId}/published/${type}/${id}`);
      const safeData = encodeFirebaseObject(data);
      await set(contentRef, safeData);
      return true;
    } catch (error) {
      console.error(`Failed to sync published content (${type}/${id}):`, error);
      throw error;
    }
  },

  async syncDraft(websiteId, type, id, data) {
    try {
      const contentRef = ref(database, `content/${websiteId}/draft/${type}/${id}`);
      const safeData = encodeFirebaseObject(data);
      await set(contentRef, safeData);
      return true;
    } catch (error) {
      console.error(`Failed to sync draft content (${type}/${id}):`, error);
      throw error;
    }
  },

  async unsync(websiteId, type, id) {
    try {
      const publishedRef = ref(database, `content/${websiteId}/published/${type}/${id}`);
      const draftRef = ref(database, `content/${websiteId}/draft/${type}/${id}`);
      await remove(publishedRef);
      await remove(draftRef);
      return true;
    } catch (error) {
      console.error(`Failed to unsync content (${type}/${id}):`, error);
      throw error;
    }
  }
};

export default contentSyncService;
