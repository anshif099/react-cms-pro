import React, { useState } from "react";
import { Plus, Layout } from "lucide-react";
import DraggableList from "../ui/DraggableList";
import BlockCard from "./BlockCard";
import BlockPicker from "./BlockPicker";
import BLOCK_SCHEMAS from "./blockSchemas";
import Button from "../ui/Button";

export function BlockEditor({ blocks = [], onChange, activeLocale = "en", onConvertToContentType }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleReorder = (newBlocks) => {
    if (onChange) onChange(newBlocks);
  };

  const handleSelectBlockType = (type) => {
    const schema = BLOCK_SCHEMAS.find((s) => s.type === type);
    if (!schema) return;

    // Generate clean initial values based on fields schema
    const newBlock = {
      id: Math.random().toString(36).substring(2, 9),
      type: type,
      locales: {}
    };

    // Populate schema default fields
    schema.fields.forEach((field) => {
      let defaultVal = "";
      if (field.type === "number") defaultVal = 0;
      if (field.type === "boolean") defaultVal = false;
      if (field.type === "array") defaultVal = [];

      if (field.localized) {
        if (!newBlock.locales[activeLocale]) {
          newBlock.locales[activeLocale] = {};
        }
        newBlock.locales[activeLocale][field.key] = defaultVal;
      } else {
        newBlock[field.key] = defaultVal;
      }
    });

    if (onChange) {
      onChange([...blocks, newBlock]);
    }
  };

  const handleDeleteBlock = (blockId) => {
    if (onChange) {
      onChange(blocks.filter((b) => b.id !== blockId));
    }
  };

  const handleDuplicateBlock = (blockId) => {
    const blockToCopy = blocks.find((b) => b.id === blockId);
    if (!blockToCopy) return;

    const duplicated = {
      ...JSON.parse(JSON.stringify(blockToCopy)),
      id: Math.random().toString(36).substring(2, 9)
    };

    if (onChange) {
      onChange([...blocks, duplicated]);
    }
  };

  const handleBlockChange = (blockId, updatedBlock) => {
    if (onChange) {
      onChange(blocks.map((b) => (b.id === blockId ? updatedBlock : b)));
    }
  };

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-admin-border dark:border-slate-800 rounded-xl p-10 bg-slate-900/10 text-center select-none">
          <Layout className="w-10 h-10 text-slate-500 mb-2.5" />
          <h4 className="text-sm font-bold text-admin-text">Drag-sortable Block Editor</h4>
          <p className="text-xs text-admin-secondary max-w-sm mt-1 mb-4">
            Build your page layout visually. Add CTA headers, grids, testimonials, pricing plans, and more.
          </p>
          <Button
            onClick={() => setIsPickerOpen(true)}
            variant="primary"
            className="gap-1.5 font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Page Section
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <DraggableList
            items={blocks}
            onReorder={handleReorder}
            renderItem={(block) => (
              <BlockCard
                block={block}
                onChange={(updated) => handleBlockChange(block.id, updated)}
                onDelete={handleDeleteBlock}
                onDuplicate={handleDuplicateBlock}
                onConvertToContentType={onConvertToContentType}
                activeLocale={activeLocale}
              />
            )}
          />

          <div className="flex justify-center pt-2">
            <Button
              onClick={() => setIsPickerOpen(true)}
              variant="secondary"
              className="gap-1.5 border-slate-800 font-bold hover:bg-slate-900/40"
            >
              <Plus className="w-4 h-4" /> Add Section Block
            </Button>
          </div>
        </div>
      )}

      <BlockPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectBlockType}
      />
    </div>
  );
}

export default BlockEditor;
