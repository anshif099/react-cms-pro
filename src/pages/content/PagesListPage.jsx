import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Search, FileText, ExternalLink, Trash2, Edit3, Eye, Settings, Globe } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import Table, { TableRow, TableCell } from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";

export function PagesListPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();
  const { pages, pageLoading, fetchPages, createPage, deletePage } = usePages();
  const { selectWebsite, selectedWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      fetchPages(websiteId);
    }
  }, [websiteId, selectWebsite, fetchPages]);

  // Auto slug generation
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setNewPageTitle(val);
    setNewPageSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  };

  const handleCreatePage = async (e) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    setCreating(true);
    try {
      await createPage(websiteId, {
        title: newPageTitle,
        slug: newPageSlug || "untitled"
      });
      setIsCreateOpen(false);
      setNewPageTitle("");
      setNewPageSlug("");
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

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
    // Check active locale data or fallback to page title/slug
    const localeData = page.locales?.[activeLocale] || {};
    const title = localeData.title || page.title || "";
    const slug = localeData.slug || page.slug || "";
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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
            Manage site structure, edit schemas, and preview drafts on <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="primary"
            className="gap-2 font-bold py-2.5 shadow-md shadow-primary/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Page
          </Button>
        </div>
      </div>

      {/* Toolbar & Filters Card */}
      <Card className="p-4 bg-slate-900/40 backdrop-blur-md border-admin-border dark:border-slate-800">
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
                    <span className="block text-[10px] text-admin-secondary uppercase font-bold tracking-wider">
                      {activeLocale} locale
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs px-2 py-0.5 bg-slate-950/20 border border-slate-800/30 rounded text-purple-400 font-mono">
                    /{displaySlug}
                  </code>
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
                    {/* View Preview (New Tab) */}
                    <button
                      onClick={() => navigate(`/content/${websiteId}/preview/${page.id}`)}
                      className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-admin-text transition-colors cursor-pointer"
                      title="Live Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Edit Page */}
                    <button
                      onClick={() => navigate(`/content/${websiteId}/pages/${page.id}`)}
                      className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-primary transition-colors cursor-pointer"
                      title="Edit Page"
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

      {/* Create Page Modal Dialog */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New CMS Page"
        size="md"
      >
        <form onSubmit={handleCreatePage} className="space-y-4 text-left">
          <Input
            label="Page Title"
            placeholder="e.g. Services Overview"
            value={newPageTitle}
            onChange={handleTitleChange}
            required
            autoFocus
          />
          <Input
            label="Path Slug (URL)"
            placeholder="e.g. services"
            value={newPageSlug}
            onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
            helperText={`Slug will resolve to /${newPageSlug || "..."}`}
            required
          />
          
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
            <Button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              variant="secondary"
              className="border-slate-800"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creating}
              disabled={!newPageTitle.trim()}
            >
              Create Page
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PagesListPage;
