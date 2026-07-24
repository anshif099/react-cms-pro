import { database } from "../lib/firebase";
import { ref, set, remove } from "firebase/database";
import { paths, encodeFirebaseObject } from "@anshif.rainhopes/shared";

export const contentSyncService = {
  /**
   * Publish page regions to the live published path.
   * Uses paths.contentPublished so the SDK can read them on page load.
   * @param {string} websiteId
   * @param {string} pageSlug - URL slug / route key (e.g. "home", "about") — must match what the SDK resolves from the URL
   * @param {object} data - { id, regions, publishedAt }
   */
  async syncPublished(websiteId, pageSlug, data) {
    try {
      const contentRef = ref(database, paths.contentPublished(websiteId, pageSlug));
      const safeData = encodeFirebaseObject(data);
      await set(contentRef, safeData);
      return true;
    } catch (error) {
      console.error(`Failed to sync published content for page "${pageSlug}":`, error);
      throw error;
    }
  },

  /**
   * Save draft page regions.
   * Uses paths.contentDraft so the SDK can read them in preview/edit mode.
   * @param {string} websiteId
   * @param {string} pageSlug - URL slug / route key (e.g. "home", "about")
   * @param {object} data - { id, regions, updatedAt }
   */
  async syncDraft(websiteId, pageSlug, data) {
    try {
      const contentRef = ref(database, paths.contentDraft(websiteId, pageSlug));
      const safeData = encodeFirebaseObject(data);
      await set(contentRef, safeData);
      return true;
    } catch (error) {
      console.error(`Failed to sync draft content for page "${pageSlug}":`, error);
      throw error;
    }
  },

  /**
   * Remove published + draft content for a page.
   */
  async unsync(websiteId, pageSlug) {
    try {
      const publishedRef = ref(database, paths.contentPublished(websiteId, pageSlug));
      const draftRef = ref(database, paths.contentDraft(websiteId, pageSlug));
      await remove(publishedRef);
      await remove(draftRef);
      return true;
    } catch (error) {
      console.error(`Failed to unsync content for page "${pageSlug}":`, error);
      throw error;
    }
  }
};

export default contentSyncService;
