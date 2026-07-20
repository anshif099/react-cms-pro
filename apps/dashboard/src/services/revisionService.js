import { database } from "../lib/firebase";
import { ref, push, set, get } from "firebase/database";

export const revisionService = {
  async save(websiteId, entityType, entityId, snapshot, userId) {
    try {
      const revisionsRef = ref(database, `revisions/${websiteId}/${entityType}/${entityId}`);
      const newRevisionRef = push(revisionsRef);
      const revisionId = newRevisionRef.key;

      await set(newRevisionRef, {
        id: revisionId,
        snapshot,
        savedBy: userId || "system",
        savedAt: Date.now()
      });

      return revisionId;
    } catch (error) {
      console.error(`Failed to save revision for ${entityType}/${entityId}:`, error);
      throw error;
    }
  },

  async getAll(websiteId, entityType, entityId) {
    try {
      const revisionsRef = ref(database, `revisions/${websiteId}/${entityType}/${entityId}`);
      const snapshot = await get(revisionsRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        return Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        })).sort((a, b) => b.savedAt - a.savedAt); // Newest first
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch revisions for ${entityType}/${entityId}:`, error);
      throw error;
    }
  },

  async getById(websiteId, entityType, entityId, revisionId) {
    try {
      const docRef = ref(database, `revisions/${websiteId}/${entityType}/${entityId}/${revisionId}`);
      const snapshot = await get(docRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch revision ${revisionId}:`, error);
      throw error;
    }
  },

  async restore(websiteId, entityType, entityId, revisionId) {
    try {
      const revision = await this.getById(websiteId, entityType, entityId, revisionId);
      if (!revision) {
        throw new Error("Revision not found.");
      }
      return revision.snapshot;
    } catch (error) {
      console.error(`Failed to restore revision ${revisionId}:`, error);
      throw error;
    }
  },

  compare(snapshotA, snapshotB) {
    // Basic structural differences finder for UI display
    const diff = {};
    const allKeys = new Set([
      ...Object.keys(snapshotA || {}),
      ...Object.keys(snapshotB || {})
    ]);

    for (const key of allKeys) {
      const valA = snapshotA ? snapshotA[key] : undefined;
      const valB = snapshotB ? snapshotB[key] : undefined;

      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        diff[key] = {
          oldValue: valA,
          newValue: valB,
          type: valA === undefined ? "added" : valB === undefined ? "deleted" : "modified"
        };
      }
    }
    return diff;
  }
};

export default revisionService;
