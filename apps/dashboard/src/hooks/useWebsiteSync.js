import { useCallback, useState } from "react";
import { useWebsites } from "./useWebsites";
import { useToast } from "./useToast";
import { useAuth } from "./useAuth";
import sourceImportService from "../services/sourceImportService";

export function useWebsiteSync(websiteId) {
  const { 
    syncWebsite, 
    importRoutes, 
    updateWebsite,
    syncLoading, 
    selectedWebsite, 
    websites 
  } = useWebsites();
  const toast = useToast();
  const { user } = useAuth();
  const [sourceSyncing, setSourceSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

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
      console.warn("Sync failed, falling back to manual import:", err.message);
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

  const rescanSource = useCallback(async () => {
    if (!websiteId || !website) return null;
    setSourceSyncing(true);
    setSyncProgress("Preparing source rescan...");
    try {
      const imported = await sourceImportService.rescanConnectedSource(website, {
        onProgress: setSyncProgress
      });
      setSyncProgress(`Importing ${imported.routes.length} discovered pages...`);
      await importRoutes(
        websiteId,
        imported.routes,
        user?.email || user?.uid || "system"
      );
      await updateWebsite(websiteId, {
        framework: imported.manifest.framework,
        connectionHealth: "healthy",
        connection: {
          ...(website.connection || {}),
          status: "ready",
          repository: imported.manifest.repository,
          branch: imported.manifest.branch,
          rootDirectory: imported.manifest.rootDirectory,
          sourceRevision: imported.manifest.revision,
          authentication: imported.manifest.authentication,
          fileCount: imported.manifest.fileCount,
          routeCount: imported.routes.length,
          importedAt: Date.now()
        }
      });
      toast.success(
        `Source rescanned: ${imported.routes.length} page${imported.routes.length === 1 ? "" : "s"} found.`
      );
      return { success: true, count: imported.routes.length };
    } catch (error) {
      console.error("Source rescan failed:", error);
      toast.error(error.message || "Connected source rescan failed.");
      return { success: false, error };
    } finally {
      setSourceSyncing(false);
      setSyncProgress("");
    }
  }, [importRoutes, toast, updateWebsite, user, website, websiteId]);

  return {
    sync,
    importManual,
    rescanSource,
    syncLoading: syncLoading || sourceSyncing,
    syncProgress,
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
