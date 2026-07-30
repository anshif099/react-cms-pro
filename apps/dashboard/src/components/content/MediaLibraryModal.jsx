import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import MediaUploadZone from "./MediaUploadZone";
import { useMedia } from "../../hooks/useMedia";
import { Search, Image, Film, FileText, Check, Folder, Clock, Upload } from "lucide-react";
import Button from "../ui/Button";

export function MediaLibraryModal({ isOpen, onClose, onSelect, activeFolder = "root" }) {
  const { files, folders, fetchMedia, mediaLoading } = useMedia();
  const [activeTab, setActiveTab] = useState("library");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(activeFolder);

  // Load media on open
  useEffect(() => {
    if (isOpen && files.length === 0) {
      // Find the website ID from url context or selected website
      // To keep it simple, we can fetch all media for the active project
      // We will look for websiteId in the url path or fallback
      const match = window.location.pathname.match(/\/content\/([^/]+)/);
      const websiteId = match ? match[1] : null;
      if (websiteId) {
        fetchMedia(websiteId);
      }
    }
  }, [isOpen, fetchMedia, files.length]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("library");
    setSelectedFile(null);
    setSelectedFolder(activeFolder);
  }, [activeFolder, isOpen]);

  const handleSelect = (file) => {
    setSelectedFile(file);
  };

  const handleConfirm = () => {
    if (selectedFile && onSelect) {
      onSelect(selectedFile.url);
      onClose();
    }
  };

  const handleUploadSuccess = (fileData) => {
    if (onSelect) {
      onSelect(fileData.url);
      onClose();
    }
  };

  const getFileIcon = (type) => {
    if (type.startsWith("image/")) return <Image className="w-5 h-5 text-blue-400" />;
    if (type.startsWith("video/")) return <Film className="w-5 h-5 text-purple-400" />;
    return <FileText className="w-5 h-5 text-emerald-400" />;
  };

  const websiteId = window.location.pathname.match(/\/content\/([^/]+)/)?.[1] || null;

  const matchingFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.alt && f.alt.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredFiles = activeTab === "recent"
    ? [...matchingFiles]
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
      .slice(0, 24)
    : activeTab === "folders"
      ? matchingFiles.filter((file) => (file.folder || "root") === selectedFolder)
      : matchingFiles;

  const tabs = [
    { id: "library", label: "Library", icon: Image },
    { id: "recent", label: "Recent", icon: Clock },
    { id: "folders", label: "Folders", icon: Folder },
    { id: "upload", label: "Upload", icon: Upload }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Media Library"
      size="lg"
    >
      <div className="space-y-4 text-left">
        {/* Tabs Bar */}
        <div className="flex border-b border-admin-border dark:border-slate-800 pb-1 gap-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`pb-2 text-xs font-bold uppercase border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Library, recent files, and folder browser */}
        {activeTab !== "upload" && (
          <div className="space-y-4">
            {activeTab === "folders" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setSelectedFolder(folder)}
                    className={`h-8 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      selectedFolder === folder
                        ? "border-blue-500 bg-blue-500/10 text-blue-300"
                        : "border-slate-800 bg-slate-950/30 text-slate-500 hover:text-white"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {folder === "root" ? "Root" : folder}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-admin-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Search file name or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-850 dark:border-slate-800 outline-none hover:border-slate-650 focus:border-primary transition-all"
              />
            </div>

            {/* Grid */}
            {mediaLoading && files.length === 0 ? (
              <div className="text-center py-10 text-xs text-admin-secondary">Loading media...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-xs text-admin-secondary">
                No media assets match your query.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-72 overflow-y-auto pr-1">
                {filteredFiles.map((file) => {
                  const isSelected = selectedFile?.id === file.id;
                  const isImage = file.type.startsWith("image/");
                  
                  return (
                    <div
                      key={file.id}
                      onClick={() => handleSelect(file)}
                      className={`relative flex flex-col p-2 border rounded-xl cursor-pointer select-none bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-600 transition-all ${
                        isSelected 
                          ? "border-primary ring-2 ring-primary/25 bg-primary/5" 
                          : "border-admin-border dark:border-slate-800"
                      }`}
                    >
                      {/* Image Preview or Icon */}
                      <div className="w-full h-24 rounded-lg bg-slate-950/40 border border-slate-800/40 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {isImage ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getFileIcon(file.type)
                        )}
                      </div>

                      {/* Info name */}
                      <div className="mt-2 text-left">
                        <span className="text-[11px] font-bold text-admin-text block truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[9px] text-admin-secondary block mt-0.5 font-mono">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      {/* Selected checkmark bubble */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 bg-primary text-white p-1 rounded-full shadow-md">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                onClick={onClose}
                variant="secondary"
                className="border-slate-800 text-xs py-1.5 px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                variant="primary"
                className="text-xs py-1.5 px-4"
                disabled={!selectedFile}
              >
                Select Asset
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Upload Zone */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            {websiteId ? (
              <MediaUploadZone
                websiteId={websiteId}
                folder={selectedFolder}
                onUploadSuccess={handleUploadSuccess}
              />
            ) : (
              <div className="text-center py-6 text-xs text-admin-danger">
                Error: Project identity missing. Cannot upload.
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                onClick={onClose}
                variant="secondary"
                className="border-slate-800 text-xs py-1.5 px-4"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default MediaLibraryModal;
