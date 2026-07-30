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
  ChevronRight,
  Loader2,
  Palette,
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
import visualBuilderService, {
  createVisualNode
} from "../../services/visualBuilderService";
import VisualBuilderToolbar from "../../components/content/VisualBuilderToolbar";
import NativeLayersPanel from "../../components/content/NativeLayersPanel";

const NativeInspector = lazy(() => import("../../components/content/NativeInspector"));
const VisualPageSettingsModal = lazy(() => import("../../components/content/VisualPageSettingsModal"));

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
      await visualBuilderService.publish({
        websiteId,
        pageId,
        pageKey: currentPageKey,
        routeId: page?.routeId || page?.slug
      });
      setSelectedPage((current) => current ? {
        ...current,
        status: "published",
        publishedAt: Date.now()
      } : current);
      toast.success("Native page published. Connected runtimes will refresh automatically.");
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
