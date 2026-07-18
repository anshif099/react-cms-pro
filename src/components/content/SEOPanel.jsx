import React, { useState } from "react";
import { ChevronDown, ChevronUp, Globe, Search, Share2, ShieldAlert } from "lucide-react";
import Input from "../ui/Input";
import ImagePicker from "../ui/ImagePicker";
import { cn } from "../../utils/cn";

export function SEOPanel({ seoData = {}, onChange }) {
  const [openSection, setOpenSection] = useState("meta");

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
