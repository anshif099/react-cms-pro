import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Edit3, Eye, Search, FileText, Trash2, Globe, RefreshCw } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useWebsiteSync } from "../../hooks/useWebsiteSync";
import Table, { TableRow, TableCell } from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import ManualRouteImportModal from "../../components/websites/ManualRouteImportModal";

export function PagesListPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();
  const { pages, pageLoading, fetchPages, deletePage } = usePages();
  const { selectWebsite, selectedWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const { sync, importManual, syncLoading } = useWebsiteSync(websiteId);
  const [showManualSync, setShowManualSync] = useState(false);

  const handleSync = async () => {
    const result = await sync();
    if (!result || result.success === false) {
      setShowManualSync(true);
    }
  };

  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      fetchPages(websiteId);
    }
  }, [websiteId, selectWebsite, fetchPages]);

  const handleDelete = async (pageId, title) => {
    if (window.confirm(`Are you sure you want to permanently delete the page "${title}"?`)) {
      try {
        await deletePage(websiteId, pageId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredPages = pages.filter((page) => {
    // Check Active Filter Tab
    const pageStatus = page.status || "draft";
    const pageSource = page.source || "cms";
    
    if (activeFilter === "imported") {
      if (pageSource !== "imported" || pageStatus === "archived") return false;
    } else if (activeFilter === "cms") {
      if (pageSource !== "cms" || pageStatus === "archived") return false;
    } else if (activeFilter === "generated") {
      if (pageSource !== "generated" || pageStatus === "archived") return false;
    } else if (activeFilter === "archived") {
      if (pageStatus !== "archived") return false;
    } else {
      if (pageStatus === "archived") return false;
    }

    // Check active locale data or fallback to page title/slug
    const localeData = page.locales?.[activeLocale] || {};
    const title = localeData.title || page.title || "";
    const slug = localeData.slug || page.slug || "";
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getSourceBadge = (source) => {
    switch (source) {
      case "imported":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Imported</span>;
      case "generated":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Generated</span>;
      case "cms":
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CMS</span>;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "published": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
      case "archived": return "bg-slate-800 text-slate-400 border-slate-700";
      case "draft":
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    }
  };

  const tableHeaders = [
    { label: "Page Name" },
    { label: "Path Slug" },
    { label: "Source" },
    { label: "Status" },
    { label: "Last Updated" },
    { label: "Actions", className: "text-right" }
  ];

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading website pages...</div>;
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <span>Pages</span>
          </h2>
          <p className="text-sm text-admin-secondary">
            View, edit, and publish connected pages visually on <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleSync}
            variant="outline"
            className="gap-2 font-bold py-2.5 cursor-pointer border-slate-805 text-xs"
            loading={syncLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Toolbar & Filters Card */}
      <Card className="p-4 bg-slate-900/40 backdrop-blur-md border-admin-border dark:border-slate-800">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search bar */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-admin-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Search pages by name or slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm pl-9 pr-4 py-2 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all"
              />
            </div>

            {/* Locale Picker Pill Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto self-start md:self-auto max-w-full pb-1 md:pb-0">
              <span className="text-xs font-semibold text-admin-secondary flex items-center gap-1 flex-shrink-0">
                <Globe className="w-3.5 h-3.5" /> Editing language:
              </span>
              <div className="flex bg-slate-950/40 border border-admin-border dark:border-slate-800 p-1 rounded-lg">
                {activeLocales.map((code) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase transition-all cursor-pointer ${
                      activeLocale === code
                        ? "bg-primary text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 border-t border-slate-800 pt-3 overflow-x-auto pb-1 max-w-full">
            {["all", "imported", "cms", "generated", "archived"].map((filt) => (
              <button
                key={filt}
                onClick={() => setActiveFilter(filt)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold capitalize transition-all cursor-pointer flex-shrink-0 ${
                  activeFilter === filt
                    ? "bg-slate-800 text-white border-slate-700"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {filt} Pages
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Pages List Section */}
      {pageLoading && pages.length === 0 ? (
        <div className="text-center py-10 text-admin-secondary text-sm">
          Fetching pages from server...
        </div>
      ) : filteredPages.length === 0 ? (
        <EmptyState
          title={searchTerm ? "No results found" : "No pages created yet"}
          description={searchTerm ? "Try searching for a different keyword or slug path." : "Start structuring your website. Create your first page above!"}
          icon={FileText}
        />
      ) : (
        <Table headers={tableHeaders}>
          {filteredPages.map((page) => {
            const localeData = page.locales?.[activeLocale] || {};
            const displayTitle = localeData.title || page.title || "Untitled Page";
            const displaySlug = localeData.slug || page.slug || "";
            const pageStatus = page.status || "draft";
            
            return (
              <TableRow key={page.id}>
                <TableCell className="font-semibold text-admin-text flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-950/20 border border-slate-800/40 flex items-center justify-center text-primary flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold">{displayTitle}</span>
                    <span className="block text-[10px] text-admin-secondary font-mono mt-0.5">
                      {page.route || `/${displaySlug}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs px-2 py-0.5 bg-slate-950/20 border border-slate-800/30 rounded text-purple-400 font-mono">
                    /{displaySlug}
                  </code>
                </TableCell>
                <TableCell>
                  {getSourceBadge(page.source)}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize border ${getStatusColor(pageStatus)}`}>
                    {pageStatus}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-admin-secondary">
                  {page.updatedAt ? new Date(page.updatedAt).toLocaleString() : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {/* Preview the connected website without editor controls */}
                    <button
                      onClick={() => navigate(`/content/${websiteId}/pages/${page.id}/editor?mode=preview`)}
                      className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-white transition-colors cursor-pointer"
                      title={`View ${displayTitle}`}
                      aria-label={`View ${displayTitle}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Open the primary visual editing experience */}
                    <button
                      onClick={() => navigate(`/content/${websiteId}/pages/${page.id}/editor?mode=edit`)}
                      className="p-1.5 rounded-lg hover:bg-blue-500/10 text-admin-secondary hover:text-blue-400 transition-colors cursor-pointer"
                      title={`Edit ${displayTitle}`}
                      aria-label={`Edit ${displayTitle}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Page */}
                    <button
                      onClick={() => handleDelete(page.id, displayTitle)}
                      className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-admin-danger transition-colors cursor-pointer"
                      title="Delete Page"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      )}

      <ManualRouteImportModal
        isOpen={showManualSync}
        onClose={() => setShowManualSync(false)}
        onImport={importManual}
        loading={syncLoading}
      />
    </div>
  );
}

export default PagesListPage;
