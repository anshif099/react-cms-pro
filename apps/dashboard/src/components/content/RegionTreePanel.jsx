import React, { useState } from "react";
import { Search, Layers, Type, Image as ImageIcon, MousePointerClick, Video, Repeat, Box, ChevronRight, FileText } from "lucide-react";

export function RegionTreePanel({
  regionsMap = {},
  selectedRegionId = null,
  onSelectRegion = () => {},
  pageTitle = "Current Page"
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const regionList = Object.values(regionsMap || {});

  // Helper to categorize regions into tree sections by regionId prefix (e.g. hero.title -> Hero)
  const groupedRegions = regionList.reduce((acc, region) => {
    const id = region.id || "";
    let groupName = "General Regions";

    if (id.includes(".")) {
      const parts = id.split(".");
      groupName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + " Section";
    } else if (id.toLowerCase().includes("hero")) {
      groupName = "Hero Section";
    } else if (id.toLowerCase().includes("feature")) {
      groupName = "Features Section";
    } else if (id.toLowerCase().includes("footer")) {
      groupName = "Footer Section";
    } else if (id.toLowerCase().includes("nav") || id.toLowerCase().includes("header")) {
      groupName = "Navigation Header";
    }

    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(region);
    return acc;
  }, {});

  const getTypeIcon = (type) => {
    switch (type) {
      case "text":
      case "textarea":
        return <Type className="w-3.5 h-3.5 text-blue-400" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />;
      case "button":
        return <MousePointerClick className="w-3.5 h-3.5 text-purple-400" />;
      case "video":
        return <Video className="w-3.5 h-3.5 text-rose-400" />;
      case "repeater":
        return <Repeat className="w-3.5 h-3.5 text-amber-400" />;
      case "section":
        return <Box className="w-3.5 h-3.5 text-cyan-400" />;
      case "richtext":
      default:
        return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const filteredGroups = Object.entries(groupedRegions).reduce((acc, [group, items]) => {
    const filteredItems = items.filter(
      (r) =>
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.label && r.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.type && r.type.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (filteredItems.length > 0) {
      acc[group] = filteredItems;
    }
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border-r border-slate-800 text-slate-100 font-sans">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-slate-200 tracking-tight">Region Tree</span>
        </div>
        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-mono font-bold">
          {regionList.length} region(s)
        </span>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search regions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
          />
        </div>
      </div>

      {/* Region Tree Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-left">
        {Object.keys(filteredGroups).length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 italic">
            {searchTerm ? "No matching regions found." : "No editable regions registered on this page yet."}
          </div>
        ) : (
          Object.entries(filteredGroups).map(([groupName, items]) => (
            <div key={groupName} className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 bg-slate-950/30 rounded border border-slate-850/50">
                <ChevronRight className="w-3 h-3 text-slate-500" />
                <span>{groupName}</span>
              </div>
              <div className="space-y-1 pl-2">
                {items.map((region) => {
                  const isSelected = selectedRegionId === region.id;
                  return (
                    <button
                      key={region.id}
                      onClick={() => onSelectRegion(region.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-white font-bold shadow-md shadow-primary/20"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getTypeIcon(region.type)}
                        <span className="truncate font-mono text-[11px]">
                          {region.label || region.id}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {region.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RegionTreePanel;
