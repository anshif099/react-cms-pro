import React, { useState } from "react";
import * as Icons from "lucide-react";
import { ChevronDown, ChevronUp, Copy, Eye, Settings, Trash2, Layers, HelpCircle, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BLOCK_SCHEMAS from "./blockSchemas";
import BlockFields from "./BlockFields";

export function BlockCard({
  block,
  onChange,
  onDelete,
  onDuplicate,
  onConvertToContentType,
  activeLocale = "en",
  dragHandleProps, // Injected by DraggableList/DraggableItem
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const schema = BLOCK_SCHEMAS.find((s) => s.type === block.type);

  const getIcon = () => {
    if (!schema || !schema.icon) return <HelpCircle className="w-4 h-4" />;
    const LucideIcon = Icons[schema.icon];
    if (!LucideIcon) return <HelpCircle className="w-4 h-4" />;
    return <LucideIcon className="w-4 h-4" />;
  };

  const getCategoryColor = () => {
    if (!schema) return "border-slate-800";
    switch (schema.category) {
      case "layout": return "border-l-4 border-l-blue-500";
      case "content": return "border-l-4 border-l-emerald-500";
      case "commerce": return "border-l-4 border-l-amber-500";
      case "social": return "border-l-4 border-l-purple-500";
      case "actions": return "border-l-4 border-l-red-500";
      default: return "border-slate-800";
    }
  };

  return (
    <div className={`border border-admin-border dark:border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur-md overflow-hidden transition-all duration-200 group ${getCategoryColor()} ${
      isExpanded ? "ring-1 ring-primary/30" : ""
    }`}>
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-slate-800/20"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
          {/* Drag handle */}
          <div 
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()} // Prevent collapse/expand when dragging
            className="p-1 text-slate-600 hover:text-slate-450 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Block Type Icon */}
          <div className="w-8 h-8 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-center text-primary flex-shrink-0">
            {getIcon()}
          </div>

          {/* Block Names */}
          <div className="text-left truncate">
            <span className="text-xs font-bold text-admin-secondary uppercase tracking-wider block">
              {schema?.label || block.type}
            </span>
            <span className="text-sm font-semibold text-admin-text truncate block mt-0.5">
              {block.locales?.[activeLocale]?.title || block.title || block.text || "Configure block..."}
            </span>
          </div>
        </div>

        {/* Action icons & Collapsible toggle */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onConvertToContentType && (
              <button
                onClick={() => onConvertToContentType(block.id)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 hover:text-primary text-admin-secondary transition-colors cursor-pointer"
                title="Convert to Reusable Content Type"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onDuplicate && onDuplicate(block.id)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 hover:text-white text-admin-secondary transition-colors cursor-pointer"
              title="Duplicate Block"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete && onDelete(block.id)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 hover:text-admin-danger text-admin-secondary transition-colors cursor-pointer"
              title="Delete Block"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-850 opacity-0 group-hover:opacity-100" />

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Fields Area collapsible */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-5 pt-3 border-t border-slate-850 bg-slate-950/20">
              <BlockFields
                block={block}
                onChange={onChange}
                locale={activeLocale}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BlockCard;
