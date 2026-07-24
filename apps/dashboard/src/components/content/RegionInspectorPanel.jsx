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
      case "heading": {
        const isObjectValue = typeof value === "object" && value !== null;
        const currentText = isObjectValue ? (value.text !== undefined ? value.text : "") : (typeof value === "string" ? value : "");
        const textObj = isObjectValue ? value : {};

        const updateProp = (prop, val) => {
          const base = isObjectValue ? { ...value } : (currentText ? { text: currentText } : {});
          if (!val) {
            delete base[prop];
          } else {
            base[prop] = val;
          }
          const keys = Object.keys(base).filter((k) => k !== "text");
          if (keys.length === 0 && typeof base.text === "string") {
            handleFieldChange(base.text);
          } else {
            handleFieldChange(base);
          }
        };

        const handleTextChange = (newText) => {
          if (isObjectValue) {
            handleFieldChange({ ...value, text: newText });
          } else {
            handleFieldChange(newText);
          }
        };

        return (
          <div className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Text Content
              </label>
              {type === "textarea" ? (
                <textarea
                  rows={4}
                  value={currentText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                  placeholder="Enter text..."
                />
              ) : (
                <Input
                  value={currentText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Enter text..."
                />
              )}
            </div>

            {/* Typography Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Typography & Styling</h5>

              {/* Font Size & Font Weight */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Font Size</label>
                  <select
                    value={textObj.fontSize || ""}
                    onChange={(e) => updateProp("fontSize", e.target.value)}
                    className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                  >
                    <option value="">Default (CSS)</option>
                    <option value="12px">12px (Small)</option>
                    <option value="14px">14px (Base Small)</option>
                    <option value="16px">16px (Body)</option>
                    <option value="18px">18px (Large Body)</option>
                    <option value="20px">20px (H4)</option>
                    <option value="24px">24px (H3)</option>
                    <option value="32px">32px (H2)</option>
                    <option value="48px">48px (H1 Hero)</option>
                    <option value="64px">64px (Display)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Font Weight</label>
                  <select
                    value={textObj.fontWeight || ""}
                    onChange={(e) => updateProp("fontWeight", e.target.value)}
                    className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                  >
                    <option value="">Default (CSS)</option>
                    <option value="300">Light (300)</option>
                    <option value="400">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="900">Black (900)</option>
                  </select>
                </div>
              </div>

              {/* Text Color & Alignment */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Text Color</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={textObj.color && textObj.color.startsWith("#") ? textObj.color : "#ffffff"}
                      onChange={(e) => updateProp("color", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={textObj.color || ""}
                      onChange={(e) => updateProp("color", e.target.value)}
                      placeholder="Default (CSS)"
                      className="w-full text-[11px] font-mono py-1 px-2 rounded border border-slate-750 bg-slate-850 text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Alignment</label>
                  <select
                    value={textObj.align || ""}
                    onChange={(e) => updateProp("align", e.target.value)}
                    className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                  >
                    <option value="">Default (CSS)</option>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="justify">Justify</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "image": {
        const imgObj = typeof value === "object" && value !== null
          ? value
          : { src: typeof value === "string" ? value : "", alt: "", width: "100%", height: "auto" };

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
              placeholder="Image alt text for SEO & accessibility..."
            />

            {/* Layout Dimensions */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dimensions</h5>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Width"
                  value={imgObj.width || "100%"}
                  onChange={(e) => handleFieldChange({ ...imgObj, width: e.target.value })}
                  placeholder="e.g. 100% or 400px"
                />
                <Input
                  label="Height"
                  value={imgObj.height || "auto"}
                  onChange={(e) => handleFieldChange({ ...imgObj, height: e.target.value })}
                  placeholder="e.g. auto or 300px"
                />
              </div>
            </div>
          </div>
        );
      }

      case "button": {
        const btnObj = typeof value === "object" && value !== null
          ? value
          : { text: typeof value === "string" ? value : "Button Label", href: "", variant: "primary", style: "solid" };

        return (
          <div className="space-y-4">
            <Input
              label="Button Text / Label"
              value={btnObj.text || btnObj.label || ""}
              onChange={(e) => handleFieldChange({ ...btnObj, text: e.target.value, label: e.target.value })}
              placeholder="e.g. Get Started Now"
            />
            <Input
              label="Link Destination (HREF / URL)"
              value={btnObj.href || btnObj.link || ""}
              onChange={(e) => handleFieldChange({ ...btnObj, href: e.target.value, link: e.target.value })}
              placeholder="e.g. /pricing or https://..."
            />

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Button Variant
                </label>
                <select
                  value={btnObj.variant || "primary"}
                  onChange={(e) => handleFieldChange({ ...btnObj, variant: e.target.value })}
                  className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                >
                  <option value="primary">Primary Accent</option>
                  <option value="secondary">Secondary Dark</option>
                  <option value="accent">Highlight Accent</option>
                  <option value="danger">Danger Red</option>
                  <option value="ghost">Ghost / Text</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Button Style
                </label>
                <select
                  value={btnObj.style || "solid"}
                  onChange={(e) => handleFieldChange({ ...btnObj, style: e.target.value })}
                  className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
                >
                  <option value="solid">Solid Filled</option>
                  <option value="outline">Border Outline</option>
                  <option value="soft">Soft Tint</option>
                  <option value="glass">Glassmorphism</option>
                </select>
              </div>
            </div>
          </div>
        );
      }

      case "section": {
        const secObj = typeof value === "object" && value !== null
          ? value
          : { background: "#0f172a", padding: "4rem 2rem", margin: "0" };

        return (
          <div className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-slate-400 uppercase block">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secObj.background && secObj.background.startsWith("#") ? secObj.background : "#0f172a"}
                  onChange={(e) => handleFieldChange({ ...secObj, background: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={secObj.background || "#0f172a"}
                  onChange={(e) => handleFieldChange({ ...secObj, background: e.target.value })}
                  className="flex-1 text-xs font-mono py-1.5 px-2 rounded border border-slate-750 bg-slate-850 text-slate-200 outline-none"
                  placeholder="#0f172a or transparent..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <Input
                label="Section Padding"
                value={secObj.padding || "4rem 2rem"}
                onChange={(e) => handleFieldChange({ ...secObj, padding: e.target.value })}
                placeholder="e.g. 4rem 2rem"
              />
              <Input
                label="Section Margin"
                value={secObj.margin || "0"}
                onChange={(e) => handleFieldChange({ ...secObj, margin: e.target.value })}
                placeholder="e.g. 0 auto"
              />
            </div>
          </div>
        );
      }

      case "richtext":
        return (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block text-left">
              HTML / Rich Text Markup
            </label>
            <textarea
              rows={8}
              value={typeof value === "string" ? value : (value?.html || value?.text || "")}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full text-xs font-mono p-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-200 outline-none focus:border-primary"
              placeholder="Enter HTML content..."
            />
          </div>
        );

      case "video": {
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
            <Input
              label="Video Title"
              value={vidObj.title || ""}
              onChange={(e) => handleFieldChange({ ...vidObj, title: e.target.value })}
              placeholder="e.g. Product Demo Video"
            />
          </div>
        );
      }

      case "repeater": {
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
      }

      default:
        return (
          <div className="space-y-3">
            <Input
              label="Region Label"
              value={label}
              disabled
            />
            <div className="text-xs text-slate-400 italic bg-slate-950/40 p-3 rounded border border-slate-800">
              Selected element properties. Adjust values above to update live site preview.
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
