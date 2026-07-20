import React, { useRef, useState } from "react";
import { UploadCloud, File, AlertCircle, Check } from "lucide-react";
import { useMedia } from "../../hooks/useMedia";

export function MediaUploadZone({ websiteId, folder = "root", onUploadSuccess }) {
  const { uploadFile, uploadProgress } = useMedia();
  const [isDragActive, setIsDragActive] = useState(false);
  const [localUploads, setLocalUploads] = useState([]);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFiles = async (filesList) => {
    const filesArray = Array.from(filesList);
    if (filesArray.length === 0) return;

    // Add files to local progress tracking list
    const newUploads = filesArray.map(file => ({
      key: `${Date.now()}_${file.name}`,
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2), // MB
      status: "uploading",
      error: null
    }));
    
    setLocalUploads(prev => [...newUploads, ...prev]);

    // Perform uploads concurrently
    filesArray.forEach((file, index) => {
      const uploadItem = newUploads[index];
      
      uploadFile(websiteId, file, folder)
        .then((fileData) => {
          setLocalUploads(prev =>
            prev.map(item =>
              item.key === uploadItem.key
                ? { ...item, status: "success" }
                : item
            )
          );
          if (onUploadSuccess) {
            onUploadSuccess(fileData);
          }
        })
        .catch((err) => {
          setLocalUploads(prev =>
            prev.map(item =>
              item.key === uploadItem.key
                ? { ...item, status: "error", error: err.message || "Failed" }
                : item
            )
          );
        });
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const activeUploadKeys = Object.keys(uploadProgress);

  return (
    <div className="space-y-4">
      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer select-none bg-slate-900/10 hover:bg-slate-900/30 ${
          isDragActive 
            ? "border-primary bg-primary/5 text-primary scale-[0.99]" 
            : "border-admin-border dark:border-slate-800 text-slate-400 hover:border-slate-650"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? "text-primary animate-bounce" : "text-admin-secondary"}`} />
        <p className="text-sm font-semibold text-admin-text">
          Drag & drop your files here, or <span className="text-primary hover:underline">browse</span>
        </p>
        <p className="text-[11px] text-admin-secondary mt-1">
          Supports Images, Videos, PDFs, and SVGs (Max 50MB)
        </p>
      </div>

      {/* Upload Progress Listings */}
      {localUploads.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto border border-admin-border dark:border-slate-800 p-3 rounded-xl bg-slate-950/20">
          <div className="text-xs font-bold text-admin-secondary uppercase tracking-wider mb-2 flex justify-between">
            <span>Upload Queue</span>
            <button 
              type="button" 
              onClick={() => setLocalUploads([])}
              className="text-[10px] text-primary hover:underline cursor-pointer font-bold"
            >
              Clear Queue
            </button>
          </div>
          <div className="space-y-2">
            {localUploads.map((item) => {
              // Find matching progress in hook state
              const matchedProgress = activeUploadKeys.find(k => k.endsWith(item.name));
              const progress = matchedProgress ? uploadProgress[matchedProgress] : 0;

              return (
                <div 
                  key={item.key} 
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-900/30 border border-slate-800/40"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
                    <File className="w-4 h-4 text-admin-secondary flex-shrink-0" />
                    <div className="truncate w-full">
                      <span className="font-semibold text-admin-text block truncate">{item.name}</span>
                      <span className="text-[10px] text-admin-secondary">{item.size} MB</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-32 justify-end">
                    {item.status === "uploading" && (
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-primary font-bold">
                          <span>UPLOADING</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-300 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {item.status === "success" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded-full">
                        <Check className="w-3 h-3" /> SUCCESS
                      </span>
                    )}
                    {item.status === "error" && (
                      <span 
                        className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 border border-red-400/20 rounded-full cursor-help"
                        title={item.error}
                      >
                        <AlertCircle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaUploadZone;
