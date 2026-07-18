import { useState, useCallback } from "react";
import contentTypeService from "../services/contentTypeService";
import useToast from "./useToast";

export function useContentTypes() {
  const [contentTypes, getContentTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadContentTypes = useCallback(async (websiteId) => {
    setLoading(true);
    try {
      const list = await contentTypeService.getAll(websiteId);
      getContentTypes(list);
      return list;
    } catch (err) {
      toast.error("Failed to load content types.");
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createContentType = useCallback(async (websiteId, data) => {
    setLoading(true);
    try {
      const created = await contentTypeService.create(websiteId, data);
      getContentTypes(prev => [created, ...prev]);
      toast.success(`Content type "${created.name}" created successfully.`);
      return created;
    } catch (err) {
      toast.error("Failed to create content type.");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateContentType = useCallback(async (websiteId, typeId, data) => {
    setLoading(true);
    try {
      const updated = await contentTypeService.update(websiteId, typeId, data);
      getContentTypes(prev => prev.map(t => (t.id === typeId ? updated : t)));
      toast.success("Content type updated successfully.");
      return updated;
    } catch (err) {
      toast.error("Failed to update content type.");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteContentType = useCallback(async (websiteId, typeId) => {
    setLoading(true);
    try {
      await contentTypeService.delete(websiteId, typeId);
      getContentTypes(prev => prev.filter(t => t.id !== typeId));
      toast.success("Content type deleted successfully.");
      return true;
    } catch (err) {
      toast.error("Failed to delete content type.");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    contentTypes,
    loading,
    loadContentTypes,
    createContentType,
    updateContentType,
    deleteContentType
  };
}

export default useContentTypes;
