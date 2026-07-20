import React from "react";
import { Monitor, Laptop, Tablet, Smartphone, RotateCcw, Maximize2 } from "lucide-react";
import { cn } from "../../utils/cn";

const PRESETS = [
  { key: "desktop", label: "Desktop", width: "1440px", icon: Monitor },
  { key: "laptop", label: "Laptop", width: "1280px", icon: Laptop },
  { key: "tablet", label: "Tablet", width: "768px", icon: Tablet },
  { key: "mobile", label: "Mobile", width: "375px", icon: Smartphone },
  { key: "landscape", label: "Landscape", width: "926px", icon: RotateCcw },
  { key: "full", label: "Fullscreen", width: "100%", icon: Maximize2 }
];

export function DeviceSwitcher({ activeDevice, onSelect }) {
  return (
    <div className="flex bg-slate-950/80 p-0.5 border border-slate-800 rounded-lg select-none">
      {PRESETS.map((preset) => {
        const Icon = preset.icon;
        const isActive = activeDevice === preset.key;

        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelect(preset.key)}
            className={cn(
              "p-1.5 rounded transition-all cursor-pointer text-slate-400 hover:text-white",
              isActive ? "bg-slate-800 text-white font-bold" : ""
            )}
            title={`${preset.label} Mode (${preset.width})`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export default DeviceSwitcher;
