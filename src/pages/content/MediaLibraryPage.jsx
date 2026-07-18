import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Folder, FolderPlus, Grid, List, Search, SlidersHorizontal, Image, Film, FileText, File, Copy, Trash2, Edit3, ArrowLeft, RefreshCw, ZoomIn, Info } from "lucide-react";
import { useMedia } from "../../hooks/useMedia";
import { useWebsites } from "../../hooks/useWebsites";
import MediaUploadZone from "../../components/content/MediaUploadZone";
import MediaPreviewModal from "../../components/content/MediaPreviewModal";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";

export function MediaLibraryPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();

  const { files, folders, mediaLoading, fetchMedia, addFolder, deleteFile, renameFile, updateAltText } = useMedia();
  const { selectedWebsite, selectWebsite } = useWebsites();

  const [activeFolder, setActiveFolder] = useState("root");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("date-desc");
  const [selectedFile, setSelectedFile] = useState(null);

  // Modal control states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameText, setRenameText] = useState("");

  // Sync settings when loaded
  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      fetchMedia(websiteId);
    }
  }, [websiteId, selectWebsite, fetchMedia]);

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    addFolder(newFolderName.trim());
    setNewFolderName("");
    setShowFolderInput(false);
  };

  const handleCopyUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const handleDelete = async (fileId) => {
    if (window.confirm("Are you sure you want to permanently delete this media file from cloud storage?")) {
      try {
        await deleteFile(websiteId, fileId);
        if (selectedFile?.id === fileId) {
          setSelectedFile(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartRename = (file) => {
    setRenamingId(file.id);
    setRenameText(file.name);
  };

  const handleSaveRename = async (fileId) => {
    if (!renameText.trim()) return;
    try {
      const updated = await renameFile(websiteId, fileId, renameText.trim());
      setRenamingId("");
      if (selectedFile?.id === fileId) {
        setSelectedFile(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAltText = async (fileId, text) => {
    try {
      setSelectedFile(prev => prev && prev.id === fileId ? { ...prev, alt: text } : prev);
      await updateAltText(websiteId, fileId, text);
    } catch (err) {
      console.error(err);
    }
  };

  const getFileIcon = (type) => {
    if (type.startsWith("image/")) return <Image className="w-8 h-8 text-blue-400" />;
    if (type.startsWith("video/")) return <Film className="w-8 h-8 text-purple-400" />;
    return <FileText className="w-8 h-8 text-emerald-400" />;
  };

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading Media Library...</div>;
  }

  // Filter and sort items
  const filteredFiles = files
    .filter(file => file.folder === activeFolder)
    .filter(file => {
      const query = searchTerm.toLowerCase().trim();
      return (
        file.name.toLowerCase().includes(query) ||
        (file.alt && file.alt.toLowerCase().includes(query))
      );
    })
    .filter(file => {
      if (typeFilter === "all") return true;
      if (typeFilter === "images") return file.type.startsWith("image/");
      if (typeFilter === "videos") return file.type.startsWith("video/");
      if (typeFilter === "documents") return file.type === "application/pdf" || file.name.endsWith(".pdf");
      return true;
    });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortKey === "name-asc") return a.name.localeCompare(b.name);
    if (sortKey === "name-desc") return b.name.localeCompare(a.name);
    if (sortKey === "size-desc") return b.size - a.size;
    if (sortKey === "size-asc") return a.size - b.size;
    if (sortKey === "date-desc") return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortKey === "date-asc") return (a.createdAt || 0) - (b.createdAt || 0);
    return 0;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Image className="w-6 h-6 text-primary" />
            <span>Media Library</span>
          </h2>
          <p className="text-sm text-admin-secondary">
            Manage files, assets, and folders for <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchMedia(websiteId)}
            variant="secondary"
            className="gap-1.5 border-slate-800"
            disabled={mediaLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${mediaLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Folder sidebar */}
        <div className="space-y-4">
          <Card title="Folders" subtitle="Organize your assets">
            <div className="space-y-3">
              <div className="space-y-1.5">
                {folders.map((folder) => {
                  const count = files.filter(f => f.folder === folder).length;
                  return (
                    <button
                      key={folder}
                      onClick={() => {
                        setActiveFolder(folder);
                        setSelectedFile(null);
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        activeFolder === folder
                          ? "bg-primary text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className={`w-4 h-4 ${activeFolder === folder ? "text-white" : "text-primary"}`} />
                        <span className="truncate">{folder === "root" ? "All Files (Root)" : folder}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        activeFolder === folder ? "bg-white/20 text-white" : "bg-slate-950/20 text-admin-secondary"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {showFolderInput ? (
                <form onSubmit={handleCreateFolder} className="pt-2 border-t border-slate-800 space-y-2">
                  <Input
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    required
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      type="button"
                      onClick={() => setShowFolderInput(false)}
                      variant="secondary"
                      className="py-1 px-2.5 text-[10px] border-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="py-1 px-2.5 text-[10px]"
                    >
                      Create
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowFolderInput(true)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 border border-dashed border-slate-800 hover:border-slate-650 hover:bg-slate-900/20 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New Folder
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Centre Column: Grid view & Upload Zone */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Bar */}
          <Card className="p-3 bg-slate-900/40 border-admin-border dark:border-slate-800">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-admin-secondary" />
                <input
                  type="text"
                  placeholder="Search filename..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-600 focus:border-primary transition-all"
                />
              </div>

              {/* Sort/Filter */}
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="text-xs py-1.5 px-2 border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-850 outline-none rounded-lg focus:border-primary"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="size-desc">Largest Size</option>
                  <option value="size-asc">Smallest Size</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs py-1.5 px-2 border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-850 outline-none rounded-lg focus:border-primary"
                >
                  <option value="all">All Types</option>
                  <option value="images">Images</option>
                  <option value="videos">Videos</option>
                  <option value="documents">PDF Documents</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Upload Zone */}
          <MediaUploadZone
            websiteId={websiteId}
            folder={activeFolder}
            onUploadSuccess={(fileData) => setSelectedFile(fileData)}
          />

          {/* Grid list */}
          {sortedFiles.length === 0 ? (
            <EmptyState
              title="No assets found"
              description="Upload files using the box above, or search for another query."
              icon={Image}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {sortedFiles.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                const isImg = file.type.startsWith("image/");
                
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    onDoubleClick={() => setIsPreviewOpen(true)}
                    className={`relative flex flex-col p-2.5 border rounded-xl cursor-pointer select-none bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/25 bg-primary/5"
                        : "border-admin-border dark:border-slate-800"
                    }`}
                  >
                    {/* Media Display box */}
                    <div className="w-full h-28 rounded-lg bg-slate-950/40 border border-slate-800/40 overflow-hidden flex items-center justify-center flex-shrink-0 relative group">
                      {isImg ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        getFileIcon(file.type)
                      )}
                      
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                        <span className="text-[10px] text-white font-bold flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5" /> Double-click
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-left">
                      {renamingId === file.id ? (
                        <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="text-xs p-1 bg-slate-950 border border-slate-800 rounded outline-none w-full text-slate-100"
                            autoFocus
                          />
                          <Button 
                            onClick={() => handleSaveRename(file.id)}
                            variant="primary"
                            className="py-1 px-2 text-[10px]"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-admin-text block truncate" title={file.name}>
                            {file.name}
                          </span>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] text-admin-secondary font-mono">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: File Details Panel */}
        <div className="space-y-4">
          <Card title="File Details">
            {selectedFile ? (
              <div className="space-y-4 text-left">
                {/* Micro Thumbnail */}
                <div className="w-full h-32 bg-slate-950/30 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                  {selectedFile.type.startsWith("image/") ? (
                    <img
                      src={selectedFile.url}
                      alt={selectedFile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    getFileIcon(selectedFile.type)
                  )}
                </div>

                <div className="space-y-3.5 text-xs text-admin-secondary">
                  <div>
                    <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary mb-1">Filename</span>
                    <span className="font-semibold text-admin-text break-all">{selectedFile.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary">Size</span>
                      <span className="font-semibold text-admin-text">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div>
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary">Folder</span>
                      <span className="font-semibold text-admin-text capitalize">{selectedFile.folder}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary">Type</span>
                    <span className="font-semibold text-admin-text truncate block">{selectedFile.type}</span>
                  </div>

                  <div>
                    <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary mb-1">SEO Alternative Text (Alt)</span>
                    <textarea
                      value={selectedFile.alt || ""}
                      onChange={(e) => handleSaveAltText(selectedFile.id, e.target.value)}
                      placeholder="Describe this image for screen readers and search spiders..."
                      rows={2}
                      className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-800 bg-slate-850 text-slate-300 outline-none hover:border-slate-650 focus:border-primary resize-none"
                    />
                  </div>

                  <div>
                    <span className="font-bold text-[10px] uppercase tracking-wider block text-admin-secondary">URL Link</span>
                    <span className="font-semibold text-admin-text truncate block mb-1.5 font-mono text-[10px]">{selectedFile.url}</span>
                    <Button
                      onClick={() => handleCopyUrl(selectedFile.url, selectedFile.id)}
                      variant="secondary"
                      className="w-full gap-1.5 text-xs py-1.5 border-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === selectedFile.id ? "Copied!" : "Copy Asset URL"}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex gap-2">
                  <Button
                    onClick={() => handleStartRename(selectedFile)}
                    variant="secondary"
                    className="flex-1 gap-1 py-1.5 text-xs border-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Rename
                  </Button>
                  <Button
                    onClick={() => handleDelete(selectedFile.id)}
                    variant="secondary"
                    className="flex-1 gap-1 py-1.5 text-xs border-slate-800 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-admin-secondary bg-slate-950/5 border border-dashed border-slate-800 rounded-lg">
                <Info className="w-6 h-6 text-slate-500 mb-1" />
                <p className="text-xs">Select a file to view properties</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Fullscreen Preview overlay */}
      {selectedFile && (
        <MediaPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          file={selectedFile}
        />
      )}
    </div>
  );
}

export default MediaLibraryPage;
