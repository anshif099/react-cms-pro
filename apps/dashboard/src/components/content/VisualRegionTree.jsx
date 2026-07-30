import React, { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Image,
  Layers,
  Plus,
  Search,
  Trash2,
  Type
} from "lucide-react";
import DraggableList from "../ui/DraggableList";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";

function RegionIcon({ type }) {
  if (type === "image" || type === "video") return <Image className="w-3.5 h-3.5" />;
  if (type === "section" || type === "repeater") return <Box className="w-3.5 h-3.5" />;
  return <Type className="w-3.5 h-3.5" />;
}

function BlockTreeItem({
  block,
  active,
  onSelect,
  onDuplicate,
  onDelete,
  dragHandleProps
}) {
  const schema = BLOCK_SCHEMAS.find((item) => item.type === block.type);
  const Icon = Icons[schema?.icon] || Box;

  return (
    <div
      onClick={() => onSelect(block)}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-2 cursor-pointer ${
        active
          ? "border-blue-500/50 bg-blue-500/10 text-white"
          : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/60 hover:text-slate-200"
      }`}
    >
      <button
        type="button"
        {...dragHandleProps}
        onClick={(event) => event.stopPropagation()}
        className="text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Icon className="w-3.5 h-3.5 text-blue-400" />
      <span className="text-[11px] font-semibold truncate flex-1">{schema?.label || block.type}</span>
      <span className="hidden group-hover:flex items-center gap-0.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(block.id);
          }}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white cursor-pointer"
          title="Duplicate"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(block.id);
          }}
          className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-300 cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </span>
    </div>
  );
}

export function VisualRegionTree({
  regions,
  blocks,
  selected,
  onSelectRegion,
  onSelectBlock,
  onBlocksChange,
  onDuplicateBlock,
  onDeleteBlock,
  onAddSection
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState(() => new Set(["page", "global", "sections"]));

  const groups = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const grouped = {};
    Object.values(regions || {}).forEach((region) => {
      if (clean && !`${region.label} ${region.id} ${region.type}`.toLowerCase().includes(clean)) {
        return;
      }
      const group = region.group || "page";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(region);
    });
    return grouped;
  }, [query, regions]);

  const toggleGroup = (group) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <aside className="w-[268px] flex-shrink-0 h-full bg-[#0b1120] border-r border-slate-800 flex flex-col text-left">
      <div className="h-12 px-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-slate-100">Page Structure</span>
        </div>
        <span className="text-[9px] font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
          {Object.keys(regions || {}).length + blocks.length}
        </span>
      </div>

      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a region..."
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-800 bg-slate-950/60 text-[11px] text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {Object.entries(groups).map(([group, groupRegions]) => {
          const open = openGroups.has(group);
          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-600 hover:text-slate-300 cursor-pointer"
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>{group.replace(/[-_]/g, " ")}</span>
                <span className="ml-auto font-mono">{groupRegions.length}</span>
              </button>

              {open && (
                <div className="space-y-0.5">
                  {groupRegions.map((region) => (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => onSelectRegion(region)}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left cursor-pointer ${
                        selected?.kind === "region" && selected.id === region.id
                          ? "bg-blue-500/12 text-blue-100 ring-1 ring-blue-500/30"
                          : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-100"
                      }`}
                    >
                      <span className="text-blue-400"><RegionIcon type={region.type} /></span>
                      <span className="text-[11px] font-medium truncate">{region.label || region.id}</span>
                      <span className="ml-auto text-[8px] font-bold uppercase text-slate-700">{region.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-2 border-t border-slate-800/70">
          <button
            type="button"
            onClick={() => toggleGroup("sections")}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-600 hover:text-slate-300 cursor-pointer"
          >
            {openGroups.has("sections") ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Builder Sections</span>
            <span className="ml-auto font-mono">{blocks.length}</span>
          </button>

          {openGroups.has("sections") && (
            <div className="mt-1">
              {blocks.length > 0 ? (
                <DraggableList
                  items={blocks}
                  onReorder={onBlocksChange}
                  className="space-y-0.5"
                  renderItem={(block) => (
                    <BlockTreeItem
                      block={block}
                      active={selected?.kind === "block" && selected.id === block.id}
                      onSelect={onSelectBlock}
                      onDuplicate={onDuplicateBlock}
                      onDelete={onDeleteBlock}
                    />
                  )}
                />
              ) : (
                <div className="mx-1 my-2 px-3 py-4 rounded-lg border border-dashed border-slate-800 text-center">
                  <p className="text-[10px] text-slate-600">No builder sections yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-950/20">
        <button
          type="button"
          onClick={() => onAddSection()}
          className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/30 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>
    </aside>
  );
}

export default VisualRegionTree;
