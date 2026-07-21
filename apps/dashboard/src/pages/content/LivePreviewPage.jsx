import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Globe, Eye, AlertTriangle, ExternalLink, RefreshCw, Layers } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useAuth } from "../../hooks/useAuth";
import BlockEditor from "../../components/blocks/BlockEditor";
import Button from "../../components/ui/Button";
import PreviewToolbar from "../../components/content/PreviewToolbar";
import InspectorPanel from "../../components/content/InspectorPanel";
import visualEditService from "../../services/visualEditService";
import BLOCK_SCHEMAS from "../../components/blocks/blockSchemas";

export function LivePreviewPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();

  const { selectedPage, fetchPageById, updatePage, publishPage } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  // Responsive device modes
  const [activeDevice, setActiveDevice] = useState("full");

  // Visual edit mode states
  const [editModeActive, setEditModeActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);

  // History stack for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoingOrRedoing, setIsUndoingOrRedoing] = useState(false);

  // Iframe error tracking states
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef(null);
  
  // Split pane sizing
  const [leftWidth, setLeftWidth] = useState(() => {
    return Number(localStorage.getItem("rcms_preview_split")) || 40; // Default 40% editor, 60% iframe
  });
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (websiteId && pageId) {
      selectWebsite(websiteId);
      fetchPageById(websiteId, pageId);
    }
  }, [websiteId, pageId, selectWebsite, fetchPageById]);

  // Sync state from database and initialize history
  useEffect(() => {
    if (selectedPage) {
      const localeData = selectedPage.locales?.[activeLocale] || {};
      const pageBlocks = localeData.blocks || [];
      setBlocks(pageBlocks);
      setTitle(localeData.title || selectedPage.title || "");
      setSlug(localeData.slug || selectedPage.slug || "");

      // Set initial history snapshot
      setHistory([JSON.parse(JSON.stringify(pageBlocks))]);
      setHistoryIndex(0);
    }
  }, [selectedPage, activeLocale]);

  // Record blocks snapshot to history
  const recordHistory = useCallback((newBlocks) => {
    if (isUndoingOrRedoing) {
      setIsUndoingOrRedoing(false);
      return;
    }
    const blocksCopy = JSON.parse(JSON.stringify(newBlocks));
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, blocksCopy];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex, isUndoingOrRedoing]);

  const handleBlocksChange = (newBlocks) => {
    setBlocks(newBlocks);
    recordHistory(newBlocks);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsUndoingOrRedoing(true);
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setBlocks(JSON.parse(JSON.stringify(history[prevIndex])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoingOrRedoing(true);
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setBlocks(JSON.parse(JSON.stringify(history[nextIndex])));
    }
  };

  // Trigger postMessage sync to iframe on block changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      syncBlocksToIframe();
    }, 400);

    return () => clearTimeout(timer);
  }, [blocks, activeLocale]);

  const syncBlocksToIframe = () => {
    if (!iframeRef.current || !selectedWebsite?.domain) return;
    
    try {
      const targetOrigin = new URL(selectedWebsite.domain).origin;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "REACTCMS_DRAFT_UPDATE",
          websiteId,
          pageId,
          locale: activeLocale,
          blocks: blocks
        },
        targetOrigin
      );
    } catch (err) {
      console.warn("Failed to dispatch postMessage to preview frame:", err);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        blocks,
        status: selectedPage?.status || "draft"
      };
      await updatePage(websiteId, pageId, activeLocale, payload);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishPage = async () => {
    setPublishing(true);
    try {
      await publishPage(websiteId, pageId, user?.uid || "system");
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const getDeviceWidth = () => {
    switch (activeDevice) {
      case "desktop": return "1440px";
      case "laptop": return "1280px";
      case "tablet": return "768px";
      case "mobile": return "375px";
      case "landscape": return "926px";
      case "full":
      default:
        return "100%";
    }
  };

  // Split-pane resizing logic
  const handleMouseDown = () => {
    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none"; // Disable text selection during drag
  };

  const handleMouseMove = (e) => {
    if (!isResizingRef.current) return;
    const percentage = (e.clientX / window.innerWidth) * 100;
    if (percentage > 20 && percentage < 80) {
      setLeftWidth(percentage);
      localStorage.setItem("rcms_preview_split", percentage);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "unset";
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
    // Sync initial state
    setTimeout(syncBlocksToIframe, 500);
    // Reactivate edit overlays if active
    if (editModeActive) {
      setTimeout(() => {
        visualEditService.enableEditMode(iframeRef.current, selectedWebsite?.domain, websiteId);
      }, 800);
    }
  };

  // Listen for visual element selection messages from iframe (v1 versioned & backward-compatible)
  useEffect(() => {
    const handleMessage = (event) => {
      if (!selectedWebsite?.domain) return;
      try {
        const targetOrigin = new URL(selectedWebsite.domain).origin;
        if (event.origin !== targetOrigin) return;

        const data = event.data;
        if (!data) return;

        // Versioned RCMSMessage format: rcms/v1/region-selected
        if (data.rcms && data.type === "rcms/v1/region-selected") {
          const payload = data.payload || {};
          setSelectedElement({
            regionId: payload.regionId,
            type: payload.type,
            pageId: payload.pageId,
            value: payload.value,
            blockId: payload.regionId, // fallback mapping
          });
        } else if (data.type === "RCMS_ELEMENT_SELECTED") {
          setSelectedElement({
            blockId: data.blockId,
            fieldKey: data.fieldKey,
            blockType: data.blockType,
            value: data.value
          });
        }
      } catch (err) {
        console.warn("Error parsing iframe event message:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedWebsite]);

  // Sync CMS Edit Mode activation state to client iframe
  useEffect(() => {
    if (editModeActive) {
      visualEditService.enableEditMode(iframeRef.current, selectedWebsite?.domain, websiteId);
    } else {
      visualEditService.disableEditMode(iframeRef.current, selectedWebsite?.domain, websiteId);
      setSelectedElement(null);
    }
  }, [editModeActive, selectedWebsite, websiteId]);

  const handleInspectorBlockChange = (blockId, updatedBlock) => {
    // Update CMS blocks layout list
    setBlocks(prev => prev.map(b => b.id === blockId ? updatedBlock : b));

    // Send visual update payload back to client iframe & persist to Firebase draft
    if (selectedElement && (selectedElement.blockId === blockId || selectedElement.regionId === blockId)) {
      const fieldKey = selectedElement.fieldKey || "value";
      const schema = BLOCK_SCHEMAS.find(s => s.type === updatedBlock.type);
      const fieldSchema = schema?.fields.find(f => f.key === fieldKey);
      const isLoc = fieldSchema?.localized;
      const value = isLoc 
        ? updatedBlock.locales?.[activeLocale]?.[fieldKey] 
        : updatedBlock[fieldKey];

      visualEditService.sendFieldUpdate(
        iframeRef.current,
        selectedWebsite?.domain,
        websiteId,
        blockId,
        fieldKey,
        value
      );

      // Persist to Firebase draft path
      visualEditService.persistFieldUpdate(websiteId, pageId, blockId, value);
    }
  };

  // Set timeout fallback for X-Frame-Options blockers
  useEffect(() => {
    const checkTimeout = setTimeout(() => {
      if (iframeLoading) {
        setIframeError(true);
      }
    }, 4500); // 4.5s check timeout

    return () => clearTimeout(checkTimeout);
  }, [iframeLoading]);

  if (!selectedPage || !selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Initializing Live Preview...</div>;
  }

  // Prepares the site preview link
  const cleanDomain = selectedWebsite.domain?.replace(/\/$/, "");
  const previewUrl = `${cleanDomain}/${slug === "home" ? "" : slug}?rcms_preview=1`;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Left Pane: Editor */}
      {!editModeActive && (
        <div 
          className="flex flex-col border-r border-slate-850 bg-slate-900/50 flex-shrink-0"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Header Bar - Hides elements as toolbar handles save/locale sync */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-850 bg-slate-950/60 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-200 truncate">
                Layout Structure Editor
              </span>
            </div>
          </div>

          {/* Scrollable Editor */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <BlockEditor
              blocks={blocks}
              onChange={handleBlocksChange}
              activeLocale={activeLocale}
            />
          </div>
        </div>
      )}

      {/* Resize handle bar */}
      {!editModeActive && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 hover:w-2 bg-slate-900 border-x border-slate-850 hover:bg-primary transition-colors cursor-col-resize flex-shrink-0 z-30"
        />
      )}

      {/* Right Container */}
      <div className="flex-1 flex flex-row h-full overflow-hidden">
        {/* Live Preview Iframe View */}
        <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-850 bg-slate-950">
          {/* Render consolidated toolbar workstation */}
          <PreviewToolbar
            title={title}
            onBack={() => navigate(`/content/${websiteId}/pages/${pageId}`)}
            activeLocale={activeLocale}
            activeLocales={activeLocales}
            onLocaleSelect={setLocale}
            activeDevice={activeDevice}
            onDeviceSelect={setActiveDevice}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onSave={handleSaveDraft}
            onPublish={handlePublishPage}
            saving={saving}
            publishing={publishing}
            previewUrl={previewUrl}
            editModeActive={editModeActive}
            onEditModeToggle={() => setEditModeActive(prev => !prev)}
          />

          {/* Warn Banner if Frame Load Blocked */}
          {iframeError && (
            <div className="m-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between gap-4 z-10 shadow-lg text-left">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p>
                  <strong>Preview Frame Blocked:</strong> Your browser or site security settings (e.g. <code>X-Frame-Options</code>) are blocking iframe embeddings. 
                </p>
              </div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-lg font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
              >
                Open New Tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Iframe View - Centered and Responsive Mock Frame */}
          <div className="flex-1 w-full h-full relative bg-slate-900 flex flex-col items-center justify-center p-4 overflow-auto">
            <div 
              style={{ 
                width: getDeviceWidth(), 
                height: "100%",
                maxWidth: "100%",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
              }}
              className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={handleIframeLoad}
                title="Site Live Preview Frame"
                className="w-full flex-1 border-none bg-slate-950"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
              {activeDevice !== "full" && (
                <div className="bg-slate-900 px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center select-none">
                  Viewport: {getDeviceWidth()} ({activeDevice})
                </div>
              )}
            </div>
            
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold">Connecting to website preview...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visual Inspector Drawer */}
        {editModeActive && (
          <div className="w-80 flex flex-col flex-shrink-0 bg-slate-900 border-l border-slate-850 h-full">
            <InspectorPanel
              selectedElement={selectedElement}
              blocks={blocks}
              onChangeBlock={handleInspectorBlockChange}
              activeLocale={activeLocale}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default LivePreviewPage;
