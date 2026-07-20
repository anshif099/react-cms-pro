import React, { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function MediaPreviewModal({ isOpen, onClose, file }) {
  if (!file) return null;

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  const handleClose = () => {
    setZoom(1);
    setRotation(0);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6">
          {/* Dark backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
          />

          {/* Floating actions menu */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {isImage && (
              <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 text-slate-400 gap-1 shadow-xl">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-850 hover:text-white rounded transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-850 hover:text-white rounded transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-slate-850 hover:text-white rounded transition-colors cursor-pointer"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <a
              href={file.url}
              download={file.name}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white border border-slate-800 rounded-lg transition-colors flex items-center justify-center shadow-xl cursor-pointer"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              onClick={handleClose}
              className="p-2.5 bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white border border-slate-800 rounded-lg transition-colors flex items-center justify-center shadow-xl cursor-pointer"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Wrapper */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="z-10 w-full h-full md:max-w-5xl md:max-h-[85vh] flex flex-col justify-center items-center relative overflow-hidden"
          >
            {/* Header info */}
            <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-lg py-2 px-4 shadow-xl max-w-sm text-left">
              <span className="text-xs font-bold text-admin-text truncate block">{file.name}</span>
              <span className="text-[10px] text-admin-secondary font-mono block mt-0.5">
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
              </span>
            </div>

            {/* Renderer Switcher */}
            <div className="flex-1 w-full h-full flex items-center justify-center p-4">
              {isImage && (
                <div 
                  className="transition-transform duration-200 ease-out flex items-center justify-center w-full h-full"
                  style={{ 
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                >
                  <img
                    src={file.url}
                    alt={file.alt || file.name}
                    className="max-w-full max-h-[70vh] md:max-h-[75vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                  />
                </div>
              )}

              {isVideo && (
                <video
                  src={file.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh] md:max-h-[75vh] rounded-lg shadow-2xl bg-black"
                />
              )}

              {isPdf && (
                <iframe
                  src={`${file.url}#toolbar=0`}
                  title={file.name}
                  className="w-full h-full min-h-[50vh] md:min-h-[70vh] rounded-lg shadow-2xl border-none bg-slate-800"
                />
              )}

              {!isImage && !isVideo && !isPdf && (
                <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-xl max-w-md shadow-2xl space-y-4">
                  <div className="text-4xl">📄</div>
                  <h4 className="text-base font-bold text-admin-text">Preview Not Supported</h4>
                  <p className="text-xs text-admin-secondary">
                    We can't render this file type in preview. You can download it directly using the button in the top right.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default MediaPreviewModal;
