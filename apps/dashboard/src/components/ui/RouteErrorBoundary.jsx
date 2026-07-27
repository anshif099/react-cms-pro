import React, { useState } from "react";
import { useRouteError, useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const errorMessage = error?.message || error?.statusText || "An unexpected error occurred.";
  const isChunkError =
    errorMessage.includes("Failed to fetch dynamically imported module") ||
    errorMessage.includes("Importing a module script failed") ||
    errorMessage.includes("dynamically imported module");

  const handleReload = () => {
    try {
      sessionStorage.removeItem("retry_chunk_reload");
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 select-none font-sans">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden text-center space-y-6">
        {/* Glow accent decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
          <AlertTriangle className="w-8 h-8 animate-pulse" />
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-white">
            {isChunkError ? "Deployment Update Detected" : "Application Navigation Error"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isChunkError
              ? "A new version of React CMS Pro was deployed or your connection was updated. Please refresh to load the latest application assets."
              : "Something went wrong while loading this view. You can refresh the page or return to your dashboard."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleReload}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-lg shadow-primary/20"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>

          <button
            type="button"
            onClick={handleGoHome}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold hover:bg-slate-750 hover:text-white transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Technical Error Details Accordion */}
        <div className="pt-2 border-t border-slate-800/80 text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-300 flex items-center justify-between w-full py-1 cursor-pointer transition-colors"
          >
            <span>Technical Log Info</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-850 font-mono text-[10px] text-rose-400 break-all max-h-32 overflow-y-auto leading-normal">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RouteErrorBoundary;
