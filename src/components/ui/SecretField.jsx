import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { cn } from "../../utils/cn";

export function SecretField({
  value,
  label = "Secret Key",
  className,
  ...props
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy key.");
    }
  };

  const getMaskedValue = () => {
    if (!value) return "";
    if (show) return value;
    // Show prefix and mask rest or mask everything
    const prefix = value.substring(0, 10);
    return `${prefix}••••••••••••••••••••`;
  };

  return (
    <div className={cn("flex items-center justify-between border border-admin-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 py-2 px-3 rounded-lg w-full text-sm", className)} {...props}>
      <code className="font-mono text-admin-text dark:text-slate-200 select-all overflow-hidden text-ellipsis mr-2 max-w-[calc(100%-80px)]">
        {getMaskedValue()}
      </code>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="p-1.5 text-admin-secondary hover:text-admin-text transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer"
          title={show ? "Hide key" : "Show key"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-admin-secondary hover:text-admin-text transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer"
          title="Copy key"
        >
          {copied ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default SecretField;
