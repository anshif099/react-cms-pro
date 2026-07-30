import React, { lazy, Suspense, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Box,
  ChevronDown,
  Image as ImageIcon,
  Link2,
  MousePointerClick,
  Paintbrush,
  SlidersHorizontal,
  Type,
  X
} from "lucide-react";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";
import ColorPicker from "../ui/ColorPicker";
import Input from "../ui/Input";
import MediaLibraryModal from "./MediaLibraryModal";

const BlockFields = lazy(() => import("../blocks/BlockFields"));

function FieldLabel({ children }) {
  return (
    <label className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-600 mb-1.5">
      {children}
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"
      >
        {children}
      </select>
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, suffix = "", onChange }) {
  const numeric = Number.parseFloat(value) || 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[9px] font-mono text-slate-500">{numeric}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numeric}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  );
}

function AlignmentControl({ value, onChange }) {
  const options = [
    { id: "left", icon: AlignLeft },
    { id: "center", icon: AlignCenter },
    { id: "right", icon: AlignRight }
  ];

  return (
    <div>
      <FieldLabel>Alignment</FieldLabel>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1">
        {options.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`h-8 rounded-md flex items-center justify-center cursor-pointer ${
              value === id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function InspectorSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-slate-800/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full h-10 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer"
      >
        <Icon className="w-3.5 h-3.5 text-blue-400" />
        <span>{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </section>
  );
}

function getTextValue(value) {
  if (value && typeof value === "object") {
    return value.text ?? value.label ?? "";
  }
  return value ?? "";
}

function getObjectValue(value, textKey = "text") {
  if (value && typeof value === "object") return { ...value };
  return { [textKey]: value ?? "" };
}

export function VisualInspector({
  selected,
  activeLocale,
  onRegionChange,
  onBlockChange,
  onClose
}) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const region = selected?.kind === "region" ? selected : null;
  const block = selected?.kind === "block" ? selected.block : null;
  const value = region?.value;
  const computed = region?.computedStyle || {};

  const title = useMemo(() => {
    if (block) {
      return BLOCK_SCHEMAS.find((item) => item.type === block.type)?.label || block.type;
    }
    return region?.label || region?.id || "Inspector";
  }, [block, region]);

  const updateRegion = (nextValue) => {
    if (region) onRegionChange?.(region.id, nextValue);
  };

  const updateTextProperty = (key, nextValue) => {
    if (key === "text" && (!value || typeof value !== "object")) {
      updateRegion(nextValue);
      return;
    }
    updateRegion({ ...getObjectValue(value), [key]: nextValue });
  };

  if (!selected) {
    return (
      <aside className="w-[320px] flex-shrink-0 h-full border-l border-slate-800 bg-[#0b1120] flex flex-col text-left">
        <div className="h-12 px-4 border-b border-slate-800 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-slate-100">Inspector</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-12 h-12 rounded-2xl border border-slate-800 bg-slate-950/50 flex items-center justify-center text-slate-600">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-300 mt-4">Select an element</h3>
          <p className="text-[11px] leading-relaxed text-slate-600 mt-1.5">
            Click editable content on the live canvas or choose a region from the page structure.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] flex-shrink-0 h-full border-l border-slate-800 bg-[#0b1120] flex flex-col text-left">
      <div className="h-12 px-4 border-b border-slate-800 flex items-center gap-2">
        {block ? <Box className="w-4 h-4 text-blue-400" /> : <SlidersHorizontal className="w-4 h-4 text-blue-400" />}
        <div className="min-w-0">
          <span className="block text-xs font-bold text-slate-100 truncate">{title}</span>
          <span className="block text-[8px] uppercase tracking-wider text-slate-600">{block ? "Section" : region?.type}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-slate-900 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {block && (
          <>
            <InspectorSection title="Section Content" icon={Box}>
              <Suspense fallback={<div className="py-8 text-center text-[10px] text-slate-600">Loading section controls...</div>}>
                <BlockFields
                  block={block}
                  locale={activeLocale}
                  onChange={(nextBlock) => onBlockChange?.(block.id, nextBlock)}
                />
              </Suspense>
            </InspectorSection>

            <InspectorSection title="Spacing & Surface" icon={Paintbrush} defaultOpen={false}>
              <ColorPicker
                label="Background"
                value={block.design?.background || "#ffffff"}
                onChange={(background) => onBlockChange?.(block.id, {
                  ...block,
                  design: { ...block.design, background }
                })}
              />
              <RangeField
                label="Vertical Padding"
                value={block.design?.paddingY ?? 64}
                min={0}
                max={180}
                suffix="px"
                onChange={(paddingY) => onBlockChange?.(block.id, {
                  ...block,
                  design: { ...block.design, paddingY }
                })}
              />
              <RangeField
                label="Content Width"
                value={block.design?.maxWidth ?? 1120}
                min={640}
                max={1600}
                step={10}
                suffix="px"
                onChange={(maxWidth) => onBlockChange?.(block.id, {
                  ...block,
                  design: { ...block.design, maxWidth }
                })}
              />
            </InspectorSection>
          </>
        )}

        {region && ["text", "textarea", "richtext"].includes(region.type) && (
          <>
            <InspectorSection title="Content" icon={Type}>
              <div>
                <FieldLabel>Text</FieldLabel>
                <textarea
                  value={getTextValue(value)}
                  onChange={(event) => updateTextProperty("text", event.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-100 outline-none resize-y focus:border-blue-500"
                />
                <p className="text-[9px] text-slate-600 mt-1.5">Tip: double-click text on the canvas to edit inline.</p>
              </div>
            </InspectorSection>

            <InspectorSection title="Typography" icon={Paintbrush}>
              <ColorPicker
                label="Text Color"
                value={value?.color || computed.color || "#111827"}
                onChange={(color) => updateTextProperty("color", color)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Font Size"
                  value={String(value?.fontSize || computed.fontSize || "16px").replace("px", "")}
                  type="number"
                  onChange={(event) => updateTextProperty("fontSize", `${event.target.value}px`)}
                />
                <SelectField
                  label="Weight"
                  value={value?.fontWeight || computed.fontWeight || "400"}
                  onChange={(fontWeight) => updateTextProperty("fontWeight", fontWeight)}
                >
                  <option value="300">Light</option>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semi Bold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extra Bold</option>
                </SelectField>
              </div>
              <AlignmentControl
                value={value?.align || computed.textAlign || "left"}
                onChange={(align) => updateTextProperty("align", align)}
              />
            </InspectorSection>
          </>
        )}

        {region && region.type === "image" && (
          <>
            <InspectorSection title="Image" icon={ImageIcon}>
              {getObjectValue(value, "src").src && (
                <img
                  src={getObjectValue(value, "src").src}
                  alt=""
                  className="w-full h-32 object-cover rounded-xl border border-slate-800 bg-slate-950"
                />
              )}
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="w-full h-9 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[11px] font-bold hover:bg-blue-500/15 cursor-pointer"
              >
                Replace Image
              </button>
              <Input
                label="Alt Text"
                value={getObjectValue(value, "src").alt || ""}
                onChange={(event) => updateRegion({ ...getObjectValue(value, "src"), alt: event.target.value })}
              />
            </InspectorSection>
            <InspectorSection title="Size & Crop" icon={SlidersHorizontal}>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Width"
                  value={getObjectValue(value, "src").width || ""}
                  placeholder="100%"
                  onChange={(event) => updateRegion({ ...getObjectValue(value, "src"), width: event.target.value })}
                />
                <Input
                  label="Height"
                  value={getObjectValue(value, "src").height || ""}
                  placeholder="Auto"
                  onChange={(event) => updateRegion({ ...getObjectValue(value, "src"), height: event.target.value })}
                />
              </div>
              <SelectField
                label="Crop"
                value={getObjectValue(value, "src").objectFit || "cover"}
                onChange={(objectFit) => updateRegion({ ...getObjectValue(value, "src"), objectFit })}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
                <option value="none">Original</option>
              </SelectField>
            </InspectorSection>
          </>
        )}

        {region && region.type === "button" && (
          <>
            <InspectorSection title="Button" icon={MousePointerClick}>
              <Input
                label="Label"
                value={getObjectValue(value).text || ""}
                onChange={(event) => updateRegion({ ...getObjectValue(value), text: event.target.value })}
              />
              <Input
                label="URL"
                icon={Link2}
                value={getObjectValue(value).href || ""}
                onChange={(event) => updateRegion({ ...getObjectValue(value), href: event.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Variant"
                  value={getObjectValue(value).variant || "primary"}
                  onChange={(variant) => updateRegion({ ...getObjectValue(value), variant })}
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                  <option value="ghost">Ghost</option>
                </SelectField>
                <SelectField
                  label="Size"
                  value={getObjectValue(value).size || "md"}
                  onChange={(size) => updateRegion({ ...getObjectValue(value), size })}
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </SelectField>
              </div>
            </InspectorSection>
            <InspectorSection title="Appearance" icon={Paintbrush}>
              <ColorPicker
                label="Button Color"
                value={getObjectValue(value).color || "#2563eb"}
                onChange={(color) => updateRegion({ ...getObjectValue(value), color })}
              />
              <RangeField
                label="Corner Radius"
                value={getObjectValue(value).radius ?? 8}
                min={0}
                max={40}
                suffix="px"
                onChange={(radius) => updateRegion({ ...getObjectValue(value), radius })}
              />
              <SelectField
                label="Shadow"
                value={getObjectValue(value).shadow || "md"}
                onChange={(shadow) => updateRegion({ ...getObjectValue(value), shadow })}
              >
                <option value="none">None</option>
                <option value="sm">Subtle</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </SelectField>
            </InspectorSection>
          </>
        )}

        {region && ["section", "repeater"].includes(region.type) && (
          <InspectorSection title="Section" icon={Box}>
            <ColorPicker
              label="Background"
              value={value?.background || computed.backgroundColor || "#ffffff"}
              onChange={(background) => updateRegion({ ...getObjectValue(value), background })}
            />
            <RangeField
              label="Vertical Padding"
              value={Number.parseInt(value?.paddingY || computed.paddingTop, 10) || 64}
              min={0}
              max={180}
              suffix="px"
              onChange={(paddingY) => updateRegion({ ...getObjectValue(value), paddingY })}
            />
            <SelectField
              label="Layout"
              value={value?.layout || "container"}
              onChange={(layout) => updateRegion({ ...getObjectValue(value), layout })}
            >
              <option value="container">Contained</option>
              <option value="full">Full Width</option>
              <option value="grid">Grid</option>
              <option value="flex">Flex</option>
            </SelectField>
          </InspectorSection>
        )}

        {region && !["text", "textarea", "richtext", "image", "button", "section", "repeater"].includes(region.type) && (
          <InspectorSection title="Value" icon={SlidersHorizontal}>
            <textarea
              value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}
              onChange={(event) => updateRegion(event.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs font-mono text-slate-200 outline-none focus:border-blue-500"
            />
          </InspectorSection>
        )}
      </div>

      <MediaLibraryModal
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(src) => {
          updateRegion({ ...getObjectValue(value, "src"), src });
          setMediaOpen(false);
        }}
      />
    </aside>
  );
}

export default VisualInspector;
