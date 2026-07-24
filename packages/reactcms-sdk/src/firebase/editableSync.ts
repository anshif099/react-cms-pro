import { ref, set, get, onValue } from 'firebase/database';
import { getFirebaseDatabase } from './firebaseClient';
import { paths, encodeFirebaseKey, decodeFirebaseKey } from '@anshif.rainhopes/shared';

export interface DraftPageRegionValues {
  [regionId: string]: unknown;
}

export const editableSync = {
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
      const regionRef = ref(db, `${paths.contentDraft(websiteId, pageId)}/${encodedRegionId}`);
      await set(regionRef, value);
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to write draft value for region ${regionId}:`, err);
    }
  },

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
      const raw = snapshot.val() as DraftPageRegionValues;
      const decoded: DraftPageRegionValues = {};
      Object.entries(raw).forEach(([k, v]) => {
        decoded[decodeFirebaseKey(k)] = v;
      });
      return decoded;
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to get draft regions for page ${pageId}:`, err);
      return {};
    }
  },

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
        const raw = snapshot.exists() ? (snapshot.val() as DraftPageRegionValues) : {};
        const decoded: DraftPageRegionValues = {};
        Object.entries(raw).forEach(([k, v]) => {
          decoded[decodeFirebaseKey(k)] = v;
        });
        callback(decoded);
      });
    } catch (err) {
      console.error(`[ReactCMS SDK] Failed to subscribe to draft regions for page ${pageId}:`, err);
      return () => {};
    }
  },
};
