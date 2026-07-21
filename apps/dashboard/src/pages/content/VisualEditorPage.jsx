import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Globe, 
  Eye, 
  Edit3, 
  ExternalLink, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Laptop, 
  Maximize2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Link2,
  AlertTriangle
} from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useAuth } from "../../hooks/useAuth";
import visualEditService from "../../services/visualEditService";
import registryService from "../../services/registryService";
import contentSyncService from "../../services/contentSyncService";
import revisionService from "../../services/revisionService";
import { websiteService } from "../../services/websiteService";
import RegionTreePanel from "../../components/content/RegionTreePanel";
import RegionInspectorPanel from "../../components/content/RegionInspectorPanel";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export function VisualEditorPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();

  const { selectedPage, fetchPageById, updatePage, publishPage } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);
  const { user } = useAuth();

  // Mode and view states
  const [editModeActive, setEditModeActive] = useState(true);
  const [activeDevice, setActiveDevice] = useState("full");
  const [selectedElement, setSelectedElement] = useState(null);
  const [regionsMap, setRegionsMap] = useState({});

  // Target domain state & modal
  const [targetDomain, setTargetDomain] = useState("");
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [updatingDomain, setUpdatingDomain] = useState(false);

  // Draft & save states
  const [draftValues, setDraftValues] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "unsaved" | "saving"
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Modals
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const iframeRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Fetch page and website data
  useEffect(() => {
    if (websiteId && pageId) {
      selectWebsite(websiteId);
      fetchPageById(websiteId, pageId);
    }
  }, [websiteId, pageId, selectWebsite, fetchPageById]);

  // Keep target domain in sync with selected website
  useEffect(() => {
    if (selectedWebsite?.domain) {
      setTargetDomain(selectedWebsite.domain);
      setNewDomainInput(selectedWebsite.domain);
    }
  }, [selectedWebsite]);

  // Subscribe to registered editable regions schema metadata from Firebase registry
  useEffect(() => {
    if (!websiteId || !pageId) return;

    const unsubscribe = registryService.subscribeToEditableRegions(websiteId, (allRegions) => {
      const pageRegions = allRegions[pageId] || {};
      setRegionsMap(pageRegions);
    });

    return () => unsubscribe();
  }, [websiteId, pageId]);

  // Handle beforeunload protection for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Leave anyway?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-save debounced handler (2.5 seconds)
  const triggerAutoSave = useCallback((updatedValues) => {
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await contentSyncService.syncDraft(websiteId, "pages", pageId, {
          id: pageId,
          regions: updatedValues,
          updatedAt: Date.now()
        });
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Auto save failed:", err);
        setSaveStatus("unsaved");
      }
    }, 2500);
  }, [websiteId, pageId]);

  // Handle region value modification from inspector or iframe
  const handleRegionValueChange = (regionId, newValue) => {
    setDraftValues((prev) => {
      const next = { ...prev, [regionId]: newValue };
      triggerAutoSave(next);
      return next;
    });

    // Update active inspector element
    setSelectedElement((prev) => (prev ? { ...prev, value: newValue } : null));

    // Send visual field update to preview iframe live
    if (iframeRef.current && targetDomain) {
      visualEditService.sendFieldUpdate(
        iframeRef.current,
        targetDomain,
        websiteId,
        regionId,
        "value",
        newValue
      );
    }
  };

  // Save Target App Domain
  const handleUpdateDomain = async () => {
    if (!newDomainInput.trim()) return;
    let cleanInput = newDomainInput.trim();
    if (!cleanInput.startsWith("http://") && !cleanInput.startsWith("https://")) {
      cleanInput = `https://${cleanInput}`;
    }

    setUpdatingDomain(true);
    try {
      await websiteService.update(websiteId, { domain: cleanInput });
      setTargetDomain(cleanInput);
      setShowDomainModal(false);
    } catch (err) {
      console.error("Failed to update website domain:", err);
    } finally {
      setUpdatingDomain(false);
    }
  };

  // Explicit Save Draft button click
  const handleSaveDraft = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    setSaveStatus("saving");
    try {
      await contentSyncService.syncDraft(websiteId, "pages", pageId, {
        id: pageId,
        regions: draftValues,
        updatedAt: Date.now()
      });
      await updatePage(websiteId, pageId, activeLocale, {
        status: "draft"
      });
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setSaveStatus("unsaved");
    } finally {
      setSaving(false);
    }
  };

  // Confirm and Execute Publish
  const handleExecutePublish = async () => {
    setPublishing(true);
    try {
      // 1. Sync draft values to published path
      await contentSyncService.syncPublished(websiteId, "pages", pageId, {
        id: pageId,
        regions: draftValues,
        publishedAt: Date.now()
      });

      // 2. Save revision
      await revisionService.save(
        websiteId,
        "page",
        pageId,
        {
          id: pageId,
          regions: draftValues,
          title: selectedPage?.title || "Page"
        },
        user?.uid || "system"
      );

      // 3. Update page record
      await publishPage(websiteId, pageId, user?.uid || "system");

      // 4. Broadcast publish event to iframe
      if (iframeRef.current && targetDomain) {
        try {
          const origin = new URL(targetDomain).origin;
          iframeRef.current.contentWindow.postMessage(
            {
              rcms: true,
              version: "v1",
              type: "rcms/v1/publish-page",
              websiteId,
              payload: { slug: selectedPage?.slug || "" },
              timestamp: Date.now()
            },
            origin
          );
        } catch (e) {
          console.warn(e);
        }
      }

      setShowPublishModal(false);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPublishing(false);
    }
  };

  // Region Tree selection handler
  const handleSelectRegionFromTree = (regionId) => {
    const regionObj = regionsMap[regionId];
    const val = draftValues[regionId] !== undefined ? draftValues[regionId] : regionObj?.defaultValue;

    setSelectedElement({
      regionId,
      type: regionObj?.type || "text",
      label: regionObj?.label || regionId,
      pageId,
      value: val
    });

    // Notify preview iframe to highlight selected region
    if (iframeRef.current && targetDomain) {
      try {
        const origin = new URL(targetDomain).origin;
        iframeRef.current.contentWindow.postMessage(
          {
            rcms: true,
            version: "v1",
            type: "rcms/v1/open-inspector",
            websiteId,
            payload: { regionId },
            timestamp: Date.now()
          },
          origin
        );
      } catch (err) {
        console.warn("Failed to notify frame of region selection:", err);
      }
    }
  };

  // Handle iframe load sequence
  const handleIframeLoad = () => {
    if (editModeActive) {
      setTimeout(() => {
        visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
      }, 500);
    }
  };

  // Message listener for iframe events
  useEffect(() => {
    const handleMessage = (event) => {
      if (!targetDomain) return;
      try {
        const targetOrigin = new URL(targetDomain).origin;
        if (event.origin !== targetOrigin) return;

        const data = event.data;
        if (!data) return;

        if (data.rcms && data.type === "rcms/v1/region-selected") {
          const payload = data.payload || {};
          setSelectedElement({
            regionId: payload.regionId,
            type: payload.type || "text",
            pageId: payload.pageId || pageId,
            value: payload.value
          });
        }
      } catch (err) {
        console.warn("Message parsing error:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [targetDomain, pageId]);

  // Handle Edit/Preview mode toggle
  const handleToggleEditMode = (mode) => {
    setEditModeActive(mode);
    if (mode) {
      visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
    } else {
      visualEditService.disableEditMode(iframeRef.current, targetDomain, websiteId);
      setSelectedElement(null);
    }
  };

  const getDeviceWidth = () => {
    switch (activeDevice) {
      case "desktop": return "1440px";
      case "laptop": return "1280px";
      case "tablet": return "768px";
      case "mobile": return "375px";
      case "full":
      default:
        return "100%";
    }
  };

  // Smart Path resolution for clean target preview URL
  let rawPath = selectedPage?.slug || selectedPage?.route || "";
  let cleanPath = "";
  if (selectedPage?.route && selectedPage.route !== "/") {
    cleanPath = selectedPage.route.replace(/^\/+/, "");
  } else if (rawPath && rawPath !== "home" && !rawPath.startsWith("0.")) {
    cleanPath = rawPath.replace(/^\/+/, "");
  }

  const cleanDomain = targetDomain.replace(/\/$/, "");
  const previewUrl = cleanDomain ? `${cleanDomain}/${cleanPath}?rcms_preview=1` : "";

  // Check if targetDomain points to Dashboard Vercel origin itself
  const isSelfDashboardOrigin = cleanDomain && (
    cleanDomain === window.location.origin ||
    cleanDomain.includes("react-cms-pro.vercel.app")
  );

  const handleExit = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
    } else {
      navigate(`/content/${websiteId}/pages`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top Navigation Toolbar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4 flex-shrink-0 z-30">
        {/* Left: Exit & Page Details */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Pages</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>{selectedPage?.title || "Page Editor"}</span>
              <code className="text-[10px] text-purple-400 font-mono font-normal">
                {cleanPath ? `/${cleanPath}` : "/ (home)"}
              </code>
            </h1>
          </div>
        </div>

        {/* Middle: Target App Domain & Auto-Save Status */}
        <div className="flex items-center gap-4">
          {/* Target App Domain Badge / Selector */}
          <button
            onClick={() => setShowDomainModal(true)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
              isSelfDashboardOrigin
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
            title="Click to change connected client app preview URL"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px]">{targetDomain || "Set Target App Domain"}</span>
            <Settings className="w-3 h-3 text-slate-500" />
          </button>

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {saveStatus === "saving" ? (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : saveStatus === "unsaved" ? (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <AlertCircle className="w-3 h-3" /> Unsaved Changes
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle className="w-3 h-3" /> Saved {lastSavedTime ? `at ${lastSavedTime}` : ""}
              </span>
            )}
          </div>

          {/* Device Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: "full", icon: Maximize2, label: "Full" },
              { id: "desktop", icon: Monitor, label: "Desktop" },
              { id: "laptop", icon: Laptop, label: "Laptop" },
              { id: "tablet", icon: Tablet, label: "Tablet" },
              { id: "mobile", icon: Smartphone, label: "Mobile" },
            ].map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDevice(d.id)}
                  className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeDevice === d.id ? "bg-primary text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={`${d.label} View`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Edit vs Preview Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => handleToggleEditMode(true)}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                editModeActive ? "bg-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => handleToggleEditMode(false)}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                !editModeActive ? "bg-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Open Preview in New Tab */}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Open Full Preview in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Refresh Frame */}
          <button
            onClick={() => {
              if (iframeRef.current && previewUrl) iframeRef.current.src = previewUrl;
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reload Preview Frame"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Save Draft */}
          <Button
            onClick={handleSaveDraft}
            variant="secondary"
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer"
            loading={saving}
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>

          {/* Publish */}
          <Button
            onClick={() => setShowPublishModal(true)}
            variant="primary"
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Publish
          </Button>
        </div>
      </header>

      {/* Main 3-Pane Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Pane: Region Tree */}
        <div className="w-64 flex-shrink-0 hidden md:block">
          <RegionTreePanel
            regionsMap={regionsMap}
            selectedRegionId={selectedElement?.regionId}
            onSelectRegion={handleSelectRegionFromTree}
            pageTitle={selectedPage?.title}
          />
        </div>

        {/* Center Pane: Preview Iframe Container */}
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-4 overflow-auto relative">
          {isSelfDashboardOrigin && (
            <div className="mb-3 w-full max-w-2xl bg-amber-950/80 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>
                  Connected app URL points to Dashboard (<strong>{targetDomain}</strong>). Enter your client React app domain (e.g. <code>http://localhost:5173</code>) to preview live.
                </span>
              </div>
              <button
                onClick={() => setShowDomainModal(true)}
                className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400 transition-colors ml-3 flex-shrink-0 cursor-pointer"
              >
                Change URL
              </button>
            </div>
          )}

          <div
            style={{ width: getDeviceWidth() }}
            className="h-full bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300 border border-slate-800 relative"
          >
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={handleIframeLoad}
                className="w-full h-full border-0"
                title="Visual Site Preview"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Globe className="w-10 h-10 mb-3 text-slate-400" />
                <h4 className="font-bold text-slate-700">No Target App URL Configured</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Please configure the domain URL of your connected client React application to display the live preview.
                </p>
                <button
                  onClick={() => setShowDomainModal(true)}
                  className="mt-4 px-4 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary/90"
                >
                  Set App Domain URL
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Inspector Panel */}
        <div className="w-80 flex-shrink-0">
          <RegionInspectorPanel
            selectedElement={selectedElement}
            onChangeRegion={handleRegionValueChange}
            activePageId={pageId}
          />
        </div>
      </div>

      {/* Target Domain Configuration Modal */}
      {showDomainModal && (
        <Modal
          isOpen={showDomainModal}
          onClose={() => setShowDomainModal(false)}
          title="Connected Client App URL"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the target domain or local URL where your connected React client application (with <code>@anshif.rainhopes/reactcms-runtime</code>) is running.
            </p>
            <Input
              label="Connected Client App URL"
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
              placeholder="e.g. http://localhost:5173 or https://my-client-app.vercel.app"
            />
            <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
              💡 For local testing, use <code>http://localhost:5173</code> (or your local dev server port).
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowDomainModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateDomain}
                loading={updatingDomain}
                className="text-xs font-bold"
              >
                Save Connected URL
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <Modal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          title="Publish Changes to Live Site?"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Publishing will push your current draft changes live. This action will replace the current published website content for <strong className="text-white">/{cleanPath || "home"}</strong> and create a new revision entry.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowPublishModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExecutePublish}
                loading={publishing}
                className="text-xs font-bold gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Publish Live
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Unsaved Changes Exit Protection Modal */}
      {showUnsavedModal && (
        <Modal
          isOpen={showUnsavedModal}
          onClose={() => setShowUnsavedModal(false)}
          title="You Have Unsaved Changes"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              You have modified region values on this page that have not been saved to draft. Are you sure you want to leave anyway?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowUnsavedModal(false)}
                className="text-xs font-bold"
              >
                Stay on Page
              </Button>
              <Button
                variant="danger"
                onClick={() => navigate(`/content/${websiteId}/pages`)}
                className="text-xs font-bold"
              >
                Leave Anyway
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default VisualEditorPage;
