import React, { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Box, ChevronRight, HelpCircle, Search } from "lucide-react";
import Modal from "../ui/Modal";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "layout", label: "Layout" },
  { id: "content", label: "Content" },
  { id: "commerce", label: "Marketing" },
  { id: "social", label: "Social" },
  { id: "actions", label: "Actions" }
];

export function VisualBlockLibrary({ isOpen, onClose, onInsert, insertIndex }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const blocks = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return BLOCK_SCHEMAS.filter((block) => {
      const matchesCategory = category === "all" || block.category === category;
      const matchesQuery = !cleanQuery || [
        block.label,
        block.type,
        block.description
      ].some((value) => String(value || "").toLowerCase().includes(cleanQuery));
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const chooseBlock = (type) => {
    onInsert?.(type, insertIndex);
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={Number.isInteger(insertIndex) ? "Insert Section" : "Add Section"}
      size="xl"
      className="bg-[#0d1424] border-slate-800"
    >
      <div className="space-y-5 text-left">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections, elements, forms, or layouts..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            autoFocus
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                category === item.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-950/30 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {blocks.map((block) => {
            const Icon = Icons[block.icon] || Box;
            return (
              <button
                key={block.type}
                type="button"
                onClick={() => chooseBlock(block.type)}
                className="group min-h-24 flex items-center gap-3.5 p-4 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-blue-500/5 hover:border-blue-500/40 text-left transition-all cursor-pointer"
              >
                <span className="w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-blue-400 flex items-center justify-center group-hover:border-blue-500/30 group-hover:bg-blue-500/10">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-100">{block.label}</span>
                  <span className="block text-[10px] leading-relaxed text-slate-500 mt-1 line-clamp-2">
                    {block.description}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-blue-400" />
              </button>
            );
          })}
        </div>

        {blocks.length === 0 && (
          <div className="py-14 text-center text-slate-500">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold">No elements match your search.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default VisualBlockLibrary;
