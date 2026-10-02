import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  Laptop,
  Monitor,
  PanelTop,
  Redo2,
  Route,
  Ruler,
  Save,
  Settings,
  Smartphone,
  MousePointer2,
  Tablet,
  Undo2
} from "lucide-react";
import Button from "../ui/Button";
import ColorPicker from "../ui/ColorPicker";

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "laptop", label: "Laptop", icon: Laptop },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "custom", label: "Custom", icon: Ruler }
];

function SaveState({ status }) {
  const states = {
    unsaved: { label: "Unsaved changes", className: "text-amber-300", icon: Cloud },
    saving: { label: "Saving...", className: "text-sky-300", icon: Cloud },
    error: { label: "Save failed", className: "text-rose-300", icon: Cloud },
    saved: { label: "Saved", className: "text-emerald-300", icon: Check }
  };
  const state = states[status] || states.saved;
  const Icon = state.icon;

  return (
    <span className={`hidden xl:flex items-center gap-1.5 text-[11px] font-semibold ${state.className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "saving" ? "animate-pulse" : ""}`} />
      {state.label}
    </span>
  );
}

export function VisualBuilderToolbar({
  mode,
  page,
  device,
  saveStatus,
  saving,
  publishing,
  canUndo,
  canRedo,
  onBack,
  onDeviceChange,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  onRepairLiveRoute,
  onSettings,
  onInspectorOpen,
  backgroundColor,
  onBackgroundChange,
  backgroundHelp = "Applies to the whole page and its section backgrounds. Save or publish when ready.",
  aiOpen = true,
  showSettings = true,
  publishLabel = "Publish"
}) {
  const isPreview = mode === "preview";
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");
  const [backgroundDraft, setBackgroundDraft] = useState(backgroundColor || "#ffffff");
  useEffect(() => { setBackgroundDraft(backgroundColor || "#ffffff"); }, [backgroundColor]);
  const changeBackground = async (color) => {
    setBackgroundDraft(color);
    if (!/^#[0-9a-f]{6}$/i.test(color) || backgroundBusy) return;
    setBackgroundBusy(true);
    setBackgroundError("");
    try { await onBackgroundChange(color); }
    catch (error) { setBackgroundError(error.message || "Could not change the background."); }
    finally { setBackgroundBusy(false); }
  };
  const title = page?.title || "Current Page";
  const status = page?.status || "draft";

  return (
    <header className="h-16 flex-shrink-0 border-b border-slate-800 bg-[#0b1120] px-3 md:px-4 flex items-center gap-3 text-left shadow-lg shadow-black/20 z-40">
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
        title="Back to Pages"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="min-w-0 mr-auto">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-white truncate max-w-[180px] md:max-w-[280px]">{title}</h1>
          <span className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${
            status === "published"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/20 text-amber-300"
          }`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
          {isPreview ? <Eye className="w-3 h-3" /> : <PanelTop className="w-3 h-3" />}
          <span>{isPreview ? "Preview" : "Edit mode"}</span>
        </div>
      </div>

      <div className="hidden sm:flex items-center bg-slate-950/70 border border-slate-800 rounded-xl p-1">
        {DEVICES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onDeviceChange(id)}
            className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
              device === id
                ? "bg-blue-600 text-white shadow-md shadow-blue-950/40"
                : "text-slate-500 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>

      {!isPreview && (
        <>
          <div className="hidden md:flex items-center gap-1 border-l border-slate-800 pl-3">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 disabled:opacity-30 cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 disabled:opacity-30 cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onInspectorOpen}
            className={`flex h-9 items-center gap-1.5 px-2.5 xl:px-3 rounded-lg text-[11px] font-semibold border cursor-pointer ${
              aiOpen
                ? "text-white border-violet-500/40 bg-violet-600 shadow-md shadow-violet-950/30"
                : "text-violet-300 border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15"
            }`}
            title="Open Inspector"
            aria-label="Open Inspector"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Inspector</span>
          </button>

          <SaveState status={saveStatus} />

          {onBackgroundChange && (
            <div className="relative">
              <button type="button" onClick={() => setBackgroundOpen(!backgroundOpen)}
                aria-expanded={backgroundOpen} aria-label="Page background"
                title="Page background"
                className="h-9 px-2.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-900 flex items-center gap-2 cursor-pointer">
                <span className="w-4 h-4 rounded border border-slate-500" style={{ background: backgroundDraft }} />
                <span className="hidden xl:inline text-[11px] font-semibold">Background</span>
              </button>
              {backgroundOpen && (
                <div className="absolute right-0 top-11 w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold">Page background</span>
                    <button type="button" onClick={() => setBackgroundOpen(false)} aria-label="Close background picker" className="text-xs text-slate-400 cursor-pointer">Close</button>
                  </div>
                  <fieldset disabled={backgroundBusy} className="disabled:opacity-50">
                    <ColorPicker value={backgroundDraft} onChange={changeBackground} />
                  </fieldset>
                  <p className="mt-3 text-xs text-slate-400">{backgroundBusy ? "Applying background…" : backgroundHelp}</p>
                  {backgroundError && <p role="alert" className="mt-2 text-xs text-rose-300">{backgroundError}</p>}
                </div>
              )}
            </div>
          )}

          {onRepairLiveRoute && (
            <button
              type="button"
              onClick={onRepairLiveRoute}
              className="hidden xl:flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
              title="Install or verify live nested URL routing"
            >
              <Route className="w-3.5 h-3.5" />
              Repair Route
            </button>
          )}

          {showSettings && (
            <button
              type="button"
              onClick={onSettings}
              className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-center cursor-pointer"
              title="Page Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onSave}
            loading={saving}
            className="gap-1.5 bg-slate-900 border-slate-700 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save Draft</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onPublish}
            loading={publishing}
            className="gap-1.5 bg-blue-600 hover:bg-blue-500"
          >
            <Cloud className="w-3.5 h-3.5" />
            {publishLabel}
          </Button>
        </>
      )}
    </header>
  );
}

export default VisualBuilderToolbar;
