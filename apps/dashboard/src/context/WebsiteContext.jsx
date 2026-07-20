import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import websiteService from "../services/websiteService";

const WebsiteContext = createContext(null);

export function WebsiteProvider({ children }) {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  // Sync state from service
  const refreshWebsites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await websiteService.getAll();
      setWebsites(data);
    } catch (e) {
      console.error("Failed to load websites", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWebsites();
  }, [refreshWebsites]);

  const selectWebsite = useCallback(async (id) => {
    setLoading(true);
    try {
      const found = await websiteService.getById(id);
      setSelectedWebsite(found);
      return found;
    } catch (e) {
      console.error("Failed to get website details", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createWebsite = useCallback(async (data) => {
    try {
      const created = await websiteService.create(data);
      await refreshWebsites();
      return created;
    } catch (e) {
      console.error("Failed to create website", e);
      throw e;
    }
  }, [refreshWebsites]);

  const updateWebsite = useCallback(async (id, data) => {
    try {
      const updated = await websiteService.update(id, data);
      await refreshWebsites();
      setSelectedWebsite(prev => {
        if (prev && prev.id === id) {
          return updated;
        }
        return prev;
      });
      return updated;
    } catch (e) {
      console.error("Failed to update website", e);
      throw e;
    }
  }, [refreshWebsites]);

  const deleteWebsite = useCallback(async (id) => {
    try {
      await websiteService.delete(id);
      await refreshWebsites();
      setSelectedWebsite(prev => {
        if (prev && prev.id === id) {
          return null;
        }
        return prev;
      });
    } catch (e) {
      console.error("Failed to delete website", e);
      throw e;
    }
  }, [refreshWebsites]);

  const regenerateApiKey = useCallback(async (id) => {
    try {
      const updated = await websiteService.regenerateApiKey(id);
      await refreshWebsites();
      setSelectedWebsite(prev => {
        if (prev && prev.id === id) {
          return updated;
        }
        return prev;
      });
      return updated;
    } catch (e) {
      console.error("Failed to regenerate API Key", e);
      throw e;
    }
  }, [refreshWebsites]);

  const regenerateSecretKey = useCallback(async (id) => {
    try {
      const updated = await websiteService.regenerateSecretKey(id);
      await refreshWebsites();
      setSelectedWebsite(prev => {
        if (prev && prev.id === id) {
          return updated;
        }
        return prev;
      });
      return updated;
    } catch (e) {
      console.error("Failed to regenerate Secret Key", e);
      throw e;
    }
  }, [refreshWebsites]);

  const updateStatus = useCallback(async (id, status) => {
    try {
      const updated = await websiteService.updateStatus(id, status);
      await refreshWebsites();
      setSelectedWebsite(prev => {
        if (prev && prev.id === id) {
          return updated;
        }
        return prev;
      });
      return updated;
    } catch (e) {
      console.error("Failed to update status", e);
      throw e;
    }
  }, [refreshWebsites]);

  const syncWebsite = useCallback(async (id) => {
    setSyncLoading(true);
    try {
      const result = await websiteService.syncWebsite(id);
      await selectWebsite(id);
      await refreshWebsites();
      return result;
    } finally {
      setSyncLoading(false);
    }
  }, [selectWebsite, refreshWebsites]);

  const importRoutes = useCallback(async (id, routes, userId) => {
    setSyncLoading(true);
    try {
      const result = await websiteService.importRoutes(id, routes, userId);
      await selectWebsite(id);
      await refreshWebsites();
      return result;
    } finally {
      setSyncLoading(false);
    }
  }, [selectWebsite, refreshWebsites]);

  return (
    <WebsiteContext.Provider value={{
      websites,
      selectedWebsite,
      loading,
      refreshWebsites,
      selectWebsite,
      createWebsite,
      updateWebsite,
      deleteWebsite,
      regenerateApiKey,
      regenerateSecretKey,
      updateStatus,
      syncWebsite,
      importRoutes,
      syncLoading
    }}>
      {children}
    </WebsiteContext.Provider>
  );
}

export function useWebsites() {
  const context = useContext(WebsiteContext);
  if (!context) {
    throw new Error("useWebsites must be used within a WebsiteProvider");
  }
  return context;
}
