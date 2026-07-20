import React from "react";
import { File, Layout, FileText, Mail, CreditCard, Grid, HelpCircle } from "lucide-react";
import { cn } from "../../utils/cn";

const TEMPLATES = [
  {
    key: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with an empty layout list.",
    icon: File,
    color: "text-slate-400 bg-slate-500/10"
  },
  {
    key: "landing",
    name: "Landing Page",
    description: "Standard layout containing Hero, Features, and CTA sections.",
    icon: Layout,
    color: "text-blue-500 bg-blue-500/10"
  },
  {
    key: "blog",
    name: "Blog Post",
    description: "Readable layout with headings, body copies, and post cards.",
    icon: FileText,
    color: "text-purple-500 bg-purple-500/10"
  },
  {
    key: "contact",
    name: "Contact Page",
    description: "Heading layouts combined with clean interactive forms.",
    icon: Mail,
    color: "text-rose-500 bg-rose-500/10"
  },
  {
    key: "pricing",
    name: "Pricing Page",
    description: "Show plans structure grid columns side-by-side.",
    icon: CreditCard,
    color: "text-amber-500 bg-amber-500/10"
  },
  {
    key: "portfolio",
    name: "Media Portfolio",
    description: "Introduce gallery items mapped to media folder assets.",
    icon: Grid,
    color: "text-teal-500 bg-teal-500/10"
  },
  {
    key: "documentation",
    name: "Product Docs",
    description: "Technical instructions structured with FAQ toggles.",
    icon: HelpCircle,
    color: "text-emerald-500 bg-emerald-500/10"
  }
];

export function PageTemplateSelector({ selectedTemplate, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1 text-left">
      {TEMPLATES.map((tpl) => {
        const Icon = tpl.icon;
        const isSelected = selectedTemplate === tpl.key;

        return (
          <div
            key={tpl.key}
            onClick={() => onSelect(tpl.key)}
            className={cn(
              "flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all bg-slate-900/20 hover:bg-slate-900/40 select-none group",
              isSelected 
                ? "border-primary ring-1 ring-primary/40 bg-primary/5" 
                : "border-admin-border dark:border-slate-800 hover:border-slate-700"
            )}
          >
            <div className={cn("p-2.5 rounded-lg flex-shrink-0", tpl.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-admin-text group-hover:text-white block">
                {tpl.name}
              </span>
              <span className="text-xs text-admin-secondary block mt-0.5 leading-relaxed">
                {tpl.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PageTemplateSelector;
