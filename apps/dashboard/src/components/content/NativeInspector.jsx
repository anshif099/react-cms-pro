import React, { lazy, Suspense, useMemo, useState } from "react";
import {
  Accessibility,
  Box,
  Braces,
  ChevronDown,
  Eye,
  LayoutPanelTop,
  Move3D,
  Paintbrush,
  Search,
  SlidersHorizontal,
  Sparkles,
  Type,
  X
} from "lucide-react";
import {
  blockToComponentNode,
  componentNodeToBlock
} from "@anshif.rainhopes/reactcms-renderer";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";
import ColorPicker from "../ui/ColorPicker";
import Input from "../ui/Input";

const BlockFields = lazy(() => import("../blocks/BlockFields"));

function FieldLabel({ children }) {
  return <label className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-600 mb-1.5">{children}</label>;
}

function SelectField({ label, value, onChange, children }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value ?? ""}
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

function InspectorGroup({ title, icon: Icon, children, defaultOpen = true }) {
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

function FourSides({ label, values, onChange }) {
  const sides = ["Top", "Right", "Bottom", "Left"];
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {sides.map((side) => {
          const key = `${label.toLowerCase()}${side}`;
          return (
            <label key={side} className="text-center">
              <span className="block text-[8px] text-slate-700 mb-1">{side[0]}</span>
              <input
                type="number"
                value={Number.parseFloat(values[key]) || 0}
                onChange={(event) => onChange(key, `${event.target.value}px`)}
                className="w-full h-8 rounded-md border border-slate-800 bg-slate-950/50 text-[10px] text-center text-slate-200 outline-none focus:border-blue-500"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

const TABS = [
  { id: "content", label: "Content", icon: Box },
  { id: "style", label: "Style", icon: Paintbrush },
  { id: "advanced", label: "Advanced", icon: SlidersHorizontal }
];

export function NativeInspector({
  node,
  locale,
  responsiveMode,
  onUpdate,
  onClose
}) {
  const [tab, setTab] = useState("content");
  const schema = useMemo(
    () => node ? BLOCK_SCHEMAS.find((item) => item.type === node.type) : null,
    [node]
  );

  if (!node) {
    return (
      <aside className="w-[336px] flex-shrink-0 h-full border-l border-slate-800 bg-[#0b1120] flex flex-col text-left">
        <div className="h-12 px-4 border-b border-slate-800 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-slate-100">Inspector</span>
        </div>
        <div className="flex-1 grid place-items-center px-8 text-center">
          <div>
            <div className="w-12 h-12 mx-auto rounded-2xl border border-slate-800 bg-slate-950/50 flex items-center justify-center">
              <LayoutPanelTop className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-300 mt-4">Select a component</h3>
            <p className="text-[11px] leading-relaxed text-slate-600 mt-1.5">
              Click any component on the native canvas or choose it from Layers.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const base = node.styles?.base || {};
  const responsive = node.styles?.[responsiveMode] || {};
  const activeStyles = { ...base, ...responsive };
  const metadata = node.metadata || {};
  const design = node.props?.design || {};

  const updateNode = (patch) => onUpdate({ ...node, ...patch });
  const updateProps = (patch) => updateNode({ props: { ...(node.props || {}), ...patch } });
  const updateMetadata = (patch) => updateNode({ metadata: { ...metadata, ...patch } });
  const updateStyle = (key, value, mode = responsiveMode) => {
    const target = mode === "desktop" ? "base" : mode;
    updateNode({
      styles: {
        ...(node.styles || {}),
        [target]: {
          ...(node.styles?.[target] || {}),
          [key]: value
        }
      }
    });
  };

  const handleBlockChange = (block) => {
    const converted = blockToComponentNode(block);
    onUpdate({
      ...node,
      label: converted.label || node.label,
      props: converted.props,
      children: node.children,
      styles: node.styles,
      metadata: node.metadata
    });
  };

  return (
    <aside className="w-[336px] flex-shrink-0 h-full border-l border-slate-800 bg-[#0b1120] flex flex-col text-left">
      <div className="h-12 px-4 border-b border-slate-800 flex items-center gap-2">
        <Box className="w-4 h-4 text-blue-400" />
        <div className="min-w-0">
          <span className="block text-xs font-bold text-slate-100 truncate">{node.label || schema?.label || node.type}</span>
          <span className="block text-[8px] uppercase tracking-wider text-slate-600">{node.type} / {responsiveMode}</span>
        </div>
        <button type="button" onClick={onClose} className="ml-auto p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-slate-900 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-10 grid grid-cols-3 p-1 border-b border-slate-800 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
              tab === id ? "bg-blue-600 text-white" : "text-slate-600 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "content" && (
          <>
            <InspectorGroup title="Component Content" icon={Box}>
              <Input
                label="Layer Name"
                value={node.label || ""}
                onChange={(event) => updateNode({ label: event.target.value })}
              />
              {schema ? (
                <Suspense fallback={<div className="py-8 text-center text-[10px] text-slate-600">Loading component controls...</div>}>
                  <BlockFields
                    block={componentNodeToBlock(node)}
                    locale={locale}
                    onChange={handleBlockChange}
                  />
                </Suspense>
              ) : (
                <p className="text-[10px] text-slate-600">This component uses renderer-native controls.</p>
              )}
            </InspectorGroup>
            <InspectorGroup title="Data Binding" icon={Braces} defaultOpen={false}>
              <Input
                label="Data Source"
                value={metadata.bindings?.source || ""}
                placeholder="collection, API, global content"
                onChange={(event) => updateMetadata({
                  bindings: { ...(metadata.bindings || {}), source: event.target.value }
                })}
              />
              <Input
                label="Value Path"
                value={metadata.bindings?.path || ""}
                placeholder="post.title"
                onChange={(event) => updateMetadata({
                  bindings: { ...(metadata.bindings || {}), path: event.target.value }
                })}
              />
              <Input
                label="Fallback"
                value={metadata.bindings?.fallback || ""}
                onChange={(event) => updateMetadata({
                  bindings: { ...(metadata.bindings || {}), fallback: event.target.value }
                })}
              />
            </InspectorGroup>
          </>
        )}

        {tab === "style" && (
          <>
            <InspectorGroup title="Typography" icon={Type}>
              <ColorPicker label="Text Color" value={activeStyles.color || "#0f172a"} onChange={(value) => updateStyle("color", value)} />
              <Input label="Font Family" value={activeStyles.fontFamily || ""} placeholder="Inter, sans-serif" onChange={(event) => updateStyle("fontFamily", event.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Font Size" type="number" value={Number.parseFloat(activeStyles.fontSize) || ""} onChange={(event) => updateStyle("fontSize", `${event.target.value}px`)} />
                <SelectField label="Weight" value={activeStyles.fontWeight || "400"} onChange={(value) => updateStyle("fontWeight", value)}>
                  <option value="300">Light</option>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semi Bold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extra Bold</option>
                </SelectField>
                <Input label="Line Height" value={activeStyles.lineHeight || ""} placeholder="1.5" onChange={(event) => updateStyle("lineHeight", event.target.value)} />
                <Input label="Letter Spacing" value={activeStyles.letterSpacing || ""} placeholder="0px" onChange={(event) => updateStyle("letterSpacing", event.target.value)} />
              </div>
              <SelectField label="Alignment" value={activeStyles.textAlign || "left"} onChange={(value) => updateStyle("textAlign", value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </SelectField>
            </InspectorGroup>

            <InspectorGroup title="Spacing" icon={Move3D}>
              <FourSides label="Padding" values={activeStyles} onChange={updateStyle} />
              <FourSides label="Margin" values={activeStyles} onChange={updateStyle} />
              <RangeField
                label="Section Vertical Space"
                value={design.paddingY ?? 36}
                min={0}
                max={200}
                suffix="px"
                onChange={(paddingY) => updateProps({ design: { ...design, paddingY } })}
              />
            </InspectorGroup>

            <InspectorGroup title="Surface" icon={Paintbrush}>
              <ColorPicker label="Background" value={design.background || activeStyles.backgroundColor || "#ffffff"} onChange={(background) => updateProps({ design: { ...design, background } })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Border Width" type="number" value={Number.parseFloat(activeStyles.borderWidth) || 0} onChange={(event) => updateStyle("borderWidth", `${event.target.value}px`)} />
                <SelectField label="Border Style" value={activeStyles.borderStyle || "solid"} onChange={(value) => updateStyle("borderStyle", value)}>
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </SelectField>
              </div>
              <ColorPicker label="Border Color" value={activeStyles.borderColor || "#cbd5e1"} onChange={(value) => updateStyle("borderColor", value)} />
              <RangeField label="Radius" value={Number.parseFloat(activeStyles.borderRadius) || 0} min={0} max={80} suffix="px" onChange={(value) => updateStyle("borderRadius", `${value}px`)} />
              <SelectField label="Shadow" value={activeStyles.boxShadow || "none"} onChange={(value) => updateStyle("boxShadow", value)}>
                <option value="none">None</option>
                <option value="0 4px 14px rgba(15,23,42,.1)">Small</option>
                <option value="0 12px 32px rgba(15,23,42,.16)">Medium</option>
                <option value="0 24px 60px rgba(15,23,42,.22)">Large</option>
              </SelectField>
              <RangeField label="Opacity" value={(activeStyles.opacity ?? 1) * 100} min={0} max={100} suffix="%" onChange={(value) => updateStyle("opacity", value / 100)} />
            </InspectorGroup>
          </>
        )}

        {tab === "advanced" && (
          <>
            <InspectorGroup title="Layout & Position" icon={LayoutPanelTop}>
              <SelectField label="Display" value={activeStyles.display || "block"} onChange={(value) => updateStyle("display", value)}>
                <option value="block">Block</option>
                <option value="flex">Flex</option>
                <option value="grid">Grid</option>
                <option value="inline-flex">Inline Flex</option>
                <option value="none">None</option>
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Position" value={activeStyles.position || "relative"} onChange={(value) => updateStyle("position", value)}>
                  <option value="relative">Relative</option>
                  <option value="absolute">Absolute</option>
                  <option value="sticky">Sticky</option>
                  <option value="fixed">Fixed</option>
                </SelectField>
                <Input label="Z Index" type="number" value={activeStyles.zIndex || ""} onChange={(event) => updateStyle("zIndex", Number(event.target.value))} />
                <Input label="Width" value={activeStyles.width || ""} placeholder="auto / 100%" onChange={(event) => updateStyle("width", event.target.value)} />
                <Input label="Min Height" value={activeStyles.minHeight || ""} placeholder="auto" onChange={(event) => updateStyle("minHeight", event.target.value)} />
                <Input label="Gap" type="number" value={Number.parseFloat(activeStyles.gap) || 0} onChange={(event) => updateStyle("gap", `${event.target.value}px`)} />
                <Input label="Max Width" value={activeStyles.maxWidth || ""} placeholder="none" onChange={(event) => updateStyle("maxWidth", event.target.value)} />
              </div>
              <SelectField label="Overflow" value={activeStyles.overflow || "visible"} onChange={(value) => updateStyle("overflow", value)}>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="auto">Auto</option>
                <option value="scroll">Scroll</option>
              </SelectField>
            </InspectorGroup>

            <InspectorGroup title="Transform" icon={Move3D} defaultOpen={false}>
              <Input
                label="CSS Transform"
                value={activeStyles.transform || ""}
                placeholder="translateX(0) scale(1)"
                onChange={(event) => updateStyle("transform", event.target.value)}
              />
              <Input label="Transform Origin" value={activeStyles.transformOrigin || ""} placeholder="center center" onChange={(event) => updateStyle("transformOrigin", event.target.value)} />
            </InspectorGroup>

            <InspectorGroup title="Animation" icon={Sparkles} defaultOpen={false}>
              <SelectField
                label="Animation"
                value={metadata.animation?.name || "none"}
                onChange={(name) => updateMetadata({ animation: { ...(metadata.animation || {}), name } })}
              >
                <option value="none">None</option>
                <option value="fade-in">Fade In</option>
                <option value="slide-up">Slide Up</option>
                <option value="scale-in">Scale In</option>
                <option value="parallax">Parallax</option>
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Duration (ms)" type="number" value={metadata.animation?.duration || 400} onChange={(event) => updateMetadata({ animation: { ...(metadata.animation || {}), duration: Number(event.target.value) } })} />
                <Input label="Delay (ms)" type="number" value={metadata.animation?.delay || 0} onChange={(event) => updateMetadata({ animation: { ...(metadata.animation || {}), delay: Number(event.target.value) } })} />
              </div>
            </InspectorGroup>

            <InspectorGroup title="Responsive & Visibility" icon={Eye} defaultOpen={false}>
              <p className="text-[10px] leading-relaxed text-slate-600">
                Style changes are currently applied to <strong className="text-slate-400">{responsiveMode}</strong>. Desktop values become the global base.
              </p>
              {["desktop", "laptop", "tablet", "mobile"].map((mode) => (
                <label key={mode} className="h-9 px-2.5 rounded-lg border border-slate-800 bg-slate-950/30 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={node.props?.visibility?.[mode] !== false}
                    onChange={(event) => updateProps({
                      visibility: { ...(node.props?.visibility || {}), [mode]: event.target.checked }
                    })}
                  />
                  <span className="text-[11px] font-semibold text-slate-400 capitalize">{mode}</span>
                </label>
              ))}
            </InspectorGroup>

            <InspectorGroup title="Accessibility" icon={Accessibility} defaultOpen={false}>
              <Input
                label="ARIA Label"
                value={metadata.accessibility?.ariaLabel || ""}
                onChange={(event) => updateMetadata({
                  accessibility: { ...(metadata.accessibility || {}), ariaLabel: event.target.value }
                })}
              />
              <Input
                label="Role"
                value={metadata.accessibility?.role || ""}
                placeholder="region, navigation, article"
                onChange={(event) => updateMetadata({
                  accessibility: { ...(metadata.accessibility || {}), role: event.target.value }
                })}
              />
              <Input
                label="Tab Index"
                type="number"
                value={metadata.accessibility?.tabIndex ?? ""}
                onChange={(event) => updateMetadata({
                  accessibility: { ...(metadata.accessibility || {}), tabIndex: Number(event.target.value) }
                })}
              />
            </InspectorGroup>

            <InspectorGroup title="Component SEO" icon={Search} defaultOpen={false}>
              <Input label="Semantic Tag" value={metadata.seo?.tag || ""} placeholder="section / article" onChange={(event) => updateMetadata({ seo: { ...(metadata.seo || {}), tag: event.target.value } })} />
              <Input label="Structured Data Type" value={metadata.seo?.schemaType || ""} placeholder="Product, FAQPage, Article" onChange={(event) => updateMetadata({ seo: { ...(metadata.seo || {}), schemaType: event.target.value } })} />
            </InspectorGroup>
          </>
        )}
      </div>
    </aside>
  );
}

export default NativeInspector;
