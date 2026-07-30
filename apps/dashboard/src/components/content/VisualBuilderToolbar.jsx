import React from "react";
import {
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  Laptop,
  Monitor,
  PanelTop,
  Redo2,
  Save,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2
} from "lucide-react";
import Button from "../ui/Button";

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "laptop", label: "Laptop", icon: Laptop },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone }
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
  onSettings
}) {
  const isPreview = mode === "preview";
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
            className="hidden lg:flex h-9 items-center gap-1.5 px-3 rounded-lg text-[11px] font-semibold text-violet-300 border border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15 cursor-pointer"
            title="AI page tools are ready for future integrations"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assist
          </button>

          <SaveState status={saveStatus} />

          <button
            type="button"
            onClick={onSettings}
            className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-center cursor-pointer"
            title="Page Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

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
            Publish
          </Button>
        </>
      )}
    </header>
  );
}

export default VisualBuilderToolbar;
