import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Globe, 
  ShieldCheck, 
  Terminal, 
  Trash2, 
  Unlink, 
  Copy, 
  Check, 
  Key, 
  Clock, 
  LayoutDashboard,
  RefreshCw,
  Download,
  Route
} from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { useWebsiteSync } from "../../hooks/useWebsiteSync";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { SecretField } from "../../components/ui/SecretField";
import { SyncStatusCard } from "../../components/websites/SyncStatusCard";
import { registryService } from "../../services/registryService";
import sourceImportService from "../../services/sourceImportService";
import { ManualRouteImportModal } from "../../components/websites/ManualRouteImportModal";
import { useAuth } from "../../hooks/useAuth";
import { HostingRouteRepairModal } from "../../components/websites/HostingRouteRepairModal";

export function WebsiteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { 
    selectWebsite, 
    selectedWebsite, 
    deleteWebsite, 
    regenerateApiKey, 
    regenerateSecretKey, 
    updateStatus,
    updateWebsite
  } = useWebsites();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  
  // Modals state
  const [showDelete, setShowDelete] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showRegenApiKey, setShowRegenApiKey] = useState(false);
  const [showRegenSecretKey, setShowRegenSecretKey] = useState(false);
  const [showManualSync, setShowManualSync] = useState(false);
  const [showRouteRepair, setShowRouteRepair] = useState(false);

  const { 
    sync, 
    importManual, 
    syncLoading, 
    syncMode, 
    syncStatus, 
    syncStats, 
    lastSync 
  } = useWebsiteSync(id);

  const handleSync = async () => {
    const result = await sync();
    if (!result || result.success === false) {
      setShowManualSync(true);
    }
  };

  const [runtimeStatus, setRuntimeStatus] = useState(null);

  useEffect(() => {
    if (selectedWebsite?.id) {
      const unsubscribe = registryService.subscribeToRuntime(selectedWebsite.id, (data) => {
        setRuntimeStatus(data);
      });
      return () => unsubscribe();
    }
  }, [selectedWebsite?.id]);

  // Sync selected website
  useEffect(() => {
    if (id) {
      async function loadWebsite() {
        const found = await selectWebsite(id);
        if (!found) {
          toast.error("Website not found.");
          navigate("/websites");
        }
      }
      loadWebsite();
    }
  }, [id, selectWebsite, navigate, toast]);

  if (!selectedWebsite) {
    return <div className="text-left py-4">Loading website details...</div>;
  }

  const handleCopyText = async (text, setter) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (e) {
      toast.error("Failed to copy key.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWebsite(selectedWebsite.id);
      toast.success("Website deleted successfully");
      navigate("/websites");
    } catch (error) {
      toast.error("Failed to delete website.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await updateStatus(selectedWebsite.id, "disconnected");
      toast.info("Website source connection disconnected");
      setShowDisconnect(false);
    } catch (error) {
      toast.error("Failed to disconnect website source.");
    }
  };

  const handleRegenApi = async () => {
    try {
      await regenerateApiKey(selectedWebsite.id);
      toast.success("API Key regenerated");
      setShowRegenApiKey(false);
    } catch (error) {
      toast.error("Failed to regenerate API Key.");
    }
  };

  const handleRegenSecret = async () => {
    try {
      await regenerateSecretKey(selectedWebsite.id);
      toast.success("Secret Key regenerated");
      setShowRegenSecretKey(false);
    } catch (error) {
      toast.error("Failed to regenerate Secret Key.");
    }
  };

  const handleDownloadSource = async () => {
    try {
      const sourceName = selectedWebsite.connection?.repository
        ?.split("/")
        .pop()
        ?.replace(/\.zip$/i, "") || selectedWebsite.name;
      await sourceImportService.downloadCodebase(
        selectedWebsite.connection?.artifactPath,
        `${sourceName}-source.zip`
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Source archive could not be downloaded.");
    }
  };

  const handleRouteRepaired = async ({ routing, connection }) => {
    await updateWebsite(selectedWebsite.id, {
      connectionHealth: "healthy",
      connection: {
        ...connection,
        spaRoutingConfigured: routing.configured,
        routeDeletionGuardConfigured: routing.deletionGuardConfigured,
        spaRoutingPath: routing.path,
        spaRoutingUpdatedAt: Date.now()
      }
    });
    setShowRouteRepair(false);
    toast.success(
      routing.changed
        ? "Live routes and deleted-page handling were installed and verified."
        : "Live routes and deleted-page handling are already configured and verified."
    );
  };

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      {/* Back button link */}
      <div>
        <button
          onClick={() => navigate("/websites")}
          className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Websites
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-admin-border dark:border-slate-700 rounded-xl text-primary flex-shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-admin-text tracking-tight">{selectedWebsite.name}</h2>
            <a 
              href={selectedWebsite.domain} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-primary hover:underline"
            >
              {selectedWebsite.domain}
            </a>
          </div>
        </div>

        {/* Verification and connection CTAs */}
        <div className="flex gap-2">
          {isSuperAdmin && ["cpanel", "sftp"].includes(selectedWebsite.connection?.provider) && (
            <Button
              onClick={() => setShowRouteRepair(true)}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Route className="w-4 h-4" />
              Repair Live Route
            </Button>
          )}
          {isSuperAdmin && selectedWebsite.verificationStatus !== "verified" && (
            <Button 
              onClick={() => navigate(`/websites/${selectedWebsite.id}/verify`)}
              variant="outline" 
              size="sm"
              className="gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Verify Domain
            </Button>
          )}
          {!isSuperAdmin ? (
            <Button
              onClick={() => navigate(`/content/${selectedWebsite.id}/pages`)}
              variant="primary"
              size="sm"
              className="gap-1.5"
            >
              <LayoutDashboard className="w-4 h-4" />
              Open Pages
            </Button>
          ) : selectedWebsite.sourceConnected ? (
            <Button
              onClick={() => navigate(`/content/${selectedWebsite.id}/pages`)}
              variant="primary"
              size="sm"
              className="gap-1.5"
            >
              <LayoutDashboard className="w-4 h-4" />
              Open Pages
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSync}
                variant="outline"
                size="sm"
                className="gap-1.5 font-bold cursor-pointer"
                loading={syncLoading}
              >
                <RefreshCw className={`w-4 h-4 ${syncLoading ? "animate-spin" : ""}`} />
                Sync Website
              </Button>
              <Button
                onClick={() => navigate(`/websites/${selectedWebsite.id}/sdk`)}
                variant="primary"
                size="sm"
                className="gap-1.5"
              >
                <Terminal className="w-4 h-4" />
                SDK Guide
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card title="Website Metadata" subtitle="Registration details and framework information">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-xs md:text-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                  Website ID
                </span>
                <div className="flex items-center gap-1.5">
                  <code className="bg-slate-50 dark:bg-slate-800 py-1 px-2 border border-admin-border dark:border-slate-700 rounded-md font-mono select-all text-xs max-w-[180px] md:max-w-none truncate">
                    {selectedWebsite.id}
                  </code>
                  <button 
                    onClick={() => handleCopyText(selectedWebsite.id, setCopiedId)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                  Framework
                </span>
                <span className="font-semibold text-admin-text bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-lg border border-admin-border dark:border-slate-800">
                  {selectedWebsite.framework}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                  Hosting Provider
                </span>
                <span className="font-semibold text-admin-text bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-lg border border-admin-border dark:border-slate-800">
                  {selectedWebsite.hosting}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                  Created On
                </span>
                <span className="font-medium text-admin-secondary flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(selectedWebsite.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Connection details */}
          {selectedWebsite.sourceConnected ? (
            <Card title="Imported Source" subtitle="Versioned codebase artifact used for page discovery">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                    Provider
                  </span>
                  <span className="font-semibold text-admin-text capitalize">
                    {selectedWebsite.connection?.provider || selectedWebsite.connectionProvider}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                    Repository / Archive
                  </span>
                  <span className="font-semibold text-admin-text break-all">
                    {selectedWebsite.connection?.repository || "Imported source"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                    Source Revision
                  </span>
                  <code className="font-mono text-admin-text break-all">
                    {selectedWebsite.connection?.sourceRevision || "N/A"}
                  </code>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block mb-1">
                    Imported Files / Routes
                  </span>
                  <span className="font-semibold text-admin-text">
                    {selectedWebsite.connection?.fileCount || 0} files / {selectedWebsite.connection?.routeCount || 0} routes
                  </span>
                </div>
                <div className="sm:col-span-2 pt-3 border-t border-admin-border dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleDownloadSource}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Imported Codebase
                  </Button>
                </div>
              </div>
            </Card>
          ) : isSuperAdmin ? (
          <Card title="API Credentials" subtitle="Access key pairs used by SDK clients">
            <div className="space-y-4">
              {/* API Public Key */}
              <div>
                <label className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider block mb-1.5">
                  Public API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-50 dark:bg-slate-800 border border-admin-border dark:border-slate-700 py-2 px-3 rounded-lg flex-1 font-mono text-xs text-left overflow-hidden text-ellipsis select-all">
                    {selectedWebsite.apiKey}
                  </code>
                  <button
                    onClick={() => handleCopyText(selectedWebsite.apiKey, setCopiedApiKey)}
                    className="p-2 border border-admin-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-admin-text transition-all cursor-pointer"
                    title="Copy API Key"
                  >
                    {copiedApiKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div>
                <label className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider block mb-1.5">
                  Secret Client Key
                </label>
                <SecretField value={selectedWebsite.secretKey} label="Secret Key" />
              </div>

              {/* Regenerate actions */}
              <div className="flex flex-wrap gap-2.5 pt-3 border-t border-admin-border dark:border-slate-800/80">
                <Button 
                  onClick={() => setShowRegenApiKey(true)} 
                  variant="outline" 
                  size="sm"
                  className="gap-1.5 text-xs font-semibold py-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  Regenerate API Key
                </Button>
                <Button 
                  onClick={() => setShowRegenSecretKey(true)} 
                  variant="outline" 
                  size="sm"
                  className="gap-1.5 text-xs font-semibold py-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  Regenerate Secret Key
                </Button>
              </div>
            </div>
          </Card>
          ) : null}

          <SyncStatusCard
            syncStats={syncStats}
            lastSync={lastSync}
            syncMode={syncMode}
            syncStatus={syncStatus}
          />
        </div>

        {/* Right side stats/status & Danger Zone */}
        <div className="space-y-6">
          {/* Runtime / source status panel */}
          <Card title={selectedWebsite.sourceConnected ? "Source Status" : "Runtime Status"}>
            <div className="space-y-4 text-xs font-medium text-admin-secondary text-left">
              <div className="flex justify-between items-center">
                <span>{selectedWebsite.sourceConnected ? "Import Status" : "Heartbeat Status"}</span>
                <Badge variant={selectedWebsite.sourceConnected || runtimeStatus?.status === "online" ? "success" : "neutral"}>
                  {selectedWebsite.sourceConnected
                    ? selectedWebsite.connection?.status || "ready"
                    : runtimeStatus?.status || "offline"}
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>{selectedWebsite.sourceConnected ? "Imported At" : "Last Ping"}</span>
                <span className="font-bold text-admin-text">
                  {selectedWebsite.sourceConnected
                    ? selectedWebsite.connection?.importedAt
                      ? new Date(selectedWebsite.connection.importedAt).toLocaleString()
                      : "Unknown"
                    : runtimeStatus?.heartbeat ? new Date(runtimeStatus.heartbeat).toLocaleTimeString() : "Never"}
                </span>
              </div>
              {!selectedWebsite.sourceConnected && <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Runtime Version</span>
                <span className="font-bold text-admin-text">{runtimeStatus?.runtimeVersion || "N/A"}</span>
              </div>}
              {!selectedWebsite.sourceConnected && <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>SDK Version</span>
                <span className="font-bold text-admin-text">{runtimeStatus?.sdkVersion || "N/A"}</span>
              </div>}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Compatibility</span>
                <Badge variant={runtimeStatus?.compatibility === "ok" ? "success" : "neutral"}>
                  {runtimeStatus?.compatibility || "unknown"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Connection Status Panel */}
          <Card title="Connection Health">
            <div className="space-y-4 text-xs font-medium text-admin-secondary">
              <div className="flex justify-between items-center">
                <span>{selectedWebsite.sourceConnected ? "Source Status" : "SDK Status"}</span>
                <Badge variant={selectedWebsite.sourceConnected || selectedWebsite.sdkInstalled ? "success" : "neutral"}>
                  {selectedWebsite.sourceConnected
                    ? selectedWebsite.connection?.provider || "Imported"
                    : selectedWebsite.sdkInstalled ? "Installed" : "Not Found"}
                </Badge>
              </div>
              {!selectedWebsite.sourceConnected && <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>SDK Version</span>
                <span className="font-bold text-admin-text">{selectedWebsite.sdkVersion || "N/A"}</span>
              </div>}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Connection Health</span>
                <Badge>{selectedWebsite.connectionHealth}</Badge>
              </div>
              {["cpanel", "sftp"].includes(selectedWebsite.connection?.provider) && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <span>Live SPA Routing</span>
                  <Badge variant={selectedWebsite.connection?.spaRoutingConfigured && selectedWebsite.connection?.routeDeletionGuardConfigured ? "success" : "warning"}>
                    {selectedWebsite.connection?.spaRoutingConfigured && selectedWebsite.connection?.routeDeletionGuardConfigured ? "verified" : "repair required"}
                  </Badge>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Last Sync Pulse</span>
                <span className="font-bold text-admin-text">{selectedWebsite.lastSync || "Never"}</span>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          {isSuperAdmin && <Card title="Danger Zone" className="border-red-200 dark:border-red-950/40">
            <div className="space-y-4">
              <p className="text-xs text-admin-secondary leading-relaxed text-left">
                Disconnecting stops future source synchronization. Deleting permanently removes all ReactCMS pages, content, media, revisions, and imported source artifacts.
              </p>
              
              <div className="flex flex-col gap-2.5">
                {selectedWebsite.status === "connected" && (
                  <Button 
                    onClick={() => setShowDisconnect(true)} 
                    variant="outline" 
                    className="w-full text-red-500 border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold gap-1.5 py-1.5"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Disconnect Source
                  </Button>
                )}
                <Button 
                  onClick={() => setShowDelete(true)} 
                  variant="danger"
                  className="w-full text-xs font-semibold gap-1.5 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Website
                </Button>
              </div>
            </div>
          </Card>}
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Website and Imported Data?"
        message={`This cannot be undone. ReactCMS will delete "${selectedWebsite.name}", its pages, drafts, published content, revisions, media, registry data, and source artifacts. The external repository and live domain are not deleted.`}
      />

      <ConfirmDialog
        isOpen={showDisconnect}
        onClose={() => setShowDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Website Source?"
        message="This marks the website source as disconnected. Existing imported data remains until you delete the website."
      />

      <ConfirmDialog
        isOpen={showRegenApiKey}
        onClose={() => setShowRegenApiKey(false)}
        onConfirm={handleRegenApi}
        title="Regenerate API Key?"
        message="Are you sure? Any live website using this API Key will immediately lose synchronization until the code is updated."
      />

      <ConfirmDialog
        isOpen={showRegenSecretKey}
        onClose={() => setShowRegenSecretKey(false)}
        onConfirm={handleRegenSecret}
        title="Regenerate Secret Key?"
        message="Are you sure? Any server-side webhook processes or SDK calls requiring the secret key will start failing immediately."
      />

      <ManualRouteImportModal
        isOpen={showManualSync}
        onClose={() => setShowManualSync(false)}
        onImport={importManual}
        loading={syncLoading}
      />

      <HostingRouteRepairModal
        isOpen={showRouteRepair}
        onClose={() => setShowRouteRepair(false)}
        website={selectedWebsite}
        onRepaired={handleRouteRepaired}
      />
    </div>
  );
}

export default WebsiteDetailsPage;
