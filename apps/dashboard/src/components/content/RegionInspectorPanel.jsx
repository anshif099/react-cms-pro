import React from "react";
import { MousePointerClick, ChevronRight, Sliders, Layers, Type, Image as ImageIcon, Video, Repeat, Box, FileText } from "lucide-react";
import Input from "../ui/Input";
import ImagePicker from "../ui/ImagePicker";

export function RegionInspectorPanel({
  selectedElement,
  onChangeRegion = () => {},
  activePageId = "global"
}) {
  if (!selectedElement || !selectedElement.regionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-500 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-center text-primary mb-4">
          <MousePointerClick className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-bold text-sm text-slate-200">Visual Region Inspector</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Hover and click on any highlighted region in the preview frame or select a node in the Region Tree to edit its values live.
        </p>
      </div>
    );
  }

  const { regionId, type = "text", label = regionId, value } = selectedElement;

  const handleFieldChange = (newValue) => {
    onChangeRegion(regionId, newValue);
  };

  const renderFieldControls = () => {
    switch (type) {
      case "text":
      case "textarea":
        return (
          <div className="space-y-3">
            <Input
              label="Text Content"
              value={typeof value === "string" ? value : (value?.text || "")}
              onChange={(e) => handleFieldChange(e.target.value)}
              placeholder="Enter text..."
            />
          </div>
        );

      case "image":
        const imgObj = typeof value === "object" && value !== null
          ? value
          : { src: typeof value === "string" ? value : "", alt: "" };

        return (
          <div className="space-y-4">
            <ImagePicker
              label="Image Source URL"
              value={imgObj.src || ""}
              onChange={(newSrc) => handleFieldChange({ ...imgObj, src: newSrc })}
              placeholder="Select or enter image URL..."
            />
            <Input
              label="Alt Description"
              value={imgObj.alt || ""}
              onChange={(e) => handleFieldChange({ ...imgObj, alt: e.target.value })}
              placeholder="Image alt text for accessibility..."
            />
          </div>
        );

      case "button":
        const btnObj = typeof value === "object" && value !== null
          ? value
          : { text: typeof value === "string" ? value : "Button Label", href: "", variant: "primary" };

        return (
          <div className="space-y-4">
            <Input
              label="Button Text"
              value={btnObj.text || ""}
              onChange={(e) => handleFieldChange({ ...btnObj, text: e.target.value })}
              placeholder="e.g. Get Started"
            />
            <Input
              label="Link Destination (HREF)"
              value={btnObj.href || ""}
              onChange={(e) => handleFieldChange({ ...btnObj, href: e.target.value })}
              placeholder="e.g. /signup or https://..."
            />
            <div className="flex flex-col gap-1 text-left">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                Button Variant
              </label>
              <select
                value={btnObj.variant || "primary"}
                onChange={(e) => handleFieldChange({ ...btnObj, variant: e.target.value })}
                className="w-full text-xs py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
              >
                <option value="primary">Primary Solid</option>
                <option value="secondary">Secondary Outline</option>
                <option value="accent">Accent Highlight</option>
              </select>
            </div>
          </div>
        );

      case "richtext":
        return (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block text-left">
              HTML / Rich Text Markup
            </label>
            <textarea
              rows={6}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full text-xs font-mono p-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
              placeholder="Enter HTML content..."
            />
          </div>
        );

      case "video":
        const vidObj = typeof value === "object" && value !== null
          ? value
          : { url: typeof value === "string" ? value : "", title: "" };

        return (
          <div className="space-y-4">
            <Input
              label="Video Source URL / Embed Code"
              value={vidObj.url || ""}
              onChange={(e) => handleFieldChange({ ...vidObj, url: e.target.value })}
              placeholder="e.g. https://www.youtube.com/embed/..."
            />
          </div>
        );

      case "repeater":
        const items = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                Repeater Items ({items.length})
              </label>
              <button
                onClick={() => handleFieldChange([...items, { id: `item-${Date.now()}`, title: "New Item" }])}
                className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold cursor-pointer hover:bg-primary/30"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-2 bg-slate-850 rounded border border-slate-750 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={typeof item === "string" ? item : item.title || item.label || `Item ${idx + 1}`}
                    onChange={(e) => {
                      const updated = [...items];
                      if (typeof item === "object" && item !== null) {
                        updated[idx] = { ...item, title: e.target.value };
                      } else {
                        updated[idx] = e.target.value;
                      }
                      handleFieldChange(updated);
                    }}
                    className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none"
                  />
                  <button
                    onClick={() => {
                      const updated = items.filter((_, i) => i !== idx);
                      handleFieldChange(updated);
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case "section":
      default:
        return (
          <div className="space-y-3">
            <Input
              label="Region Label"
              value={label}
              disabled
            />
            <div className="text-xs text-slate-400 italic bg-slate-950/40 p-3 rounded border border-slate-800">
              Section wrapper region selected. Child elements inside this section can be inspected individually.
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border-l border-slate-800 text-slate-100 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Sliders className="w-4 h-4" />
          <span className="text-xs font-bold text-slate-200">Region Inspector</span>
        </div>
        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 py-0.5 px-2 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
          {type}
        </span>
      </div>

      {/* Path Breadcrumb */}
      <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-850 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 font-mono overflow-x-auto whitespace-nowrap">
        <span>Page: {activePageId}</span>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-purple-400 select-all">{regionId}</span>
      </div>

      {/* Inspector Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
        {renderFieldControls()}
      </div>
    </div>
  );
}

export default RegionInspectorPanel;
