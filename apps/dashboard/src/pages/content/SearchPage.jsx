import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, FileText, Image, Globe, ArrowRight, CornerDownRight, HelpCircle } from "lucide-react";
import { useSearch } from "../../hooks/useSearch";
import { useWebsites } from "../../hooks/useWebsites";
import { useLocale } from "../../hooks/useLocale";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";

export function SearchPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();

  const { results, query, searching, search, clearSearch } = useSearch();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocale } = useLocale(websiteId);

  const [inputVal, setInputVal] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
    }
  }, [websiteId, selectWebsite]);

  // Handle Search Input Change
  const handleChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    search(websiteId, val, activeLocale);
  };

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading Search Console...</div>;
  }

  const filteredResults = results.filter((item) => {
    if (scopeFilter === "all") return true;
    if (scopeFilter === "pages") return item.type === "page";
    if (scopeFilter === "media") return item.type === "media";
    return true;
  });

  const getResultIcon = (type) => {
    if (type === "page") return <FileText className="w-4.5 h-4.5 text-blue-400" />;
    if (type === "media") return <Image className="w-4.5 h-4.5 text-purple-400" />;
    return <HelpCircle className="w-4.5 h-4.5 text-slate-400" />;
  };

  const getStatusColor = (status) => {
    if (status === "published") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    return "bg-amber-500/10 text-amber-400 border-amber-500/25";
  };

  const handleNavigate = (item) => {
    if (item.type === "page") {
      navigate(`/content/${websiteId}/pages/${item.id}`);
    } else if (item.type === "media") {
      navigate(`/content/${websiteId}/media`);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          <span>Cross-Entity Search Console</span>
        </h2>
        <p className="text-sm text-admin-secondary">
          Perform site-wide searches across pages, block values, and media metadata for <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
        </p>
      </div>

      {/* Main Search Bar */}
      <Card className="p-4 bg-slate-900/40 border-admin-border dark:border-slate-800">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-admin-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Start typing to query database..."
              value={inputVal}
              onChange={handleChange}
              className="w-full text-base pl-11 pr-4 py-2.5 rounded-xl border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all"
              autoFocus
            />
          </div>

          {/* Scope Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setScopeFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                scopeFilter === "all"
                  ? "bg-slate-800 text-white border-slate-700"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              All Entities ({filteredResults.length})
            </button>
            <button
              onClick={() => setScopeFilter("pages")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                scopeFilter === "pages"
                  ? "bg-slate-800 text-white border-slate-700"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Pages ({filteredResults.filter(r => r.type === "page").length})
            </button>
            <button
              onClick={() => setScopeFilter("media")}
              className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                scopeFilter === "media"
                  ? "bg-slate-800 text-white border-slate-700"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Media Assets ({filteredResults.filter(r => r.type === "media").length})
            </button>
          </div>
        </div>
      </Card>

      {/* Results Listings */}
      {searching ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Searching databases...
        </div>
      ) : inputVal.trim() === "" ? (
        <div className="text-center py-16 border border-dashed border-slate-850 rounded-xl bg-slate-950/10 text-xs text-admin-secondary space-y-1">
          <p className="font-bold text-slate-400">Type a keyword above to lookup records</p>
          <p>Queries page titles, paths, meta descriptions, and image alt attributes.</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <EmptyState
          title="No records found"
          description={`Your query "${inputVal}" did not return any database matches.`}
          icon={Search}
        />
      ) : (
        <div className="space-y-3.5">
          {filteredResults.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavigate(item)}
              className="flex items-center justify-between p-3.5 border border-admin-border dark:border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3.5 text-left min-w-0 flex-1 pr-4">
                <div className="w-10 h-10 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-center flex-shrink-0">
                  {getResultIcon(item.type)}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-admin-text block truncate group-hover:text-white transition-colors">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-primary uppercase font-bold tracking-wider">
                      {item.type}
                    </span>
                    <span className="text-slate-600 font-bold text-xs">•</span>
                    <span className="text-[10px] text-admin-secondary font-mono truncate max-w-xs block">
                      /{item.slug}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-admin-secondary hidden sm:inline-block">
                  Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "N/A"}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-650 group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchPage;
