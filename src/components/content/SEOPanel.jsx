import React, { useState } from "react";
import { ChevronDown, ChevronUp, Globe, Search, Share2, ShieldAlert } from "lucide-react";
import Input from "../ui/Input";
import ImagePicker from "../ui/ImagePicker";
import { cn } from "../../utils/cn";

export function SEOPanel({ seoData = {}, onChange, blocks = [] }) {
  const [openSection, setOpenSection] = useState("meta");

  // Concatenates all textual blocks content
  const extractTextFromBlocks = (blockData) => {
    let text = "";
    const scan = (obj) => {
      if (!obj) return;
      if (typeof obj === "string") {
        text += " " + obj;
      } else if (Array.isArray(obj)) {
        obj.forEach(scan);
      } else if (typeof obj === "object") {
        Object.entries(obj).forEach(([key, val]) => {
          if (key === "id" || key === "type" || key === "style" || key === "config") return;
          scan(val);
        });
      }
    };
    scan(blockData);
    return text.trim();
  };

  const focusKeyword = seoData.focusKeyword || "";
  const allText = extractTextFromBlocks(blocks);
  
  let density = 0;
  let wordCount = 0;
  let occurrences = 0;

  if (focusKeyword.trim() && allText.trim()) {
    const words = allText.toLowerCase().match(/\b\w+\b/g) || [];
    wordCount = words.length;

    const cleanKeyword = focusKeyword.trim().toLowerCase();
    const escapedKeyword = cleanKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, "gi");
    const matches = allText.match(regex) || [];
    occurrences = matches.length;

    if (wordCount > 0) {
      density = parseFloat(((occurrences / wordCount) * 100).toFixed(2));
    }
  }

  const getDensityBadgeColor = () => {
    if (!focusKeyword) return "bg-slate-800/80 text-slate-400 border-slate-700";
    if (occurrences === 0) return "bg-rose-500/10 border-rose-500/20 text-rose-400";
    if (density >= 0.5 && density <= 2.5) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    if (density < 0.5) return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    return "bg-rose-500/10 border-rose-500/20 text-rose-400"; // Stuffed
  };

  const updateField = (key, value) => {
    if (onChange) {
      onChange({
        ...seoData,
        [key]: value
      });
    }
  };

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? "" : section);
  };

  return (
    <div className="space-y-4">
      {/* Search Meta Info Accordion */}
      <div className="border border-admin-border dark:border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur-md">
        <button
          onClick={() => toggleSection("meta")}
          className="flex items-center justify-between w-full p-4 font-bold text-sm text-admin-text hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <span>Search Meta Tags</span>
          </div>
          {openSection === "meta" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openSection === "meta" && (
          <div className="p-4 border-t border-admin-border dark:border-slate-800 space-y-4">
            <div className="space-y-1">
              <Input
                label="Meta Title"
                placeholder="e.g. Home Page | ReactCMS Pro"
                value={seoData.metaTitle || ""}
                onChange={(e) => updateField("metaTitle", e.target.value)}
                helperText={`${(seoData.metaTitle || "").length}/60 characters (recommended max)`}
                error={(seoData.metaTitle || "").length > 60 ? "Title is too long" : ""}
              />
            </div>
            
            <div className="space-y-1 text-left flex flex-col gap-1">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                Meta Description
              </label>
              <textarea
                placeholder="e.g. Build faster with our ReactCMS headless dashboard..."
                value={seoData.metaDescription || ""}
                onChange={(e) => updateField("metaDescription", e.target.value)}
                rows={3}
                className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-none"
              />
              <span className="text-xs text-admin-secondary">
                {`${(seoData.metaDescription || "").length}/160 characters (recommended max)`}
              </span>
            </div>

            <Input
              label="Keywords (comma separated)"
              placeholder="cms, react, vite, headless"
              value={seoData.keywords || ""}
              onChange={(e) => updateField("keywords", e.target.value)}
            />

            <div className="space-y-3 pt-2 border-t border-slate-800/60 text-left">
              <Input
                label="Focus Keyword"
                placeholder="e.g. headless cms"
                value={seoData.focusKeyword || ""}
                onChange={(e) => updateField("focusKeyword", e.target.value)}
                helperText="Target search keyword or phrase for this page."
              />

              {focusKeyword && (
                <div className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 transition-colors ${getDensityBadgeColor()}`}>
                   <div className="flex items-center justify-between font-bold">
                     <span>Keyword Density Status</span>
                     <span className="uppercase text-[9px] tracking-wider bg-slate-950/40 px-2 py-0.5 rounded border border-white/5 font-mono">
                       {occurrences === 0 ? "Missing" : density >= 0.5 && density <= 2.5 ? "Optimal" : density < 0.5 ? "Low" : "High (Stuffed)"}
                     </span>
                   </div>
                   <p className="text-[11px] leading-relaxed">
                     {occurrences === 0 
                       ? `The phrase "${focusKeyword}" does not appear anywhere in your page's block content.`
                       : `Occurrences: ${occurrences} times in ${wordCount} words (Density: ${density}%). ${
                           density >= 0.5 && density <= 2.5 
                             ? "Perfect! The keyword is nicely balanced in your content."
                             : density < 0.5 
                               ? "Consider using the keyword in a few more headings or body paragraphs."
                               : "Warning: Density exceeds recommended 2.5%. Reduce occurrences to avoid search engine penalties."
                         }`}
                   </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Open Graph Accordion */}
      <div className="border border-admin-border dark:border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur-md">
        <button
          onClick={() => toggleSection("og")}
          className="flex items-center justify-between w-full p-4 font-bold text-sm text-admin-text hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-400" />
            <span>Social Sharing (Open Graph)</span>
          </div>
          {openSection === "og" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openSection === "og" && (
          <div className="p-4 border-t border-admin-border dark:border-slate-800 space-y-4">
            <Input
              label="OG Title"
              placeholder="e.g. ReactCMS Pro headless framework"
              value={seoData.ogTitle || ""}
              onChange={(e) => updateField("ogTitle", e.target.value)}
            />
            <div className="space-y-1 text-left flex flex-col gap-1">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                OG Description
              </label>
              <textarea
                placeholder="Description when shared on platforms..."
                value={seoData.ogDescription || ""}
                onChange={(e) => updateField("ogDescription", e.target.value)}
                rows={2}
                className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-none"
              />
            </div>
            <ImagePicker
              label="OG Image"
              value={seoData.ogImage || ""}
              onChange={(val) => updateField("ogImage", val)}
              placeholder="Enter social share image URL..."
            />
            
            <div className="space-y-1 text-left flex flex-col gap-1">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                Twitter Card Type
              </label>
              <select
                value={seoData.twitterCard || "summary_large_image"}
                onChange={(e) => updateField("twitterCard", e.target.value)}
                className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25"
              >
                <option value="summary">Summary</option>
                <option value="summary_large_image">Summary with Large Image</option>
                <option value="app">App</option>
                <option value="player">Player</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Accordion */}
      <div className="border border-admin-border dark:border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur-md">
        <button
          onClick={() => toggleSection("advanced")}
          className="flex items-center justify-between w-full p-4 font-bold text-sm text-admin-text hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Advanced SEO</span>
          </div>
          {openSection === "advanced" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openSection === "advanced" && (
          <div className="p-4 border-t border-admin-border dark:border-slate-800 space-y-4">
            <Input
              label="Canonical URL"
              placeholder="https://example.com/page"
              value={seoData.canonicalUrl || ""}
              onChange={(e) => updateField("canonicalUrl", e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-left flex flex-col gap-1">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                  Robots Index
                </label>
                <select
                  value={seoData.robotsIndex || "index"}
                  onChange={(e) => updateField("robotsIndex", e.target.value)}
                  className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  <option value="index">Index</option>
                  <option value="noindex">No Index</option>
                </select>
              </div>

              <div className="space-y-1 text-left flex flex-col gap-1">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                  Robots Follow
                </label>
                <select
                  value={seoData.robotsFollow || "follow"}
                  onChange={(e) => updateField("robotsFollow", e.target.value)}
                  className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  <option value="follow">Follow</option>
                  <option value="nofollow">No Follow</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 text-left flex flex-col gap-1">
              <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                JSON-LD Structured Data
              </label>
              <textarea
                placeholder='{ "@context": "https://schema.org", "@type": "WebPage" }'
                value={seoData.jsonLd || ""}
                onChange={(e) => updateField("jsonLd", e.target.value)}
                rows={4}
                className="w-full text-sm py-2 px-3 rounded-lg border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none font-mono hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-y"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SEOPanel;
