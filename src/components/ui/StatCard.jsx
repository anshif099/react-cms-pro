import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "../../utils/cn";

export function StatCard({
  title,
  value,
  icon: Icon,
  trend, // e.g. { value: "+12.4%", type: "up" | "down" }
  description,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "bg-admin-card border border-admin-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 dark:border-slate-800",
        className
      )}
      {...props}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">{title}</p>
          <h4 className="text-3xl font-bold text-admin-text tracking-tight">{value}</h4>
        </div>
        {Icon && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-primary">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(trend || description) && (
        <div className="flex items-center gap-1.5 mt-4 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center font-semibold rounded-md px-1.5 py-0.5",
                trend.type === "up" 
                  ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" 
                  : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
              )}
            >
              {trend.type === "up" ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              )}
              {trend.value}
            </span>
          )}
          {description && (
            <span className="text-admin-secondary font-medium">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
