import React from "react";
import { MousePointerClick, ChevronRight, Sliders, Layers } from "lucide-react";
import BLOCK_SCHEMAS from "../blocks/blockSchemas";
import BlockFields from "../blocks/BlockFields";
import Card from "../ui/Card";

export function InspectorPanel({
  selectedElement,
  blocks = [],
  onChangeBlock,
  activeLocale = "en"
}) {
  // Try to find the active block being edited
  const block = selectedElement?.blockId 
    ? blocks.find(b => b.id === selectedElement.blockId) 
    : null;

  const schema = block ? BLOCK_SCHEMAS.find(s => s.type === block.type) : null;

  if (!selectedElement || !block) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-500 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-center text-primary mb-4">
          <MousePointerClick className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-bold text-sm text-slate-200">Interactive Inspector</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Hover and click on any highlighted section block element inside the preview frame to inspect and edit its CMS fields live.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md">
      {/* Inspector Header */}
      <div className="p-4 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Sliders className="w-4 h-4" />
          <span className="text-xs font-bold text-slate-200">CMS Block Inspector</span>
        </div>
        {schema && (
          <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 py-0.5 px-2 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" /> {schema.label}
          </span>
        )}
      </div>

      {/* Selected Element Path Breadcrumbs */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-850 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 font-mono overflow-x-auto whitespace-nowrap">
        <span>Page</span>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-primary">{block.type}</span>
        {selectedElement.fieldKey && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-purple-400 select-all">{selectedElement.fieldKey}</span>
          </>
        )}
      </div>

      {/* Scrollable Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
        <BlockFields
          block={block}
          onChange={onChangeBlock}
          locale={activeLocale}
        />
      </div>
    </div>
  );
}

export default InspectorPanel;
