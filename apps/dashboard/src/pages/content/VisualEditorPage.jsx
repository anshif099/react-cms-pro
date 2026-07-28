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
  AlertTriangle,
  UploadCloud
} from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useAuth } from "../../hooks/useAuth";
import visualEditService from "../../services/visualEditService";
import registryService from "../../services/registryService";
import contentSyncService from "../../services/contentSyncService";
import revisionService from "../../services/revisionService";
import vercelDeployService from "../../services/vercelDeployService";
import { websiteService } from "../../services/websiteService";
import RegionTreePanel from "../../components/content/RegionTreePanel";
import RegionInspectorPanel from "../../components/content/RegionInspectorPanel";
import SEOPanel from "../../components/content/SEOPanel";
import RevisionPanel from "../../components/content/RevisionPanel";
import BlockEditor from "../../components/blocks/BlockEditor";
import { useRevisions } from "../../hooks/useRevisions";
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
  const { revisions, loadRevisions, restoreRevision } = useRevisions();

  // Mode and view states
  const [editModeActive, setEditModeActive] = useState(true);
  const [activeDevice, setActiveDevice] = useState("full");
  const [selectedElement, setSelectedElement] = useState(null);
  const [regionsMap, setRegionsMap] = useState({});
  const [previewModeType, setPreviewModeType] = useState("shell"); // "shell" | "direct"

  // Target domain state & modal
  const [targetDomain, setTargetDomain] = useState("");
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [updatingDomain, setUpdatingDomain] = useState(false);

  // Page Settings / Configuration Modal States
  const [showPageSettingsModal, setShowPageSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [pageTitle, setPageTitle] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageRoute, setPageRoute] = useState("");
  const [pageSeo, setPageSeo] = useState({});
  const [pageBlocks, setPageBlocks] = useState([]);

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

  // Vercel deployment state
  const [deployingVercel, setDeployingVercel] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [vercelHookInput, setVercelHookInput] = useState("");

  const handleTriggerVercelDeploy = async () => {
    setDeployingVercel(true);
    try {
      let hookUrl = await vercelDeployService.getDeployHook(websiteId);
      if (!hookUrl) {
        setShowVercelModal(true);
        setDeployingVercel(false);
        return;
      }

      await vercelDeployService.triggerDeploy(websiteId);
      toast.success("🚀 Vercel deployment triggered! Site will update in ~30s.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to trigger Vercel deployment.");
    } finally {
      setDeployingVercel(false);
    }
  };

  const handleSaveVercelHook = async () => {
    if (!vercelHookInput.trim()) return;
    try {
      await vercelDeployService.setDeployHook(websiteId, vercelHookInput.trim());
      setShowVercelModal(false);
      toast.success("Vercel Deploy Hook saved! Triggering build...");
      setDeployingVercel(true);
      await vercelDeployService.triggerDeploy(websiteId);
      toast.success("🚀 Vercel deployment triggered! Site will update in ~30s.");
    } catch (err) {
      toast.error("Failed to save or trigger Vercel deploy hook.");
    } finally {
      setDeployingVercel(false);
    }
  };

  const iframeRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Fetch page and website data
  useEffect(() => {
    if (websiteId && pageId) {
      selectWebsite(websiteId);
      fetchPageById(websiteId, pageId);
      loadRevisions(websiteId, "page", pageId);
    }
  }, [websiteId, pageId, selectWebsite, fetchPageById, loadRevisions]);

  // Sync page metadata with local state
  useEffect(() => {
    if (selectedPage) {
      const localeData = selectedPage.locales?.[activeLocale] || {};
      setPageTitle(localeData.title || selectedPage.title || "");
      setPageSlug(localeData.slug || selectedPage.slug || "");
      setPageRoute(selectedPage.route || `/${localeData.slug || selectedPage.slug || ""}`);
      setPageSeo(localeData.seo || {});
      setPageBlocks(localeData.blocks || []);

      // Auto-set preview mode based on whether route was imported from code or created in CMS
      if (selectedPage.isImported) {
        setPreviewModeType("direct");
      } else {
        setPreviewModeType("shell");
      }
    }
  }, [selectedPage, activeLocale]);

  // Pre-populate draftValues from Firebase draft / published region content on mount
  useEffect(() => {
    if (!websiteId || !selectedPage) return;
    const pageSlug = resolvePageSlug();

    const loadInitialRegions = async () => {
      try {
        const draftData = await contentSyncService.getDraft(websiteId, pageSlug);
        const publishedData = await contentSyncService.getPublished(websiteId, pageSlug);

        const initialRegions = {
          ...(publishedData?.regions || {}),
          ...(draftData?.regions || {})
        };

        if (Object.keys(initialRegions).length > 0) {
          setDraftValues((prev) => ({ ...initialRegions, ...prev }));
        }
      } catch (err) {
        console.warn("Failed to load initial page regions:", err);
      }
    };

    loadInitialRegions();
  }, [websiteId, selectedPage?.id]);

  // Save Page Settings handler
  const handleSavePageSettings = async () => {
    try {
      await updatePage(websiteId, pageId, activeLocale, {
        title: pageTitle,
        slug: pageSlug,
        route: pageRoute,
        seo: pageSeo,
        blocks: pageBlocks
      });
      setShowPageSettingsModal(false);
    } catch (err) {
      console.error("Failed to update page settings:", err);
    }
  };

  const handleRestoreRevision = async (revisionId) => {
    if (window.confirm("Restore this revision? Unsaved page setting draft changes will be overwritten.")) {
      try {
        const snapshot = await restoreRevision(websiteId, "page", pageId, revisionId);
        if (snapshot) {
          if (snapshot.title) setPageTitle(snapshot.title);
          if (snapshot.slug) setPageSlug(snapshot.slug);
          if (snapshot.seo) setPageSeo(snapshot.seo);
          if (snapshot.blocks) setPageBlocks(snapshot.blocks);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Keep target domain in sync with selected website
  useEffect(() => {
    if (selectedWebsite?.domain) {
      setTargetDomain(selectedWebsite.domain);
      setNewDomainInput(selectedWebsite.domain);
    }
  }, [selectedWebsite]);

  const handleSwitchTargetDomain = async (newDomain) => {
    try {
      setUpdatingDomain(true);
      setTargetDomain(newDomain);
      setNewDomainInput(newDomain);
      await websiteService.updateDomain(websiteId, newDomain);
      toast.success(`Preview target set to ${newDomain}`);
    } catch (err) {
      console.error("Failed to switch target domain:", err);
      toast.error("Failed to update target domain.");
    } finally {
      setUpdatingDomain(false);
    }
  };

  // Subscribe to registered editable regions schema metadata from Firebase registry
  useEffect(() => {
    if (!websiteId || !pageId) return;

    const unsubscribe = registryService.subscribeToEditableRegions(websiteId, (allRegions) => {
      if (!allRegions) {
        setRegionsMap({});
        return;
      }

      // 1. Check exact pageId key
      let pageRegions = allRegions[pageId];

      // 2. If not found by exact pageId, check by slug or fallback to 'global' or merge all keys if empty
      if (!pageRegions || Object.keys(pageRegions).length === 0) {
        if (allRegions.global && Object.keys(allRegions.global).length > 0) {
          pageRegions = allRegions.global;
        } else {
          // Merge all available regions from all pages if pageId-specific entry is empty
          pageRegions = Object.values(allRegions).reduce((acc, curr) => ({ ...acc, ...curr }), {});
        }
      } else if (allRegions.global) {
        // Merge global regions with page specific regions
        pageRegions = { ...allRegions.global, ...pageRegions };
      }

      setRegionsMap(pageRegions || {});
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

  // Resolve page slug from selectedPage for consistent sync keys.
  // The SDK resolves pageId from the browser URL (e.g. "home", "about"),
  // so we must publish/draft under the same slug — not the Firebase doc ID.
  const resolvePageSlug = () => {
    if (selectedPage?.route && selectedPage.route !== "/") {
      return selectedPage.route.replace(/^\/+|\/+$/g, "") || "home";
    }
    const slug = selectedPage?.slug || "";
    if (slug && slug !== "home" && !slug.startsWith("0.") && !slug.startsWith("-")) return slug;
    if (selectedPage?.route === "/" || !slug || slug === "home" || slug.startsWith("-")) return "home";
    return slug || "home";
  };

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
        const pageSlug = resolvePageSlug();
        const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
          || (await contentSyncService.getDraft(websiteId, "home"));

        const mergedValues = {
          ...(existingDraft?.regions || {}),
          ...updatedValues
        };

        const payload = {
          id: pageSlug,
          regions: mergedValues,
          updatedAt: Date.now()
        };

        const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
        await Promise.all(targetKeys.map((key) => contentSyncService.syncDraft(websiteId, key, payload)));

        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Auto save failed:", err);
        setSaveStatus("unsaved");
      }
    }, 2500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, pageId, selectedPage]);

  // Handle region value modification from inspector or iframe
  const handleRegionValueChange = (regionId, newValue) => {
    setDraftValues((prev) => {
      const next = { ...prev, [regionId]: newValue };
      triggerAutoSave(next);
      return next;
    });

    // Update active inspector element
    setSelectedElement((prev) => (prev ? { ...prev, value: newValue } : null));

    // 1. Immediately write to Firebase draft so the preview iframe's real-time
    //    draft subscription picks it up instantly (most reliable cross-origin live preview)
    visualEditService.persistFieldUpdate(websiteId, resolvePageSlug(), regionId, newValue)
      .catch(() => {}); // fire-and-forget

    // 2. Also send postMessage to iframe for instant update (belt + suspenders)
    if (iframeRef.current) {
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

    try {
      const parsed = new URL(cleanInput);
      cleanInput = parsed.origin;
    } catch {
      cleanInput = cleanInput.replace(/\/$/, "");
    }

    setUpdatingDomain(true);
    try {
      await websiteService.update(websiteId, { domain: cleanInput });
      setTargetDomain(cleanInput);
      setNewDomainInput(cleanInput);
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
      const pageSlug = resolvePageSlug();
      const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
        || (await contentSyncService.getDraft(websiteId, "home"));

      const mergedValues = {
        ...(existingDraft?.regions || {}),
        ...draftValues
      };

      const payload = {
        id: pageSlug,
        regions: mergedValues,
        updatedAt: Date.now()
      };

      const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
      await Promise.all(targetKeys.map((key) => contentSyncService.syncDraft(websiteId, key, payload)));

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
      const pageSlug = resolvePageSlug();
      const existingDraft = (await contentSyncService.getDraft(websiteId, pageSlug))
        || (await contentSyncService.getDraft(websiteId, "home"));
      const existingPublished = (await contentSyncService.getPublished(websiteId, pageSlug))
        || (await contentSyncService.getPublished(websiteId, "home"));

      const combinedRegions = {
        ...(existingPublished?.regions || {}),
        ...(existingDraft?.regions || {}),
        ...draftValues
      };

      const payload = {
        id: pageSlug,
        regions: combinedRegions,
        publishedAt: Date.now()
      };

      // 1. Sync to all target page keys (slug, home, pageId) so client SDK resolves it on any route
      const targetKeys = Array.from(new Set([pageSlug, "home", pageId]));
      await Promise.all(targetKeys.map((key) => contentSyncService.syncPublished(websiteId, key, payload)));

      // 2. Save revision
      await revisionService.save(
        websiteId,
        "page",
        pageId,
        {
          id: pageId,
          regions: combinedRegions,
          title: selectedPage?.title || "Page"
        },
        user?.uid || "system"
      );

      // 3. Update page record
      await publishPage(websiteId, pageId, user?.uid || "system");

      // 4. Broadcast publish event to iframe
      if (iframeRef.current) {
        try {
          iframeRef.current.contentWindow.postMessage(
            {
              rcms: true,
              version: "v1",
              type: "rcms/v1/publish-page",
              websiteId,
              payload: { slug: pageSlug },
              timestamp: Date.now()
            },
            "*"
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

  // Memoized target origin to avoid running expensive URL parsing on every postMessage
  const targetOrigin = React.useMemo(() => {
    if (!targetDomain) return "";
    try {
      return new URL(targetDomain).origin;
    } catch {
      return "";
    }
  }, [targetDomain]);

  // Fast Message listener for iframe events
  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      // Fast guard check: skip non-RCMS messages without parsing overhead
      if (!data || typeof data !== "object" || data.rcms !== true || data.version !== "v1") return;

      try {
        if (targetOrigin && event.origin !== targetOrigin && event.origin !== window.location.origin) return;

        if (data.type === "rcms/v1/runtime-ready") {
          if (editModeActive && iframeRef.current && targetDomain) {
            visualEditService.enableEditMode(iframeRef.current, targetDomain, websiteId);
          }
        } else if (data.type === "rcms/v1/regions-registered") {
          const payload = data.payload || {};
          if (payload.regions) {
            setRegionsMap((prev) => ({ ...prev, ...payload.regions }));
          }
        } else if (data.type === "rcms/v1/region-selected") {
          const payload = data.payload || {};
          setSelectedElement((prev) => {
            const isSameRegion = prev && prev.regionId === payload.regionId;
            return {
              regionId: payload.regionId,
              type: payload.type || (isSameRegion ? prev.type : "text"),
              label: payload.label || (isSameRegion ? prev.label : payload.regionId),
              pageId: payload.pageId || pageId,
              value: payload.value !== undefined ? payload.value : (isSameRegion ? prev.value : undefined),
              computedStyle: payload.computedStyle || (isSameRegion ? prev.computedStyle : {})
            };
          });
        } else if (data.type === "rcms/v1/field-update") {
          const payload = data.payload || {};
          if (payload.regionId) {
            setDraftValues((prev) => {
              const next = { ...prev, [payload.regionId]: payload.value };
              triggerAutoSave(next);
              return next;
            });
            setSelectedElement((prev) =>
              prev && prev.regionId === payload.regionId
                ? { ...prev, value: payload.value }
                : prev
            );
          }
        }
      } catch (err) {
        // Silent catch
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [targetOrigin, pageId]);

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

  // Always sanitize cleanDomain to base origin (e.g. https://triosis.vercel.app without subpaths)
  let cleanDomain = "";
  if (targetDomain) {
    try {
      let raw = targetDomain.trim();
      if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
      cleanDomain = new URL(raw).origin;
    } catch {
      cleanDomain = targetDomain.replace(/\/$/, "");
    }
  }

  let previewUrl = "";
  if (cleanDomain) {
    if (previewModeType === "shell" && cleanPath && cleanPath !== "home") {
      previewUrl = `${cleanDomain}/?page=${encodeURIComponent(cleanPath)}&rcms_preview=1`;
    } else if (cleanPath && cleanPath !== "home") {
      previewUrl = `${cleanDomain}/${cleanPath}?rcms_preview=1`;
    } else {
      previewUrl = `${cleanDomain}/?rcms_preview=1`;
    }
  }

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
          {/* Target App Domain Badge & Quick Selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDomainModal(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                isSelfDashboardOrigin
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
              }`}
              title="Click to enter custom client app preview URL"
            >
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span className="truncate max-w-[140px]">{targetDomain || "Set Target App Domain"}</span>
              <Settings className="w-3 h-3 text-slate-500" />
            </button>

            {/* Quick 1-Click Local Dev (5173) vs Live Vercel Toggle */}
            <div className="hidden sm:flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => handleSwitchTargetDomain("http://localhost:5173")}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  cleanDomain.includes("localhost")
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Switch preview to local dev server (http://localhost:5173)"
              >
                Local Dev (5173)
              </button>
              <button
                onClick={() => handleSwitchTargetDomain("https://triosis.vercel.app")}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  cleanDomain.includes("triosis.vercel.app")
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Switch preview to live Vercel site (https://triosis.vercel.app)"
              >
                Live Vercel
              </button>
            </div>
          </div>

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

          {/* Layout Shell vs Direct Route Selector */}
          {cleanPath && cleanPath !== "home" && (
            <div className="hidden lg:flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setPreviewModeType("canvas")}
                className={`px-2.5 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  previewModeType === "canvas" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
                title="Renders clean page canvas with section blocks editor for this page"
              >
                Page Canvas
              </button>
              <button
                onClick={() => setPreviewModeType("shell")}
                className={`px-2.5 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  previewModeType === "shell" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
                title="Renders using live site layout shell (?page=slug)"
              >
                Site Shell Frame
              </button>
              <button
                onClick={() => setPreviewModeType("direct")}
                className={`px-2.5 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  previewModeType === "direct" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
                title="Renders using direct URL route (/slug)"
              >
                Direct Route
              </button>
            </div>
          )}

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

          {/* Page Settings & Configuration */}
          <button
            onClick={() => setShowPageSettingsModal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer bg-slate-950/60"
            title="Page Properties, SEO Metadata & Revisions"
          >
            <Settings className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline font-semibold">Settings</span>
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

          {/* Trigger Vercel Deployment */}
          <Button
            onClick={handleTriggerVercelDeploy}
            variant="secondary"
            loading={deployingVercel}
            className="text-xs py-1.5 px-3 font-bold gap-1.5 cursor-pointer bg-purple-950/60 border-purple-500/40 text-purple-200 hover:bg-purple-900/80"
            title="Trigger 1-click Vercel deployment directly from CMS without writing code or git commands"
          >
            <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
            Deploy Vercel
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

          {previewModeType === "shell" && cleanPath && cleanPath !== "home" && !isSelfDashboardOrigin && (
            <div className="mb-2 w-full max-w-2xl bg-purple-950/70 border border-purple-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>
                  ✨ Previewing page <strong>/{cleanPath}</strong> using <strong>Site Layout Shell</strong>. Header, Footer & existing site structure are automatically inherited.
                </span>
              </div>
              <button
                onClick={() => setPreviewModeType("direct")}
                className="text-[11px] underline text-purple-300 hover:text-white font-semibold flex-shrink-0 cursor-pointer ml-3"
              >
                Try Direct Route
              </button>
            </div>
          )}

          {previewModeType === "canvas" ? (
            <div className="h-full w-full bg-slate-900/60 p-6 overflow-y-auto rounded-xl border border-slate-800 text-left space-y-6 max-w-5xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{selectedPage?.title || "Page Content Canvas"}</span>
                    <code className="text-xs text-purple-400 font-mono">/{cleanPath}</code>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Build sections, customize content, and edit drag-and-drop blocks for this page.
                  </p>
                </div>
                <button
                  onClick={() => setPreviewModeType("shell")}
                  className="px-3 py-1.5 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold hover:bg-purple-600 hover:text-white transition-all cursor-pointer"
                >
                  View Live Frame Preview
                </button>
              </div>

              {/* Section Block Editor */}
              <BlockEditor
                blocks={pageBlocks}
                onChange={(updatedBlocks) => {
                  setPageBlocks(updatedBlocks);
                  setHasUnsavedChanges(true);
                  setSaveStatus("unsaved");
                }}
                activeLocale={activeLocale}
              />
            </div>
          ) : (
            <div
              style={{ width: getDeviceWidth(), transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              className="h-full bg-white rounded-xl overflow-hidden shadow-2xl transition-[width] duration-300 border border-slate-800 relative will-change-transform"
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
          )}
        </div>

        {/* Right Pane: Inspector Panel */}
        <div className="w-80 flex-shrink-0">
          <RegionInspectorPanel
            selectedElement={selectedElement}
            onChangeRegion={handleRegionValueChange}
            activePageId={pageId}
            onSwitchDevice={(bp) => {
              const deviceMap = { mobile: "mobile", tablet: "tablet", desktop: "desktop" };
              setActiveDevice(deviceMap[bp] || "full");
            }}
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

      {/* Page Settings & Configuration Modal */}
      {showPageSettingsModal && (
        <Modal
          isOpen={showPageSettingsModal}
          onClose={() => setShowPageSettingsModal(false)}
          title={`Page Configuration: ${pageTitle || "Page Settings"}`}
          size="lg"
        >
          <div className="space-y-4 text-left p-1">
            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 gap-2 pb-2 overflow-x-auto">
              {[
                { id: "general", label: "Page Properties" },
                { id: "seo", label: "SEO Metadata" },
                { id: "blocks", label: "Fallback Blocks" },
                { id: "revisions", label: "Revisions" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeSettingsTab === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* General Tab */}
            {activeSettingsTab === "general" && (
              <div className="space-y-4">
                <Input
                  label="Page Display Title"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="e.g. Home Page"
                />
                <Input
                  label="Path Slug"
                  value={pageSlug}
                  onChange={(e) => setPageSlug(e.target.value)}
                  placeholder="e.g. home or about-us"
                />
                <Input
                  label="Route Path Override"
                  value={pageRoute}
                  onChange={(e) => setPageRoute(e.target.value)}
                  placeholder="e.g. /about"
                />
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1 text-left">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Page Status
                    </label>
                    <select
                      value={selectedPage?.status || "draft"}
                      onChange={(e) => updatePage(websiteId, pageId, activeLocale, { status: e.target.value })}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1 text-left">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Page Source
                    </label>
                    <input
                      disabled
                      value={selectedPage?.source || "cms"}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 outline-none capitalize font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SEO Tab */}
            {activeSettingsTab === "seo" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <SEOPanel
                  seoData={pageSeo}
                  onChange={setPageSeo}
                  blocks={pageBlocks}
                />
              </div>
            )}

            {/* Fallback Block Layout Tab */}
            {activeSettingsTab === "blocks" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <p className="text-xs text-slate-400 mb-3">
                  Configure structural JSON block fallbacks for original CMS layout rendering.
                </p>
                <BlockEditor
                  blocks={pageBlocks}
                  onChange={setPageBlocks}
                  activeLocale={activeLocale}
                />
              </div>
            )}

            {/* Revisions Tab */}
            {activeSettingsTab === "revisions" && (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <RevisionPanel
                  revisions={revisions}
                  onRestore={handleRestoreRevision}
                />
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setShowPageSettingsModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePageSettings}
                className="text-xs font-bold gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Page Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Vercel Deploy Hook Setup Modal */}
      {showVercelModal && (
        <Modal
          isOpen={showVercelModal}
          onClose={() => setShowVercelModal(false)}
          title="Configure 1-Click Vercel Deploy Hook"
        >
          <div className="space-y-4 text-left p-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your Vercel Deploy Hook URL once to enable 1-click deployments directly from the CMS header without editing code or running manual git commands.
            </p>
            <Input
              label="Vercel Deploy Hook URL"
              value={vercelHookInput}
              onChange={(e) => setVercelHookInput(e.target.value)}
              placeholder="e.g. https://api.vercel.com/v1/integrations/deploy/..."
            />
            <div className="text-[11px] text-slate-400 bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <p className="font-bold text-white">How to get your Vercel Deploy Hook URL:</p>
              <p>1. Go to your Vercel Dashboard project settings.</p>
              <p>2. Navigate to <strong>Git -&gt; Deploy Hooks</strong>.</p>
              <p>3. Click <strong>Create Hook</strong> (name: "ReactCMS", branch: "main") and copy the webhook URL.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowVercelModal(false)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveVercelHook}
                disabled={!vercelHookInput.trim()}
                className="text-xs font-bold gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Save &amp; Deploy Now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default VisualEditorPage;
