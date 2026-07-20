import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Globe, 
  PlusCircle, 
  Search, 
  MoreVertical, 
  Eye, 
  ShieldCheck, 
  Terminal, 
  Key, 
  Trash2, 
  AlertCircle, 
  Unlink 
} from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useToast } from "../../hooks/useToast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Dropdown } from "../../components/ui/Dropdown";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { motion, AnimatePresence } from "framer-motion";

export function WebsitesPage() {
  const { 
    websites, 
    deleteWebsite, 
    regenerateApiKey, 
    regenerateSecretKey, 
    updateStatus,
    selectWebsite
  } = useWebsites();
  const navigate = useNavigate();
  const toast = useToast();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [hostingFilter, setHostingFilter] = useState("all");

  // Dialog State
  const [deleteId, setDeleteId] = useState(null);
  const [disconnectId, setDisconnectId] = useState(null);
  const [regenerateId, setRegenerateId] = useState(null);
  const [regenerateType, setRegenerateType] = useState(null); // 'api' | 'secret'

  const handleSelectWebsite = (id, pathSuffix = "") => {
    selectWebsite(id);
    navigate(`/websites/${id}${pathSuffix}`);
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        await deleteWebsite(deleteId);
        toast.success("Website deleted successfully");
      } catch (error) {
        toast.error("Failed to delete website.");
      } finally {
        setDeleteId(null);
      }
    }
  };

  const handleDisconnect = async () => {
    if (disconnectId) {
      try {
        await updateStatus(disconnectId, "disconnected");
        toast.info("Website SDK disconnected");
      } catch (error) {
        toast.error("Failed to disconnect SDK.");
      } finally {
        setDisconnectId(null);
      }
    }
  };

  const handleRegenerateKeys = async () => {
    if (regenerateId && regenerateType) {
      try {
        if (regenerateType === "api") {
          await regenerateApiKey(regenerateId);
          toast.success("API Key regenerated successfully");
        } else {
          await regenerateSecretKey(regenerateId);
          toast.success("Secret Key regenerated successfully");
        }
      } catch (error) {
        toast.error("Failed to regenerate credentials.");
      } finally {
        setRegenerateId(null);
        setRegenerateType(null);
      }
    }
  };

  // Filter logic
  const filteredWebsites = websites.filter((web) => {
    const matchesSearch = 
      web.name.toLowerCase().includes(search.toLowerCase()) ||
      web.domain.toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || web.status === statusFilter;
    const matchesFramework = frameworkFilter === "all" || web.framework === frameworkFilter;
    const matchesHosting = hostingFilter === "all" || web.hosting === hostingFilter;

    return matchesSearch && matchesStatus && matchesFramework && matchesHosting;
  });

  const getActionItems = (web) => [
    {
      label: "View Details",
      icon: Eye,
      onClick: () => handleSelectWebsite(web.id)
    },
    {
      label: "Verify Domain",
      icon: ShieldCheck,
      onClick: () => handleSelectWebsite(web.id, "/verify")
    },
    {
      label: "SDK Guide",
      icon: Terminal,
      onClick: () => handleSelectWebsite(web.id, "/sdk")
    },
    {
      label: "Regenerate API Key",
      icon: Key,
      onClick: () => {
        setRegenerateId(web.id);
        setRegenerateType("api");
      }
    },
    {
      label: "Disconnect SDK",
      icon: Unlink,
      onClick: () => setDisconnectId(web.id),
      className: web.status !== "connected" ? "hidden" : ""
    },
    { divider: true },
    {
      label: "Delete Website",
      icon: Trash2,
      variant: "danger",
      onClick: () => setDeleteId(web.id)
    }
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">My Websites</h2>
          <p className="text-sm text-admin-secondary">Configure and audit all connected domains</p>
        </div>
        <Button onClick={() => navigate("/websites/add")} variant="primary" className="gap-2 self-start sm:self-auto">
          <PlusCircle className="w-4 h-4" />
          Connect Website
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4" noPadding>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-secondary" />
            <input
              type="text"
              placeholder="Search website..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 border border-admin-border dark:border-slate-800 dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-admin-text"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs p-2 border border-admin-border dark:border-slate-800 dark:bg-slate-800 rounded-lg outline-none text-admin-text cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="connected">Connected</option>
              <option value="pending">Pending</option>
              <option value="disconnected">Disconnected</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Framework Filter */}
          <div className="flex flex-col gap-1">
            <select
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="w-full text-xs p-2 border border-admin-border dark:border-slate-800 dark:bg-slate-800 rounded-lg outline-none text-admin-text cursor-pointer"
            >
              <option value="all">All Frameworks</option>
              <option value="React">React</option>
              <option value="React + Vite">React + Vite</option>
              <option value="Next.js">Next.js</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Hosting Filter */}
          <div className="flex flex-col gap-1">
            <select
              value={hostingFilter}
              onChange={(e) => setHostingFilter(e.target.value)}
              className="w-full text-xs p-2 border border-admin-border dark:border-slate-800 dark:bg-slate-800 rounded-lg outline-none text-admin-text cursor-pointer"
            >
              <option value="all">All Hosting</option>
              <option value="cPanel">cPanel</option>
              <option value="VPS">VPS</option>
              <option value="Cloud">Cloud</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Grid List */}
      <AnimatePresence mode="popLayout">
        {filteredWebsites.length === 0 ? (
          <EmptyState
            title="No websites match the criteria"
            description="Clear your filters or connect a new website to get started."
            actionLabel="Connect Website"
            onActionClick={() => navigate("/websites/add")}
          />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredWebsites.map((web) => (
              <motion.div
                key={web.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card 
                  className="hover:shadow-md transition-shadow cursor-pointer border border-admin-border dark:border-slate-800 relative group"
                  onClick={() => handleSelectWebsite(web.id)}
                >
                  {/* Top Bar inside card */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-admin-border dark:border-slate-700 rounded-lg text-primary">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-admin-text leading-tight group-hover:text-primary transition-colors">{web.name}</h3>
                        <p className="text-xs text-admin-secondary mt-0.5 truncate max-w-[170px]" title={web.domain}>
                          {web.domain}
                        </p>
                      </div>
                    </div>
                    
                    {/* Action dropdown */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        align="right"
                        trigger={
                          <button className="p-1 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        }
                        items={getActionItems(web)}
                      />
                    </div>
                  </div>

                  {/* Body Badges */}
                  <div className="flex flex-wrap gap-2.5 mt-5 border-t border-b border-admin-border dark:border-slate-800/80 py-3.5 select-none">
                    <div className="flex flex-col gap-1 items-start flex-1 min-w-[80px]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-admin-secondary">Status</span>
                      <Badge>{web.status}</Badge>
                    </div>
                    <div className="flex flex-col gap-1 items-start flex-1 min-w-[80px]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-admin-secondary">Domain</span>
                      <Badge>{web.verificationStatus}</Badge>
                    </div>
                    <div className="flex flex-col gap-1 items-start flex-1 min-w-[80px]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-admin-secondary">SDK</span>
                      <Badge variant={web.sdkInstalled ? "success" : "neutral"}>
                        {web.sdkInstalled ? "Installed" : "Not Found"}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Footer Details */}
                  <div className="flex justify-between items-center text-[10px] text-admin-secondary mt-4 font-medium">
                    <div>
                      <span>Key: </span>
                      <code className="bg-slate-50 dark:bg-slate-800 py-0.5 px-1.5 rounded-sm font-mono text-[9px] border border-admin-border dark:border-slate-800">
                        {web.apiKey ? `${web.apiKey.substring(0, 11)}...` : "none"}
                      </code>
                    </div>
                    <div>
                      {web.lastSync ? `Synced ${web.lastSync}` : "Never Synced"}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Website"
        message="Are you sure you want to delete this website? This action is permanent and will delete all configuration settings from the CMS."
      />

      <ConfirmDialog
        isOpen={disconnectId !== null}
        onClose={() => setDisconnectId(null)}
        onConfirm={handleDisconnect}
        title="Disconnect SDK"
        message="Are you sure you want to disconnect this website's SDK? It will put the website back into 'disconnected' status until it syncs again."
      />

      <ConfirmDialog
        isOpen={regenerateId !== null}
        onClose={() => {
          setRegenerateId(null);
          setRegenerateType(null);
        }}
        onConfirm={handleRegenerateKeys}
        title="Regenerate Credentials"
        message={`Are you sure you want to regenerate this website's ${regenerateType === "api" ? "API Key" : "Secret Key"}? Any existing SDK code referencing the old key will stop working instantly.`}
      />
    </div>
  );
}

export default WebsitesPage;
