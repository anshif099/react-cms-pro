import { useCallback } from "react";
import { useWebsites } from "./useWebsites";
import { useToast } from "./useToast";
import { useAuth } from "./useAuth";

export function useWebsiteSync(websiteId) {
  const { 
    syncWebsite, 
    importRoutes, 
    syncLoading, 
    selectedWebsite, 
    websites 
  } = useWebsites();
  const toast = useToast();
  const { user } = useAuth();

  const website = selectedWebsite?.id === websiteId 
    ? selectedWebsite 
    : websites.find(w => w.id === websiteId);

  const sync = useCallback(async () => {
    if (!websiteId) return null;
    try {
      const result = await syncWebsite(websiteId);
      toast.success(`Successfully synchronized ${result.count} routes via manifest!`);
      return { success: true, count: result.count, mode: result.mode };
    } catch (err) {
      console.error(err);
      toast.error("Auto manifest sync failed. Open manual route import fallback.");
      return { success: false, error: err };
    }
  }, [websiteId, syncWebsite, toast]);

  const importManual = useCallback(async (routes) => {
    if (!websiteId) return null;
    try {
      const result = await importRoutes(websiteId, routes, user?.uid || "system");
      toast.success(`Successfully imported ${result.count} manual routes!`);
      return result;
    } catch (err) {
      console.error(err);
      toast.error("Manual route import failed.");
      throw err;
    }
  }, [websiteId, importRoutes, user, toast]);

  return {
    sync,
    importManual,
    syncLoading,
    syncMode: website?.syncMode || "none",
    syncStatus: website?.syncStatus || "idle",
    syncStats: website?.syncStats || {
      totalPages: 0,
      importedPages: 0,
      cmsPages: 0,
      drafts: 0,
      published: 0,
      archived: 0
    },
    lastSync: website?.lastSync 
      ? new Date(website.lastSync).toLocaleString() 
      : "Never"
  };
}

export default useWebsiteSync;
