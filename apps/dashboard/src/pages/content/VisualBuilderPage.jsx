import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  GitBranch,
  KeyRound,
  Loader2,
  MousePointer2,
  Palette,
  RefreshCw,
  Ruler
} from "lucide-react";
import { NativeCanvas, CANVAS_DEVICE_WIDTHS } from "@anshif.rainhopes/reactcms-canvas";
import {
  NativeEditorProvider,
  useNativeEditor
} from "@anshif.rainhopes/reactcms-editor";
import { findNode } from "@anshif.rainhopes/reactcms-layout-engine";
import {
  blocksToPageTree,
  isPageComponentTree,
  pageTreeToBlocks,
  RUNTIME_ADDITIONS_REGION,
  regionsToPageTree
} from "@anshif.rainhopes/reactcms-renderer";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useRevisions } from "../../hooks/useRevisions";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import revisionService from "../../services/revisionService";
import themeService from "../../services/themeService";
import websiteService from "../../services/websiteService";
import sourceCredentialService from "../../services/sourceCredentialService";
import sourceProviderService from "../../services/sourceProviderService";
import registryService from "../../services/registryService";
import pageService from "../../services/pageService";
import contentSyncService from "../../services/contentSyncService";
import {
  buildConnectedCanvasProxyUrl,
  buildConnectedPageFallbackUrl,
  buildConnectedPageUrl,
  connectedDraftTargets,
  connectedRegionAliases,
  createRuntimeMessage,
  discoverLocalSourceImports,
  mergeRegionSelection,
  patchEditableRegionSource,
  selectGitContentRegions,
  shouldUseConnectedWebsiteCanvas,
  updateRegionFieldValue
} from "../../services/sourceVisualPatchService";
import {
  generateReactPageSource,
  patchReactStateRouter,
  reactPageComponentName,
  reactPageSourcePath
} from "../../services/sourceGenerationService";
import visualBuilderService, {
  createVisualNode
} from "../../services/visualBuilderService";
import { applyAIPlan } from "../../services/aiPageMutationService";
import { stringifyAISnapshot } from "../../services/aiBuilderPersistenceService";
import {
  auditAIContext,
  collectAIWebsiteContext,
  AI_COMPONENT_LIBRARY
} from "../../services/aiWebsiteContextService";
import VisualBuilderToolbar from "../../components/content/VisualBuilderToolbar";
import NativeLayersPanel from "../../components/content/NativeLayersPanel";
import ImagePicker from "../../components/ui/ImagePicker";
import HostingRouteRepairModal from "../../components/websites/HostingRouteRepairModal";
import { calculateConnectedCanvasSizing } from "../../utils/connectedCanvasSizing";

const NativeInspector = lazy(() => import("../../components/content/NativeInspector"));
const AIWorkspace = lazy(() => import("../../components/content/AIWorkspace"));
const VisualPageSettingsModal = lazy(() => import("../../components/content/VisualPageSettingsModal"));
const LIVE_FRAME_LOAD_TIMEOUT_MS = 15000;

function sourceDraftKey(websiteId, pageId) {
  return `reactcms_source_draft:${websiteId}:${pageId}`;
}

function sourceFilesDraftKey(websiteId, pageId) {
  return `reactcms_source_files_draft:${websiteId}:${pageId}`;
}

async function loadConnectedSourceGraph(website, entryPath, entryContent) {
  const files = { [entryPath]: entryContent };
  const attempted = new Set([entryPath]);
  const processed = new Set();
  const queue = [entryPath];
  const maxSourceFiles = 48;

  while (queue.length && Object.keys(files).length < maxSourceFiles) {
    const importerPath = queue.shift();
    if (processed.has(importerPath)) continue;
    processed.add(importerPath);

    const imports = discoverLocalSourceImports(
      importerPath,
      files[importerPath] || ""
    );
    const loadedImports = await Promise.all(imports.map(async ({ candidates }) => {
      for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(files, candidate)) return null;
        if (attempted.has(candidate)) continue;
        attempted.add(candidate);
        try {
          const source = await sourceProviderService.readFile(website, candidate);
          return { path: candidate, content: source.content };
        } catch {
          // Extensionless imports are tried against each supported source extension.
        }
      }
      return null;
    }));

    loadedImports.filter(Boolean).forEach(({ path, content }) => {
      files[path] = content;
      queue.push(path);
    });
  }

  return files;
}

function ConnectedSourceWorkspace({
  mode,
  websiteId,
  pageId,
  pageKey,
  locale,
  page,
  website,
  theme,
  pageSettings,
  content,
  loading,
  error,
  saveStatus,
  saving,
  publishing,
  writeToken,
  onWriteTokenChange,
  onBack,
  onChange,
  onVisualChange,
  getSourceFiles,
  onSourceFilesChange,
  onThemeChange,
  onPageSettingsChange,
  onSaveSEO,
  onAIDraftSave,
  onSave,
  onPublish,
  onRepairLiveRoute,
  visualOnly = false
}) {
  const isPreview = mode === "preview";
  const isGitHub = website?.connection?.provider === "github";
  const isSftp = website?.connection?.provider === "sftp";
  const iframeRef = useRef(null);
  const canvasViewportRef = useRef(null);
  const connectedDraftHydratedRef = useRef(false);
  const [workspaceMode, setWorkspaceMode] = useState("visual");
  const [device, setDevice] = useState("desktop");
  const [customWidth, setCustomWidth] = useState(960);
  const [canvasViewportSize, setCanvasViewportSize] = useState({
    width: 0,
    height: 0
  });
  const [frameLoading, setFrameLoading] = useState(true);
  const [frameVersion, setFrameVersion] = useState(0);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const runtimeWebsiteIdFallback = String(website?.websiteId || "").trim();
  const [runtimeWebsiteId, setRuntimeWebsiteId] = useState(runtimeWebsiteIdFallback);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [connectedSelectionVersion, setConnectedSelectionVersion] = useState(0);
  const selectedRegionRef = useRef(null);
  const selectedRegionsRef = useRef([]);
  const additiveSelectionRequestRef = useRef(false);
  const connectedUndoRef = useRef([]);
  const connectedRedoRef = useRef([]);
  const [connectedHistoryVersion, setConnectedHistoryVersion] = useState(0);
  const [visualError, setVisualError] = useState("");
  const [liveRouteError, setLiveRouteError] = useState("");
  const [aiOpen, setAIOpen] = useState(true);
  const [canvasSEOScan, setCanvasSEOScan] = useState(null);

  const requestedLivePageUrl = useMemo(
    () => buildConnectedPageUrl(website, page, isPreview ? "preview" : "edit"),
    [isPreview, page, website]
  );
  const fallbackLivePageUrl = useMemo(
    () => buildConnectedPageFallbackUrl(website, page, isPreview ? "preview" : "edit"),
    [isPreview, page, website]
  );
  const [livePageUrl, setLivePageUrl] = useState("");
  const canvasRuntimePageId = useMemo(() => {
    const cleanKey = String(pageKey || "").split("?")[0].replace(/^\/+|\/+$/g, "");
    if (cleanKey && cleanKey !== "api/live-preview" && cleanKey !== "api-live-preview") {
      return cleanKey;
    }
    try {
      if (!livePageUrl) return cleanKey || "home";
      const url = new URL(livePageUrl, window.location.origin);
      const routeParam = url.searchParams.get("route");
      if (routeParam) {
        const routePath = new URL(routeParam, "https://dummy.invalid").pathname;
        const clean = routePath.split("?")[0].replace(/^\/+|\/+$/g, "");
        if (clean && clean !== "api/live-preview" && clean !== "api-live-preview") {
          return clean;
        }
      }
      const targetParam = url.searchParams.get("target");
      if (targetParam) {
        const targetPath = new URL(targetParam).pathname;
        const clean = targetPath.split("?")[0].replace(/^\/+|\/+$/g, "");
        if (clean && clean !== "api/live-preview" && clean !== "api-live-preview") {
          return clean;
        }
      }
      const path = url.pathname.replace(/^\/+|\/+$/g, "");
      if (path && path !== "api/live-preview" && path !== "api-live-preview") {
        return path;
      }
    } catch {
      // fallback
    }
    return cleanKey || "home";
  }, [livePageUrl, pageKey]);
  const [routeResolving, setRouteResolving] = useState(true);
  const renderedLivePageUrl = useMemo(() => {
    if (!livePageUrl || frameVersion === 0) return livePageUrl;
    try {
      const url = new URL(livePageUrl, window.location.origin);
      url.searchParams.set("rcms_reload", String(frameVersion));
      return url.toString();
    } catch {
      return livePageUrl;
    }
  }, [frameVersion, livePageUrl]);
  const liveOrigin = useMemo(() => {
    try {
      return livePageUrl
        ? new URL(livePageUrl, window.location.origin).origin
        : "";
    } catch {
      return "";
    }
  }, [livePageUrl]);
  const livePageIsCrossOrigin = Boolean(
    liveOrigin && liveOrigin !== window.location.origin
  );
  const canvasWidth = device === "custom"
    ? customWidth
    : CANVAS_DEVICE_WIDTHS[device] || 1440;
  const {
    scale: canvasScale,
    frameHeight: canvasFrameHeight,
    layoutWidth: canvasLayoutWidth,
    layoutHeight: canvasLayoutHeight
  } = calculateConnectedCanvasSizing({
    viewportWidth: canvasViewportSize.width,
    viewportHeight: canvasViewportSize.height,
    canvasWidth
  });

  useEffect(() => {
    let cancelled = false;
    setRouteResolving(true);
    setLivePageUrl("");
    setLiveRouteError("");

    if (!requestedLivePageUrl) {
      setRouteResolving(false);
      return undefined;
    }

    const canvasUrl = (connectedUrl) => {
      if (isPreview) return connectedUrl;
      return buildConnectedCanvasProxyUrl(connectedUrl, "edit") || connectedUrl;
    };

    let requestedPath = "/";
    try {
      requestedPath = new URL(requestedLivePageUrl).pathname;
    } catch {
      setLivePageUrl(requestedLivePageUrl);
      setRouteResolving(false);
      return undefined;
    }

    if (requestedPath === "/") {
      setLivePageUrl(canvasUrl(requestedLivePageUrl));
      setRouteResolving(false);
      return undefined;
    }

    fetch(`/api/live-preview?probe=${encodeURIComponent(requestedLivePageUrl)}`, {
      method: "GET",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Route probe failed (${response.status}).`);
        return response.json();
      })
      .then((result) => {
        if (cancelled) return;
        setLivePageUrl(
          canvasUrl(
            result.status === 404 && fallbackLivePageUrl
              ? fallbackLivePageUrl
              : requestedLivePageUrl
          )
        );
      })
      .catch(() => {
        if (!cancelled) setLivePageUrl(canvasUrl(requestedLivePageUrl));
      })
      .finally(() => {
        if (!cancelled) setRouteResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackLivePageUrl, isPreview, requestedLivePageUrl]);

  useLayoutEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || (workspaceMode !== "visual" && !isPreview)) return undefined;

    let measurementFrame = 0;
    let settlingFrame = 0;
    const updateViewportSize = () => {
      const bounds = viewport.getBoundingClientRect();
      const nextSize = {
        // Border-box measurements remain stable when macOS overlay scrollbars
        // appear. clientWidth can alternate and feed the canvas scale back into
        // ResizeObserver, which makes the connected page visibly shiver.
        width: Math.max(0, Math.floor(bounds.width)),
        height: Math.max(0, Math.floor(bounds.height))
      };
      setCanvasViewportSize((currentSize) => (
        currentSize.width === nextSize.width
          && currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      ));
    };
    const scheduleViewportUpdate = () => {
      window.cancelAnimationFrame(measurementFrame);
      measurementFrame = window.requestAnimationFrame(updateViewportSize);
    };
    updateViewportSize();
    settlingFrame = window.requestAnimationFrame(() => {
      updateViewportSize();
      settlingFrame = window.requestAnimationFrame(updateViewportSize);
    });

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleViewportUpdate);
      return () => {
        window.cancelAnimationFrame(measurementFrame);
        window.cancelAnimationFrame(settlingFrame);
        window.removeEventListener("resize", scheduleViewportUpdate);
      };
    }

    const observer = new ResizeObserver(scheduleViewportUpdate);
    try {
      observer.observe(viewport, { box: "border-box" });
    } catch {
      observer.observe(viewport);
    }
    window.addEventListener("resize", scheduleViewportUpdate);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(measurementFrame);
      window.cancelAnimationFrame(settlingFrame);
      window.removeEventListener("resize", scheduleViewportUpdate);
    };
  }, [aiOpen, isPreview, workspaceMode]);

  const sendRuntimeMessage = useCallback((type, payload = {}) => {
    iframeRef.current?.contentWindow?.postMessage(
      createRuntimeMessage(type, payload),
      "*"
    );
  }, []);
  const requestCanvasSEOScan = useCallback(() => {
    sendRuntimeMessage("rcms/v1/request-seo-scan");
  }, [sendRuntimeMessage]);

  const updateConnectedSelection = useCallback((regions) => {
    const nextRegions = Array.from(new Map((regions || [])
      .filter((region) => region?.regionId)
      .map((region) => [region.regionId, region])).values());
    const activeRegion = nextRegions[nextRegions.length - 1] || null;
    selectedRegionsRef.current = nextRegions;
    selectedRegionRef.current = activeRegion;
    setSelectedRegions(nextRegions);
    setSelectedRegion(activeRegion);
  }, []);

  const clearConnectedSelection = useCallback(() => {
    additiveSelectionRequestRef.current = false;
    updateConnectedSelection([]);
  }, [updateConnectedSelection]);

  const recordConnectedHistory = useCallback((region, before, after) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    connectedUndoRef.current = [...connectedUndoRef.current.slice(-99), {
      region: {
        regionId: region.regionId,
        type: region.type,
        pageId: region.pageId,
        label: region.label
      },
      before: structuredClone(before),
      after: structuredClone(after)
    }];
    connectedRedoRef.current = [];
    setConnectedHistoryVersion((value) => value + 1);
  }, []);

  const applyVisualValue = useCallback((
    region,
    value,
    sendToRuntime = true,
    recordHistory = true
  ) => {
    const currentRegion = selectedRegionsRef.current.find((item) => (
      item.regionId === region.regionId
    )) || (selectedRegionRef.current?.regionId === region.regionId
      ? selectedRegionRef.current
      : null);
    const before = region.value !== undefined ? region.value : currentRegion?.value;
    const result = onVisualChange({
      regionId: region.regionId,
      type: region.type,
      pageId: region.pageId || canvasRuntimePageId,
      runtimeWebsiteId,
      runtimeWebsiteIds: [runtimeWebsiteIdFallback],
      value
    });
    if (!result?.changed) {
      setVisualError(
        result?.error
        || "This region is rendered by another source component and cannot be written to this page file."
      );
      return false;
    }

    setVisualError("");
    if (recordHistory) recordConnectedHistory(region, before, value);
    const nextRegion = { ...(currentRegion || region), ...region, value };
    const nextRegions = selectedRegionsRef.current.some((item) => (
      item.regionId === region.regionId
    ))
      ? selectedRegionsRef.current.map((item) => (
        item.regionId === region.regionId ? nextRegion : item
      ))
      : [nextRegion];
    updateConnectedSelection(nextRegions);
    if (sendToRuntime) {
      sendRuntimeMessage("rcms/v1/field-update", {
        pageId: region.pageId || canvasRuntimePageId,
        regionId: region.regionId,
        value
      });
    }
    return true;
  }, [
    canvasRuntimePageId,
    onVisualChange,
    recordConnectedHistory,
    runtimeWebsiteId,
    runtimeWebsiteIdFallback,
    sendRuntimeMessage,
    updateConnectedSelection
  ]);

  const undoConnectedEdit = useCallback(() => {
    const entry = connectedUndoRef.current.pop();
    if (!entry) return;
    connectedRedoRef.current.push(entry);
    applyVisualValue({ ...entry.region, value: entry.before }, entry.before, true, false);
    setConnectedHistoryVersion((value) => value + 1);
  }, [applyVisualValue]);

  const redoConnectedEdit = useCallback(() => {
    const entry = connectedRedoRef.current.pop();
    if (!entry) return;
    connectedUndoRef.current.push(entry);
    applyVisualValue({ ...entry.region, value: entry.before }, entry.after, true, false);
    setConnectedHistoryVersion((value) => value + 1);
  }, [applyVisualValue]);

  useEffect(() => {
    setWorkspaceMode("visual");
    clearConnectedSelection();
    setRuntimeWebsiteId(runtimeWebsiteIdFallback);
    connectedUndoRef.current = [];
    connectedRedoRef.current = [];
    setConnectedHistoryVersion((value) => value + 1);
    connectedDraftHydratedRef.current = false;
    setVisualError("");
    setFrameLoading(true);
  }, [clearConnectedSelection, page?.id, isPreview, runtimeWebsiteIdFallback]);

  useEffect(() => {
    if (!livePageUrl) return undefined;
    if (livePageIsCrossOrigin) {
      setLiveRouteError("");
      return undefined;
    }
    let cancelled = false;
    setLiveRouteError("");

    fetch(livePageUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store"
    })
      .then(async (response) => {
        if (cancelled || response.ok) return;
        const payload = await response.json().catch(() => null);
        setLiveRouteError(
          payload?.error
          || `ReactCMS could not prepare the connected page (HTTP ${response.status}).`
        );
      })
      .catch(() => {
        // Some connected hosts allow framing but not cross-origin fetches.
        // In that case the iframe remains the source of truth.
      });

    return () => {
      cancelled = true;
    };
  }, [livePageIsCrossOrigin, livePageUrl, frameVersion]);

  useEffect(() => {
    if (!livePageUrl) return undefined;
    let active = true;
    const handleRuntimeMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        liveOrigin
        && event.origin !== liveOrigin
        && event.origin !== "null"
      ) return;
      const message = event.data;
      if (
        !message
        || typeof message !== "object"
        || message.rcms !== true
        || message.version !== "v1"
      ) return;

      if (message.type === "rcms/v1/runtime-ready") {
        connectedDraftHydratedRef.current = false;
        setFrameLoading(false);
        setLiveRouteError("");
        setRuntimeConnected(true);
        const readyRuntimeWebsiteId = message.websiteId || runtimeWebsiteIdFallback;
        if (readyRuntimeWebsiteId) setRuntimeWebsiteId(readyRuntimeWebsiteId);
        sendRuntimeMessage(
          isPreview ? "rcms/v1/exit-edit-mode" : "rcms/v1/enter-edit-mode"
        );
        if (!isPreview) {
          requestCanvasSEOScan();
          window.setTimeout(() => {
            if (active) requestCanvasSEOScan();
          }, 500);
        }
        if (!isPreview && visualOnly && websiteId && pageKey) {
          void visualBuilderService.loadSavedDraftRegions(websiteId, pageKey, {
            pageId,
            routeId: page?.routeId,
            slug: page?.slug,
            route: page?.route
          })
            .then((draftRegions) => {
              if (!active) return;
              const entries = Object.entries(draftRegions || {}).filter(([, value]) => (
                value !== null && value !== undefined
              ));
              entries.forEach(([regionId, value]) => {
                onVisualChange({
                  regionId,
                  pageId: canvasRuntimePageId,
                  runtimeWebsiteId: readyRuntimeWebsiteId,
                  runtimeWebsiteIds: [runtimeWebsiteIdFallback],
                  value
                });
              });
              const broadcastDraft = () => entries.forEach(([regionId, value]) => {
                if (!active) return;
                if (value === null || value === undefined) return;
                sendRuntimeMessage("rcms/v1/field-update", {
                  pageId: canvasRuntimePageId || pageKey,
                  regionId,
                  value
                });
              });
              broadcastDraft();
              window.setTimeout(broadcastDraft, 250);
              window.setTimeout(() => {
                broadcastDraft();
                if (active) connectedDraftHydratedRef.current = true;
              }, 900);
            })
            .catch((hydrationError) => {
              console.error("Connected canvas draft could not be hydrated", hydrationError);
              connectedDraftHydratedRef.current = true;
            });
        }
        return;
      }

      if (!isPreview && message.type === "rcms/v1/seo-scan") {
        setCanvasSEOScan(message.payload || null);
        return;
      }

      if (!isPreview && message.type === "rcms/v1/region-selected") {
        sendRuntimeMessage("rcms/v1/exit-area-select");
        const payload = message.payload || {};
        const metadataOnly = !payload.type
          && !Object.prototype.hasOwnProperty.call(payload, "value");
        if (metadataOnly) {
          const nextRegions = selectedRegionsRef.current.map((region) => (
            region.regionId === payload.regionId
              ? mergeRegionSelection(region, payload)
              : region
          ));
          if (nextRegions.length) {
            updateConnectedSelection(nextRegions);
            setConnectedSelectionVersion((version) => version + 1);
          }
          return;
        }

        const nextRegion = mergeRegionSelection(
          selectedRegionsRef.current.find((region) => (
            region.regionId === payload.regionId
          )) || null,
          payload
        );
        const alreadySelected = selectedRegionsRef.current.some((region) => (
          region.regionId === nextRegion?.regionId
        ));
        const additive = Boolean(payload.additive || additiveSelectionRequestRef.current);
        additiveSelectionRequestRef.current = false;
        const nextRegions = additive
          ? alreadySelected
            ? selectedRegionsRef.current.filter((region) => (
              region.regionId !== nextRegion.regionId
            ))
            : [...selectedRegionsRef.current, nextRegion]
          : [nextRegion];
        updateConnectedSelection(nextRegions);
        setConnectedSelectionVersion((version) => version + 1);
        setVisualError("");
        return;
      }

      if (!isPreview && message.type === "rcms/v1/field-update") {
        if (visualOnly && !connectedDraftHydratedRef.current) return;
        const payload = message.payload || {};
        if (!payload.regionId) return;
        const currentRegion = selectedRegionsRef.current.find((region) => (
          region.regionId === payload.regionId
        ));
        applyVisualValue({
          ...(currentRegion || {}),
          ...payload,
          value: currentRegion?.value
        }, payload.value, false);
      }
    };

    window.addEventListener("message", handleRuntimeMessage);
    return () => {
      active = false;
      window.removeEventListener("message", handleRuntimeMessage);
    };
  }, [
    applyVisualValue,
    isPreview,
    liveOrigin,
    livePageUrl,
    canvasRuntimePageId,
    onVisualChange,
    page?.route,
    page?.routeId,
    page?.slug,
    pageId,
    pageKey,
    runtimeWebsiteIdFallback,
    requestCanvasSEOScan,
    sendRuntimeMessage,
    updateConnectedSelection,
    visualOnly,
    websiteId
  ]);

  const handleFrameLoad = () => {
    connectedDraftHydratedRef.current = false;
    setFrameLoading(false);
    setLiveRouteError("");
    setRuntimeConnected(false);
    setCanvasSEOScan(null);
    sendRuntimeMessage(
      isPreview ? "rcms/v1/exit-edit-mode" : "rcms/v1/enter-edit-mode"
    );
  };

  const handleFrameError = () => {
    setFrameLoading(false);
    setRuntimeConnected(false);
    setLiveRouteError(
      "The connected page failed to load. Reload the route and check that the deployed site is available."
    );
  };

  useEffect(() => {
    if (!frameLoading || routeResolving || !livePageUrl) return undefined;
    const timeout = window.setTimeout(() => {
      setFrameLoading(false);
      setRuntimeConnected(false);
      setLiveRouteError((current) => current || (
        "The connected page did not become ready in time. Reload the route to try again."
      ));
    }, LIVE_FRAME_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [frameLoading, frameVersion, livePageUrl, routeResolving]);

  const publishConnectedSource = async () => {
    const result = await onPublish();
    if (result?.verified && !result?.deploymentPending && !visualOnly) {
      setFrameLoading(true);
      setFrameVersion((current) => current + 1);
    }
    return result;
  };

  const updateSelectedField = (field, nextFieldValue) => {
    if (!selectedRegion) return;
    const nextValue = updateRegionFieldValue(
      selectedRegion.type,
      selectedRegion.value,
      field,
      nextFieldValue
    );
    applyVisualValue(selectedRegion, nextValue);
  };

  const updateRepeaterJson = (rawValue) => {
    try {
      const nextValue = JSON.parse(rawValue);
      if (!Array.isArray(nextValue)) {
        throw new Error("Repeater content must be a JSON array.");
      }
      setVisualError("");
      applyVisualValue(selectedRegion, nextValue);
    } catch (error) {
      setVisualError(error.message || "Repeater content is not valid JSON.");
    }
  };

  const renderVisualInspector = (embedded = false) => {
    if (!selectedRegion) {
      return (
        <aside className={embedded
          ? "min-h-96 w-full bg-transparent grid place-items-center p-7 text-center"
          : "w-[320px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] grid place-items-center p-7 text-center"}
        >
          <div>
            <MousePointer2 className="w-8 h-8 mx-auto text-blue-400" />
            <h2 className="mt-4 text-sm font-bold text-white">Select a page element</h2>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Click an outlined text, image, button, or section in the live canvas.
            </p>
            {!runtimeConnected && (
              <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-4 text-amber-200/70">
                Waiting for the ReactCMS editing bridge. The live page still previews normally,
                but visual selection requires its SDK components.
              </p>
            )}
          </div>
        </aside>
      );
    }

    const value = selectedRegion.value;
    const textValue = typeof value === "object" && value !== null
      ? value.text || ""
      : value || "";
    const textStyleValue = typeof value === "object" && value !== null ? value : {};
    const selectedComputedStyle = selectedRegion.computedStyle || {};
    const fontSizeField = device === "mobile"
      ? "fontSizeMobile"
      : device === "tablet"
        ? "fontSizeTablet"
        : "fontSize";
    const inheritedFontSize = textStyleValue[fontSizeField]
      || textStyleValue.fontSize
      || selectedComputedStyle.fontSize
      || "";
    const numericFontSize = String(inheritedFontSize).match(/[\d.]+/)?.[0] || "";
    const textColor = textStyleValue.color || selectedComputedStyle.color || "#0f172a";
    const safeTextColor = /^#[0-9a-f]{6}$/i.test(textColor) ? textColor : "#0f172a";

    return (
      <aside className={embedded
        ? "w-full bg-transparent overflow-y-auto"
        : "w-[320px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] overflow-y-auto"}
      >
        <div className="h-12 px-4 border-b border-slate-800 flex items-center">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-400">
              {selectedRegion.type || "region"}
            </p>
            <p className="text-xs font-semibold text-white truncate">
              {selectedRegion.regionId}
            </p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {selectedRegion.type === "text" && (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Text
                </span>
                <textarea
                  value={textValue}
                  onChange={(event) => updateSelectedField("text", event.target.value)}
                  rows="5"
                  className="mt-2 w-full resize-y rounded-lg border border-slate-800 bg-[#070b14] p-3 text-xs leading-5 text-slate-200 outline-none focus:border-blue-500"
                />
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Manual style
                </p>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-500">Text colour</span>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="color"
                        value={safeTextColor}
                        onChange={(event) => updateSelectedField("color", event.target.value)}
                        className="h-9 w-11 cursor-pointer rounded-lg border border-slate-700 bg-[#070b14] p-1"
                        title="Choose text colour"
                      />
                      <input
                        value={textStyleValue.color || selectedComputedStyle.color || ""}
                        onChange={(event) => updateSelectedField("color", event.target.value)}
                        placeholder="#ff4f4f"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#070b14] px-3 font-mono text-xs text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      Font size
                      <span className="text-[9px] font-normal text-blue-400">
                        {device === "mobile" ? "Mobile" : device === "tablet" ? "Tablet" : "Desktop"}
                      </span>
                    </span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min="8"
                        max="240"
                        step="1"
                        value={numericFontSize}
                        onChange={(event) => updateSelectedField(
                          fontSizeField,
                          event.target.value ? `${event.target.value}px` : ""
                        )}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                      />
                      <span className="text-[10px] font-bold text-slate-600">px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="120"
                      step="1"
                      value={Math.min(120, Math.max(8, Number(numericFontSize) || 16))}
                      onChange={(event) => updateSelectedField(fontSizeField, `${event.target.value}px`)}
                      className="mt-2 h-1.5 w-full cursor-pointer accent-blue-500"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {selectedRegion.type === "richtext" && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                HTML content
              </span>
              <textarea
                value={typeof value === "string" ? value : value?.html || ""}
                onChange={(event) => updateSelectedField("html", event.target.value)}
                rows="8"
                spellCheck="false"
                className="mt-2 w-full resize-y rounded-lg border border-slate-800 bg-[#070b14] p-3 font-mono text-[11px] leading-5 text-slate-200 outline-none focus:border-blue-500"
              />
            </label>
          )}

          {selectedRegion.type === "button" && (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Label
                </span>
                <input
                  value={value?.text || ""}
                  onChange={(event) => updateSelectedField("text", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  URL
                </span>
                <input
                  value={value?.href || ""}
                  onChange={(event) => updateSelectedField("href", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
            </>
          )}

          {selectedRegion.type === "image" && (
            <>
              <ImagePicker
                label="Image URL"
                value={typeof value === "string" ? value : value?.src || ""}
                onChange={(url) => updateSelectedField("src", url)}
                placeholder="Enter URL or choose/upload an image"
              />
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Alt text
                </span>
                <input
                  value={typeof value === "object" ? value?.alt || "" : ""}
                  onChange={(event) => updateSelectedField("alt", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Width
                  </span>
                  <input
                    value={typeof value === "object" ? value?.width || "" : ""}
                    onChange={(event) => updateSelectedField("width", event.target.value)}
                    placeholder="100% or 320px"
                    className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Height
                  </span>
                  <input
                    value={typeof value === "object" ? value?.height || "" : ""}
                    onChange={(event) => updateSelectedField("height", event.target.value)}
                    placeholder="auto or 240px"
                    className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Image fit
                </span>
                <select
                  value={typeof value === "object" ? value?.objectFit || "" : ""}
                  onChange={(event) => updateSelectedField("objectFit", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">Default</option>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                  <option value="none">None</option>
                </select>
              </label>
            </>
          )}

          {selectedRegion.type === "video" && (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Video URL
                </span>
                <input
                  value={typeof value === "string" ? value : value?.url || ""}
                  onChange={(event) => updateSelectedField("url", event.target.value)}
                  placeholder="Video, YouTube, or Vimeo URL"
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Title
                </span>
                <input
                  value={typeof value === "object" ? value?.title || "" : ""}
                  onChange={(event) => updateSelectedField("title", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
            </>
          )}

          {selectedRegion.type === "section" && (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Background
                </span>
                <input
                  value={value?.background || ""}
                  onChange={(event) => updateSelectedField("background", event.target.value)}
                  placeholder="#ffffff or CSS background"
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Vertical padding
                </span>
                <input
                  type="number"
                  min="0"
                  value={value?.paddingY ?? ""}
                  onChange={(event) => updateSelectedField(
                    "paddingY",
                    event.target.value === "" ? 0 : Number(event.target.value)
                  )}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
            </>
          )}

          {selectedRegion.type === "repeater" && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Items (JSON)
              </span>
              <textarea
                key={`${selectedRegion.regionId}:${JSON.stringify(value)}`}
                defaultValue={JSON.stringify(Array.isArray(value) ? value : [], null, 2)}
                onBlur={(event) => updateRepeaterJson(event.target.value)}
                rows="14"
                spellCheck="false"
                className="mt-2 w-full resize-y rounded-lg border border-slate-800 bg-[#070b14] p-3 font-mono text-[10px] leading-5 text-slate-200 outline-none focus:border-blue-500"
              />
              <span className="mt-2 block text-[9px] leading-4 text-slate-600">
                Changes apply when this field loses focus.
              </span>
            </label>
          )}

          {![
            "text",
            "richtext",
            "button",
            "image",
            "video",
            "section",
            "repeater"
          ].includes(selectedRegion.type) && (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] leading-5 text-slate-500">
              This element does not expose editable ReactCMS source metadata.
              Wrap it with an Editable component before changing it visually.
            </p>
          )}

          {visualError && (
            <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <p className="text-[10px] leading-4 text-amber-200/70">
                {visualError} Open Code to edit the component that owns it.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <p className="text-[10px] leading-4 text-emerald-200/70">
              {visualOnly
                ? "Text, colour, and size overrides are saved to this page draft. The connected website continues to supply its base theme, header, and footer."
                : <>Supported changes update the connected source immediately. Use {isGitHub
                  ? " Update Git "
                  : isSftp
                    ? " Update StackCP "
                    : " Update cPanel "}
                when the page is ready to publish live.</>}
            </p>
          </div>
        </div>
      </aside>
    );
  };

  const getConnectedAIContext = useCallback(() => {
    const selectedRuntimeNodes = visualOnly
      ? selectedRegions.map((region) => (
        region?.type === "runtime-component" && isPageComponentTree(region.value)
          ? findNode(region.value, region.componentId)
          : null
      )).filter(Boolean)
      : [];
    return collectAIWebsiteContext({
      websiteId,
      runtimeWebsiteId,
      pageId,
      pageKey,
      locale,
      surface: visualOnly ? "connected-runtime" : "connected-source",
      page,
      website,
      tree: null,
      selectedNode: selectedRuntimeNodes.at(-1) || null,
      selectedNodes: selectedRuntimeNodes,
      selectedRegion,
      selectedRegions,
      pageSettings,
      theme,
      sourceFiles: visualOnly ? {} : getSourceFiles?.() || {},
      editorHistory: []
    });
  }, [
    getSourceFiles,
    locale,
    page,
    pageId,
    pageKey,
    pageSettings,
    selectedRegion,
    selectedRegions,
    theme,
    visualOnly,
    website,
    websiteId,
    runtimeWebsiteId
  ]);

  const applyConnectedAIPlan = useCallback(async (plan, context) => {
    const initialRegions = {
      ...(context?.currentPage?.editableRegionValues || {})
    };
    selectedRegions.forEach((region) => {
      if (region?.regionId) initialRegions[region.regionId] = region.value;
    });
    if (selectedRegion?.regionId) initialRegions[selectedRegion.regionId] = selectedRegion.value;
    let execution = applyAIPlan({
      plan,
      tree: visualOnly && isPageComponentTree(context?.currentPage?.componentTree)
        ? context.currentPage.componentTree
        : null,
      theme: context?.designSystem?.theme || theme || {},
      pageSettings: context?.currentPage?.settings || pageSettings || {},
      regions: initialRegions,
      sourceFiles: getSourceFiles?.() || {},
      blockedSourcePaths: Object.entries(context?.sourceProject?.files || {})
        .filter(([, fileContent]) => String(fileContent).includes("ReactCMS context truncated"))
        .map(([path]) => path),
      componentTypes: AI_COMPONENT_LIBRARY.map((component) => component.type),
      createNode: (type) => createVisualNode(type, locale)
    });
    if (visualOnly && isPageComponentTree(execution.tree)) {
      const nextRegions = {
        ...execution.regions,
        [RUNTIME_ADDITIONS_REGION]: execution.tree
      };
      execution = {
        ...execution,
        regions: nextRegions,
        after: {
          ...execution.after,
          regions: structuredClone(nextRegions)
        }
      };
    }
    const changedSourcePaths = Array.from(new Set([
      ...Object.keys(execution.before.sourceFiles || {}),
      ...Object.keys(execution.sourceFiles || {})
    ])).filter((path) => (
      execution.before.sourceFiles?.[path] !== execution.sourceFiles?.[path]
    ));
    const historyBefore = {
      ...execution.before,
      sourceFilesMode: "patch",
      sourceFiles: Object.fromEntries(changedSourcePaths.map((path) => [
        path,
        execution.before.sourceFiles?.[path] ?? null
      ]))
    };
    const historyAfter = {
      ...execution.after,
      sourceFilesMode: "patch",
      sourceFiles: Object.fromEntries(changedSourcePaths.map((path) => [
        path,
        execution.sourceFiles?.[path] ?? null
      ]))
    };
    stringifyAISnapshot(historyBefore);
    stringifyAISnapshot(historyAfter);

    if (JSON.stringify(execution.sourceFiles) !== JSON.stringify(execution.before.sourceFiles)) {
      onSourceFilesChange?.(execution.sourceFiles);
    }
    if (JSON.stringify(execution.theme) !== JSON.stringify(execution.before.theme)) {
      await onThemeChange?.(execution.theme);
      sendRuntimeMessage("rcms/v1/theme-update", execution.theme);
    }
    if (JSON.stringify(execution.pageSettings) !== JSON.stringify(execution.before.pageSettings)) {
      onPageSettingsChange?.(execution.pageSettings);
    }

    const regionDefinitions = context?.currentPage?.editableRegionDefinitions || {};
    for (const [regionId, value] of Object.entries(execution.regions)) {
      if (JSON.stringify(value) === JSON.stringify(initialRegions[regionId])) continue;
      const definition = regionDefinitions[regionId] || {};
      const selected = selectedRegions.find((region) => region.regionId === regionId)
        || (selectedRegion?.regionId === regionId ? selectedRegion : null);
      const change = {
        regionId,
        type: definition.type || selected?.type || "text",
        pageId: definition.pageId || selected?.pageId || canvasRuntimePageId || pageKey,
        runtimeWebsiteId,
        runtimeWebsiteIds: [runtimeWebsiteIdFallback],
        value
      };
      const changed = onVisualChange(change);
      if (!changed?.changed) {
        throw new Error(changed?.error || `Region "${regionId}" could not be updated.`);
      }
      updateConnectedSelection(selectedRegionsRef.current.map((region) => (
        region.regionId === regionId ? { ...region, value } : region
      )));
      sendRuntimeMessage("rcms/v1/field-update", change);
    }
    const saved = await onAIDraftSave?.(execution);
    if (saved === false) throw new Error("The Rocket AI page draft could not be saved.");

    const validationContext = {
      ...context,
      currentPage: {
        ...context.currentPage,
        settings: execution.pageSettings,
        draftContent: {
          ...(context.currentPage.draftContent || {}),
          regions: execution.regions
        }
      },
      designSystem: {
        ...context.designSystem,
        theme: execution.theme
      }
    };
    return {
      ...execution,
      before: historyBefore,
      after: historyAfter,
      validation: auditAIContext(validationContext)
    };
  }, [
    locale,
    getSourceFiles,
    onAIDraftSave,
    onPageSettingsChange,
    onSourceFilesChange,
    onThemeChange,
    onVisualChange,
    canvasRuntimePageId,
    pageKey,
    pageSettings,
    runtimeWebsiteId,
    runtimeWebsiteIdFallback,
    selectedRegion,
    selectedRegions,
    sendRuntimeMessage,
    theme,
    updateConnectedSelection,
    visualOnly
  ]);

  const rollbackConnectedAIPlan = useCallback(async (snapshot) => {
    if (!snapshot) throw new Error("The rollback snapshot is missing.");
    if (snapshot.sourceFiles) {
      const currentFiles = getSourceFiles?.() || {};
      const restoredFiles = snapshot.sourceFilesMode === "patch"
        ? { ...currentFiles }
        : { ...snapshot.sourceFiles };
      if (snapshot.sourceFilesMode === "patch") {
        Object.entries(snapshot.sourceFiles).forEach(([path, content]) => {
          if (content === null) delete restoredFiles[path];
          else restoredFiles[path] = content;
        });
      }
      onSourceFilesChange?.(restoredFiles);
    }
    if (snapshot.theme) {
      await onThemeChange?.(snapshot.theme);
      sendRuntimeMessage("rcms/v1/theme-update", snapshot.theme);
    }
    if (snapshot.pageSettings) onPageSettingsChange?.(snapshot.pageSettings);
    for (const [regionId, value] of Object.entries(snapshot.regions || {})) {
      const selected = selectedRegions.find((region) => region.regionId === regionId)
        || (selectedRegion?.regionId === regionId ? selectedRegion : {});
      const changed = onVisualChange({
        regionId,
        type: selected.type || "text",
        pageId: selected.pageId || canvasRuntimePageId || pageKey,
        runtimeWebsiteId,
        runtimeWebsiteIds: [runtimeWebsiteIdFallback],
        value
      });
      if (changed?.changed) {
        sendRuntimeMessage("rcms/v1/field-update", {
          regionId,
          pageId: selected.pageId || canvasRuntimePageId || pageKey,
          value
        });
      }
    }
    const saved = await onAIDraftSave?.(snapshot);
    if (saved === false) throw new Error("The restored page draft could not be saved.");
  }, [
    onAIDraftSave,
    getSourceFiles,
    onPageSettingsChange,
    onSourceFilesChange,
    onThemeChange,
    onVisualChange,
    canvasRuntimePageId,
    pageKey,
    runtimeWebsiteId,
    runtimeWebsiteIdFallback,
    selectedRegion,
    selectedRegions,
    sendRuntimeMessage
  ]);

  return (
    <div className="h-screen min-h-0 bg-[#070b14] text-slate-200 flex flex-col overflow-hidden">
      <VisualBuilderToolbar
        mode={mode}
        page={page}
        device={device}
        saveStatus={saveStatus}
        saving={saving}
        publishing={publishing}
        canUndo={connectedHistoryVersion >= 0 && connectedUndoRef.current.length > 0}
        canRedo={connectedHistoryVersion >= 0 && connectedRedoRef.current.length > 0}
        onBack={onBack}
        onDeviceChange={setDevice}
        onUndo={undoConnectedEdit}
        onRedo={redoConnectedEdit}
        onSave={onSave}
        onPublish={publishConnectedSource}
        onRepairLiveRoute={onRepairLiveRoute}
        onSettings={() => {}}
        onAIToggle={() => setAIOpen((value) => !value)}
        aiOpen={aiOpen}
        showSettings={false}
        publishLabel={visualOnly ? "Publish" : isGitHub ? "Update Git" : isSftp ? "Update StackCP" : "Update cPanel"}
      />

      <div className="h-11 px-4 border-b border-slate-800 bg-[#0a101d] flex items-center gap-3">
        {!isPreview && !visualOnly ? (
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/50 p-0.5">
            <button
              type="button"
              onClick={() => setWorkspaceMode("visual")}
              className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[10px] font-bold cursor-pointer ${
                workspaceMode === "visual"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode("code")}
              className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[10px] font-bold cursor-pointer ${
                workspaceMode === "code"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
          </div>
        ) : (
          <>
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isPreview ? "Live page preview" : "Connected website canvas"}
            </span>
          </>
        )}

        {workspaceMode === "code" && !isPreview && !visualOnly && (
          <>
            <span className="h-4 w-px bg-slate-800" />
            <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
            <code className="text-[10px] text-slate-400 truncate">{page?.sourceFile}</code>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {workspaceMode === "visual" && device === "custom" && (
            <label className="flex items-center gap-1.5">
              <Ruler className="w-3 h-3 text-slate-600" />
              <input
                type="number"
                min="280"
                max="1920"
                value={customWidth}
                onChange={(event) => setCustomWidth(Number(event.target.value))}
                className="w-16 h-6 rounded border border-slate-800 bg-slate-950/50 px-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500"
              />
            </label>
          )}
          {workspaceMode === "visual" && (
            <button
              type="button"
              onClick={() => {
                setFrameLoading(true);
                setFrameVersion((current) => current + 1);
              }}
              className="h-7 px-2.5 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-500 hover:text-white hover:bg-slate-900 flex items-center gap-1.5 cursor-pointer"
              title="Reload live page"
            >
              <RefreshCw className="w-3 h-3" />
              Reload
            </button>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <GitBranch className="w-3.5 h-3.5" />
            {website?.connection?.branch || website?.connection?.provider}
          </span>
        </div>
      </div>

      {!isPreview && isGitHub && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-slate-500" />
          <span className="shrink-0 text-[10px] font-bold text-slate-400">
            Publish token
          </span>
          <input
            type="password"
            value={writeToken}
            onChange={(event) => onWriteTokenChange(event.target.value)}
            placeholder="GitHub token with Contents: Read and write"
            autoComplete="new-password"
            className="h-8 flex-1 rounded-lg border border-slate-800 bg-[#080d18] px-3 text-[11px] text-slate-200 outline-none focus:border-blue-500"
          />
          <span className="hidden lg:inline text-[9px] text-slate-600">
            Saved automatically in this browser, never in Firebase
          </span>
        </div>
      )}

      {workspaceMode === "visual" || isPreview ? (
        <div className="flex-1 min-h-0 flex">
          <main
            ref={canvasViewportRef}
            className="flex-1 min-w-0 min-h-0 overflow-auto bg-[#080d18] p-4"
          >
            {routeResolving ? (
              <div className="h-full grid place-items-center">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Checking live page route...
                  </p>
                </div>
              </div>
            ) : !livePageUrl ? (
              <div className="h-full grid place-items-center">
                <div className="max-w-lg rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
                  <p className="text-sm font-bold text-white">Live page URL is not configured</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Add the connected site&apos;s live domain to open its real route in Preview.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="relative mx-auto shrink-0"
                style={{
                  width: `${canvasLayoutWidth}px`,
                  height: `${canvasLayoutHeight}px`
                }}
              >
                <div
                  className="relative min-h-[560px] overflow-hidden rounded-xl border border-slate-700 bg-white shadow-2xl shadow-black/40"
                  style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasFrameHeight}px`,
                    maxWidth: "none",
                    transform: `scale(${canvasScale})`,
                    transformOrigin: "top left"
                  }}
                >
                {frameLoading && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-white">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Loading live page…
                      </p>
                    </div>
                  </div>
                )}
                {liveRouteError && !frameLoading && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-[#080d18] p-8">
                    <div className="max-w-md rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                      <AlertCircle className="mx-auto h-7 w-7 text-amber-400" />
                      <p className="mt-3 text-sm font-bold text-white">
                        The live page could not be prepared
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        {liveRouteError}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setLiveRouteError("");
                          setFrameLoading(true);
                          setFrameVersion((current) => current + 1);
                        }}
                        className="mt-4 h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-bold text-white cursor-pointer"
                      >
                        Reload live route
                      </button>
                    </div>
                  </div>
                )}
                <iframe
                  key={`${renderedLivePageUrl}:${frameVersion}`}
                  ref={iframeRef}
                  src={renderedLivePageUrl}
                  title={`${page?.title || "Untitled Page"} live visual canvas`}
                  onLoad={handleFrameLoad}
                  onError={handleFrameError}
                  className="block h-full w-full border-0 bg-white"
                  sandbox={livePageIsCrossOrigin
                    ? "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    : "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"}
                  allow="clipboard-read; clipboard-write"
                />
                </div>
              </div>
            )}
          </main>
          {!isPreview && aiOpen && (
            <Suspense fallback={<aside className="h-full w-[400px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] 2xl:w-[440px]" />}>
              <AIWorkspace
                websiteId={websiteId}
                pageId={pageId}
                pageTitle={page?.title || "Untitled Page"}
                surface={visualOnly ? "connected-runtime" : "connected-source"}
                getContext={getConnectedAIContext}
                onApplyPlan={applyConnectedAIPlan}
                onRollback={rollbackConnectedAIPlan}
                renderInspector={() => renderVisualInspector(true)}
                inspectorSelectionKey={selectedRegions.map((region) => region.regionId).join("|")}
                inspectorSelectionVersion={connectedSelectionVersion}
                selectedTarget={selectedRegion}
                selectedTargets={selectedRegions}
                pageSettings={pageSettings}
                seoScan={canvasSEOScan}
                onRequestSEOScan={requestCanvasSEOScan}
                onSaveSEO={async (seo) => {
                  await onSaveSEO?.(seo);
                  sendRuntimeMessage("rcms/v1/seo-update", seo);
                }}
                onRequestAreaSelect={(options) => {
                  setWorkspaceMode("visual");
                  additiveSelectionRequestRef.current = Boolean(options?.additive);
                  if (!options?.additive) clearConnectedSelection();
                  sendRuntimeMessage("rcms/v1/enter-edit-mode");
                  sendRuntimeMessage("rcms/v1/enter-area-select");
                  window.setTimeout(() => iframeRef.current?.focus(), 0);
                }}
                onClearAreaSelection={() => {
                  sendRuntimeMessage("rcms/v1/exit-area-select");
                  clearConnectedSelection();
                }}
                onClose={() => {
                  sendRuntimeMessage("rcms/v1/exit-area-select");
                  setAIOpen(false);
                }}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <main className="flex-1 min-w-0 min-h-0 p-4 bg-[#080d18]">
            {loading ? (
              <div className="h-full grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className="h-full grid place-items-center">
                <div className="max-w-lg rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
                  <p className="text-sm font-bold text-white">Connected source could not be loaded</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{error}</p>
                </div>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(event) => onChange(event.target.value)}
                spellCheck="false"
                aria-label={`Source code for ${page?.title || "Untitled Page"}`}
                className="w-full h-full resize-none rounded-xl border border-slate-800 bg-[#050914] p-5 font-mono text-[12px] leading-5 text-slate-300 outline-none focus:border-blue-500"
              />
            )}
          </main>
          {aiOpen && (
            <Suspense fallback={<aside className="h-full w-[400px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] 2xl:w-[440px]" />}>
              <AIWorkspace
                websiteId={websiteId}
                pageId={pageId}
                pageTitle={page?.title || "Untitled Page"}
                surface="connected-source"
                getContext={getConnectedAIContext}
                onApplyPlan={applyConnectedAIPlan}
                onRollback={rollbackConnectedAIPlan}
                renderInspector={() => renderVisualInspector(true)}
                inspectorSelectionKey={selectedRegions.map((region) => region.regionId).join("|")}
                inspectorSelectionVersion={connectedSelectionVersion}
                selectedTarget={selectedRegion}
                selectedTargets={selectedRegions}
                pageSettings={pageSettings}
                seoScan={canvasSEOScan}
                onRequestSEOScan={requestCanvasSEOScan}
                onSaveSEO={async (seo) => {
                  await onSaveSEO?.(seo);
                  sendRuntimeMessage("rcms/v1/seo-update", seo);
                }}
                onRequestAreaSelect={(options) => {
                  setWorkspaceMode("visual");
                  additiveSelectionRequestRef.current = Boolean(options?.additive);
                  if (!options?.additive) clearConnectedSelection();
                  sendRuntimeMessage("rcms/v1/enter-edit-mode");
                  sendRuntimeMessage("rcms/v1/enter-area-select");
                  window.setTimeout(() => iframeRef.current?.focus(), 0);
                }}
                onClearAreaSelection={() => {
                  sendRuntimeMessage("rcms/v1/exit-area-select");
                  clearConnectedSelection();
                }}
                onClose={() => {
                  sendRuntimeMessage("rcms/v1/exit-area-select");
                  setAIOpen(false);
                }}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}

function buildInitialTree(page, document, locale, pageKey) {
  const localeData = page?.locales?.[locale] || {};
  if (isPageComponentTree(document?.tree)) return document.tree;
  if (isPageComponentTree(localeData.componentTree)) return localeData.componentTree;

  const blocks = document?.blocks?.length
    ? document.blocks
    : Array.isArray(localeData.blocks)
      ? localeData.blocks
      : [];
  if (blocks.length) {
    return blocksToPageTree(blocks, {
      id: pageKey,
      title: localeData.title || page?.title || "Untitled Page",
      locale
    });
  }

  if (Object.keys(document?.regions || {}).length) {
    return regionsToPageTree(document.regions, {
      id: pageKey,
      title: localeData.title || page?.title || "Untitled Page",
      locale
    });
  }

  return regionsToPageTree({}, {
    id: pageKey,
    title: localeData.title || page?.title || "Untitled Page",
    locale
  });
}

function NativeBuilderWorkspace({
  mode,
  websiteId,
  pageId,
  pageKey,
  website,
  page,
  pageTitle,
  locale,
  device,
  setDevice,
  customWidth,
  setCustomWidth,
  saveStatus,
  saving,
  publishing,
  pageSettings,
  revisions,
  revisionLoading,
  onBack,
  onSave,
  onAIDraftSave,
  onPublish,
  onOpenSettings,
  onTheme,
  onSaveTheme,
  theme,
  regions,
  onRegionsChange,
  settingsOpen,
  onCloseSettings,
  onApplySettings,
  onSaveSettings,
  onSaveSEO,
  onRestoreRevision
}) {
  const editor = useNativeEditor();
  const isPreview = mode === "preview";
  const [aiOpen, setAIOpen] = useState(true);
  const blocks = useMemo(() => pageTreeToBlocks(editor.tree), [editor.tree]);
  const importedSourceEmptyState = page?.isImported ? (
    <div className="max-w-lg px-8 py-10 text-center">
      <div className="mx-auto mb-4 h-10 w-10 rounded-xl border border-amber-300/40 bg-amber-50 text-amber-600 grid place-items-center text-lg">
        !
      </div>
      <h2 className="text-base font-bold text-slate-900">
        Native page artifact not available
      </h2>
      <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
        ReactCMS imported this route from the connected source, but the source
        has not produced an editor-safe component tree. No generated template
        or placeholder page is being substituted.
      </p>
      {page?.sourceFile && (
        <code className="mt-4 inline-block max-w-full truncate rounded-md bg-slate-100 px-2.5 py-1.5 text-[10px] text-slate-600">
          {page.sourceFile}
        </code>
      )}
    </div>
  ) : null;

  const addNode = useCallback((type, targetId = null, position = "after") => {
    const node = createVisualNode(type, locale);
    if (!node) return;
    editor.insert(node, targetId, position, `Add ${type}`);
  }, [editor, locale]);

  const getNativeAIContext = useCallback(() => collectAIWebsiteContext({
    websiteId,
    pageId,
    pageKey,
    locale,
    surface: "native",
    page,
    website,
    tree: editor.tree,
    selectedNode: editor.selectedNode,
    selectedNodes: editor.selectedIds
      .map((nodeId) => findNode(editor.tree, nodeId))
      .filter(Boolean),
    selectedRegion: null,
    selectedRegions: [],
    pageSettings,
    theme,
    regions,
    sourceFiles: {},
    editorHistory: editor.history
  }), [
    editor.history,
    editor.selectedIds,
    editor.selectedNode,
    editor.tree,
    locale,
    page,
    pageId,
    pageKey,
    pageSettings,
    regions,
    theme,
    website,
    websiteId
  ]);

  const applyNativeAIPlan = useCallback(async (plan, context) => {
    const execution = applyAIPlan({
      plan,
      tree: editor.tree,
      theme: context?.designSystem?.theme || theme || {},
      pageSettings: context?.currentPage?.settings || pageSettings || {},
      regions: regions || {},
      sourceFiles: {},
      componentTypes: AI_COMPONENT_LIBRARY.map((component) => component.type),
      createNode: (type) => createVisualNode(type, locale)
    });
    stringifyAISnapshot(execution.before);
    stringifyAISnapshot(execution.after);
    if (JSON.stringify(execution.tree) !== JSON.stringify(execution.before.tree)) {
      editor.replaceTree(execution.tree, `Rocket AI: ${plan.title}`);
    }
    if (JSON.stringify(execution.theme) !== JSON.stringify(execution.before.theme)) {
      await onSaveTheme(execution.theme);
    }
    if (JSON.stringify(execution.pageSettings) !== JSON.stringify(execution.before.pageSettings)) {
      onApplySettings(execution.pageSettings);
    }
    if (JSON.stringify(execution.regions) !== JSON.stringify(execution.before.regions)) {
      onRegionsChange(execution.regions);
    }
    const saved = await onAIDraftSave(execution);
    if (saved === false) throw new Error("The Rocket AI page draft could not be saved.");
    const validationContext = {
      ...context,
      currentPage: {
        ...context.currentPage,
        componentTree: execution.tree,
        settings: execution.pageSettings
      },
      designSystem: {
        ...context.designSystem,
        theme: execution.theme
      }
    };
    return {
      ...execution,
      validation: auditAIContext(validationContext)
    };
  }, [
    editor,
    locale,
    onApplySettings,
    onAIDraftSave,
    onRegionsChange,
    onSaveTheme,
    pageSettings,
    regions,
    theme
  ]);

  const rollbackNativeAIPlan = useCallback(async (snapshot) => {
    if (!snapshot?.tree) throw new Error("The component-tree rollback snapshot is missing.");
    editor.replaceTree(snapshot.tree, "Rollback Rocket AI changes");
    if (snapshot.theme) await onSaveTheme(snapshot.theme);
    if (snapshot.pageSettings) onApplySettings(snapshot.pageSettings);
    if (snapshot.regions) onRegionsChange(snapshot.regions);
    const saved = await onAIDraftSave(snapshot);
    if (saved === false) throw new Error("The restored page draft could not be saved.");
  }, [editor, onAIDraftSave, onApplySettings, onRegionsChange, onSaveTheme]);

  return (
    <div className="h-screen min-h-0 bg-[#070b14] text-slate-200 flex flex-col overflow-hidden">
      <VisualBuilderToolbar
        mode={mode}
        page={{ ...page, title: pageTitle }}
        device={device}
        customWidth={customWidth}
        saveStatus={saveStatus}
        saving={saving}
        publishing={publishing}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onBack={onBack}
        onDeviceChange={setDevice}
        onCustomWidthChange={setCustomWidth}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSave={onSave}
        onPublish={onPublish}
        onSettings={onOpenSettings}
        onTheme={onTheme}
        onAIToggle={() => setAIOpen((value) => !value)}
        aiOpen={aiOpen}
      />

      <div className="flex-1 min-h-0 flex">
        {!isPreview && (
          <NativeLayersPanel
            tree={editor.tree}
            pageTitle={pageTitle}
            selectedIds={editor.selectedIds}
            onSelect={editor.select}
            onMove={editor.move}
            onDuplicate={editor.duplicate}
            onDelete={editor.remove}
            onToggleHidden={editor.toggleHidden}
            onToggleLocked={editor.toggleLocked}
            onAdd={addNode}
          />
        )}

        <main className="flex-1 min-w-0 min-h-0 bg-[#080d18] flex flex-col">
          <div className="h-10 px-3 flex items-center gap-2 border-b border-slate-800/80 bg-[#0a101d]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Native Canvas
            </span>
            <span className="text-[9px] text-slate-700">/</span>
            <span className="text-[10px] text-slate-600">
              {device === "custom" ? customWidth : CANVAS_DEVICE_WIDTHS[device]}px
            </span>

            {!isPreview && editor.breadcrumbs.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 ml-3 min-w-0">
                <span className="text-[9px] text-slate-700">Page</span>
                {editor.breadcrumbs.map((node) => (
                  <React.Fragment key={node.id}>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-800" />
                    <button
                      type="button"
                      onClick={() => editor.select(node.id)}
                      className="text-[9px] text-slate-600 hover:text-blue-300 truncate max-w-24 cursor-pointer"
                    >
                      {node.label || node.type}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {device === "custom" && (
                <label className="flex items-center gap-1.5">
                  <Ruler className="w-3 h-3 text-slate-600" />
                  <input
                    type="number"
                    min="280"
                    max="1920"
                    value={customWidth}
                    onChange={(event) => setCustomWidth(Number(event.target.value))}
                    className="w-16 h-6 rounded border border-slate-800 bg-slate-950/50 px-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500"
                  />
                </label>
              )}
              {!isPreview && (
                <button
                  type="button"
                  onClick={onTheme}
                  className="h-7 px-2.5 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-500 hover:text-white hover:bg-slate-900 flex items-center gap-1.5 cursor-pointer"
                  title="Open Theme Builder"
                >
                  <Palette className="w-3 h-3" />
                  Theme
                </button>
              )}
            </div>
          </div>

          <NativeCanvas
            tree={editor.tree}
            theme={theme}
            locale={locale}
            mode={isPreview ? "preview" : "edit"}
            responsiveMode={device}
            customWidth={customWidth}
            selectedIds={editor.selectedIds}
            hoveredId={editor.hoveredId}
            onSelect={editor.select}
            onSelectMany={editor.selectMany}
            onHover={editor.hover}
            onMutation={editor.mutate}
            onMove={editor.move}
            onInsert={addNode}
            onCommand={editor.command}
            emptyState={importedSourceEmptyState}
            className="flex-1 min-h-0"
          />
        </main>

        {!isPreview && aiOpen && (
          <Suspense fallback={<aside className="w-[400px] border-l border-slate-800 bg-[#0b1120]" />}>
            <AIWorkspace
              websiteId={websiteId}
              pageId={pageId}
              pageTitle={pageTitle}
              surface="native"
              getContext={getNativeAIContext}
              onApplyPlan={applyNativeAIPlan}
              onRollback={rollbackNativeAIPlan}
              onInsertComponent={addNode}
              inspectorSelectionKey={editor.selectedIds.join("|")}
              selectedTarget={editor.selectedNode}
              selectedTargets={editor.selectedIds
                .map((nodeId) => findNode(editor.tree, nodeId))
                .filter(Boolean)}
              pageSettings={pageSettings}
              onSaveSEO={onSaveSEO}
              onRequestAreaSelect={(options) => {
                if (!options?.additive) editor.clearSelection();
              }}
              onClearAreaSelection={editor.clearSelection}
              renderInspector={() => (
                <NativeInspector
                  embedded
                  node={editor.selectedNode}
                  locale={locale}
                  responsiveMode={device}
                  onUpdate={(updatedNode) => editor.update(
                    updatedNode.id,
                    () => updatedNode,
                    "Edit component"
                  )}
                  onClose={editor.clearSelection}
                />
              )}
              onClose={() => setAIOpen(false)}
            />
          </Suspense>
        )}
      </div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <VisualPageSettingsModal
            isOpen
            settings={pageSettings}
            blocks={blocks}
            revisions={revisions}
            revisionLoading={revisionLoading}
            onClose={onCloseSettings}
            onChange={onApplySettings}
            onSave={onSaveSettings}
            onRestoreRevision={onRestoreRevision}
          />
        </Suspense>
      )}
    </div>
  );
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
  const { activeLocale } = useLocale(websiteId);
  const {
    revisions,
    loading: revisionLoading,
    loadRevisions,
    restoreRevision
  } = useRevisions();
  const { user } = useAuth();
  const toast = useToast();

  const [initialTree, setInitialTree] = useState(null);
  const [legacyRegions, setLegacyRegions] = useState({});
  const [pageSettings, setPageSettings] = useState({
    title: "",
    slug: "",
    route: "",
    layout: "default",
    seo: {}
  });
  const [device, setDevice] = useState("desktop");
  const [customWidth, setCustomWidth] = useState(960);
  const [loadError, setLoadError] = useState("");
  const [nativeLoading, setNativeLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeTokens, setThemeTokens] = useState(null);
  const [sourceWebsite, setSourceWebsite] = useState(null);
  const [sourceWebsiteLoading, setSourceWebsiteLoading] = useState(true);
  const [sourceContent, setSourceContent] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceSaveStatus, setSourceSaveStatus] = useState("saved");
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourcePublishing, setSourcePublishing] = useState(false);
  const [sourceWriteToken, setSourceWriteToken] = useState("");
  const [connectedSaveStatus, setConnectedSaveStatus] = useState("saved");
  const [connectedSaving, setConnectedSaving] = useState(false);
  const [connectedPublishing, setConnectedPublishing] = useState(false);
  const [showRouteRepair, setShowRouteRepair] = useState(false);

  const treeRef = useRef(null);
  const pageRef = useRef(null);
  const settingsRef = useRef(pageSettings);
  const regionsRef = useRef({});
  const changeVersionRef = useRef(0);
  const loadedIdentityRef = useRef("");
  const sourceFilesRef = useRef({});
  const sourceDirtyPathsRef = useRef(new Set());
  const connectedWritesRef = useRef(new Set());
  const connectedPublishTargetsRef = useRef(new Map());
  const connectedPublishingRef = useRef(false);

  const pageKey = useMemo(
    () => visualBuilderService.resolvePageKey(selectedPage),
    [selectedPage]
  );

  useEffect(() => {
    if (!websiteId || !pageId) return;
    fetchPageById(websiteId, pageId);
  }, [fetchPageById, pageId, websiteId]);

  useEffect(() => {
    if (!websiteId) return undefined;
    return themeService.subscribeTheme(websiteId, setThemeTokens);
  }, [websiteId]);

  useEffect(() => {
    pageRef.current = selectedPage;
  }, [selectedPage]);

  useEffect(() => {
    if (!websiteId) return undefined;
    let cancelled = false;
    setSourceWebsiteLoading(true);
    websiteService.getById(websiteId)
      .then((website) => {
        if (cancelled) return;
        setSourceWebsite(website);
        setSourceWriteToken(
          sourceCredentialService.get(websiteId).token || ""
        );
      })
      .catch((error) => {
        if (!cancelled) console.error("Connected website could not be loaded", error);
      })
      .finally(() => {
        if (!cancelled) setSourceWebsiteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  const isConnectedSourcePage = Boolean(
    selectedPage?.isImported
    && selectedPage?.nativeArtifactStatus === "source-only"
    && selectedPage?.sourceFile
  );
  const isConnectedCmsPage = shouldUseConnectedWebsiteCanvas(
    sourceWebsite,
    selectedPage
  );

  useEffect(() => {
    if (!isConnectedSourcePage || !websiteId || !pageId) return undefined;
    let cancelled = false;
    const loadSource = async () => {
      setSourceLoading(true);
      setSourceError("");
      sourceFilesRef.current = {};
      sourceDirtyPathsRef.current = new Set();
      try {
        const website = await websiteService.getById(websiteId);
        if (!website) throw new Error("The connected website record was not found.");
        const source = await sourceProviderService.readFile(
          website,
          selectedPage.sourceFile
        );
        const sourceFiles = await loadConnectedSourceGraph(
          website,
          selectedPage.sourceFile,
          source.content
        );
        if (cancelled) return;
        const legacyDraft = sessionStorage.getItem(
          sourceDraftKey(websiteId, pageId)
        );
        let fileDrafts = {};
        try {
          fileDrafts = JSON.parse(
            sessionStorage.getItem(sourceFilesDraftKey(websiteId, pageId)) || "{}"
          );
        } catch {
          fileDrafts = {};
        }
        if (legacyDraft !== null) {
          fileDrafts[selectedPage.sourceFile] = legacyDraft;
        }
        const nextSourceFiles = {
          ...sourceFiles,
          ...fileDrafts
        };
        sourceFilesRef.current = nextSourceFiles;
        sourceDirtyPathsRef.current = new Set(Object.keys(fileDrafts));
        setSourceWebsite(website);
        setSourceContent(
          nextSourceFiles[selectedPage.sourceFile] || source.content
        );
        setSourceWriteToken(
          sourceCredentialService.get(websiteId).token || ""
        );
        setSourceSaveStatus(
          Object.keys(fileDrafts).length ? "unsaved" : "saved"
        );
      } catch (error) {
        if (!cancelled) setSourceError(error.message || "Source file could not be loaded.");
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };
    loadSource();
    return () => {
      cancelled = true;
    };
  }, [
    isConnectedSourcePage,
    pageId,
    selectedPage?.sourceFile,
    websiteId
  ]);

  useEffect(() => {
    settingsRef.current = pageSettings;
  }, [pageSettings]);

  useEffect(() => {
    if (!selectedPage || selectedPage.id !== pageId || !websiteId || !pageKey) return;
    const identity = `${websiteId}:${pageId}:${activeLocale}:${pageKey}`;
    if (loadedIdentityRef.current === identity) return;
    loadedIdentityRef.current = identity;
    let cancelled = false;

    const loadNativeDocument = async () => {
      setNativeLoading(true);
      setLoadError("");
      try {
        const { draft } = await visualBuilderService.loadNativePage(
          websiteId,
          pageKey,
          {
            pageId,
            routeId: selectedPage.routeId,
            slug: selectedPage.slug,
            route: selectedPage.route
          }
        );
        if (cancelled) return;
        const localeData = selectedPage.locales?.[activeLocale] || {};
        const tree = buildInitialTree(selectedPage, draft, activeLocale, pageKey);
        const settings = {
          title: localeData.title || selectedPage.title || "Untitled Page",
          slug: localeData.slug || selectedPage.slug || "",
          route: selectedPage.route || (selectedPage.slug === "home" ? "/" : `/${selectedPage.slug || ""}`),
          layout: selectedPage.layout || "default",
          seo: localeData.seo || {}
        };

        treeRef.current = tree;
        regionsRef.current = draft.regions || {};
        settingsRef.current = settings;
        setInitialTree(tree);
        setLegacyRegions(draft.regions || {});
        setPageSettings(settings);
        changeVersionRef.current = 0;
        setSaveStatus("saved");
      } catch (error) {
        console.error(error);
        setLoadError("ReactCMS could not load the native page document.");
      } finally {
        if (!cancelled) setNativeLoading(false);
      }
    };

    loadNativeDocument();
    return () => {
      cancelled = true;
    };
  }, [activeLocale, pageId, pageKey, selectedPage, websiteId]);

  const handleTreeChange = useCallback((tree) => {
    treeRef.current = tree;
    changeVersionRef.current += 1;
    setSaveStatus((current) => current === "saving" ? current : "unsaved");
  }, []);

  const performSave = useCallback(async ({ manual = false, settingsOverride } = {}) => {
    const page = pageRef.current;
    const tree = treeRef.current;
    if (!page || !tree) return false;
    const savingVersion = changeVersionRef.current;
    const settings = settingsOverride || settingsRef.current;
    const currentPageKey = visualBuilderService.resolvePageKey(page);
    const blocks = pageTreeToBlocks(tree);
    setSaving(true);
    setSaveStatus("saving");

    try {
      await visualBuilderService.saveDraft({
        websiteId,
        pageId,
        pageKey: currentPageKey,
        locale: activeLocale,
        page,
        pageSettings: settings,
        regions: regionsRef.current,
        blocks,
        tree
      });

      if (manual) {
        await revisionService.save(
          websiteId,
          "page",
          pageId,
          {
            ...page,
            title: settings.title,
            slug: settings.slug,
            route: settings.route,
            componentTree: tree,
            visualRegions: regionsRef.current,
            locales: {
              ...(page.locales || {}),
              [activeLocale]: {
                ...(page.locales?.[activeLocale] || {}),
                title: settings.title,
                slug: settings.slug,
                seo: settings.seo,
                blocks,
                componentTree: tree
              }
            }
          },
          user?.email || user?.uid
        );
      }

      setSaveStatus(
        changeVersionRef.current === savingVersion ? "saved" : "unsaved"
      );
      return true;
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      if (manual) toast.error(error.message || "Draft could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [activeLocale, pageId, toast, user, websiteId]);

  useEffect(() => {
    if (isPreview || saveStatus !== "unsaved" || !initialTree) return undefined;
    const timer = window.setTimeout(() => performSave({ manual: false }), 2200);
    return () => window.clearTimeout(timer);
  }, [initialTree, isPreview, performSave, saveStatus]);

  const publish = async () => {
    setPublishing(true);
    try {
      const saved = await performSave({ manual: true });
      if (!saved) return;
      const page = pageRef.current;
      const currentPageKey = visualBuilderService.resolvePageKey(page);

      let providerResult = null;
      let generatedSourceFile = null;
      if (sourceWebsite?.connection?.sourceMode === "provider") {
        const framework = String(sourceWebsite.framework || "").toLowerCase();
        if (!framework.includes("react") && !framework.includes("vite")) {
          throw new Error(
            "Automatic new-page source generation currently supports connected React/Vite projects."
          );
        }
        const credentials = sourceCredentialService.get(websiteId);
        if (
          sourceWebsite.connection.provider === "github"
          && !credentials.token
        ) {
          throw new Error(
            "Enter a GitHub token with Contents: Read and write permission when connecting the website."
          );
        }

        generatedSourceFile = reactPageSourcePath(
          settingsRef.current.slug || page.slug
        );
        const component = reactPageComponentName(
          settingsRef.current.slug || page.slug
        );
        const componentSource = generateReactPageSource({
          title: settingsRef.current.title || page.title,
          slug: settingsRef.current.slug || page.slug,
          blocks: pageTreeToBlocks(treeRef.current),
          locale: activeLocale
        });
        const routerFile = "src/App.jsx";
        const router = await sourceProviderService.readFile(
          sourceWebsite,
          routerFile
        );
        const routerSource = patchReactStateRouter(router.content, {
          title: settingsRef.current.title || page.title,
          slug: settingsRef.current.slug || page.slug,
          component,
          importPath: `./pages/${component}.jsx`
        });
        providerResult = await sourceProviderService.writeFiles(
          sourceWebsite,
          [
            { path: generatedSourceFile, content: componentSource },
            { path: routerFile, content: routerSource }
          ],
          `Publish ${settingsRef.current.title || page.title} from ReactCMS`
        );
      }

      await visualBuilderService.publish({
        websiteId,
        pageId,
        pageKey: currentPageKey,
        routeId: page?.routeId || page?.slug
      });
      if (providerResult) {
        await pageService.updateSourceMetadata(websiteId, pageId, {
          sourceProvider: providerResult.provider,
          sourceFile: generatedSourceFile,
          sourceRouterFile: "src/App.jsx",
          sourceRevision: providerResult.revision
        });
      }
      setSelectedPage((current) => current ? {
        ...current,
        sourceProvider: providerResult?.provider || current.sourceProvider,
        sourceFile: generatedSourceFile || current.sourceFile,
        sourceRouterFile: providerResult ? "src/App.jsx" : current.sourceRouterFile,
        sourceRevision: providerResult?.revision || current.sourceRevision,
        status: "published",
        publishedAt: Date.now()
      } : current);
      toast.success(
        providerResult?.provider === "github"
          ? "Page committed to GitHub. The connected deployment can now rebuild."
          : providerResult?.provider === "cpanel"
            ? "Page source and route saved directly to cPanel."
            : providerResult?.provider === "sftp"
              ? "Page source and route saved directly to StackCP through SFTP."
              : "Native page published. Connected runtimes will refresh automatically."
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Page publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const applyPageSettings = (settings) => {
    settingsRef.current = settings;
    setPageSettings(settings);
    changeVersionRef.current += 1;
    setSaveStatus("unsaved");
  };

  const savePageSEOSettings = async (seo) => {
    const page = pageRef.current;
    if (!page) throw new Error("The current page is not ready.");
    await visualBuilderService.savePageSEO({
      websiteId,
      pageId,
      pageKey: visualBuilderService.resolvePageKey(page),
      locale: activeLocale,
      page,
      seo
    });

    const nextSettings = {
      ...settingsRef.current,
      seo
    };
    settingsRef.current = nextSettings;
    setPageSettings(nextSettings);
    setSelectedPage((current) => current ? {
      ...current,
      seo,
      locales: {
        ...(current.locales || {}),
        [activeLocale]: {
          ...(current.locales?.[activeLocale] || {}),
          seo
        }
      }
    } : current);
    toast.success("Page SEO draft saved.");
    return seo;
  };

  const savePageSettings = async (settings) => {
    settingsRef.current = settings;
    setPageSettings(settings);
    const saved = await performSave({ manual: true, settingsOverride: settings });
    if (!saved) return;

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
            blocks: pageTreeToBlocks(treeRef.current),
            componentTree: treeRef.current
          }
        }
      };
    });
    setSettingsOpen(false);
  };

  const restorePageRevision = async (revisionId) => {
    try {
      const snapshot = await restoreRevision(websiteId, "page", pageId, revisionId);
      const localeData = snapshot.locales?.[activeLocale] || {};
      let tree = localeData.componentTree || snapshot.componentTree;
      if (!isPageComponentTree(tree)) {
        tree = blocksToPageTree(localeData.blocks || snapshot.blocks || [], {
          id: pageKey,
          title: localeData.title || snapshot.title,
          locale: activeLocale
        });
      }

      const settings = {
        title: localeData.title || snapshot.title || pageSettings.title,
        slug: localeData.slug || snapshot.slug || pageSettings.slug,
        route: snapshot.route || pageSettings.route,
        layout: snapshot.layout || pageSettings.layout,
        seo: localeData.seo || pageSettings.seo
      };
      treeRef.current = tree;
      regionsRef.current = snapshot.visualRegions || legacyRegions;
      settingsRef.current = settings;
      setInitialTree(structuredClone(tree));
      setLegacyRegions(regionsRef.current);
      setPageSettings(settings);
      changeVersionRef.current += 1;
      setSaveStatus("unsaved");
      setSettingsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Revision could not be restored.");
    }
  };

  const saveSourceDraft = useCallback(async () => {
    setSourceSaving(true);
    setSourceSaveStatus("saving");
    try {
      const dirtyFiles = Object.fromEntries(
        Array.from(sourceDirtyPathsRef.current).map((path) => [
          path,
          sourceFilesRef.current[path]
        ])
      );
      sessionStorage.setItem(
        sourceFilesDraftKey(websiteId, pageId),
        JSON.stringify(dirtyFiles)
      );
      sessionStorage.removeItem(sourceDraftKey(websiteId, pageId));
      setSourceSaveStatus("saved");
      toast.success("Source file drafts saved in this browser session.");
      return true;
    } catch (error) {
      setSourceSaveStatus("error");
      toast.error(error.message || "Source draft could not be saved.");
      return false;
    } finally {
      setSourceSaving(false);
    }
  }, [pageId, toast, websiteId]);

  const publishSource = async () => {
    if (!sourceWebsite) return;
    if (sourceWebsite.connection?.provider === "github") {
      const token = sourceWriteToken.trim()
        || sourceCredentialService.get(websiteId).token;
      if (!token) {
        toast.error(
          "Enter a GitHub token with Contents: Read and write permission in the Publish token field."
        );
        return;
      }
      sourceCredentialService.rememberGitHub(websiteId, token);
    }

    setSourcePublishing(true);
    try {
      const dirtyPaths = Array.from(sourceDirtyPathsRef.current);
      const provider = sourceWebsite.connection?.provider;
      const directHostingProvider = provider === "sftp" || provider === "cpanel";
      const publishPaths = dirtyPaths.length
        ? dirtyPaths
        : directHostingProvider && selectedPage.sourceFile
          ? [selectedPage.sourceFile]
          : [];
      const result = publishPaths.length
        ? await sourceProviderService.writeFiles(
          sourceWebsite,
          publishPaths.map((path) => ({
            path,
            content: sourceFilesRef.current[path]
              ?? (path === selectedPage.sourceFile ? sourceContent : "")
          })),
          `Update ${selectedPage.title} from ReactCMS`
        )
        : {
          provider,
          revision: selectedPage.sourceRevision || null,
          files: []
        };
      const pageSyncKey = selectedPage.route === "/"
        ? "home"
        : String(selectedPage.route || selectedPage.slug || "home")
          .replace(/^\/+|\/+$/g, "") || "home";
      const contentPublished = await contentSyncService.publishDraft(
        websiteId,
        pageSyncKey
      );
      const publishedAt = await pageService.markPublished(
        websiteId,
        pageId,
        selectedPage.routeId
      );
      sessionStorage.removeItem(sourceDraftKey(websiteId, pageId));
      sessionStorage.removeItem(sourceFilesDraftKey(websiteId, pageId));
      sourceDirtyPathsRef.current = new Set();
      setSourceSaveStatus("saved");
      setSelectedPage((current) => current ? {
        ...current,
        sourceRevision: result.revision,
        status: "published",
        publishedAt
      } : current);
      toast.success(
        result.provider === "github"
          ? `${dirtyPaths.length} source file${dirtyPaths.length === 1 ? "" : "s"} committed to GitHub. The connected deployment can now rebuild.`
          : result.provider === "sftp"
            ? publishPaths.length
              ? `Verified ${publishPaths.length} StackCP source file${publishPaths.length === 1 ? "" : "s"}${result.runtimeRebound ? ", connected the live runtime" : ""}${result.cacheBusted ? ", and refreshed the deployed asset cache" : ""}.`
              : contentPublished
                ? "Published the saved page content; no source files had pending changes."
                : "Marked the page published; no source files had pending changes."
            : publishPaths.length
              ? `Verified ${publishPaths.length} cPanel source file${publishPaths.length === 1 ? "" : "s"}${result.runtimeRebound ? ", connected the live runtime" : ""}${result.cacheBusted ? ", and refreshed the deployed asset cache" : ""}.`
              : contentPublished
                ? "Published the saved page content; no source files had pending changes."
                : "Marked the page published; no source files had pending changes."
      );
      return result;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Connected source publish failed.");
      return null;
    } finally {
      setSourcePublishing(false);
    }
  };

  const patchSourceFromVisual = useCallback((change) => {
    for (const [path, content] of Object.entries(sourceFilesRef.current)) {
      const result = patchEditableRegionSource(
        content,
        change.regionId,
        change.value
      );
      if (!result.changed) continue;

      sourceFilesRef.current = {
        ...sourceFilesRef.current,
        [path]: result.content
      };
      sourceDirtyPathsRef.current.add(path);
      if (path === selectedPage.sourceFile) {
        setSourceContent(result.content);
      }
      setSourceSaveStatus("unsaved");
      return {
        ...result,
        sourceFile: path
      };
    }

    return {
      content: "",
      changed: false,
      error: `Region "${change.regionId}" was not found in the loaded page components.`
    };
  }, [selectedPage?.sourceFile]);

  const persistConnectedRegion = useCallback((change) => {
    if (!websiteId || !pageKey || !change.regionId) {
      return { changed: false, error: "The connected page draft is not ready." };
    }

    setConnectedSaveStatus("saving");
    const regionIds = connectedRegionAliases(pageKey, change.regionId);
    regionsRef.current = regionIds.reduce((regions, regionId) => ({
      ...regions,
      [regionId]: change.value
    }), regionsRef.current);
    setLegacyRegions(regionsRef.current);
    const targets = connectedDraftTargets({
      websiteId,
      pageKey,
      runtimeWebsiteId: change.runtimeWebsiteId,
      runtimeWebsiteIds: change.runtimeWebsiteIds,
      runtimePageId: change.pageId,
      pageAliases: [
        pageId,
        selectedPage?.id,
        selectedPage?.routeId,
        selectedPage?.slug,
        selectedPage?.route
      ],
      regionId: change.regionId
    });
    targets.forEach((target) => {
      connectedPublishTargetsRef.current.set(target.key, target);
    });
    const write = Promise.all(
      regionIds.map((regionId) => visualBuilderService.persistRegionTargets(
        targets,
        regionId,
        change.value
      ))
    );
    connectedWritesRef.current.add(write);
    write
      .then(() => {
        if (connectedWritesRef.current.size === 1) {
          setConnectedSaveStatus("saved");
        }
      })
      .catch((error) => {
        console.error(error);
        setConnectedSaveStatus("error");
        toast.error(error.message || "The connected page draft could not be saved.");
      })
      .finally(() => {
        connectedWritesRef.current.delete(write);
      });

    return { changed: true };
  }, [
    pageId,
    pageKey,
    selectedPage?.id,
    selectedPage?.route,
    selectedPage?.routeId,
    selectedPage?.slug,
    toast,
    websiteId
  ]);

  const saveConnectedDraft = useCallback(async (showToast = true) => {
    setConnectedSaving(true);
    try {
      await Promise.all(Array.from(connectedWritesRef.current));
      setConnectedSaveStatus("saved");
      if (showToast) toast.success("Connected page draft saved.");
      return true;
    } catch (error) {
      console.error(error);
      setConnectedSaveStatus("error");
      toast.error(error.message || "The connected page draft could not be saved.");
      return false;
    } finally {
      setConnectedSaving(false);
    }
  }, [toast]);

  const publishConnectedPage = useCallback(async () => {
    if (connectedPublishingRef.current) return null;
    connectedPublishingRef.current = true;
    setConnectedPublishing(true);
    try {
      const saved = await saveConnectedDraft(false);
      if (!saved) return null;

      const publishesToGit = Boolean(
        sourceWebsite?.connection?.provider === "github"
        && sourceWebsite?.connection?.sourceMode === "provider"
        && sourceWebsite?.connection?.writebackEnabled !== false
      );
      if (publishesToGit) {
        const token = sourceWriteToken.trim()
          || sourceCredentialService.get(websiteId).token;
        if (!token) {
          throw new Error(
            "Enter a GitHub token with Contents: Read and write permission in the Publish token field above the canvas."
          );
        }
        sourceCredentialService.rememberGitHub(websiteId, token);
      }
      let gitPublish = null;
      let spaRouting = {
        changed: false,
        configured: false,
        deploymentPending: false
      };
      if (publishesToGit) {
        const editableRegions = await registryService.getEditableRegions(websiteId);
        const gitRegions = selectGitContentRegions(
          regionsRef.current,
          editableRegions?.[pageKey] || {}
        );
        if (!Object.keys(gitRegions).length) {
          throw new Error("No registered page fields are ready for the Git publish.");
        }
        gitPublish = await sourceProviderService.writeContentManifest(
          sourceWebsite,
          pageKey,
          gitRegions
        );
        spaRouting = {
          changed: gitPublish.changed,
          configured: true,
          deploymentPending: gitPublish.deploymentPending
        };
      } else if (sourceWebsite) {
        // Visual-only client publishing writes editable content to Firebase.
        // SFTP/cPanel credentials are deliberately session-only and normally
        // unavailable in a client's browser, so do not block content publish
        // merely because the already-configured routing file cannot be checked.
        spaRouting = await sourceProviderService.ensureSpaRouting(sourceWebsite, {
          skipIfCredentialsUnavailable: true
        });
        if (spaRouting.skipped) {
          try {
            const verifiedRouting = await sourceProviderService
              .verifyExistingLiveRouting(sourceWebsite);
            spaRouting = {
              ...spaRouting,
              ...verifiedRouting,
              skipped: false,
              reason: null
            };

            const nextConnection = {
              ...sourceWebsite.connection,
              spaRoutingConfigured: verifiedRouting.configured,
              routeDeletionGuardConfigured: verifiedRouting.deletionGuardConfigured,
              publishedStyleBridgeConfigured: verifiedRouting.publishedStyleBridgeConfigured,
              spaRoutingPath: verifiedRouting.path,
              spaRoutingUpdatedAt: Date.now()
            };
            try {
              const updatedWebsite = await websiteService.update(websiteId, {
                connectionHealth: "healthy",
                connection: nextConnection
              });
              setSourceWebsite(updatedWebsite);
            } catch (statusError) {
              // Publishing is still safe after a successful live verification.
              // A status write failure should not force the customer to reload
              // the working canvas or enter hosting credentials.
              console.warn("Live routing status could not be saved", statusError);
            }
          } catch (verificationError) {
            console.warn("Existing live routing could not be verified", verificationError);
            spaRouting = {
              ...spaRouting,
              requiresRepair: true,
              verificationError: verificationError?.message || "Live routing verification failed."
            };
          }
        }
      }

      // Firebase remains the source for page SEO even when editable content is
      // also committed to Git, so publish both parts of the same page draft.
      const publishTargets = Array.from(new Map([
        [`${websiteId}:${pageKey}`, { websiteId, pageKey }],
        ...connectedPublishTargetsRef.current.entries()
      ]).values());
      const publishResults = await Promise.all(
        publishTargets.map((target) => contentSyncService.publishDraft(
          target.websiteId,
          target.pageKey
        ))
      );
      if (!publishResults[0]) {
        throw new Error("The connected page draft is empty.");
      }
      const publishedAt = await pageService.markPublished(
        websiteId,
        pageId,
        selectedPage?.routeId
      );

      setSelectedPage((current) => current ? {
        ...current,
        sourceRevision: gitPublish?.revision || current.sourceRevision,
        status: "published",
        publishedAt
      } : current);
      const routingRepairRequired = Boolean(
        spaRouting.requiresRepair
        || (
          spaRouting.skipped
          && (
            !sourceWebsite?.connection?.spaRoutingConfigured
            || !sourceWebsite?.connection?.routeDeletionGuardConfigured
          )
        )
      );
      const publishMessage = gitPublish?.deploymentPending
        ? "Page content committed to GitHub. Vercel is rebuilding the live site."
        : gitPublish
        ? "Page content committed to the connected Git repository."
        : spaRouting.deploymentPending
        ? "Page published and Vercel routing committed. The live deployment is rebuilding."
        : spaRouting.changed
        ? "Page published and live URL routing configured on the connected website."
        : "Page content published to the connected website.";
      if (routingRepairRequired) {
        setShowRouteRepair(true);
        toast.warning(
          "Page content was published. Enter this website's hosting credentials once to enable live updates."
        );
      } else {
        toast.success(publishMessage);
      }
      return {
        verified: true,
        deploymentPending: gitPublish?.deploymentPending || spaRouting.deploymentPending,
        spaRoutingConfigured: spaRouting.configured,
        routingRepairRequired,
        sourceRevision: gitPublish?.revision || null
      };
    } catch (error) {
      console.error(error);
      toast.error(error.message || "The connected page could not be published.");
      return null;
    } finally {
      connectedPublishingRef.current = false;
      setConnectedPublishing(false);
    }
  }, [
    pageId,
    pageKey,
    saveConnectedDraft,
    selectedPage?.routeId,
    setSelectedPage,
    sourceWebsite,
    sourceWriteToken,
    toast,
    websiteId
  ]);

  const canRepairLiveRoute = Boolean(
    ["cpanel", "sftp"].includes(sourceWebsite?.connection?.provider)
  );

  const handleLiveRouteRepaired = useCallback(async ({ routing, connection }) => {
    const updatedWebsite = await websiteService.update(websiteId, {
      connectionHealth: "healthy",
      connection: {
        ...connection,
        spaRoutingConfigured: routing.configured,
        routeDeletionGuardConfigured: routing.deletionGuardConfigured,
        publishedStyleBridgeConfigured: routing.publishedStyleBridgeConfigured,
        spaRoutingPath: routing.path,
        spaRoutingUpdatedAt: Date.now()
      }
    });
    setSourceWebsite(updatedWebsite);
    setShowRouteRepair(false);
    toast.success(
      routing.changed
        ? "Live routes, published styles, and deleted-page handling were installed and verified."
        : "Live routes, published styles, and deleted-page handling are configured and verified."
    );
  }, [toast, websiteId]);

  const getAISourceFiles = useCallback(() => sourceFilesRef.current, []);

  const applyAISourceFiles = useCallback((nextFiles) => {
    const previousFiles = sourceFilesRef.current;
    Object.entries(nextFiles || {}).forEach(([path, nextContent]) => {
      if (previousFiles[path] !== nextContent) sourceDirtyPathsRef.current.add(path);
    });
    sourceFilesRef.current = { ...(nextFiles || {}) };
    if (selectedPage?.sourceFile && Object.prototype.hasOwnProperty.call(nextFiles || {}, selectedPage.sourceFile)) {
      setSourceContent(nextFiles[selectedPage.sourceFile]);
    }
    setSourceSaveStatus("unsaved");
  }, [selectedPage?.sourceFile]);

  const applyAIRegions = useCallback((nextRegions) => {
    regionsRef.current = { ...(nextRegions || {}) };
    setLegacyRegions(regionsRef.current);
    changeVersionRef.current += 1;
    setSaveStatus("unsaved");
  }, []);

  const saveAITheme = useCallback(async (tokens) => {
    await themeService.saveTheme(websiteId, tokens);
    setThemeTokens(tokens);
  }, [websiteId]);

  const stageAIExecution = useCallback((snapshot) => {
    if (snapshot?.tree) treeRef.current = structuredClone(snapshot.tree);
    if (snapshot?.pageSettings) settingsRef.current = structuredClone(snapshot.pageSettings);
    if (snapshot?.regions) regionsRef.current = structuredClone(snapshot.regions);
  }, []);

  const saveNativeAIChanges = useCallback(async (snapshot) => {
    stageAIExecution(snapshot);
    return performSave({ manual: true, settingsOverride: snapshot?.pageSettings });
  }, [performSave, stageAIExecution]);

  const saveSourceAIChanges = useCallback(async (snapshot) => {
    stageAIExecution(snapshot);
    const sourceSaved = await saveSourceDraft();
    const pageSaved = sourceSaved
      ? await performSave({ manual: true, settingsOverride: snapshot?.pageSettings })
      : false;
    if (!sourceSaved || !pageSaved) {
      throw new Error("The Rocket AI source draft could not be committed completely.");
    }
    return true;
  }, [performSave, saveSourceDraft, stageAIExecution]);

  const saveConnectedAIChanges = useCallback(async () => {
    // applyConnectedAIPlan and rollbackConnectedAIPlan already persist only the
    // regions they changed. Re-saving the full snapshot here duplicated every
    // Firebase write and incorrectly stored the supplemental runtime tree as the
    // connected page's native tree, which could force the iframe into a bad reload.
    const regionsSaved = await saveConnectedDraft(false);
    if (!regionsSaved) throw new Error("The Rocket AI page draft could not be committed completely.");
    return true;
  }, [saveConnectedDraft]);

  const handleSourceWriteTokenChange = useCallback((token) => {
    setSourceWriteToken(token);
    if (!websiteId) return;

    if (String(token || "").trim()) {
      sourceCredentialService.rememberGitHub(websiteId, token);
    } else {
      sourceCredentialService.forgetGitHub(websiteId);
    }
  }, [websiteId]);

  if (isConnectedSourcePage) {
    return (
      <ConnectedSourceWorkspace
        mode={mode}
        websiteId={websiteId}
        pageId={pageId}
        pageKey={pageKey}
        locale={activeLocale}
        page={selectedPage}
        website={sourceWebsite}
        theme={themeTokens}
        pageSettings={pageSettings}
        content={sourceContent}
        loading={pageLoading || sourceLoading}
        error={sourceError}
        saveStatus={sourceSaveStatus}
        saving={sourceSaving}
        publishing={sourcePublishing}
        writeToken={sourceWriteToken}
        onWriteTokenChange={handleSourceWriteTokenChange}
        onBack={() => navigate(`/content/${websiteId}/pages`)}
        onChange={(content) => {
          sourceFilesRef.current = {
            ...sourceFilesRef.current,
            [selectedPage.sourceFile]: content
          };
          sourceDirtyPathsRef.current.add(selectedPage.sourceFile);
          setSourceContent(content);
          setSourceSaveStatus("unsaved");
        }}
        onVisualChange={patchSourceFromVisual}
        getSourceFiles={getAISourceFiles}
        onSourceFilesChange={applyAISourceFiles}
        onThemeChange={saveAITheme}
        onPageSettingsChange={applyPageSettings}
        onSaveSEO={savePageSEOSettings}
        onAIDraftSave={saveSourceAIChanges}
        onSave={saveSourceDraft}
        onPublish={publishSource}
      />
    );
  }

  if (
    selectedPage
    && !selectedPage.isImported
    && selectedPage.source === "cms"
    && sourceWebsiteLoading
  ) {
    return (
      <div className="h-screen bg-[#070b14] text-slate-300 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-500 mt-3">Connecting the real website canvas...</p>
        </div>
      </div>
    );
  }

  if (isConnectedCmsPage) {
    return (
      <>
        <ConnectedSourceWorkspace
          mode={mode}
          websiteId={websiteId}
          pageId={pageId}
          pageKey={pageKey}
          locale={activeLocale}
          page={selectedPage}
          website={sourceWebsite}
          theme={themeTokens}
          pageSettings={pageSettings}
          content=""
          loading={pageLoading}
          error=""
          saveStatus={connectedSaveStatus}
          saving={connectedSaving}
          publishing={connectedPublishing}
          writeToken={sourceWriteToken}
          onWriteTokenChange={handleSourceWriteTokenChange}
          onBack={() => navigate(`/content/${websiteId}/pages`)}
          onChange={() => {}}
          onVisualChange={persistConnectedRegion}
          getSourceFiles={() => ({})}
          onSourceFilesChange={() => {}}
          onThemeChange={saveAITheme}
          onPageSettingsChange={applyPageSettings}
          onSaveSEO={savePageSEOSettings}
          onAIDraftSave={saveConnectedAIChanges}
          onSave={saveConnectedDraft}
          onPublish={publishConnectedPage}
          onRepairLiveRoute={canRepairLiveRoute ? () => setShowRouteRepair(true) : undefined}
          visualOnly
        />
        {canRepairLiveRoute && (
          <HostingRouteRepairModal
            isOpen={showRouteRepair}
            onClose={() => setShowRouteRepair(false)}
            website={sourceWebsite}
            onRepaired={handleLiveRouteRepaired}
          />
        )}
      </>
    );
  }

  if ((pageLoading || nativeLoading || !initialTree || selectedPage?.id !== pageId) && !loadError) {
    return (
      <div className="h-screen bg-[#070b14] text-slate-300 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-500 mt-3">Opening native editor...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen bg-[#070b14] text-slate-300 grid place-items-center">
        <div className="max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <h1 className="text-sm font-bold text-white">Native page could not be opened</h1>
          <p className="text-xs text-slate-500 mt-2">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate(`/content/${websiteId}/pages`)}
            className="mt-5 h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            Back to Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <NativeEditorProvider
      initialTree={initialTree}
      readOnly={isPreview}
      onChange={handleTreeChange}
    >
      <NativeBuilderWorkspace
        mode={mode}
        websiteId={websiteId}
        pageId={pageId}
        pageKey={pageKey}
        website={sourceWebsite}
        page={selectedPage}
        pageTitle={pageSettings.title || selectedPage.title}
        locale={activeLocale}
        device={device}
        setDevice={setDevice}
        customWidth={customWidth}
        setCustomWidth={setCustomWidth}
        saveStatus={saveStatus}
        saving={saving}
        publishing={publishing}
        pageSettings={pageSettings}
        revisions={revisions}
        revisionLoading={revisionLoading}
        onBack={() => navigate(`/content/${websiteId}/pages`)}
        onSave={() => performSave({ manual: true })}
        onAIDraftSave={saveNativeAIChanges}
        onPublish={publish}
        onOpenSettings={() => {
          setSettingsOpen(true);
          void loadRevisions(websiteId, "page", pageId);
        }}
        onTheme={() => navigate(`/content/${websiteId}/theme`)}
        onSaveTheme={saveAITheme}
        theme={themeTokens}
        regions={legacyRegions}
        onRegionsChange={applyAIRegions}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onApplySettings={applyPageSettings}
        onSaveSettings={savePageSettings}
        onSaveSEO={savePageSEOSettings}
        onRestoreRevision={restorePageRevision}
      />
    </NativeEditorProvider>
  );
}

export default VisualBuilderPage;
