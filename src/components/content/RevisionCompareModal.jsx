import React from "react";
import Modal from "../ui/Modal";
import revisionService from "../../services/revisionService";

export function RevisionCompareModal({ isOpen, onClose, revision, currentDraft }) {
  if (!revision) return null;

  const diff = revisionService.compare(revision.snapshot, currentDraft);
  const diffKeys = Object.keys(diff);

  const formatValue = (val) => {
    if (val === undefined) return <span className="text-slate-600 italic">None</span>;
    if (typeof val === "object") {
      return <pre className="text-xs font-mono bg-slate-950 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>;
    }
    return <span className="font-mono text-sm break-all">{String(val)}</span>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compare Revision (${new Date(revision.savedAt).toLocaleString()})`}
      size="xl"
    >
      <div className="space-y-6 text-left">
        <div className="flex gap-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-xs text-admin-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-red-500/20 border border-red-500/30 rounded" />
            <span>Old Version</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-emerald-500/20 border border-emerald-500/30 rounded" />
            <span>Current Draft</span>
          </div>
        </div>

        {diffKeys.length === 0 ? (
          <div className="py-8 text-center text-admin-secondary text-sm">
            This revision is identical to the current draft.
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {diffKeys.map((key) => {
              const change = diff[key];
              
              return (
                <div 
                  key={key} 
                  className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20"
                >
                  <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 font-semibold text-xs text-admin-text tracking-wider uppercase">
                    Field: {key}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
                    {/* Left: Old Value */}
                    <div className="p-4 bg-red-950/10 hover:bg-red-950/15 transition-colors">
                      <div className="text-[10px] uppercase font-bold text-red-400 mb-2">Revision Value</div>
                      <div className="text-red-300">
                        {formatValue(change.oldValue)}
                      </div>
                    </div>
                    {/* Right: New Value */}
                    <div className="p-4 bg-emerald-950/10 hover:bg-emerald-950/15 transition-colors">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 mb-2">Current Draft Value</div>
                      <div className="text-emerald-300">
                        {formatValue(change.newValue)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default RevisionCompareModal;
