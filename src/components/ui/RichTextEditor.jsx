import React from "react";
import { cn } from "../../utils/cn";

export function RichTextEditor({ label, value, onChange, placeholder = "Write content here...", className }) {
  return (
    <div className={cn("flex flex-col gap-1 w-full text-left", className)}>
      {label && (
        <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className={cn(
          "w-full text-sm py-2.5 px-3 rounded-lg border bg-white text-admin-text transition-all duration-200 outline-none resize-y",
          "border-admin-border hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25"
        )}
      />
    </div>
  );
}

export default RichTextEditor;
