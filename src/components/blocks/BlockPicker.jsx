import React, { useState } from "react";
import * as Icons from "lucide-react";
import { Search, ChevronRight, Layout, HelpCircle } from "lucide-react";
import Modal from "../ui/Modal";
import BLOCK_SCHEMAS from "./blockSchemas";
import { cn } from "../../utils/cn";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "layout", label: "Layout Structures" },
  { value: "content", label: "Core Content" },
  { value: "commerce", label: "Marketing / Commerce" },
  { value: "social", label: "Social Proof" }
];

export function BlockPicker({ isOpen, onClose, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const getIcon = (iconName) => {
    if (!iconName) return <HelpCircle className="w-5 h-5" />;
    const LucideIcon = Icons[iconName];
    if (!LucideIcon) return <HelpCircle className="w-5 h-5" />;
    return <LucideIcon className="w-5 h-5" />;
  };

  const filteredBlocks = BLOCK_SCHEMAS.filter((b) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      b.label.toLowerCase().includes(query) || 
      b.description.toLowerCase().includes(query);
    
    if (activeCategory === "all") return matchesSearch;
    return b.category === activeCategory && matchesSearch;
  });

  const handleSelect = (type) => {
    if (onSelect) {
      onSelect(type);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Content Block"
      size="lg"
    >
      <div className="space-y-4 text-left">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-admin-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search block types by name, category or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm pl-9 pr-4 py-2.5 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-650 focus:border-primary transition-all"
            autoFocus
          />
        </div>

        {/* Category Pills Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer flex-shrink-0",
                activeCategory === cat.value
                  ? "bg-primary text-white border-primary"
                  : "border-admin-border dark:border-slate-850 text-slate-400 hover:text-white"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid List */}
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-10 text-xs text-admin-secondary">
            No block schemas match your query.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-80 overflow-y-auto pr-1">
            {filteredBlocks.map((item) => (
              <div
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className="flex items-center gap-3.5 p-3.5 border border-admin-border dark:border-slate-800 rounded-xl cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700 transition-all group"
              >
                {/* Icon box */}
                <div className="w-10 h-10 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  {getIcon(item.icon)}
                </div>

                {/* Meta Description */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-admin-text block truncate group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-admin-secondary block truncate mt-0.5" title={item.description}>
                    {item.description}
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <Button
            onClick={onClose}
            variant="secondary"
            className="border-slate-800 text-xs py-1.5 px-4"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default BlockPicker;
