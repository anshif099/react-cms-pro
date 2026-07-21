import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sliders, Layers, FileText, Clock } from "lucide-react";
import registryService from "../../services/registryService";
import Card from "../../components/ui/Card";

export function EditableRegionsPage() {
  const { websiteId } = useParams();
  const [loading, setLoading] = useState(true);
  const [regionsData, setRegionsData] = useState({});

  useEffect(() => {
    if (!websiteId) return;

    setLoading(true);
    const unsubscribe = registryService.subscribeToEditableRegions(websiteId, (data) => {
      setRegionsData(data || {});
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [websiteId]);

  const totalPages = Object.keys(regionsData).length;
  let totalRegions = 0;
  Object.values(regionsData).forEach((pageObj) => {
    totalRegions += Object.keys(pageObj || {}).length;
  });

  if (loading) {
    return <div className="p-6 text-slate-400">Loading editable region schemas...</div>;
  }

  return (
    <div className="p-6 space-y-6 text-left max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-805 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" />
            <span>Editable Regions Schema Viewer</span>
          </h2>
          <p className="text-sm text-admin-secondary mt-1">
            View all explicit editable regions declared in the connected React client app via <code className="text-xs bg-slate-800 text-primary px-1.5 py-0.5 rounded font-mono">useEditable</code> or <code className="text-xs bg-slate-800 text-primary px-1.5 py-0.5 rounded font-mono">EditableXxx</code> primitives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
            <span className="text-primary font-bold">{totalRegions}</span> region(s) registered across <span className="text-primary font-bold">{totalPages}</span> page(s)
          </div>
        </div>
      </div>

      {totalPages === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-3 bg-slate-900/40 border-slate-800">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Editable Regions Registered</h3>
          <p className="text-xs max-w-md mx-auto leading-relaxed text-slate-400">
            Once your connected React app mounts components using <code className="text-primary font-mono">useEditable</code> or <code className="text-primary font-mono">&lt;EditableText /&gt;</code>, their schema metadata will automatically appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(regionsData).map(([pageId, regionsMap]) => {
            const regionList = Object.values(regionsMap || {});
            return (
              <Card key={pageId} className="p-5 border-slate-805 bg-slate-900/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-slate-200 font-mono">Page ID: {pageId}</h3>
                  </div>
                  <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 py-0.5 px-2 rounded-full font-bold uppercase tracking-wider font-mono">
                    {regionList.length} region(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regionList.map((reg) => (
                    <div
                      key={reg.id}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-100 font-mono">{reg.id}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{reg.label || reg.id}</p>
                        </div>
                        <span className="text-[9px] bg-slate-800 text-purple-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          {reg.type}
                        </span>
                      </div>

                      {reg.registeredAt && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-900">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>{new Date(reg.registeredAt).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EditableRegionsPage;
