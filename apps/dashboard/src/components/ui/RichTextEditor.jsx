import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { 
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  Heading1, Heading2, Heading3, Quote, Code, Link as LinkIcon, 
  Trash2, RotateCcw 
} from "lucide-react";
import { cn } from "../../utils/cn";

export function RichTextEditor({ label, value, onChange, placeholder = "Enter description text...", className }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  // Sync value from prop if editor is loaded and value differs
  React.useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.commands.unsetLink();
      return;
    }
    const url = window.prompt("Enter link URL:");
    if (url) {
      editor.commands.setLink({ href: url });
    }
  };

  const toolbarBtnClass = (active) => cn(
    "p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer",
    active ? "bg-primary text-white hover:bg-primary/95" : ""
  );

  return (
    <div className={cn("flex flex-col gap-1 w-full text-left", className)}>
      {label && (
        <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="border border-admin-border dark:border-slate-800 rounded-lg overflow-hidden bg-slate-900/10 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary transition-all">
        {/* Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border-b border-admin-border dark:border-slate-800 select-none">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={toolbarBtnClass(editor.isActive("bold"))}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={toolbarBtnClass(editor.isActive("italic"))}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={toolbarBtnClass(editor.isActive("underline"))}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={toolbarBtnClass(editor.isActive("heading", { level: 1 }))}
            title="H1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={toolbarBtnClass(editor.isActive("heading", { level: 2 }))}
            title="H2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={toolbarBtnClass(editor.isActive("heading", { level: 3 }))}
            title="H3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarBtnClass(editor.isActive("bulletList"))}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarBtnClass(editor.isActive("orderedList"))}
            title="Ordered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={toggleLink}
            className={toolbarBtnClass(editor.isActive("link"))}
            title="Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={toolbarBtnClass(editor.isActive("blockquote"))}
            title="Blockquote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={toolbarBtnClass(editor.isActive("codeBlock"))}
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Input Area */}
        <div className="p-3 text-sm text-slate-100 min-h-[140px] focus:outline-none dark:bg-slate-800/20">
          <EditorContent 
            editor={editor} 
            className="prose dark:prose-invert max-w-none min-h-[120px] focus:outline-none text-slate-200 outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export default RichTextEditor;
