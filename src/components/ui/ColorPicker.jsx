import React from "react";
import { cn } from "../../utils/cn";

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", 
  "#8B5CF6", "#EC4899", "#111827", "#6B7280", 
  "#D1D5DB", "#F3F4F6", "#FFFFFF", "#6366F1"
];

export function ColorPicker({ label, value, onChange, className }) {
  const activeColor = value || "#000000";

  return (
    <div className={cn("flex flex-col gap-1.5 w-full text-left", className)}>
      {label && (
        <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-admin-border dark:border-slate-700 flex-shrink-0 cursor-pointer">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => onChange && onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div 
            className="w-full h-full" 
            style={{ backgroundColor: activeColor }}
          />
        </div>
        <input
          type="text"
          value={activeColor}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className="text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none w-28 uppercase"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange && onChange(color)}
            className={cn(
              "w-6 h-6 rounded-md border border-admin-border dark:border-slate-800 transition-transform hover:scale-110 cursor-pointer",
              activeColor.toUpperCase() === color.toUpperCase() ? "ring-2 ring-primary scale-110" : ""
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

export default ColorPicker;
