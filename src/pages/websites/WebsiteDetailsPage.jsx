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
  HeartHandshake,
  LayoutDashboard,
  RefreshCw
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
import { ManualRouteImportModal } from "../../components/websites/ManualRouteImportModal";
import { motion } from "framer-motion";

export function WebsiteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { 
    selectWebsite, 
    selectedWebsite, 
    deleteWebsite, 
    regenerateApiKey, 
    regenerateSecretKey, 
    updateStatus 
  } = useWebsites();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  
  // Modals state
  const [showDelete, setShowDelete] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showRegenApiKey, setShowRegenApiKey] = useState(false);
  const [showRegenSecretKey, setShowRegenSecretKey] = useState(false);
  const [showManualSync, setShowManualSync] = useState(false);

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
      toast.info("Website SDK disconnected");
      setShowDisconnect(false);
    } catch (error) {
      toast.error("Failed to disconnect SDK.");
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
          {selectedWebsite.verificationStatus !== "verified" && (
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

          {/* API Credentials Card */}
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

          <SyncStatusCard
            syncStats={syncStats}
            lastSync={lastSync}
            syncMode={syncMode}
            syncStatus={syncStatus}
          />
        </div>

        {/* Right side stats/status & Danger Zone */}
        <div className="space-y-6">
          {/* Connection Status Panel */}
          <Card title="Connection Health">
            <div className="space-y-4 text-xs font-medium text-admin-secondary">
              <div className="flex justify-between items-center">
                <span>SDK Status</span>
                <Badge variant={selectedWebsite.sdkInstalled ? "success" : "neutral"}>
                  {selectedWebsite.sdkInstalled ? "Installed" : "Not Found"}
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>SDK Version</span>
                <span className="font-bold text-admin-text">{selectedWebsite.sdkVersion || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Connection Health</span>
                <Badge>{selectedWebsite.connectionHealth}</Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span>Last Sync Pulse</span>
                <span className="font-bold text-admin-text">{selectedWebsite.lastSync || "Never"}</span>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card title="Danger Zone" className="border-red-200 dark:border-red-950/40">
            <div className="space-y-4">
              <p className="text-xs text-admin-secondary leading-relaxed text-left">
                Disconnecting the SDK stops content synchronization. Deleting the website permanently deletes all settings.
              </p>
              
              <div className="flex flex-col gap-2.5">
                {selectedWebsite.status === "connected" && (
                  <Button 
                    onClick={() => setShowDisconnect(true)} 
                    variant="outline" 
                    className="w-full text-red-500 border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold gap-1.5 py-1.5"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Disconnect SDK
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
          </Card>
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Website configuration?"
        message={`This action cannot be undone. This will delete "${selectedWebsite.name}" and deactivate all credentials associated with ${selectedWebsite.domain}.`}
      />

      <ConfirmDialog
        isOpen={showDisconnect}
        onClose={() => setShowDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Website SDK?"
        message="Are you sure you want to mock disconnecting this SDK client connection? Status will revert to disconnected."
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
    </div>
  );
}

export default WebsiteDetailsPage;
