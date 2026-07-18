import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layers, Plus, Search, Edit3, Trash2, Calendar, FileCode } from "lucide-react";
import { useContentTypes } from "../../hooks/useContentTypes";
import { useWebsites } from "../../hooks/useWebsites";
import Table, { TableRow, TableCell } from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";

export function ContentTypesPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();

  const { contentTypes, loading, loadContentTypes, deleteContentType } = useContentTypes();
  const { selectedWebsite, selectWebsite } = useWebsites();

  const [searchTerm, setSearchTerm] = React.useState("");

  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      loadContentTypes(websiteId);
    }
  }, [websiteId, selectWebsite, loadContentTypes]);

  const handleDelete = async (typeId, name) => {
    if (window.confirm(`Are you sure you want to permanently delete the content type "${name}"? Pages referencing it will display placeholder errors.`)) {
      try {
        await deleteContentType(websiteId, typeId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredTypes = contentTypes.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tableHeaders = [
    { label: "Content Type Name" },
    { label: "Slug Key" },
    { label: "Fields Count" },
    { label: "Created Date" },
    { label: "Actions", className: "text-right" }
  ];

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading Content Types...</div>;
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            <span>Content Types</span>
          </h2>
          <p className="text-sm text-admin-secondary">
            Design reusable block structures and schema formats for <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
        <div>
          <Button
            onClick={() => navigate(`/content/${websiteId}/content-types/new`)}
            variant="primary"
            className="gap-2 font-bold py-2.5 shadow-md shadow-primary/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Content Type
          </Button>
        </div>
      </div>

      {/* Search Toolbar */}
      <Card className="p-4 bg-slate-900/40 backdrop-blur-md border-admin-border dark:border-slate-800">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-admin-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search content types by name or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm pl-9 pr-4 py-2 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all"
          />
        </div>
      </Card>

      {/* Content Types Table List */}
      {loading && contentTypes.length === 0 ? (
        <div className="text-center py-10 text-admin-secondary text-sm">
          Loading content types from Firebase...
        </div>
      ) : filteredTypes.length === 0 ? (
        <EmptyState
          title={searchTerm ? "No search results" : "No content types yet"}
          description={searchTerm ? "Try searching for a different keyword or slug key." : "Create custom content types above to reuse layouts across different pages."}
          icon={Layers}
        />
      ) : (
        <Table headers={tableHeaders}>
          {filteredTypes.map((type) => (
            <TableRow key={type.id}>
              <TableCell className="font-semibold text-admin-text flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-950/20 border border-slate-800/40 flex items-center justify-center text-primary flex-shrink-0">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-semibold">{type.name}</span>
                  <span className="block text-[10px] text-admin-secondary font-mono">ID: {type.id}</span>
                </div>
              </TableCell>
              <TableCell>
                <code className="text-xs px-2 py-0.5 bg-slate-950/20 border border-slate-800/30 rounded text-purple-400 font-mono">
                  {type.slug}
                </code>
              </TableCell>
              <TableCell className="font-semibold text-slate-350">
                {type.fields?.length || 0} fields
              </TableCell>
              <TableCell className="text-xs text-admin-secondary">
                {type.createdAt ? new Date(type.createdAt).toLocaleDateString() : "N/A"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  {/* Edit Content Type */}
                  <button
                    onClick={() => navigate(`/content/${websiteId}/content-types/${type.id}`)}
                    className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-primary transition-colors cursor-pointer"
                    title="Edit Content Type"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete Content Type */}
                  <button
                    onClick={() => handleDelete(type.id, type.name)}
                    className="p-1.5 rounded-lg hover:bg-slate-850 text-admin-secondary hover:text-admin-danger transition-colors cursor-pointer"
                    title="Delete Content Type"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
    </div>
  );
}

export default ContentTypesPage;
