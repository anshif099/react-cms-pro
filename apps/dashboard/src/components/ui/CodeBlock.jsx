import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { cn } from "../../utils/cn";

export function CodeBlock({
  code,
  language = "javascript",
  className,
  ...props
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy code.");
    }
  };

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-admin-border dark:border-slate-800 bg-slate-900 text-slate-100 text-left font-mono text-xs shadow-inner", className)} {...props}>
      {/* Header bar */}
      <div className="flex justify-between items-center py-2 px-4 bg-slate-950/80 border-b border-slate-800 select-none">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-sans">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="font-sans font-medium text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans font-medium">Copy code</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code Area */}
      <pre className="p-4 overflow-x-auto leading-relaxed select-all">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default CodeBlock;
