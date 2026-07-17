import React, { useState, useEffect, useRef } from "react";
import { cn } from "../../utils/cn";

export function Dropdown({
  trigger,
  items = [],
  align = "right",
  className,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const alignments = {
    left: "left-0 mt-1",
    right: "right-0 mt-1",
    top: "bottom-full mb-1 right-0",
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} {...props}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-40 w-48 rounded-lg bg-admin-card border border-admin-border shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-slate-800",
            alignments[align],
            className
          )}
        >
          <div className="py-1 flex flex-col">
            {items.map((item, index) => {
              if (item.divider) {
                return <div key={index} className="h-px bg-admin-border dark:bg-slate-800 my-1" />;
              }

              const Icon = item.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick && item.onClick(e);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm text-left w-full text-admin-text transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer",
                    item.variant === "danger" ? "text-admin-danger hover:bg-red-50 dark:hover:bg-red-950/20" : "",
                    item.className
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropdown;
