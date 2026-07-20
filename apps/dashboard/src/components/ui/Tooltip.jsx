import React, { useState } from "react";
import { cn } from "../../utils/cn";

export function Tooltip({
  children,
  content,
  position = "top",
  className,
  ...props
}) {
  const [active, setActive] = useState(false);

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  const arrows = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-800 dark:border-t-slate-900 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 dark:border-b-slate-900 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-800 dark:border-l-slate-900 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-800 dark:border-r-slate-900 border-y-transparent border-l-transparent"
  };

  return (
    <div
      className="relative flex items-center inline-block"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      {...props}
    >
      {children}
      {active && content && (
        <div
          className={cn(
            "absolute z-50 whitespace-nowrap bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-md pointer-events-none transition-all duration-150 dark:bg-slate-950",
            positions[position],
            className
          )}
        >
          {content}
          <div className={cn("absolute border-4 w-0 h-0", arrows[position])} />
        </div>
      )}
    </div>
  );
}

export default Tooltip;
