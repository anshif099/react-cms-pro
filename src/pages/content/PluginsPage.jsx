import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Puzzle, ArrowRight, Settings, Trash2, CheckCircle2, ShieldCheck, ToggleLeft, ToggleRight, Sparkles, RefreshCw } from "lucide-react";
import pluginService from "../../services/pluginService";
import { useToast } from "../../hooks/useToast";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";

const MARKETPLACE_PLUGINS = [
  {
    id: "seo-booster",
    title: "SEO Booster & Schema Injector",
    category: "SEO",
    description: "Injects automated JSON-LD schema breadcrumbs, configures site redirection headers, and auto-generates sitemap files.",
    version: "v1.2.0",
    developer: "ReactCMS Core Team",
    settingsSchema: [
      { key: "enableAutoRedirects", label: "Auto Redirect 404 Pages", type: "checkbox", default: true },
      { key: "targetScoreMin", label: "Minimum SEO Score Threshold", type: "number", default: 80 }
    ]
  },
  {
    id: "contact-forms",
    title: "Contact Forms Handler",
    category: "Marketing",
    description: "Binds serverless email handlers and captcha validation to process user messages submitted through contact forms.",
    version: "v2.1.4",
    developer: "ReactCMS Core Team",
    settingsSchema: [
      { key: "notifyEmail", label: "Notification Target Email", type: "text", default: "" },
      { key: "enableRecaptcha", label: "Enable Google reCAPTCHA v3", type: "checkbox", default: false }
    ]
  },
  {
    id: "google-analytics",
    title: "Google Analytics Tracker",
    category: "Analytics",
    description: "Deploys tracking tags and events triggers automatically to stream pageviews metrics straight to GA4 consoles.",
    version: "v1.0.8",
    developer: "Google Analytics Team",
    settingsSchema: [
      { key: "trackingId", label: "Measurement ID (G-XXXXXXXXXX)", type: "text", default: "" }
    ]
  },
  {
    id: "image-optimizer",
    title: "Image Optimizer & CDN",
    category: "Utilities",
    description: "Compresses asset files on-the-fly and automatically converts image uploads to high-performance WebP formats.",
    version: "v3.0.1",
    developer: "Cloudinary Partner",
    settingsSchema: [
      { key: "maxFileSizeMB", label: "Max File Upload Size (MB)", type: "number", default: 5 },
      { key: "webpConversion", label: "Auto Convert Uploads to WebP", type: "checkbox", default: true }
    ]
  }
];

export function PluginsPage() {
  const { websiteId } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState({});
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [settingsForm, setSettingsForm] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");

  const loadPlugins = async () => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const data = await pluginService.getInstalledPlugins(websiteId);
      setInstalledPlugins(data || {});
    } catch (err) {
      console.error(err);
      toast.error("Failed to load plugin marketplace registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, [websiteId]);

  const handleInstall = async (pluginId) => {
    const plugin = MARKETPLACE_PLUGINS.find(p => p.id === pluginId);
    const defaults = {};
    plugin.settingsSchema.forEach(field => {
      defaults[field.key] = field.default;
    });

    try {
      const result = await pluginService.installPlugin(websiteId, pluginId, defaults);
      setInstalledPlugins(prev => ({
        ...prev,
        [pluginId]: result
      }));
      toast.success(`${plugin.title} installed and activated successfully!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to install plugin.");
    }
  };

  const handleUninstall = async (pluginId) => {
    const plugin = MARKETPLACE_PLUGINS.find(p => p.id === pluginId);
    if (!window.confirm(`Are you sure you want to deactivate and uninstall ${plugin.title}?`)) return;

    try {
      const result = await pluginService.uninstallPlugin(websiteId, pluginId);
      setInstalledPlugins(prev => ({
        ...prev,
        [pluginId]: { ...prev[pluginId], ...result }
      }));
      toast.success(`${plugin.title} uninstalled successfully.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to uninstall plugin.");
    }
  };

  const handleOpenConfigure = (plugin) => {
    setSelectedPlugin(plugin);
    // Merge defaults/existing settings
    const existing = installedPlugins[plugin.id]?.settings || {};
    const form = {};
    plugin.settingsSchema.forEach(field => {
      form[field.key] = existing[field.key] !== undefined ? existing[field.key] : field.default;
    });
    setSettingsForm(form);
  };

  const handleSaveSettings = async () => {
    if (!selectedPlugin) return;
    try {
      await pluginService.savePluginSettings(websiteId, selectedPlugin.id, settingsForm);
      setInstalledPlugins(prev => ({
        ...prev,
        [selectedPlugin.id]: {
          ...prev[selectedPlugin.id],
          settings: settingsForm
        }
      }));
      toast.success(`${selectedPlugin.title} settings configured successfully!`);
      setSelectedPlugin(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings configurations.");
    }
  };

  const updateFormField = (key, val) => {
    setSettingsForm(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const filteredPlugins = MARKETPLACE_PLUGINS.filter(plugin => {
    if (activeFilter === "all") return true;
    return plugin.category.toLowerCase() === activeFilter.toLowerCase();
  });

  const getPluginStatus = (pluginId) => {
    const record = installedPlugins[pluginId];
    return record && record.enabled;
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Loading marketplace plugins...</div>;
  }

  return (
    <div className="p-6 space-y-6 text-left max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-805 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-primary" />
            <span>Plugin Marketplace</span>
          </h2>
          <p className="text-sm text-admin-secondary mt-1">
            Browse and install extensions to add advanced tracking, automated optimization tools, and visual widgets to your site.
          </p>
        </div>
        <Button
          onClick={loadPlugins}
          variant="outline"
          className="border-slate-800 gap-2 cursor-pointer font-bold text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2.5">
        {["all", "SEO", "Marketing", "Analytics", "Utilities"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`text-xs px-3.5 py-1.5 rounded-lg border font-bold capitalize transition-all cursor-pointer ${
              activeFilter === cat 
                ? "bg-primary border-primary text-white" 
                : "border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPlugins.map((plugin) => {
          const isActive = getPluginStatus(plugin.id);
          return (
            <Card key={plugin.id} className="p-5 border-slate-805 bg-slate-900/35 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-slate-200">{plugin.title}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">
                      By {plugin.developer} • {plugin.version}
                    </p>
                  </div>
                  <span className="text-[10px] bg-slate-950/80 text-primary border border-slate-800 font-bold tracking-wider py-0.5 px-2.5 rounded-full uppercase">
                    {plugin.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed text-justify">
                  {plugin.description}
                </p>
              </div>

              {/* Status footer buttons */}
              <div className="mt-5 pt-4 border-t border-slate-850/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isActive ? (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-950/60 border border-slate-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Inactive
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {isActive ? (
                    <>
                      <Button
                        onClick={() => handleOpenConfigure(plugin)}
                        variant="outline"
                        className="py-1 px-3 text-[10px] border-slate-800 font-bold gap-1 cursor-pointer"
                      >
                        <Settings className="w-3 h-3" /> Configure
                      </Button>
                      <Button
                        onClick={() => handleUninstall(plugin.id)}
                        variant="secondary"
                        className="py-1 px-3 text-[10px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border-transparent font-bold gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Disable
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleInstall(plugin.id)}
                      variant="primary"
                      className="py-1 px-4 text-[10px] font-bold gap-1 cursor-pointer"
                    >
                      Install Extension
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Configure Settings Modal */}
      <Modal
        isOpen={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
        title={selectedPlugin ? `Configure ${selectedPlugin.title}` : ""}
      >
        {selectedPlugin && (
          <div className="space-y-4 text-left">
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Setup custom runtime variables parameters for the {selectedPlugin.title} extension below:
            </p>

            <div className="space-y-4 pt-2">
              {selectedPlugin.settingsSchema.map((field) => (
                <div key={field.key} className="space-y-1">
                  {field.type === "checkbox" ? (
                    <div className="flex items-center gap-2.5 py-1.5 cursor-pointer select-none">
                      <button
                        onClick={() => updateFormField(field.key, !settingsForm[field.key])}
                        className="text-primary hover:text-primary-hover focus:outline-none"
                      >
                        {settingsForm[field.key] ? (
                          <ToggleRight className="w-9 h-9" />
                        ) : (
                          <ToggleLeft className="w-9 h-9 text-slate-600" />
                        )}
                      </button>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">{field.label}</span>
                        <span className="text-[10px] text-slate-500">Enable/disable plugin logic parameters.</span>
                      </div>
                    </div>
                  ) : (
                    <Input
                      label={field.label}
                      type={field.type}
                      value={settingsForm[field.key] || ""}
                      onChange={(e) => updateFormField(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 gap-2">
              <Button
                onClick={() => setSelectedPlugin(null)}
                variant="secondary"
                className="border-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSettings}
                variant="primary"
                className="font-bold"
              >
                Save Configurations
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PluginsPage;
