import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  Move,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useWebsites } from "../../hooks/useWebsites";
import { useLocale } from "../../hooks/useLocale";
import { useRevisions } from "../../hooks/useRevisions";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import registryService from "../../services/registryService";
import revisionService from "../../services/revisionService";
import visualBuilderService, {
  BUILDER_BLOCKS_REGION,
  createVisualBlock
} from "../../services/visualBuilderService";
import VisualBuilderToolbar from "../../components/content/VisualBuilderToolbar";
import VisualRegionTree from "../../components/content/VisualRegionTree";
import VisualInspector from "../../components/content/VisualInspector";
import VisualBlockLibrary from "../../components/content/VisualBlockLibrary";
import VisualPageSettingsModal from "../../components/content/VisualPageSettingsModal";

const DEVICE_WIDTHS = {
  desktop: 1440,
  laptop: 1180,
  tablet: 820,
  mobile: 390
};

function humanizeRegionId(regionId) {
  return String(regionId || "")
    .split(/[._:/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRegionType(regionId, value) {
  const id = String(regionId || "").toLowerCase();
  if (id.includes("image") || id.includes("logo") || id.includes("avatar")) return "image";
  if (id.includes("button") || id.includes("cta") || id.includes("link")) return "button";
  if (id.includes("section") || id.includes("container")) return "section";
  if (value && typeof value === "object" && ("src" in value || "alt" in value)) return "image";
  if (value && typeof value === "object" && ("href" in value || "variant" in value)) return "button";
  return "text";
}

function inferGroup(regionId) {
  const first = String(regionId || "").split(/[._:/-]+/).filter(Boolean)[0] || "page";
  if (["header", "footer", "navigation", "nav", "global"].includes(first.toLowerCase())) {
    return "global";
  }
  return first;
}

function resolveRegisteredPage(registry, page, pageKey) {
  const routeKey = String(page?.route || "").replace(/^\/+|\/+$/g, "") || "home";
  const candidates = [
    pageKey,
    routeKey,
    page?.slug,
    page?.route,
    page?.id,
    pageKey === "home" ? "/" : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (registry?.[candidate]) return registry[candidate];
  }

  const values = Object.values(registry || {});
  if (values.length === 1 && values[0] && typeof values[0] === "object") {
    return values[0];
  }
  return {};
}

function snapshotEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function VisualBuilderPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "preview" ? "preview" : "edit";
  const isPreview = mode === "preview";

  const {
    selectedPage,
    pageLoading,
    fetchPageById,
    setSelectedPage
  } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocale } = useLocale(websiteId);
  const {
    revisions,
    loading: revisionLoading,
    loadRevisions,
    restoreRevision
  } = useRevisions();
  const { user } = useAuth();
  const toast = useToast();

  const iframeRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const blocksRef = useRef([]);
  const draftRef = useRef({});
  const payloadRef = useRef({});
  const clipboardRef = useRef(null);
  const changeVersionRef = useRef(0);

  const [device, setDevice] = useState("desktop");
  const [canvasReady, setCanvasReady] = useState(false);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [registeredRegions, setRegisteredRegions] = useState({});
  const [draftValues, setDraftValues] = useState({});
  const [blocks, setBlocks] = useState([]);
  const [pageSettings, setPageSettings] = useState({
    title: "",
    slug: "",
    route: "",
    layout: "default",
    seo: {}
  });
  const [selected, setSelected] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pageKey = useMemo(
    () => visualBuilderService.resolvePageKey(selectedPage),
    [selectedPage]
  );
  const canvasUrl = useMemo(
    () => visualBuilderService.buildCanvasUrl(
      selectedWebsite?.domain,
      selectedPage,
      mode,
      activeLocale
    ),
    [activeLocale, mode, selectedPage, selectedWebsite?.domain]
  );

  useEffect(() => {
    blocksRef.current = blocks;
    draftRef.current = draftValues;
  }, [blocks, draftValues]);

  useEffect(() => {
    if (!websiteId || !pageId) return;
    selectWebsite(websiteId);
    fetchPageById(websiteId, pageId);
    loadRevisions(websiteId, "page", pageId);
  }, [fetchPageById, loadRevisions, pageId, selectWebsite, websiteId]);

  useEffect(() => {
    if (!websiteId) return undefined;
    return registryService.subscribeToEditableRegions(websiteId, setRegisteredRegions);
  }, [websiteId]);

  useEffect(() => {
    if (!selectedPage || !websiteId || !pageKey) return;
    let cancelled = false;

    const initializeDraft = async () => {
      setLoadError("");
      try {
        const { draft } = await visualBuilderService.loadRegions(websiteId, pageKey);
        if (cancelled) return;
        const localeData = selectedPage.locales?.[activeLocale] || {};
        const initialBlocks = Array.isArray(draft[BUILDER_BLOCKS_REGION])
          ? draft[BUILDER_BLOCKS_REGION]
          : (localeData.blocks || []);
        const initialRegions = { ...draft };
        delete initialRegions[BUILDER_BLOCKS_REGION];

        const settings = {
          title: localeData.title || selectedPage.title || "Untitled Page",
          slug: localeData.slug || selectedPage.slug || "",
          route: selectedPage.route || (selectedPage.slug === "home" ? "/" : `/${selectedPage.slug || ""}`),
          layout: selectedPage.layout || "default",
          seo: localeData.seo || {}
        };

        setPageSettings(settings);
        setDraftValues(initialRegions);
        setBlocks(initialBlocks);
        const firstSnapshot = { regions: initialRegions, blocks: initialBlocks };
        setHistory([firstSnapshot]);
        setHistoryIndex(0);
        changeVersionRef.current = 0;
        setSaveStatus("saved");
      } catch (error) {
        console.error(error);
        setLoadError("ReactCMS could not load the current page draft.");
      }
    };

    initializeDraft();
    return () => {
      cancelled = true;
    };
  }, [activeLocale, pageKey, selectedPage, websiteId]);

  const regionCatalog = useMemo(() => {
    const registered = resolveRegisteredPage(registeredRegions, selectedPage, pageKey);
    const catalog = {};

    Object.entries(registered || {}).forEach(([id, data]) => {
      const region = data && typeof data === "object" ? data : {};
      catalog[id] = {
        id,
        label: region.label || humanizeRegionId(id),
        type: region.type || inferRegionType(id, draftValues[id] ?? region.defaultValue),
        group: inferGroup(id),
        defaultValue: region.defaultValue
      };
    });

    Object.entries(draftValues).forEach(([id, value]) => {
      if (!catalog[id]) {
        catalog[id] = {
          id,
          label: humanizeRegionId(id),
          type: inferRegionType(id, value),
          group: inferGroup(id),
          defaultValue: value
        };
      }
    });

    return catalog;
  }, [draftValues, pageKey, registeredRegions, selectedPage]);

  const postCanvasState = useCallback(() => {
    if (!iframeRef.current || !canvasUrl || !websiteId) return;
    visualBuilderService.setCanvasMode(
      iframeRef.current,
      canvasUrl,
      websiteId,
      mode
    );
    visualBuilderService.hydrateCanvas(
      iframeRef.current,
      canvasUrl,
      websiteId,
      pageKey,
      {
        ...draftRef.current,
        [BUILDER_BLOCKS_REGION]: blocksRef.current
      }
    );
    visualBuilderService.updateCanvasBlocks(
      iframeRef.current,
      canvasUrl,
      websiteId,
      pageKey,
      blocksRef.current
    );
  }, [canvasUrl, mode, pageKey, websiteId]);

  const handleCanvasLoad = () => {
    setCanvasLoading(false);
    setCanvasReady(true);
    window.setTimeout(postCanvasState, 120);
  };

  useEffect(() => {
    if (isPreview || !canvasReady || runtimeConnected) {
      setConnectionTimedOut(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setConnectionTimedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, [canvasReady, isPreview, runtimeConnected]);

  const pushHistory = useCallback((regions, nextBlocks) => {
    const nextSnapshot = { regions, blocks: nextBlocks };
    setHistory((current) => {
      const currentSnapshot = current[historyIndex];
      if (currentSnapshot && snapshotEquals(currentSnapshot, nextSnapshot)) return current;
      const nextHistory = [...current.slice(0, historyIndex + 1), nextSnapshot].slice(-60);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }, [historyIndex]);

  const markUnsaved = useCallback(() => {
    changeVersionRef.current += 1;
    setSaveStatus((current) => current === "saving" ? current : "unsaved");
  }, []);

  const applyBlocks = useCallback((nextBlocks, recordHistory = true) => {
    setBlocks(nextBlocks);
    blocksRef.current = nextBlocks;
    if (recordHistory) pushHistory(draftRef.current, nextBlocks);
    markUnsaved();
    visualBuilderService.updateCanvasBlocks(
      iframeRef.current,
      canvasUrl,
      websiteId,
      pageKey,
      nextBlocks
    );
  }, [canvasUrl, markUnsaved, pageKey, pushHistory, websiteId]);

  const handleRegionChange = useCallback((regionId, value, options = {}) => {
    const nextRegions = { ...draftRef.current, [regionId]: value };
    draftRef.current = nextRegions;
    setDraftValues(nextRegions);
    setSelected((current) => (
      current?.kind === "region" && current.id === regionId
        ? { ...current, value }
        : current
    ));
    if (options.recordHistory !== false) pushHistory(nextRegions, blocksRef.current);
    markUnsaved();

    visualBuilderService.updateCanvasRegion(
      iframeRef.current,
      canvasUrl,
      websiteId,
      pageKey,
      regionId,
      value
    );
  }, [canvasUrl, markUnsaved, pageKey, pushHistory, websiteId]);

  const handleBlockChange = (blockId, updatedBlock) => {
    const nextBlocks = blocksRef.current.map((block) => (
      block.id === blockId ? updatedBlock : block
    ));
    applyBlocks(nextBlocks);
    setSelected((current) => (
      current?.kind === "block" && current.id === blockId
        ? { ...current, block: updatedBlock }
        : current
    ));
  };

  const insertBlock = (type, requestedIndex) => {
    const block = createVisualBlock(type, activeLocale);
    if (!block) return;
    const nextBlocks = [...blocksRef.current];
    const target = Number.isInteger(requestedIndex)
      ? Math.max(0, Math.min(requestedIndex, nextBlocks.length))
      : nextBlocks.length;
    nextBlocks.splice(target, 0, block);
    applyBlocks(nextBlocks);
    setSelected({ kind: "block", id: block.id, block });
    toast.success(`${humanizeRegionId(type)} added to the page.`);
  };

  const duplicateBlock = useCallback((blockId) => {
    const index = blocksRef.current.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const copy = {
      ...structuredClone(blocksRef.current[index]),
      id: `block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    };
    const nextBlocks = [...blocksRef.current];
    nextBlocks.splice(index + 1, 0, copy);
    applyBlocks(nextBlocks);
    setSelected({ kind: "block", id: copy.id, block: copy });
  }, [applyBlocks]);

  const deleteBlock = useCallback((blockId) => {
    applyBlocks(blocksRef.current.filter((block) => block.id !== blockId));
    setSelected((current) => current?.id === blockId ? null : current);
  }, [applyBlocks]);

  const moveBlock = useCallback((blockId, direction) => {
    const index = blocksRef.current.findIndex((block) => block.id === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocksRef.current.length) return;
    const nextBlocks = [...blocksRef.current];
    [nextBlocks[index], nextBlocks[nextIndex]] = [nextBlocks[nextIndex], nextBlocks[index]];
    applyBlocks(nextBlocks);
  }, [applyBlocks]);

  const selectRegion = useCallback((region, extra = {}) => {
    const value = extra.value !== undefined
      ? extra.value
      : (draftRef.current[region.id] ?? region.defaultValue ?? "");
    setSelected({
      kind: "region",
      ...region,
      ...extra,
      value
    });
    visualBuilderService.postToCanvas(
      iframeRef.current,
      canvasUrl,
      websiteId,
      "rcms/v1/select-region",
      { regionId: region.id }
    );
  }, [canvasUrl, websiteId]);

  const selectBlock = useCallback((block, extra = {}) => {
    setSelected({ kind: "block", id: block.id, block, ...extra });
    visualBuilderService.postToCanvas(
      iframeRef.current,
      canvasUrl,
      websiteId,
      "rcms/v1/select-region",
      { regionId: `__block__:${block.id}` }
    );
  }, [canvasUrl, websiteId]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (canvasUrl) {
        try {
          if (event.origin !== new URL(canvasUrl).origin) return;
        } catch {
          // Message shape and website identity checks below remain mandatory.
        }
      }
      const message = event.data;
      if (!message || message.rcms !== true || message.version !== "v1") return;
      if (message.websiteId && message.websiteId !== websiteId) return;
      const payload = message.payload || {};

      if (message.type === "rcms/v1/runtime-ready") {
        setCanvasReady(true);
        setRuntimeConnected(true);
        setConnectionTimedOut(false);
        window.setTimeout(postCanvasState, 80);
        return;
      }

      if (message.type === "rcms/v1/regions-registered" && payload.regions) {
        setRegisteredRegions((current) => ({
          ...current,
          [payload.pageId || pageKey]: payload.regions
        }));
        return;
      }

      if (message.type === "rcms/v1/field-update" && payload.regionId) {
        if (payload.regionId === BUILDER_BLOCKS_REGION && Array.isArray(payload.value)) {
          applyBlocks(payload.value, false);
          return;
        }
        handleRegionChange(payload.regionId, payload.value, { recordHistory: true });
        visualBuilderService.persistRegion(
          websiteId,
          pageKey,
          payload.regionId,
          payload.value
        ).catch(console.error);
        return;
      }

      if (message.type === "rcms/v1/region-selected") {
        const regionId = payload.regionId;
        if (payload.type === "block" || String(regionId).startsWith("__block__:")) {
          const blockId = payload.blockId || String(regionId).replace("__block__:", "");
          const block = blocksRef.current.find((item) => item.id === blockId);
          if (block) selectBlock(block, { rect: payload.rect });
          return;
        }
        const region = regionCatalog[regionId] || {
          id: regionId,
          label: payload.label || humanizeRegionId(regionId),
          type: payload.type || inferRegionType(regionId, payload.value),
          group: inferGroup(regionId)
        };
        selectRegion(region, {
          value: payload.value,
          computedStyle: payload.computedStyle,
          rect: payload.rect
        });
        return;
      }

      if (message.type === "rcms/v1/builder-insert-request") {
        setInsertIndex(Number.isInteger(payload.index) ? payload.index : blocksRef.current.length);
        setLibraryOpen(true);
        return;
      }

      if (message.type === "rcms/v1/builder-command" && payload.blockId) {
        if (payload.command === "duplicate") duplicateBlock(payload.blockId);
        if (payload.command === "delete") deleteBlock(payload.blockId);
        if (payload.command === "move-up") moveBlock(payload.blockId, -1);
        if (payload.command === "move-down") moveBlock(payload.blockId, 1);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    applyBlocks,
    canvasUrl,
    deleteBlock,
    duplicateBlock,
    handleRegionChange,
    moveBlock,
    pageKey,
    postCanvasState,
    regionCatalog,
    selectBlock,
    selectRegion,
    websiteId
  ]);

  const performSave = useCallback(async ({ manual = false, settingsOverride } = {}) => {
    const payload = payloadRef.current;
    if (!payload.page || !payload.pageKey) return false;
    setSaving(true);
    setSaveStatus("saving");
    const savingVersion = changeVersionRef.current;

    try {
      const settings = settingsOverride || payload.pageSettings;
      await visualBuilderService.saveDraft({
        websiteId,
        pageId,
        pageKey: payload.pageKey,
        locale: activeLocale,
        page: payload.page,
        pageSettings: settings,
        regions: draftRef.current,
        blocks: blocksRef.current
      });

      if (manual) {
        await revisionService.save(
          websiteId,
          "page",
          pageId,
          {
            ...payload.page,
            title: settings.title,
            slug: settings.slug,
            route: settings.route,
            locales: {
              ...(payload.page.locales || {}),
              [activeLocale]: {
                ...(payload.page.locales?.[activeLocale] || {}),
                title: settings.title,
                slug: settings.slug,
                seo: settings.seo,
                blocks: blocksRef.current
              }
            },
            visualRegions: draftRef.current
          },
          user?.email || user?.uid
        );
        loadRevisions(websiteId, "page", pageId);
      }

      setSaveStatus(
        changeVersionRef.current === savingVersion ? "saved" : "unsaved"
      );
      return true;
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      if (manual) toast.error("Draft could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [activeLocale, loadRevisions, pageId, toast, user, websiteId]);

  useEffect(() => {
    payloadRef.current = {
      page: selectedPage,
      pageKey,
      pageSettings
    };
  }, [pageKey, pageSettings, selectedPage]);

  useEffect(() => {
    if (isPreview || saveStatus !== "unsaved") return undefined;
    const timer = window.setTimeout(() => {
      performSave({ manual: false });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [isPreview, performSave, saveStatus]);

  const publish = async () => {
    setPublishing(true);
    try {
      const saved = await performSave({ manual: true });
      if (!saved) return;
      await visualBuilderService.publish({
        websiteId,
        pageId,
        pageKey,
        routeId: selectedPage?.routeId || selectedPage?.slug
      });
      setSelectedPage((current) => current ? {
        ...current,
        status: "published",
        publishedAt: Date.now()
      } : current);
      toast.success("Page published. The connected website is now live.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Page publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    draftRef.current = snapshot.regions;
    blocksRef.current = snapshot.blocks;
    setDraftValues(snapshot.regions);
    setBlocks(snapshot.blocks);
    markUnsaved();
    window.setTimeout(postCanvasState, 0);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    draftRef.current = snapshot.regions;
    blocksRef.current = snapshot.blocks;
    setDraftValues(snapshot.regions);
    setBlocks(snapshot.blocks);
    markUnsaved();
    window.setTimeout(postCanvasState, 0);
  };

  const restorePageRevision = async (revisionId) => {
    try {
      const snapshot = await restoreRevision(websiteId, "page", pageId, revisionId);
      const localeData = snapshot.locales?.[activeLocale] || {};
      const nextBlocks = localeData.blocks || snapshot.blocks || [];
      const nextRegions = snapshot.visualRegions || draftRef.current;
      const nextSettings = {
        title: localeData.title || snapshot.title || pageSettings.title,
        slug: localeData.slug || snapshot.slug || pageSettings.slug,
        route: snapshot.route || pageSettings.route,
        layout: snapshot.layout || pageSettings.layout,
        seo: localeData.seo || pageSettings.seo
      };
      setBlocks(nextBlocks);
      setDraftValues(nextRegions);
      setPageSettings(nextSettings);
      blocksRef.current = nextBlocks;
      draftRef.current = nextRegions;
      pushHistory(nextRegions, nextBlocks);
      markUnsaved();
      postCanvasState();
      setSettingsOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const applyPageSettings = (settings) => {
    setPageSettings(settings);
    markUnsaved();
  };

  const savePageSettings = async (settings) => {
    setPageSettings(settings);
    const saved = await performSave({ manual: true, settingsOverride: settings });
    if (saved) {
      setSelectedPage((current) => {
        if (!current) return current;
        return {
          ...current,
          title: activeLocale === "en" ? settings.title : current.title,
          slug: activeLocale === "en" ? settings.slug : current.slug,
          route: settings.route,
          layout: settings.layout,
          locales: {
            ...(current.locales || {}),
            [activeLocale]: {
              ...(current.locales?.[activeLocale] || {}),
              title: settings.title,
              slug: settings.slug,
              seo: settings.seo,
              blocks: blocksRef.current
            }
          }
        };
      });
      setSettingsOpen(false);
    }
  };

  const openLibrary = (index = null) => {
    setInsertIndex(Number.isInteger(index) ? index : null);
    setLibraryOpen(true);
  };

  const copySelection = () => {
    if (selected?.kind === "block") {
      clipboardRef.current = { kind: "block", value: structuredClone(selected.block) };
    } else if (selected?.kind === "region") {
      clipboardRef.current = { kind: "region", value: structuredClone(selected.value) };
    }
    toast.success("Component copied.");
  };

  const pasteSelection = () => {
    const copied = clipboardRef.current;
    if (!copied) return;
    if (copied.kind === "region" && selected?.kind === "region") {
      handleRegionChange(selected.id, structuredClone(copied.value));
    }
    if (copied.kind === "block") {
      const block = {
        ...structuredClone(copied.value),
        id: `block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      };
      applyBlocks([...blocksRef.current, block]);
      setSelected({ kind: "block", id: block.id, block });
    }
  };

  const floatingPosition = (() => {
    if (!selected?.rect || !iframeRef.current || !canvasAreaRef.current) return null;
    const frameRect = iframeRef.current.getBoundingClientRect();
    const areaRect = canvasAreaRef.current.getBoundingClientRect();
    return {
      left: frameRect.left - areaRect.left + canvasAreaRef.current.scrollLeft + selected.rect.x + (selected.rect.width / 2),
      top: Math.max(8, frameRect.top - areaRect.top + canvasAreaRef.current.scrollTop + selected.rect.y - 45)
    };
  })();

  if ((pageLoading || !selectedPage || !selectedWebsite) && !loadError) {
    return (
      <div className="h-screen bg-[#070b14] text-slate-300 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-500 mt-3">Opening visual builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen min-h-0 bg-[#070b14] text-slate-200 flex flex-col overflow-hidden">
      <VisualBuilderToolbar
        mode={mode}
        page={{ ...selectedPage, title: pageSettings.title || selectedPage?.title }}
        device={device}
        saveStatus={saveStatus}
        saving={saving}
        publishing={publishing}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onBack={() => navigate(`/content/${websiteId}/pages`)}
        onDeviceChange={setDevice}
        onUndo={undo}
        onRedo={redo}
        onSave={() => performSave({ manual: true })}
        onPublish={publish}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 min-h-0 flex">
        {!isPreview && (
          <VisualRegionTree
            regions={regionCatalog}
            blocks={blocks}
            selected={selected}
            onSelectRegion={selectRegion}
            onSelectBlock={selectBlock}
            onBlocksChange={applyBlocks}
            onDuplicateBlock={duplicateBlock}
            onDeleteBlock={deleteBlock}
            onAddSection={openLibrary}
          />
        )}

        <main className="flex-1 min-w-0 min-h-0 bg-[#080d18] flex flex-col">
          <div className="h-10 px-3 flex items-center gap-2 border-b border-slate-800/80 bg-[#0a101d]">
            <span className={`w-2 h-2 rounded-full ${(isPreview ? canvasReady : runtimeConnected) ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Live Website Canvas
            </span>
            <span className="text-[9px] text-slate-700">/</span>
            <span className="text-[10px] text-slate-600">{DEVICE_WIDTHS[device]}px</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setCanvasLoading(true);
                  setCanvasReady(false);
                  setRuntimeConnected(false);
                  setCanvasKey((value) => value + 1);
                }}
                className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-slate-900 cursor-pointer"
                title="Reload canvas"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            ref={canvasAreaRef}
            className="relative flex-1 min-h-0 overflow-auto p-4 md:p-6 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,0.42),_rgba(7,11,20,0.15)_58%)]"
          >
            {!canvasUrl ? (
              <div className="h-full flex items-center justify-center">
                <div className="max-w-md text-center rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
                  <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
                  <h2 className="text-sm font-bold text-white mt-3">Connected website URL missing</h2>
                  <p className="text-xs leading-relaxed text-slate-500 mt-2">
                    Add a domain in Website Settings before opening the live canvas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative min-h-full flex justify-center items-start">
                {connectionTimedOut && (
                  <div className="sticky top-2 z-40 h-0 w-0 overflow-visible pointer-events-none">
                    <div className="pointer-events-auto absolute left-4 top-2 w-80 rounded-xl border border-amber-500/25 bg-slate-950/95 p-3 shadow-xl">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-200">Runtime editing bridge not responding</p>
                          <p className="text-[10px] leading-relaxed text-slate-500 mt-1">
                            The live site is visible, but selection and inline editing require the updated ReactCMS Runtime on the connected website.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div
                  className="relative flex-shrink-0 bg-white shadow-2xl shadow-black/50 transition-[width] duration-300 overflow-hidden"
                  style={{
                    width: `${DEVICE_WIDTHS[device]}px`,
                    maxWidth: device === "desktop" ? "100%" : "none",
                    minHeight: "100%",
                    borderRadius: device === "mobile" ? "24px" : "10px",
                    border: device === "mobile" ? "8px solid #111827" : "1px solid #334155"
                  }}
                >
                  {canvasLoading && (
                    <div className="absolute inset-0 z-20 bg-white flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                        <p className="text-[11px] font-semibold text-slate-500 mt-2">Loading live website...</p>
                      </div>
                    </div>
                  )}
                  <iframe
                    key={`${canvasKey}-${canvasUrl}`}
                    ref={iframeRef}
                    src={canvasUrl}
                    title={`${pageSettings.title} ${mode === "edit" ? "visual editor" : "preview"}`}
                    onLoad={handleCanvasLoad}
                    className="block w-full border-0 bg-white"
                    style={{ height: "calc(100vh - 146px)", minHeight: "640px" }}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                  />
                </div>

                {!isPreview && floatingPosition && (
                  <div
                    className="absolute z-30 -translate-x-1/2 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 shadow-xl shadow-black/50"
                    style={{ left: floatingPosition.left, top: floatingPosition.top }}
                  >
                    <button type="button" onClick={copySelection} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Copy">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={pasteSelection} className="px-2 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Paste">
                      Paste
                    </button>
                    {selected?.kind === "block" && (
                      <>
                        <span className="w-px h-4 bg-slate-800" />
                        <button type="button" onClick={() => moveBlock(selected.id, -1)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => moveBlock(selected.id, 1)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => duplicateBlock(selected.id)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Duplicate">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteBlock(selected.id)} className="p-1.5 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {selected?.kind === "region" && <Move className="w-3.5 h-3.5 text-slate-700 mx-1" />}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {!isPreview && (
          <VisualInspector
            selected={selected}
            activeLocale={activeLocale}
            onRegionChange={handleRegionChange}
            onBlockChange={handleBlockChange}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      <VisualBlockLibrary
        isOpen={libraryOpen}
        insertIndex={insertIndex}
        onClose={() => {
          setLibraryOpen(false);
          setInsertIndex(null);
        }}
        onInsert={insertBlock}
      />

      <VisualPageSettingsModal
        isOpen={settingsOpen}
        settings={pageSettings}
        blocks={blocks}
        revisions={revisions}
        revisionLoading={revisionLoading}
        onClose={() => setSettingsOpen(false)}
        onChange={applyPageSettings}
        onSave={savePageSettings}
        onRestoreRevision={restorePageRevision}
      />
    </div>
  );
}

export default VisualBuilderPage;
