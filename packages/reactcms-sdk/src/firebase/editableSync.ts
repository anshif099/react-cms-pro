import { ref, set, get, onValue } from 'firebase/database';
import { getFirebaseDatabase } from './firebaseClient';
import { paths, encodeFirebaseKey, decodeFirebaseKey } from '@anshif.rainhopes/shared';

export interface DraftPageRegionValues {
  [regionId: string]: unknown;
}

/** Unwrap and decode encoded region keys from a raw Firebase snapshot value */
function decodeRegionsSnapshot(raw: Record<string, unknown>): DraftPageRegionValues {
  // The dashboard stores { id, regions: {...}, publishedAt } — unwrap if needed
  const regionsRaw = (raw.regions && typeof raw.regions === 'object')
    ? (raw.regions as Record<string, unknown>)
    : raw;
  const decoded: DraftPageRegionValues = {};
  Object.entries(regionsRaw).forEach(([k, v]) => {
    // Skip metadata keys
    if (k === 'id' || k === 'updatedAt' || k === 'publishedAt') return;
    decoded[decodeFirebaseKey(k)] = v;
  });
  return decoded;
}

export const editableSync = {
  /** Write a single region value to the draft path */
  async saveDraftRegion(
    apiKey: string,
    websiteId: string,
    pageId: string,
    regionId: string,
    value: unknown
  ): Promise<void> {
    try {
      const db = getFirebaseDatabase(apiKey);
      const encodedRegionId = encodeFirebaseKey(regionId);
      const regionRef = ref(db, `${paths.contentDraft(websiteId, pageId)}/regions/${encodedRegionId}`);
      await set(regionRef, value);
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to write draft value for region ${regionId}:`, err);
    }
  },

  /** One-time fetch of draft region values for a page */
  async getDraftRegions(
    apiKey: string,
    websiteId: string,
    pageId: string
  ): Promise<DraftPageRegionValues> {
    try {
      const db = getFirebaseDatabase(apiKey);
      const draftRef = ref(db, paths.contentDraft(websiteId, pageId));
      const snapshot = await get(draftRef);
      if (!snapshot.exists()) return {};
      return decodeRegionsSnapshot(snapshot.val() as Record<string, unknown>);
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to get draft regions for page ${pageId}:`, err);
      return {};
    }
  },

  /** One-time fetch of published region values for a page (used on live site initial hydration) */
  async getPublishedRegions(
    apiKey: string,
    websiteId: string,
    pageId: string
  ): Promise<DraftPageRegionValues> {
    try {
      const db = getFirebaseDatabase(apiKey);
      const publishedRef = ref(db, paths.contentPublished(websiteId, pageId));
      const snapshot = await get(publishedRef);
      if (!snapshot.exists()) return {};
      return decodeRegionsSnapshot(snapshot.val() as Record<string, unknown>);
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to get published regions for page ${pageId}:`, err);
      return {};
    }
  },

  /** Subscribe to real-time draft region changes (used in preview/edit mode) */
  subscribeToDraftRegions(
    apiKey: string,
    websiteId: string,
    pageId: string,
    callback: (values: DraftPageRegionValues) => void
  ): () => void {
    try {
      const db = getFirebaseDatabase(apiKey);
      const draftRef = ref(db, paths.contentDraft(websiteId, pageId));
      return onValue(draftRef, (snapshot) => {
        if (!snapshot.exists()) { callback({}); return; }
        callback(decodeRegionsSnapshot(snapshot.val() as Record<string, unknown>));
      });
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to subscribe to draft regions for page ${pageId}:`, err);
      return () => {};
    }
  },

  /** Subscribe to published region value changes (used on live site for real-time publish updates) */
  subscribeToPublishedRegions(
    apiKey: string,
    websiteId: string,
    pageId: string,
    callback: (values: DraftPageRegionValues) => void
  ): () => void {
    try {
      const db = getFirebaseDatabase(apiKey);
      const publishedRef = ref(db, paths.contentPublished(websiteId, pageId));
      return onValue(publishedRef, (snapshot) => {
        if (!snapshot.exists()) return;
        callback(decodeRegionsSnapshot(snapshot.val() as Record<string, unknown>));
      });
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to subscribe to published regions for page ${pageId}:`, err);
      return () => {};
    }
  },
};
