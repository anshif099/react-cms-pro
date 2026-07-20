import React, { useState } from "react";
import { Calendar, Globe, Power, Archive, CornerUpLeft, Eye } from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

export function PublishPanel({ 
  status = "draft", 
  publishedAt, 
  scheduledAt, 
  onPublish, 
  onUnpublish, 
  onArchive, 
  onRestore, 
  onSchedule,
  loading = false 
}) {
  const [scheduleTime, setScheduleTime] = useState("");
  const [showScheduleInput, setShowScheduleInput] = useState(false);

  const handleScheduleSubmit = () => {
    if (!scheduleTime) return;
    if (onSchedule) {
      onSchedule(new Date(scheduleTime).toISOString());
      setShowScheduleInput(false);
    }
  };

  const getStatusBadgeVariant = () => {
    switch (status) {
      case "published": return "success";
      case "archived": return "neutral";
      case "review": return "neutral";
      case "draft":
      default:
        return "neutral";
    }
  };

  const statusColors = {
    draft: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    published: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    archived: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    review: "bg-blue-500/10 text-blue-400 border border-blue-500/20"
  };

  return (
    <div className="border border-admin-border dark:border-slate-800 rounded-xl bg-slate-900/50 backdrop-blur-md p-4 space-y-4 text-left">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-admin-secondary uppercase tracking-wider">Publish Status</span>
        <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${statusColors[status]}`}>
          {status}
        </div>
      </div>

      <div className="space-y-2">
        {status === "draft" && (
          <>
            <Button
              onClick={onPublish}
              variant="primary"
              className="w-full gap-2 font-bold justify-center"
              loading={loading}
            >
              <Globe className="w-4 h-4" />
              Publish Page
            </Button>

            <Button
              onClick={() => setShowScheduleInput(!showScheduleInput)}
              variant="secondary"
              className="w-full gap-2 font-bold justify-center border-slate-700 hover:border-slate-600"
              disabled={loading}
            >
              <Calendar className="w-4 h-4" />
              Schedule Publish
            </Button>
          </>
        )}

        {status === "published" && (
          <>
            <Button
              onClick={onUnpublish}
              variant="secondary"
              className="w-full gap-2 font-bold justify-center text-amber-500 hover:text-amber-400 border-amber-500/20 hover:bg-amber-500/5"
              loading={loading}
            >
              <Power className="w-4 h-4" />
              Unpublish (Draft)
            </Button>

            <Button
              onClick={onArchive}
              variant="secondary"
              className="w-full gap-2 font-bold justify-center border-slate-700 hover:border-slate-600"
              loading={loading}
            >
              <Archive className="w-4 h-4" />
              Archive Page
            </Button>
          </>
        )}

        {status === "archived" && (
          <Button
            onClick={onRestore}
            variant="primary"
            className="w-full gap-2 font-bold justify-center"
            loading={loading}
          >
            <CornerUpLeft className="w-4 h-4" />
            Restore to Draft
          </Button>
        )}
      </div>

      {showScheduleInput && (
        <div className="pt-2.5 border-t border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-admin-secondary">Select Publish Date & Time</label>
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="w-full text-xs py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none"
            min={new Date().toISOString().slice(0, 16)}
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => setShowScheduleInput(false)}
              variant="secondary"
              className="py-1 px-2.5 text-xs border-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSubmit}
              variant="primary"
              className="py-1 px-2.5 text-xs"
              disabled={!scheduleTime}
            >
              Schedule
            </Button>
          </div>
        </div>
      )}

      {/* Info Meta */}
      <div className="pt-3 border-t border-admin-border dark:border-slate-800/80 space-y-2 text-xs text-admin-secondary">
        {publishedAt && (
          <div className="flex justify-between">
            <span>Published</span>
            <span className="font-semibold text-admin-text">
              {new Date(publishedAt).toLocaleString()}
            </span>
          </div>
        )}
        {scheduledAt && (
          <div className="flex justify-between items-center text-amber-500">
            <span>Scheduled</span>
            <span className="font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(scheduledAt).toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>SDK Availability</span>
          <span className="font-semibold text-admin-text">
            {status === "published" ? "Realtime sync" : "Private Draft"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PublishPanel;
