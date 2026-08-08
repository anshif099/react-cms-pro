import { database } from "../lib/firebase";
import { ref, set, get, remove } from "firebase/database";
import { paths, encodeFirebaseObject } from "@anshif.rainhopes/shared";
import { repairSerializedRegionValues } from "./regionValueService";

export const contentSyncService = {
  async publishDraft(websiteId, pageSlug) {
    const draftRef = ref(database, paths.contentDraft(websiteId, pageSlug));
    const [draftSnapshot, definitionsSnapshot] = await Promise.all([
      get(draftRef),
      get(ref(database, paths.registryRegions(websiteId, pageSlug)))
    ]);
    if (!draftSnapshot.exists()) return false;

    const draft = draftSnapshot.val();
    const repaired = repairSerializedRegionValues(
      draft?.regions,
      definitionsSnapshot.exists() ? definitionsSnapshot.val() : {}
    );
    const publishableDraft = repaired.changed
      ? { ...draft, regions: repaired.regions }
      : draft;
    if (repaired.changed) {
      await set(draftRef, publishableDraft);
    }
    await set(ref(database, paths.contentPublished(websiteId, pageSlug)), {
      ...(publishableDraft && typeof publishableDraft === "object" ? publishableDraft : {}),
      publishedAt: Date.now()
    });
    return true;
  },

  /**
   * Publish page regions to the live published path.
   * Uses paths.contentPublished so the SDK can read them on page load.
   * Supports both (websiteId, pageSlug, data) and legacy (websiteId, type, pageSlug, data).
   */
  async syncPublished(websiteId, pageSlugOrType, dataOrPageSlug, optionalData) {
    let pageSlug = pageSlugOrType;
    let data = dataOrPageSlug;

    if (optionalData !== undefined) {
      pageSlug = dataOrPageSlug;
      data = optionalData;
    }

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
   * Supports both (websiteId, pageSlug, data) and legacy (websiteId, type, pageSlug, data).
   */
  async syncDraft(websiteId, pageSlugOrType, dataOrPageSlug, optionalData) {
    let pageSlug = pageSlugOrType;
    let data = dataOrPageSlug;

    if (optionalData !== undefined) {
      pageSlug = dataOrPageSlug;
      data = optionalData;
    }

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
   * Fetch published page regions for a website & page slug.
   */
  async getPublished(websiteId, pageSlug) {
    try {
      const contentRef = ref(database, paths.contentPublished(websiteId, pageSlug));
      const snapshot = await get(contentRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch published content for page "${pageSlug}":`, error);
      return null;
    }
  },

  /**
   * Fetch draft page regions for a website & page slug.
   */
  async getDraft(websiteId, pageSlug) {
    try {
      const contentRef = ref(database, paths.contentDraft(websiteId, pageSlug));
      const snapshot = await get(contentRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch draft content for page "${pageSlug}":`, error);
      return null;
    }
  },

  /**
   * Remove published + draft content for a page.
   */
  async unsync(websiteId, pageSlugOrType, optionalPageSlug) {
    const pageSlug = optionalPageSlug !== undefined ? optionalPageSlug : pageSlugOrType;
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
