import React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import BLOCK_SCHEMAS from "./blockSchemas";
import Input from "../ui/Input";
import ImagePicker from "../ui/ImagePicker";
import ColorPicker from "../ui/ColorPicker";
import RichTextEditor from "../ui/RichTextEditor";
import DraggableList from "../ui/DraggableList";
import Button from "../ui/Button";

export function BlockFields({ block, onChange, locale = "en" }) {
  const schema = BLOCK_SCHEMAS.find((s) => s.type === block.type);
  if (!schema) return <div className="text-xs text-red-400">Unknown block schema: {block.type}</div>;

  // Resolve values localized or non-localized
  const getFieldValue = (key, localized) => {
    if (localized) {
      return block.locales?.[locale]?.[key];
    }
    return block[key];
  };

  const updateFieldValue = (key, value, localized) => {
    if (!onChange) return;

    if (localized) {
      const existingLocales = block.locales || {};
      const currentLocale = existingLocales[locale] || {};
      
      onChange({
        ...block,
        locales: {
          ...existingLocales,
          [locale]: {
            ...currentLocale,
            [key]: value,
          },
        },
      });
    } else {
      onChange({
        ...block,
        [key]: value,
      });
    }
  };

  // Render a single field based on schema type
  const renderField = (field) => {
    const value = getFieldValue(field.key, field.localized);
    const key = field.key;
    const isLoc = field.localized;

    switch (field.type) {
      case "textarea":
        return (
          <div key={key} className="flex flex-col gap-1 w-full text-left">
            <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
              {field.label} {isLoc && <span className="text-[9px] bg-slate-800 text-slate-400 py-0.5 px-1.5 rounded-full font-bold ml-1 font-mono uppercase">Local</span>}
            </label>
            <textarea
              value={value || ""}
              onChange={(e) => updateFieldValue(key, e.target.value, isLoc)}
              placeholder={`Enter ${field.label.toLowerCase()}...`}
              rows={3}
              className="w-full text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-y"
            />
          </div>
        );

      case "richtext":
        return (
          <RichTextEditor
            key={key}
            label={
              <span>
                {field.label} {isLoc && <span className="text-[9px] bg-slate-800 text-slate-400 py-0.5 px-1.5 rounded-full font-bold ml-1 font-mono uppercase">Local</span>}
              </span>
            }
            value={value || ""}
            onChange={(val) => updateFieldValue(key, val, isLoc)}
          />
        );

      case "image":
        return (
          <ImagePicker
            key={key}
            label={
              <span>
                {field.label} {isLoc && <span className="text-[9px] bg-slate-800 text-slate-400 py-0.5 px-1.5 rounded-full font-bold ml-1 font-mono uppercase">Local</span>}
              </span>
            }
            value={value || ""}
            onChange={(val) => updateFieldValue(key, val, isLoc)}
          />
        );

      case "color":
        return (
          <ColorPicker
            key={key}
            label={field.label}
            value={value || ""}
            onChange={(val) => updateFieldValue(key, val, isLoc)}
          />
        );

      case "select":
        return (
          <div key={key} className="flex flex-col gap-1 w-full text-left">
            <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
              {field.label}
            </label>
            <select
              value={value || ""}
              onChange={(e) => updateFieldValue(key, e.target.value, isLoc)}
              className="w-full text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-450 focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              <option value="" disabled>Select option...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case "number":
        return (
          <Input
            key={key}
            label={field.label}
            type="number"
            value={value !== undefined ? value : ""}
            onChange={(e) => updateFieldValue(key, Number(e.target.value), isLoc)}
            placeholder={`Enter numeric ${field.label.toLowerCase()}...`}
          />
        );

      case "boolean":
        return (
          <label 
            key={key} 
            className="flex items-center gap-3 p-3 rounded-lg border border-admin-border dark:border-slate-800 transition-all cursor-pointer bg-slate-950/20 text-slate-350 select-none text-left"
          >
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateFieldValue(key, e.target.checked, isLoc)}
              className="rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-700 bg-slate-900 cursor-pointer"
            />
            <span className="text-sm font-semibold text-admin-text">{field.label}</span>
          </label>
        );

      case "array":
        return renderArrayField(field);

      case "text":
      case "url":
      default:
        return (
          <Input
            key={key}
            label={
              <span>
                {field.label} {isLoc && <span className="text-[9px] bg-slate-800 text-slate-400 py-0.5 px-1.5 rounded-full font-bold ml-1 font-mono uppercase">Local</span>}
              </span>
            }
            type={field.type === "url" ? "url" : "text"}
            value={value || ""}
            onChange={(e) => updateFieldValue(key, e.target.value, isLoc)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );
    }
  };

  // Render arrays / repeatable subforms
  const renderArrayField = (field) => {
    const key = field.key;
    const isLoc = field.localized;
    const items = getFieldValue(key, isLoc) || [];

    const handleAddItem = () => {
      const newItem = { id: Math.random().toString(36).substring(2, 9) };
      field.fields.forEach(f => {
        newItem[f.key] = f.type === "number" ? 0 : f.type === "boolean" ? false : "";
      });
      updateFieldValue(key, [...items, newItem], isLoc);
    };

    const handleRemoveItem = (itemId) => {
      updateFieldValue(key, items.filter(item => item.id !== itemId), isLoc);
    };

    const handleItemChange = (itemId, subKey, val) => {
      const updated = items.map(item => item.id === itemId ? { ...item, [subKey]: val } : item);
      updateFieldValue(key, updated, isLoc);
    };

    const handleReorder = (reorderedItems) => {
      updateFieldValue(key, reorderedItems, isLoc);
    };

    return (
      <div key={key} className="space-y-3 pt-3 border-t border-slate-800 text-left">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-admin-secondary uppercase tracking-wider">
            {field.label} ({items.length})
          </label>
          <Button onClick={handleAddItem} variant="secondary" className="py-1 px-2.5 text-[10px] border-slate-800">
            <Plus className="w-3 h-3 mr-1" /> Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-xs text-admin-secondary">
            No items added. Click the button to add.
          </div>
        ) : (
          <DraggableList
            items={items}
            onReorder={handleReorder}
            renderItem={(item, index) => (
              <ArrayItemCard
                item={item}
                index={index}
                subFields={field.fields}
                onUpdate={handleItemChange}
                onDelete={handleRemoveItem}
              />
            )}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => renderField(field))}
    </div>
  );
}

// Inner subcomponent for list items
function ArrayItemCard({ item, index, subFields, onUpdate, onDelete, dragHandleProps }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-950/20 group">
      {/* Reorder drag handle handle */}
      <div 
        {...dragHandleProps}
        className="pt-2 text-slate-600 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 space-y-3 text-left">
        <div className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider">
          Item #{index + 1}
        </div>
        
        <div className="space-y-3.5">
          {subFields.map(sub => {
            const key = sub.key;
            const value = item[key];

            const handleChange = (val) => {
              if (onUpdate) onUpdate(item.id, key, val);
            };

            switch (sub.type) {
              case "textarea":
                return (
                  <div key={key} className="flex flex-col gap-1 w-full text-left">
                    <label className="text-[11px] font-bold text-slate-400 block">{sub.label}</label>
                    <textarea
                      value={value || ""}
                      onChange={(e) => handleChange(e.target.value)}
                      placeholder={`Enter ${sub.label.toLowerCase()}...`}
                      rows={2}
                      className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-200 outline-none hover:border-slate-700 focus:border-primary"
                    />
                  </div>
                );
              case "image":
                return (
                  <ImagePicker
                    key={key}
                    label={sub.label}
                    value={value || ""}
                    onChange={handleChange}
                  />
                );
              case "boolean":
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={!!value}
                      onChange={(e) => handleChange(e.target.checked)}
                      className="rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-850 bg-slate-950 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-350">{sub.label}</span>
                  </label>
                );
              case "number":
                return (
                  <Input
                    key={key}
                    label={sub.label}
                    type="number"
                    value={value !== undefined ? value : ""}
                    onChange={(e) => handleChange(Number(e.target.value))}
                    className="text-xs"
                  />
                );
              case "text":
              case "url":
              default:
                return (
                  <Input
                    key={key}
                    label={sub.label}
                    type={sub.type === "url" ? "url" : "text"}
                    value={value || ""}
                    onChange={(e) => handleChange(e.target.value)}
                    className="text-xs"
                  />
                );
            }
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete && onDelete(item.id)}
        className="p-1.5 text-admin-secondary hover:text-admin-danger hover:bg-slate-900 rounded-lg transition-all flex-shrink-0 cursor-pointer mt-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default BlockFields;
