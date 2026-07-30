import React, { useMemo, useState } from "react";
import { ArrowLeft, FilePlus2, WandSparkles } from "lucide-react";
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
  const { createPage, pageLoading } = usePages();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [error, setError] = useState("");

  const route = useMemo(
    () => slug === "home" ? "/" : `/${slug}`,
    [slug]
  );

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

    setError("");
    try {
      const page = await createPage(websiteId, {
        title: cleanTitle,
        slug: cleanSlug,
        route: cleanSlug === "home" ? "/" : `/${cleanSlug}`,
        routeId: cleanSlug,
        template: template === "blank" ? null : template,
        status: "draft",
        source: "cms",
        userId: user?.email || user?.uid
      });
      navigate(`/content/${websiteId}/pages/${page.id}/editor?mode=edit`, {
        replace: true
      });
    } catch (creationError) {
      console.error(creationError);
      setError("The page could not be created.");
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
