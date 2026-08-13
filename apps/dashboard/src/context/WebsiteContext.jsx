import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import websiteService from "../services/websiteService";
import sourceCredentialService from "../services/sourceCredentialService";
import { useAuth } from "./AuthContext";
import { getAccessibleWebsiteIds } from "../utils/authAccess";

const WebsiteContext = createContext(null);

export function WebsiteProvider({ children }) {
  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    loading: authLoading,
    canAccessWebsite
  } = useAuth();
  const [websites, setWebsites] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  // Sync state from service
  const refreshWebsites = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      setWebsites([]);
      setSelectedWebsite(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = isSuperAdmin
        ? await websiteService.getAll()
        : (await Promise.all(
          getAccessibleWebsiteIds(user).map((id) => websiteService.getById(id))
        )).filter(Boolean);
      setWebsites(data);
      setSelectedWebsite((current) => (
        current && data.some((website) => website.id === current.id) ? current : null
      ));
    } catch (e) {
      console.error("Failed to load websites", e);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, isSuperAdmin, user]);

  useEffect(() => {
    refreshWebsites();
  }, [refreshWebsites]);

  const selectWebsite = useCallback(async (id) => {
    if (!canAccessWebsite(id)) {
      setSelectedWebsite(null);
      return null;
    }
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
  }, [canAccessWebsite]);

  const createWebsite = useCallback(async (data) => {
    if (!isSuperAdmin) throw new Error("Only a super administrator can connect websites.");
    try {
      const created = await websiteService.create(data);
      await refreshWebsites();
      return created;
    } catch (e) {
      console.error("Failed to create website", e);
      throw e;
    }
  }, [isSuperAdmin, refreshWebsites]);

  const updateWebsite = useCallback(async (id, data) => {
    if (!canAccessWebsite(id)) throw new Error("You do not have access to this website.");
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
  }, [canAccessWebsite, refreshWebsites]);

  const deleteWebsite = useCallback(async (id) => {
    if (!isSuperAdmin) throw new Error("Only a super administrator can delete websites.");
    try {
      await websiteService.delete(id);
      sourceCredentialService.clear(id);
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
  }, [isSuperAdmin, refreshWebsites]);

  const regenerateApiKey = useCallback(async (id) => {
    if (!isSuperAdmin) throw new Error("Only a super administrator can regenerate API keys.");
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
  }, [isSuperAdmin, refreshWebsites]);

  const regenerateSecretKey = useCallback(async (id) => {
    if (!isSuperAdmin) throw new Error("Only a super administrator can regenerate secret keys.");
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
  }, [isSuperAdmin, refreshWebsites]);

  const updateStatus = useCallback(async (id, status) => {
    if (!isSuperAdmin) throw new Error("Only a super administrator can change connection status.");
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
  }, [isSuperAdmin, refreshWebsites]);

  const syncWebsite = useCallback(async (id) => {
    if (!canAccessWebsite(id)) throw new Error("You do not have access to this website.");
    setSyncLoading(true);
    try {
      const result = await websiteService.syncWebsite(id);
      await selectWebsite(id);
      await refreshWebsites();
      return result;
    } finally {
      setSyncLoading(false);
    }
  }, [canAccessWebsite, selectWebsite, refreshWebsites]);

  const importRoutes = useCallback(async (id, routes, userId) => {
    if (!canAccessWebsite(id)) throw new Error("You do not have access to this website.");
    setSyncLoading(true);
    try {
      const result = await websiteService.importRoutes(id, routes, userId);
      await selectWebsite(id);
      await refreshWebsites();
      return result;
    } finally {
      setSyncLoading(false);
    }
  }, [canAccessWebsite, selectWebsite, refreshWebsites]);

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
