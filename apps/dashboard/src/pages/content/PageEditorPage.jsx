import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, FilePlus2, Loader2, Palette, PanelsTopLeft, WandSparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePages } from "../../hooks/usePages";
import PageTemplateSelector from "../../components/content/PageTemplateSelector";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Page creation is intentionally a short setup step. Once the page record is
 * created, all content and layout work continues in the native visual canvas.
 */
export function PageEditorPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();
  const { pages, createPage, fetchPages, pageLoading } = usePages();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [copyFromPageId, setCopyFromPageId] = useState("");
  const [error, setError] = useState("");

  const copyablePages = useMemo(
    () => [...pages]
      .filter((page) => page.status !== "archived")
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""))),
    [pages]
  );

  const route = useMemo(
    () => slug === "home" ? "/" : `/${slug}`,
    [slug]
  );

  useEffect(() => {
    if (websiteId) fetchPages(websiteId);
  }, [fetchPages, websiteId]);

  useEffect(() => {
    if (template !== "copy" || copyFromPageId || copyablePages.length === 0) return;
    setCopyFromPageId(copyablePages[0].id);
  }, [copyFromPageId, copyablePages, template]);

  const handleTitleChange = (event) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    if (!slugTouched) setSlug(slugify(nextTitle));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanSlug = slugify(slug || title);
    if (!cleanTitle || !cleanSlug) {
      setError("Enter a page name and route slug.");
      return;
    }
    if (template === "copy" && !copyFromPageId) {
      setError("Choose an existing page to copy.");
      return;
    }

    setError("");
    try {
      const page = await createPage(websiteId, {
        title: cleanTitle,
        slug: cleanSlug,
        route: cleanSlug === "home" ? "/" : `/${cleanSlug}`,
        routeId: cleanSlug,
        template: ["blank", "copy"].includes(template) ? null : template,
        copyFromPageId: template === "copy" ? copyFromPageId : null,
        status: "draft",
        source: "cms",
        userId: user?.email || user?.uid
      });
      navigate(`/content/${websiteId}/pages/${page.id}/editor?mode=edit`, {
        replace: true
      });
    } catch (creationError) {
      console.error(creationError);
      setError(creationError.message || "The page could not be created.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto text-left space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/content/${websiteId}/pages`)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-white cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pages
      </button>

      <div>
        <h1 className="text-2xl font-bold text-admin-text flex items-center gap-2">
          <FilePlus2 className="w-6 h-6 text-blue-400" />
          Create a page
        </h1>
        <p className="text-sm text-admin-secondary mt-1">
          Choose a starting point. The new page opens immediately in the native visual canvas.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        <Card className="p-5 border-slate-800 bg-slate-900/35">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Page name"
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Services"
              autoFocus
              required
            />
            <Input
              label="Route slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              placeholder="services"
              required
            />
          </div>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Route</span>
            <code className="block mt-1 text-xs text-violet-300">{route}</code>
          </div>
        </Card>

        <Card className="p-5 border-slate-800 bg-slate-900/35">
          <div className="flex items-center gap-2 mb-4">
            <WandSparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-200">Starting template</h2>
          </div>
          <PageTemplateSelector selectedTemplate={template} onSelect={setTemplate} />

          {template === "copy" && (
            <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <label
                htmlFor="copy-page"
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"
              >
                <Copy className="w-3.5 h-3.5" />
                Page to copy
              </label>
              {pageLoading && copyablePages.length === 0 ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading existing pages...
                </div>
              ) : copyablePages.length > 0 ? (
                <>
                  <select
                    id="copy-page"
                    value={copyFromPageId}
                    onChange={(event) => setCopyFromPageId(event.target.value)}
                    className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {copyablePages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title || "Untitled Page"} ({page.route || `/${page.slug || ""}`})
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    Content, blocks, SEO settings, and the current draft are copied. The new page gets its own route and remains a draft.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-amber-300">
                  There are no existing pages available to copy yet.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/25 px-3 py-2.5">
              <PanelsTopLeft className="mt-0.5 w-4 h-4 flex-shrink-0 text-blue-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">Website shell included</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">The default website layout supplies the same header and footer.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/25 px-3 py-2.5">
              <Palette className="mt-0.5 w-4 h-4 flex-shrink-0 text-violet-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">Theme stays connected</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Colors, fonts, and buttons inherit the website theme automatically.</p>
              </div>
            </div>
          </div>
        </Card>

        {error && (
          <p className="text-xs text-rose-300 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/content/${websiteId}/pages`)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pageLoading}>
            Create & Open Canvas
          </Button>
        </div>
      </form>
    </div>
  );
}

export default PageEditorPage;
