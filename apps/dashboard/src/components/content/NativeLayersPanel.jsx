import React, { useMemo, useState } from "react";
import {
  AlignLeft,
  Box,
  Braces,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Code,
  CodeXml,
  Columns3,
  Copy,
  CreditCard,
  DatabaseZap,
  Eye,
  EyeOff,
  GalleryHorizontal,
  Grid,
  Grid3X3,
  GripVertical,
  HelpCircle,
  Image,
  Layers,
  LayoutGrid,
  ListCollapse,
  ListFilter,
  Lock,
  Mail,
  MapPinned,
  Menu,
  MessageSquare,
  Minus,
  MousePointerClick,
  MoveVertical,
  Newspaper,
  PanelsTopLeft,
  PanelTopOpen,
  Plus,
  Search,
  Send,
  SquareCheckBig,
  SquareDashed,
  Star,
  TextCursorInput,
  TextSelect,
  Trash2,
  Type,
  Unlock,
  Users,
  Video
} from "lucide-react";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";

const ICON_MAP = {
  AlignLeft,
  Box,
  Braces,
  BriefcaseBusiness,
  Code,
  CodeXml,
  Columns3,
  CreditCard,
  DatabaseZap,
  GalleryHorizontal,
  Grid,
  Grid3X3,
  HelpCircle,
  Image,
  Layers,
  LayoutGrid,
  ListCollapse,
  ListFilter,
  Mail,
  MapPinned,
  Menu,
  MessageSquare,
  Minus,
  MousePointerClick,
  MoveVertical,
  Newspaper,
  PanelsTopLeft,
  PanelTopOpen,
  Send,
  SquareCheckBig,
  SquareDashed,
  Star,
  TextCursorInput,
  TextSelect,
  Type,
  Users,
  Video
};

const LIBRARY_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "content", label: "Basic" },
  { id: "layout", label: "Layout" },
  { id: "commerce", label: "Marketing" },
  { id: "social", label: "Forms & Social" },
  { id: "actions", label: "Advanced" }
];

function schemaFor(type) {
  return BLOCK_SCHEMAS.find((schema) => schema.type === type);
}

function LayerRow({
  node,
  depth,
  selectedIds,
  expanded,
  onToggleExpanded,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onToggleLocked
}) {
  const schema = schemaFor(node.type);
  const Icon = ICON_MAP[schema?.icon] || Box;
  const hasChildren = node.children?.length > 0;
  const isOpen = expanded.has(node.id);
  const selected = selectedIds.includes(node.id);

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = event.dataTransfer.getData("application/reactcms-node");
    if (!sourceId || sourceId === node.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    const position = ratio < 0.3
      ? "before"
      : ratio > 0.7
        ? "after"
        : ["section", "container", "columns", "grid", "flex"].includes(node.type)
          ? "inside"
          : "after";
    onMove(sourceId, node.id, position);
  };

  return (
    <div>
      <div
        draggable={!node.locked}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/reactcms-node", node.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={handleDrop}
        onClick={(event) => onSelect(node.id, event.ctrlKey || event.metaKey || event.shiftKey)}
        className={`group h-9 flex items-center gap-1.5 rounded-lg border cursor-pointer transition-colors ${
          selected
            ? "border-blue-500/45 bg-blue-500/12 text-white"
            : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/70"
        }`}
        style={{ paddingLeft: `${6 + depth * 16}px`, paddingRight: "6px" }}
      >
        <span className="text-slate-700 group-hover:text-slate-500 cursor-grab">
          <GripVertical className="w-3 h-3" />
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) onToggleExpanded(node.id);
          }}
          className="w-4 h-5 flex items-center justify-center text-slate-600 cursor-pointer"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : null}
        </button>
        <Icon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold truncate flex-1">
          {node.label || schema?.label || node.type}
        </span>

        <span className="hidden group-hover:flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden(node.id);
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-white cursor-pointer"
            title={node.hidden ? "Show" : "Hide"}
          >
            {node.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleLocked(node.id);
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-white cursor-pointer"
            title={node.locked ? "Unlock" : "Lock"}
          >
            {node.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(node.id);
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-white cursor-pointer"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1 rounded hover:bg-rose-500/10 text-slate-600 hover:text-rose-300 cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </span>
      </div>

      {hasChildren && isOpen && node.children.map((child) => (
        <LayerRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedIds={selectedIds}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          onSelect={onSelect}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleHidden={onToggleHidden}
          onToggleLocked={onToggleLocked}
        />
      ))}
    </div>
  );
}

export function NativeLayersPanel({
  tree,
  pageTitle,
  selectedIds,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onToggleLocked,
  onAdd
}) {
  const [tab, setTab] = useState("layers");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set(["page"]));

  const components = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return BLOCK_SCHEMAS.filter((schema) => {
      const categoryMatch = category === "all" || schema.category === category;
      const queryMatch = !clean || `${schema.label} ${schema.type} ${schema.description}`.toLowerCase().includes(clean);
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  const toggleExpanded = (nodeId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <aside className="w-[286px] flex-shrink-0 h-full bg-[#0b1120] border-r border-slate-800 flex flex-col text-left">
      <div className="h-12 border-b border-slate-800 grid grid-cols-2 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setTab("layers")}
          className={`rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === "layers" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Layers
        </button>
        <button
          type="button"
          onClick={() => setTab("elements")}
          className={`rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === "elements" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Element
        </button>
      </div>

      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "layers" ? "Search layers..." : "Search elements..."}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-800 bg-slate-950/60 text-[11px] text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      {tab === "layers" ? (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="h-9 flex items-center gap-2 px-2 rounded-lg text-slate-300 bg-slate-950/25 border border-slate-800/60 mb-1">
            <ChevronDown className="w-3 h-3 text-slate-600" />
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-bold truncate">{pageTitle || "Page"}</span>
            <span className="ml-auto text-[9px] font-mono text-slate-600">{tree.children.length}</span>
          </div>
          {tree.children
            .filter((node) => !query || `${node.label} ${node.type}`.toLowerCase().includes(query.toLowerCase()) || node.children?.length)
            .map((node) => (
              <LayerRow
                key={node.id}
                node={node}
                depth={0}
                selectedIds={selectedIds}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                onSelect={onSelect}
                onMove={onMove}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onToggleHidden={onToggleHidden}
                onToggleLocked={onToggleLocked}
              />
            ))}
          {tree.children.length === 0 && (
            <div className="m-2 px-3 py-8 rounded-xl border border-dashed border-slate-800 text-center text-[10px] text-slate-600">
              Add an element to start building this page.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-slate-800/70">
            {LIBRARY_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`px-2.5 py-1 rounded-md text-[9px] font-bold whitespace-nowrap cursor-pointer ${
                  category === item.id
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/25"
                    : "text-slate-600 border border-transparent hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 content-start gap-1.5">
            {components.map((schema) => {
              const Icon = ICON_MAP[schema.icon] || Box;
              return (
                <button
                  key={schema.type}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/reactcms-component", schema.type);
                  }}
                  onClick={() => onAdd(schema.type, selectedIds[0] || null, selectedIds[0] ? "after" : "after")}
                  className="min-h-20 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-blue-500/40 hover:bg-blue-500/5 flex flex-col items-center justify-center gap-2 p-2 text-center cursor-grab active:cursor-grabbing"
                  title={schema.description}
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 leading-tight">{schema.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="p-3 border-t border-slate-800 bg-slate-950/20">
        <button
          type="button"
          onClick={() => setTab("elements")}
          className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/30 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Element
        </button>
      </div>
    </aside>
  );
}

export default NativeLayersPanel;
