import React, { useEffect, useState } from "react";
import { FileText, History, Search, Settings } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import SEOPanel from "./SEOPanel";
import RevisionPanel from "./RevisionPanel";

const TABS = [
  { id: "general", label: "General", icon: FileText },
  { id: "seo", label: "SEO & Metadata", icon: Search },
  { id: "revisions", label: "Revisions", icon: History }
];

export function VisualPageSettingsModal({
  isOpen,
  onClose,
  settings,
  blocks,
  revisions,
  revisionLoading,
  onChange,
  onSave,
  onRestoreRevision
}) {
  const [tab, setTab] = useState("general");
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const updateField = (key, value) => {
    setLocalSettings((current) => ({ ...current, [key]: value }));
  };

  const applySettings = () => {
    onChange?.(localSettings);
    onSave?.(localSettings);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Page Settings"
      size="xl"
      className="bg-[#0d1424] border-slate-800"
    >
      <div className="grid grid-cols-[190px_minmax(0,1fr)] min-h-[520px] -m-6">
        <nav className="border-r border-slate-800 bg-slate-950/30 p-3">
          <div className="px-2 py-2 mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            <Settings className="w-3.5 h-3.5" />
            Configuration
          </div>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === id
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-6 overflow-y-auto max-h-[72vh]">
          {tab === "general" && (
            <div className="space-y-5 max-w-xl">
              <div>
                <h3 className="text-sm font-bold text-white">Page details</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  These properties stay out of the visual editing workflow until explicitly opened.
                </p>
              </div>
              <Input
                label="Page Title"
                value={localSettings.title || ""}
                onChange={(event) => updateField("title", event.target.value)}
              />
              <Input
                label="Slug"
                value={localSettings.slug || ""}
                onChange={(event) => updateField("slug", event.target.value)}
                helperText="Used as the page identifier and content draft key."
              />
              <Input
                label="Route"
                value={localSettings.route || ""}
                onChange={(event) => updateField("route", event.target.value)}
                placeholder="/about-us"
              />
              <Input
                label="Layout"
                value={localSettings.layout || "default"}
                onChange={(event) => updateField("layout", event.target.value)}
              />
            </div>
          )}

          {tab === "seo" && (
            <SEOPanel
              seoData={localSettings.seo || {}}
              blocks={blocks}
              onChange={(seo) => updateField("seo", seo)}
            />
          )}

          {tab === "revisions" && (
            <RevisionPanel
              revisions={revisions}
              loading={revisionLoading}
              onRestore={onRestoreRevision}
              onCompare={() => {}}
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-800">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={applySettings}>Apply Settings</Button>
      </div>
    </Modal>
  );
}

export default VisualPageSettingsModal;
