import React from "react";
import { Image, X } from "lucide-react";
import Input from "./Input";

export function ImagePicker({ label, value, onChange, placeholder = "Enter image URL or select..." }) {
  const handleClear = () => {
    if (onChange) onChange("");
  };

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      <Input
        label={label}
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        icon={Image}
      />
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
    </div>
  );
}

export default ImagePicker;
