import React from "react";
import { cn } from "../../utils/cn";

export function LoadingSkeleton({
  variant = "text",
  className,
  count = 1,
  ...props
}) {
  const baseStyles = "animate-pulse bg-slate-200 dark:bg-slate-700 rounded";

  const renderSkeleton = () => {
    switch (variant) {
      case "avatar":
        return <div className={cn(baseStyles, "w-10 h-10 rounded-full", className)} {...props} />;
      case "card":
        return (
          <div className={cn("border border-admin-border p-6 rounded-xl space-y-4 bg-white dark:border-slate-800 dark:bg-slate-800", className)} {...props}>
            <div className="flex gap-4">
              <div className={cn(baseStyles, "w-12 h-12 rounded-lg")} />
              <div className="space-y-2 flex-1">
                <div className={cn(baseStyles, "h-4 w-1/3")} />
                <div className={cn(baseStyles, "h-3 w-1/2")} />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className={cn(baseStyles, "h-3 w-full")} />
              <div className={cn(baseStyles, "h-3 w-5/6")} />
            </div>
          </div>
        );
      case "table-row":
        return (
          <div className={cn("flex items-center gap-4 py-4 border-b border-admin-border dark:border-slate-800", className)} {...props}>
            <div className={cn(baseStyles, "h-4 w-1/4")} />
            <div className={cn(baseStyles, "h-4 w-1/4")} />
            <div className={cn(baseStyles, "h-4 w-1/6")} />
            <div className={cn(baseStyles, "h-4 w-1/6")} />
            <div className={cn(baseStyles, "h-4 w-10 ml-auto")} />
          </div>
        );
      case "text":
      default:
        return Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={cn(baseStyles, "h-4 w-full mb-2 last:mb-0", className)}
            {...props}
          />
        ));
    }
  };

  return <>{renderSkeleton()}</>;
}

export default LoadingSkeleton;
