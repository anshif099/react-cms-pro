import { useState, useCallback } from "react";
import revisionService from "../services/revisionService";
import useToast from "./useToast";

export function useRevisions() {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadRevisions = useCallback(async (websiteId, entityType, entityId) => {
    setLoading(true);
    try {
      const list = await revisionService.getAll(websiteId, entityType, entityId);
      setRevisions(list);
      return list;
    } catch (err) {
      toast.error("Failed to load revisions history.");
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const saveRevision = useCallback(async (websiteId, entityType, entityId, snapshot, userId) => {
    try {
      const revId = await revisionService.save(websiteId, entityType, entityId, snapshot, userId);
      // Reload history
      await loadRevisions(websiteId, entityType, entityId);
      return revId;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [loadRevisions]);

  const restoreRevision = useCallback(async (websiteId, entityType, entityId, revisionId) => {
    setLoading(true);
    try {
      const snapshot = await revisionService.restore(websiteId, entityType, entityId, revisionId);
      toast.success("Revision restored. Save draft to apply.");
      return snapshot;
    } catch (err) {
      toast.error("Failed to restore revision.");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getDiff = useCallback((snapshotA, snapshotB) => {
    return revisionService.compare(snapshotA, snapshotB);
  }, []);

  return {
    revisions,
    loading,
    loadRevisions,
    saveRevision,
    restoreRevision,
    getDiff
  };
}

export default useRevisions;
