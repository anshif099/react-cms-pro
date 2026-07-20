import React from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { FileText, Download, Edit3, CheckCircle, FileX, Archive, RefreshCw } from "lucide-react";

export function SyncStatusCard({ syncStats, lastSync, syncMode, syncStatus }) {
  const statsList = [
    {
      label: "Total Pages",
      value: syncStats.totalPages || 0,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      label: "Imported Pages",
      value: syncStats.importedPages || 0,
      icon: Download,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      label: "CMS Pages",
      value: syncStats.cmsPages || 0,
      icon: Edit3,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      label: "Published",
      value: syncStats.published || 0,
      icon: CheckCircle,
      color: "text-teal-500",
      bg: "bg-teal-500/10"
    },
    {
      label: "Drafts",
      value: syncStats.drafts || 0,
      icon: FileX,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      label: "Archived",
      value: syncStats.archived || 0,
      icon: Archive,
      color: "text-rose-500",
      bg: "bg-rose-500/10"
    }
  ];

  return (
    <Card 
      title="Synchronization Summary" 
      subtitle="Metrics mapping connected domain structure imports"
      headerAction={
        <div className="flex items-center gap-2">
          {syncMode !== "none" && (
            <Badge variant={syncMode === "manifest" ? "success" : "warning"}>
              {syncMode === "manifest" ? "Auto Manifest" : "Manual Import"}
            </Badge>
          )}
          {syncStatus === "syncing" && (
            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {statsList.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div 
              key={idx} 
              className="flex items-center gap-3 p-3 rounded-lg border border-admin-border dark:border-slate-800 bg-slate-900/10 text-left"
            >
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-admin-secondary tracking-wider block">
                  {stat.label}
                </span>
                <span className="text-lg font-bold text-admin-text block">
                  {stat.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-admin-border dark:border-slate-800 text-xs text-admin-secondary flex justify-between items-center">
        <span>Last Sync State:</span>
        <span className="font-semibold text-admin-text">{lastSync}</span>
      </div>
    </Card>
  );
}

export default SyncStatusCard;
