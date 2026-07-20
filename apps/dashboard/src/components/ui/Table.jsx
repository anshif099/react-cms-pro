import React from "react";
import { cn } from "../../utils/cn";

export function Table({
  headers = [],
  children,
  className,
  ...props
}) {
  return (
    <div className={cn("w-full overflow-x-auto border border-admin-border rounded-lg bg-white dark:border-slate-800 dark:bg-slate-900/30", className)} {...props}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-admin-border dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-admin-secondary uppercase tracking-wider select-none">
            {headers.map((header, index) => (
              <th 
                key={index} 
                className={cn(
                  "py-3.5 px-4 font-semibold", 
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-border dark:divide-slate-800 text-sm text-admin-text">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, className, onClick, ...props }) {
  return (
    <tr
      className={cn(
        "hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td className={cn("py-3.5 px-4 align-middle", className)} {...props}>
      {children}
    </td>
  );
}

export default Table;
