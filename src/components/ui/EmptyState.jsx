import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

export function EmptyState({
  icon: Icon = FolderOpen,
  title = "No items found",
  description = "Get started by creating a new item.",
  actionLabel,
  onActionClick,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-admin-border dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/30",
        className
      )}
      {...props}
    >
      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-admin-secondary mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="font-semibold text-lg text-admin-text mb-1">{title}</h3>
      <p className="text-sm text-admin-secondary max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onActionClick && (
        <Button onClick={onActionClick} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
