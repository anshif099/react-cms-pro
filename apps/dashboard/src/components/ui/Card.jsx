import React from "react";
import { cn } from "../../utils/cn";

export function Card({
  children,
  className,
  title,
  subtitle,
  headerAction,
  noPadding = false,
  ...props
}) {
  return (
    <div
      className={cn(
        "bg-admin-card border border-admin-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 dark:border-slate-800",
        className
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4 border-b border-admin-border dark:border-slate-800 flex justify-between items-center gap-4">
          <div>
            {title && <h3 className="font-semibold text-lg text-admin-text">{title}</h3>}
            {subtitle && <p className="text-sm text-admin-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-6")}>
        {children}
      </div>
    </div>
  );
}

export default Card;
