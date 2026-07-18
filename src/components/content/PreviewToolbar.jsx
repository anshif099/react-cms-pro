import React from "react";
import { ArrowLeft, Save, Globe, RefreshCw, Undo2, Redo2, ExternalLink, MousePointerClick } from "lucide-react";
import DeviceSwitcher from "./DeviceSwitcher";
import Button from "../ui/Button";

export function PreviewToolbar({
  title,
  onBack,
  activeLocale,
  activeLocales,
  onLocaleSelect,
  activeDevice,
  onDeviceSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onPublish,
  saving,
  publishing,
  previewUrl,
  editModeActive,
  onEditModeToggle
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-850 bg-slate-950/60 flex-shrink-0 text-left">
      {/* Back & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Return to Page Editor"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-slate-200 truncate max-w-[120px] sm:max-w-[200px]">
          Preview: {title}
        </span>
      </div>

      {/* Center: Device Switcher & Language pills */}
      <div className="flex items-center gap-3">
        {/* Device Switcher */}
        <DeviceSwitcher
          activeDevice={activeDevice}
          onSelect={onDeviceSelect}
        />

        {/* Language toggle */}
        <div className="flex bg-slate-950/80 p-0.5 border border-slate-800 rounded-lg">
          {activeLocales.map((code) => (
            <button
              key={code}
              onClick={() => onLocaleSelect(code)}
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-all cursor-pointer ${
                activeLocale === code ? "bg-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Right: History, Save, Publish & External Redirect */}
      <div className="flex items-center gap-2">
        {/* Visual Edit Mode Toggle */}
        <button
          type="button"
          onClick={onEditModeToggle}
          className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-[10px] font-bold transition-all cursor-pointer ${
            editModeActive 
              ? "bg-primary border-primary text-white" 
              : "border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
          }`}
          title={editModeActive ? "Exit Visual Edit Mode" : "Enter Visual Edit Mode"}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Visual Edit</span>
        </button>

        {/* Undo/Redo */}
        <div className="flex bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* External Tab link */}
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 border border-slate-850 rounded-lg text-slate-400 hover:text-white cursor-pointer bg-slate-950/20"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Save */}
        <Button
          onClick={onSave}
          variant="outline"
          className="py-1 px-3 text-[10px] gap-1 font-bold border-slate-800"
          loading={saving}
        >
          <Save className="w-3 h-3" /> Save Draft
        </Button>

        {/* Publish */}
        <Button
          onClick={onPublish}
          variant="primary"
          className="py-1 px-3 text-[10px] gap-1 font-bold"
          loading={publishing}
        >
          <Globe className="w-3 h-3" /> Publish
        </Button>
      </div>
    </div>
  );
}

export default PreviewToolbar;
