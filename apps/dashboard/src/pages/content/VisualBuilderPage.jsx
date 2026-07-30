import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
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
import {
  blocksToPageTree,
  isPageComponentTree,
  pageTreeToBlocks,
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
import pageService from "../../services/pageService";
import {
  buildConnectedPageUrl,
  createRuntimeMessage,
  patchEditableRegionSource
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
import VisualBuilderToolbar from "../../components/content/VisualBuilderToolbar";
import NativeLayersPanel from "../../components/content/NativeLayersPanel";

const NativeInspector = lazy(() => import("../../components/content/NativeInspector"));
const VisualPageSettingsModal = lazy(() => import("../../components/content/VisualPageSettingsModal"));

function sourceDraftKey(websiteId, pageId) {
  return `reactcms_source_draft:${websiteId}:${pageId}`;
}

function ConnectedSourceWorkspace({
  mode,
  page,
  website,
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
  onSave,
  onPublish
}) {
  const isPreview = mode === "preview";
  const isGitHub = website?.connection?.provider === "github";
  const iframeRef = useRef(null);
  const [workspaceMode, setWorkspaceMode] = useState("visual");
  const [device, setDevice] = useState("desktop");
  const [customWidth, setCustomWidth] = useState(960);
  const [frameLoading, setFrameLoading] = useState(true);
  const [frameVersion, setFrameVersion] = useState(0);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [visualError, setVisualError] = useState("");
  const [liveRouteError, setLiveRouteError] = useState("");

  const livePageUrl = useMemo(
    () => buildConnectedPageUrl(website, page, isPreview ? "preview" : "edit"),
    [isPreview, page, website]
  );
  const liveOrigin = useMemo(() => {
    try {
      return livePageUrl ? new URL(livePageUrl).origin : "";
    } catch {
      return "";
    }
  }, [livePageUrl]);
  const canvasWidth = device === "custom"
    ? customWidth
    : CANVAS_DEVICE_WIDTHS[device] || 1440;

  const sendRuntimeMessage = useCallback((type, payload = {}) => {
    iframeRef.current?.contentWindow?.postMessage(
      createRuntimeMessage(type, payload),
      liveOrigin || "*"
    );
  }, [liveOrigin]);

  const applyVisualValue = useCallback((region, value, sendToRuntime = true) => {
    const result = onVisualChange({
      regionId: region.regionId,
      type: region.type,
      pageId: region.pageId,
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
    setSelectedRegion((current) => current ? { ...current, value } : current);
    if (sendToRuntime) {
      sendRuntimeMessage("rcms/v1/field-update", {
        pageId: region.pageId,
        regionId: region.regionId,
        value
      });
    }
    return true;
  }, [onVisualChange, sendRuntimeMessage]);

  useEffect(() => {
    setWorkspaceMode("visual");
    setSelectedRegion(null);
    setVisualError("");
    setFrameLoading(true);
  }, [page?.id, isPreview]);

  useEffect(() => {
    if (!livePageUrl) return undefined;
    let cancelled = false;
    setLiveRouteError("");

    fetch(livePageUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store"
    })
      .then((response) => {
        if (cancelled || response.ok) return;
        setLiveRouteError(
          `The connected host returned HTTP ${response.status} for this page route. `
          + "Redeploy the connected project with its SPA rewrite/fallback enabled, then reload the canvas."
        );
      })
      .catch(() => {
        // Some connected hosts allow framing but not cross-origin fetches.
        // In that case the iframe remains the source of truth.
      });

    return () => {
      cancelled = true;
    };
  }, [livePageUrl, frameVersion]);

  useEffect(() => {
    if (!livePageUrl) return undefined;
    const handleRuntimeMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (liveOrigin && event.origin !== liveOrigin) return;
      const message = event.data;
      if (
        !message
        || typeof message !== "object"
        || message.rcms !== true
        || message.version !== "v1"
      ) return;

      if (message.type === "rcms/v1/runtime-ready") {
        setRuntimeConnected(true);
        sendRuntimeMessage(
          isPreview ? "rcms/v1/exit-edit-mode" : "rcms/v1/enter-edit-mode"
        );
        return;
      }

      if (!isPreview && message.type === "rcms/v1/region-selected") {
        setSelectedRegion(message.payload || null);
        setVisualError("");
        return;
      }

      if (!isPreview && message.type === "rcms/v1/field-update") {
        const payload = message.payload || {};
        if (!payload.regionId) return;
        setSelectedRegion((current) => ({
          ...(current || {}),
          ...payload
        }));
        applyVisualValue(payload, payload.value, false);
      }
    };

    window.addEventListener("message", handleRuntimeMessage);
    return () => window.removeEventListener("message", handleRuntimeMessage);
  }, [
    applyVisualValue,
    isPreview,
    liveOrigin,
    livePageUrl,
    sendRuntimeMessage
  ]);

  const handleFrameLoad = () => {
    setFrameLoading(false);
    setRuntimeConnected(false);
    sendRuntimeMessage(
      isPreview ? "rcms/v1/exit-edit-mode" : "rcms/v1/enter-edit-mode"
    );
  };

  const updateSelectedField = (field, nextFieldValue) => {
    if (!selectedRegion) return;
    const currentValue = selectedRegion.value;
    let nextValue;

    if (selectedRegion.type === "text" && field === "text") {
      nextValue = currentValue && typeof currentValue === "object"
        ? { ...currentValue, text: nextFieldValue }
        : nextFieldValue;
    } else {
      const base = currentValue && typeof currentValue === "object"
        ? { ...currentValue }
        : {};
      nextValue = { ...base, [field]: nextFieldValue };
    }
    applyVisualValue(selectedRegion, nextValue);
  };

  const renderVisualInspector = () => {
    if (!selectedRegion) {
      return (
        <aside className="w-[320px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] grid place-items-center p-7 text-center">
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

    return (
      <aside className="w-[320px] flex-shrink-0 border-l border-slate-800 bg-[#0b1120] overflow-y-auto">
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
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Image URL
                </span>
                <input
                  value={typeof value === "string" ? value : value?.src || ""}
                  onChange={(event) => updateSelectedField("src", event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </label>
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

          {!["text", "button", "image", "section"].includes(selectedRegion.type) && (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] leading-5 text-slate-500">
              This SDK region can be selected, but its visual controls are not available yet.
              Use the Code tab for this component.
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
              Supported changes update this page&apos;s JSX immediately. Use Update Git
              when the page is ready to deploy.
            </p>
          </div>
        </div>
      </aside>
    );
  };

  return (
    <div className="h-screen min-h-0 bg-[#070b14] text-slate-200 flex flex-col overflow-hidden">
      <VisualBuilderToolbar
        mode={mode}
        page={page}
        device={device}
        saveStatus={saveStatus}
        saving={saving}
        publishing={publishing}
        canUndo={false}
        canRedo={false}
        onBack={onBack}
        onDeviceChange={setDevice}
        onUndo={() => {}}
        onRedo={() => {}}
        onSave={onSave}
        onPublish={onPublish}
        onSettings={() => {}}
        showSettings={false}
        publishLabel={isGitHub ? "Update Git" : "Update cPanel"}
      />

      <div className="h-11 px-4 border-b border-slate-800 bg-[#0a101d] flex items-center gap-3">
        {!isPreview ? (
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
              Live page preview
            </span>
          </>
        )}

        {workspaceMode === "code" && !isPreview && (
          <>
            <span className="h-4 w-px bg-slate-800" />
            <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
            <code className="text-[10px] text-slate-400 truncate">{page.sourceFile}</code>
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

      {!isPreview && isGitHub && workspaceMode === "code" && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="password"
            value={writeToken}
            onChange={(event) => onWriteTokenChange(event.target.value)}
            placeholder="GitHub Contents: Read and write token (kept for this browser session)"
            autoComplete="new-password"
            className="h-8 flex-1 rounded-lg border border-slate-800 bg-[#080d18] px-3 text-[11px] text-slate-200 outline-none focus:border-blue-500"
          />
        </div>
      )}

      {workspaceMode === "visual" || isPreview ? (
        <div className="flex-1 min-h-0 flex">
          <main className="flex-1 min-w-0 min-h-0 overflow-auto bg-[#080d18] p-4">
            {!livePageUrl ? (
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
                className="relative mx-auto h-full min-h-[560px] overflow-hidden rounded-xl border border-slate-700 bg-white shadow-2xl shadow-black/40"
                style={{ width: `${canvasWidth}px`, maxWidth: device === "desktop" ? "none" : "100%" }}
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
                        The live page route is not deployed
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
                  key={`${livePageUrl}:${frameVersion}`}
                  ref={iframeRef}
                  src={livePageUrl}
                  title={`${page.title} live visual canvas`}
                  onLoad={handleFrameLoad}
                  className="block h-full min-h-[700px] w-full border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
            )}
          </main>
          {!isPreview && renderVisualInspector()}
        </div>
      ) : (
        <main className="flex-1 min-h-0 p-4 bg-[#080d18]">
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
              aria-label={`Source code for ${page.title}`}
              className="w-full h-full resize-none rounded-xl border border-slate-800 bg-[#050914] p-5 font-mono text-[12px] leading-5 text-slate-300 outline-none focus:border-blue-500"
            />
          )}
        </main>
      )}
    </div>
  );
}

function buildInitialTree(page, document, locale, pageKey) {
  const localeData = page.locales?.[locale] || {};
  if (isPageComponentTree(document.tree)) return document.tree;
  if (isPageComponentTree(localeData.componentTree)) return localeData.componentTree;

  const blocks = document.blocks?.length
    ? document.blocks
    : Array.isArray(localeData.blocks)
      ? localeData.blocks
      : [];
  if (blocks.length) {
    return blocksToPageTree(blocks, {
      id: pageKey,
      title: localeData.title || page.title,
      locale
    });
  }

  if (Object.keys(document.regions || {}).length) {
    return regionsToPageTree(document.regions, {
      id: pageKey,
      title: localeData.title || page.title,
      locale
    });
  }

  return regionsToPageTree({}, {
    id: pageKey,
    title: localeData.title || page.title,
    locale
  });
}

function NativeBuilderWorkspace({
  mode,
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
  onPublish,
  onOpenSettings,
  onTheme,
  theme,
  settingsOpen,
  onCloseSettings,
  onApplySettings,
  onSaveSettings,
  onRestoreRevision
}) {
  const editor = useNativeEditor();
  const isPreview = mode === "preview";
  const blocks = useMemo(() => pageTreeToBlocks(editor.tree), [editor.tree]);
  const importedSourceEmptyState = page.isImported ? (
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
      {page.sourceFile && (
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

        {!isPreview && (
          <Suspense fallback={<aside className="w-[336px] border-l border-slate-800 bg-[#0b1120]" />}>
            <NativeInspector
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
  const [sourceContent, setSourceContent] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceSaveStatus, setSourceSaveStatus] = useState("saved");
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourcePublishing, setSourcePublishing] = useState(false);
  const [sourceWriteToken, setSourceWriteToken] = useState("");

  const treeRef = useRef(null);
  const pageRef = useRef(null);
  const settingsRef = useRef(pageSettings);
  const regionsRef = useRef({});
  const changeVersionRef = useRef(0);
  const loadedIdentityRef = useRef("");

  const pageKey = useMemo(
    () => visualBuilderService.resolvePageKey(selectedPage),
    [selectedPage]
  );

  useEffect(() => {
    if (!websiteId || !pageId) return;
    fetchPageById(websiteId, pageId);
    loadRevisions(websiteId, "page", pageId);
  }, [fetchPageById, loadRevisions, pageId, websiteId]);

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

  useEffect(() => {
    if (!isConnectedSourcePage || !websiteId || !pageId) return undefined;
    let cancelled = false;
    const loadSource = async () => {
      setSourceLoading(true);
      setSourceError("");
      try {
        const website = await websiteService.getById(websiteId);
        if (!website) throw new Error("The connected website record was not found.");
        const source = await sourceProviderService.readFile(
          website,
          selectedPage.sourceFile
        );
        if (cancelled) return;
        const draft = sessionStorage.getItem(sourceDraftKey(websiteId, pageId));
        setSourceWebsite(website);
        setSourceContent(draft ?? source.content);
        setSourceWriteToken(
          sourceCredentialService.get(websiteId).token || ""
        );
        setSourceSaveStatus(draft === null ? "saved" : "unsaved");
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
        loadRevisions(websiteId, "page", pageId);
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
  }, [activeLocale, loadRevisions, pageId, toast, user, websiteId]);

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

  const saveSourceDraft = async () => {
    setSourceSaving(true);
    setSourceSaveStatus("saving");
    try {
      sessionStorage.setItem(
        sourceDraftKey(websiteId, pageId),
        sourceContent
      );
      setSourceSaveStatus("saved");
      toast.success("Source draft saved in this browser session.");
      return true;
    } catch (error) {
      setSourceSaveStatus("error");
      toast.error(error.message || "Source draft could not be saved.");
      return false;
    } finally {
      setSourceSaving(false);
    }
  };

  const publishSource = async () => {
    if (!sourceWebsite) return;
    setSourcePublishing(true);
    try {
      if (
        sourceWebsite.connection?.provider === "github"
        && sourceWriteToken.trim()
      ) {
        sourceCredentialService.rememberGitHub(
          websiteId,
          sourceWriteToken
        );
      }
      const result = await sourceProviderService.writeFile(
        sourceWebsite,
        selectedPage.sourceFile,
        sourceContent,
        `Update ${selectedPage.title} from ReactCMS`
      );
      sessionStorage.removeItem(sourceDraftKey(websiteId, pageId));
      setSourceSaveStatus("saved");
      setSelectedPage((current) => current ? {
        ...current,
        sourceRevision: result.revision,
        status: "published",
        publishedAt: Date.now()
      } : current);
      toast.success(
        result.provider === "github"
          ? "Committed to GitHub. The connected deployment can now rebuild."
          : "Saved directly to cPanel."
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Connected source publish failed.");
    } finally {
      setSourcePublishing(false);
    }
  };

  const patchSourceFromVisual = useCallback((change) => {
    const result = patchEditableRegionSource(
      sourceContent,
      change.regionId,
      change.value
    );
    if (result.changed) {
      setSourceContent(result.content);
      setSourceSaveStatus("unsaved");
    }
    return result;
  }, [sourceContent]);

  if (isConnectedSourcePage) {
    return (
      <ConnectedSourceWorkspace
        mode={mode}
        page={selectedPage}
        website={sourceWebsite}
        content={sourceContent}
        loading={pageLoading || sourceLoading}
        error={sourceError}
        saveStatus={sourceSaveStatus}
        saving={sourceSaving}
        publishing={sourcePublishing}
        writeToken={sourceWriteToken}
        onWriteTokenChange={setSourceWriteToken}
        onBack={() => navigate(`/content/${websiteId}/pages`)}
        onChange={(content) => {
          setSourceContent(content);
          setSourceSaveStatus("unsaved");
        }}
        onVisualChange={patchSourceFromVisual}
        onSave={saveSourceDraft}
        onPublish={publishSource}
      />
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
        onPublish={publish}
        onOpenSettings={() => setSettingsOpen(true)}
        onTheme={() => navigate(`/content/${websiteId}/theme`)}
        theme={themeTokens}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onApplySettings={applyPageSettings}
        onSaveSettings={savePageSettings}
        onRestoreRevision={restorePageRevision}
      />
    </NativeEditorProvider>
  );
}

export default VisualBuilderPage;
