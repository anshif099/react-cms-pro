import React from "react";
import { cn } from "../../utils/cn";

export function Badge({
  children,
  className,
  variant = "neutral",
  ...props
}) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none border";

  // Pre-configured variants
  const variants = {
    // Basic types
    neutral: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    primary: "bg-primary/10 text-primary border-primary/20",
    
    // Status types
    success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/40",
    warning: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800/40",
    danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40",
    info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/40",
    
    // Exact status mappings
    connected: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/40",
    verified: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/40",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800/40",
    disconnected: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40"
  };

  const selectedVariant = variants[children?.toString().toLowerCase()] || variants[variant] || variants.neutral;

  return (
    <span
      className={cn(baseStyles, selectedVariant, className)}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
