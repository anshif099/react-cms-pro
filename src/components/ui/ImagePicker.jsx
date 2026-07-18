import React, { useState } from "react";
import { Image as ImageIcon, X, FolderOpen } from "lucide-react";
import Input from "./Input";
import MediaLibraryModal from "../content/MediaLibraryModal";

export function ImagePicker({ label, value, onChange, placeholder = "Enter image URL or browse..." }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClear = () => {
    if (onChange) onChange("");
  };

  const handleSelect = (url) => {
    if (onChange) onChange(url);
  };

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label={label}
            value={value || ""}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            icon={ImageIcon}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="py-2.5 px-3 border border-slate-700 hover:border-slate-650 bg-slate-900/40 hover:bg-slate-800/40 text-slate-300 hover:text-white rounded-lg text-sm transition-colors flex items-center gap-1.5 h-[38px] mb-[1px] cursor-pointer"
          title="Browse Media Library"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Browse</span>
        </button>
      </div>
      
      {value && (
        <div className="mt-2 relative inline-block group w-32">
          <img
            src={value}
            alt="Preview"
            className="w-32 h-20 object-cover rounded-lg border border-admin-border dark:border-slate-800"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-1.5 -right-1.5 bg-admin-danger text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow-md cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <MediaLibraryModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  );
}

export default ImagePicker;
