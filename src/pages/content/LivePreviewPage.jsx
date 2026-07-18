import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Globe, Eye, AlertTriangle, ExternalLink, RefreshCw, Layers } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useAuth } from "../../hooks/useAuth";
import BlockEditor from "../../components/blocks/BlockEditor";
import Button from "../../components/ui/Button";

export function LivePreviewPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();

  const { selectedPage, fetchPageById, updatePage } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

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

  // Sync state from database
  useEffect(() => {
    if (selectedPage) {
      const localeData = selectedPage.locales?.[activeLocale] || {};
      setBlocks(localeData.blocks || []);
      setTitle(localeData.title || selectedPage.title || "");
      setSlug(localeData.slug || selectedPage.slug || "");
    }
  }, [selectedPage, activeLocale]);

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
      <div 
        className="flex flex-col border-r border-slate-850 bg-slate-900/50 flex-shrink-0"
        style={{ width: `${leftWidth}%` }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-850 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/content/${websiteId}/pages/${pageId}`)}
              className="p-1.5 rounded-lg border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Return to Page Editor"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-200 truncate max-w-[120px] sm:max-w-[200px]">
              Preview: {title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex bg-slate-950/80 p-0.5 border border-slate-800 rounded-lg">
              {activeLocales.map((code) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-all cursor-pointer ${
                    activeLocale === code ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <Button
              onClick={handleSaveDraft}
              variant="primary"
              className="py-1 px-3 text-[10px] gap-1 font-bold"
              loading={saving}
            >
              <Save className="w-3 h-3" /> Save
            </Button>
          </div>
        </div>

        {/* Scrollable Editor */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <BlockEditor
            blocks={blocks}
            onChange={setBlocks}
            activeLocale={activeLocale}
          />
        </div>
      </div>

      {/* Resize handle bar */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 hover:w-2 bg-slate-900 border-x border-slate-850 hover:bg-primary transition-colors cursor-col-resize flex-shrink-0 z-30"
      />

      {/* Right Pane: Live Iframe Preview */}
      <div className="flex-1 flex flex-col bg-slate-950 relative h-full">
        {/* Navigation control header for preview */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-850 bg-slate-900/60 flex-shrink-0 text-xs">
          <span className="font-mono text-slate-400 truncate max-w-lg select-all">
            {previewUrl}
          </span>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIframeLoading(true);
                if (iframeRef.current) iframeRef.current.src = previewUrl;
              }}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Refresh Frame"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Tab
            </a>
          </div>
        </div>

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

        {/* Iframe View */}
        <div className="flex-1 w-full h-full relative bg-slate-900">
          <iframe
            ref={iframeRef}
            src={previewUrl}
            onLoad={handleIframeLoad}
            title="Site Live Preview Frame"
            className="w-full h-full border-none bg-slate-950"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
          
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                <span className="text-xs text-slate-400 font-semibold">Connecting to website preview...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}

export default LivePreviewPage;
