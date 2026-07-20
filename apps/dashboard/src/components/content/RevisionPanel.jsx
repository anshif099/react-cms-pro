import React from "react";
import { History, RotateCcw, GitCompare } from "lucide-react";
import Button from "../ui/Button";

export function RevisionPanel({ 
  revisions = [], 
  onRestore, 
  onCompare, 
  loading = false 
}) {
  const getInitials = (email) => {
    if (!email) return "U";
    return email.split("@")[0].substring(0, 2).toUpperCase();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="border border-admin-border dark:border-slate-800 rounded-xl bg-slate-900/50 backdrop-blur-md p-4 space-y-3.5 text-left">
      <div className="flex items-center gap-2 border-b border-admin-border dark:border-slate-800 pb-2">
        <History className="w-4 h-4 text-admin-secondary" />
        <h4 className="font-bold text-sm text-admin-text">Revision History</h4>
        <span className="text-xs bg-slate-800 text-admin-secondary px-2 py-0.5 rounded-full ml-auto">
          {revisions.length}
        </span>
      </div>

      {revisions.length === 0 ? (
        <div className="text-xs text-admin-secondary py-4 text-center">
          No revisions saved yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {revisions.map((rev) => (
            <div 
              key={rev.id} 
              className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-800/40 hover:border-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center border border-primary/25"
                  title={rev.savedBy}
                >
                  {getInitials(rev.savedBy)}
                </div>
                <div>
                  <div className="text-xs font-bold text-admin-text">{formatTime(rev.savedAt)}</div>
                  <div className="text-[10px] text-admin-secondary truncate max-w-[120px]">{rev.savedBy}</div>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => onCompare && onCompare(rev)}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-admin-secondary hover:text-admin-text transition-colors cursor-pointer"
                  title="Compare with current draft"
                  disabled={loading}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRestore && onRestore(rev.id)}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-admin-secondary hover:text-admin-text transition-colors cursor-pointer"
                  title="Restore this version"
                  disabled={loading}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RevisionPanel;
