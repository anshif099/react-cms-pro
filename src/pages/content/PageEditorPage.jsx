import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Globe, Eye, Settings, Terminal, Plus, Trash2, Copy, EyeOff, Layout } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import { useRevisions } from "../../hooks/useRevisions";
import { useAuth } from "../../hooks/useAuth";
import SEOPanel from "../../components/content/SEOPanel";
import PublishPanel from "../../components/content/PublishPanel";
import RevisionPanel from "../../components/content/RevisionPanel";
import RevisionCompareModal from "../../components/content/RevisionCompareModal";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";

export function PageEditorPage() {
  const { websiteId, pageId } = useParams();
  const navigate = useNavigate();
  
  const { selectedPage, fetchPageById, updatePage, publishPage, unpublishPage } = usePages();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);
  const { revisions, loadRevisions, saveRevision, restoreRevision } = useRevisions();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Local form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [seo, setSeo] = useState({});
  const [blocks, setBlocks] = useState([]);

  // Revision comparison state
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Load page details
  useEffect(() => {
    if (websiteId && pageId) {
      selectWebsite(websiteId);
      fetchPageById(websiteId, pageId);
      loadRevisions(websiteId, "page", pageId);
    }
  }, [websiteId, pageId, selectWebsite, fetchPageById, loadRevisions]);

  // Sync state with selected page/locale
  useEffect(() => {
    if (selectedPage) {
      const localeData = selectedPage.locales?.[activeLocale] || {};
      setTitle(localeData.title || selectedPage.title || "");
      setSlug(localeData.slug || selectedPage.slug || "");
      setSeo(localeData.seo || {});
      setBlocks(localeData.blocks || []);
    }
  }, [selectedPage, activeLocale]);

  // Auto-saves draft changes (debounce or manual trigger)
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        seo,
        blocks,
        status: selectedPage?.status || "draft"
      };
      await updatePage(websiteId, pageId, activeLocale, payload);
      // Create a draft revision snapshot
      await saveRevision(websiteId, "page", pageId, {
        title,
        slug,
        seo,
        blocks,
        status: selectedPage?.status || "draft"
      }, user?.email || "anonymous");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // First save current draft changes
      const payload = {
        title,
        slug,
        seo,
        blocks,
        status: "published"
      };
      await updatePage(websiteId, pageId, activeLocale, payload);
      await publishPage(websiteId, pageId, user?.email || "anonymous");
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await unpublishPage(websiteId, pageId);
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleRestoreRevision = async (revisionId) => {
    if (window.confirm("Are you sure you want to restore this version? This will overwrite your current unsaved draft changes.")) {
      try {
        const snapshot = await restoreRevision(websiteId, "page", pageId, revisionId);
        setTitle(snapshot.title || "");
        setSlug(snapshot.slug || "");
        setSeo(snapshot.seo || {});
        setBlocks(snapshot.blocks || []);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCompareRevision = (revision) => {
    setSelectedRevision(revision);
    setIsCompareOpen(true);
  };

  // Mock block operations for v2.0 Phase 2
  const handleAddMockBlock = () => {
    const newBlock = {
      id: Math.random().toString(36).substring(2, 9),
      type: "hero",
      title: "Hero Banner",
      subtitle: "Customize this header subtext in Phase 4 block editor."
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const handleRemoveBlock = (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  if (!selectedPage || !selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading Page Editor...</div>;
  }

  const currentDraftSnapshot = { title, slug, seo, blocks, status: selectedPage?.status };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto">
      {/* Top sticky action header bar */}
      <div className="sticky top-0 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-3 px-4 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => navigate(`/content/${websiteId}/pages`)}
            className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-admin-secondary hover:text-admin-text transition-colors cursor-pointer"
            title="Back to Pages"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-admin-text truncate max-w-[200px] sm:max-w-[300px]">
              Editing: {selectedPage.title}
            </h3>
            <span className="text-[10px] text-admin-secondary font-mono flex items-center gap-1 mt-0.5">
              <Terminal className="w-3 h-3" /> /{slug || selectedPage.slug}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Locale switcher */}
          <div className="flex bg-slate-950/60 p-0.5 border border-slate-800 rounded-lg">
            {activeLocales.map((code) => (
              <button
                key={code}
                onClick={() => setLocale(code)}
                className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase transition-all cursor-pointer ${
                  activeLocale === code ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <Button
            onClick={() => navigate(`/content/${websiteId}/preview/${pageId}`)}
            variant="secondary"
            className="gap-1.5 py-1.5 text-xs border-slate-800"
          >
            <Eye className="w-3.5 h-3.5" />
            Live Preview
          </Button>

          <Button
            onClick={handleSaveDraft}
            variant="secondary"
            className="gap-1.5 py-1.5 text-xs border-slate-700 hover:border-slate-600"
            loading={saving}
            disabled={publishing}
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>

          <Button
            onClick={handlePublish}
            variant="primary"
            className="gap-1.5 py-1.5 text-xs font-bold"
            loading={publishing}
            disabled={saving}
          >
            <Globe className="w-3.5 h-3.5" />
            Publish
          </Button>
        </div>
      </div>

      {/* Main columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left editor body */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Page Properties">
            <div className="space-y-4">
              <Input
                label="Page Display Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Home Page"
                required
              />
              <Input
                label="Path Slug (URL)"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                placeholder="e.g. home"
                required
              />
            </div>
          </Card>

          {/* Block Editor Mock Shell */}
          <Card 
            title="Block Editor" 
            subtitle="Visual content editor blocks will reside here (fully styled in Phase 4)"
          >
            <div className="space-y-4">
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-admin-border dark:border-slate-800 rounded-xl p-8 bg-slate-950/10 text-center">
                  <Layout className="w-8 h-8 text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-400 mb-1">No blocks added yet</p>
                  <p className="text-xs text-admin-secondary mb-4">Blocks are sections like Hero, Pricing, Team, FAQs, CTA, etc.</p>
                  <Button onClick={handleAddMockBlock} variant="secondary" className="gap-1.5 border-slate-800">
                    <Plus className="w-4 h-4" /> Add Temporary Block
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {blocks.map((block, idx) => (
                    <div 
                      key={block.id} 
                      className="flex items-center justify-between p-3.5 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-900/30"
                    >
                      <div className="text-left">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                          Block {idx + 1}: {block.type}
                        </span>
                        <span className="text-sm font-semibold text-admin-text block mt-0.5">
                          {block.title}
                        </span>
                        <span className="text-xs text-admin-secondary block">
                          {block.subtitle}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveBlock(block.id)}
                        className="p-2 text-admin-secondary hover:text-admin-danger hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Remove Block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-center pt-2">
                    <Button onClick={handleAddMockBlock} variant="secondary" className="gap-1.5 border-slate-800">
                      <Plus className="w-4 h-4" /> Add Another Block
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right configuration sidebars */}
        <div className="space-y-6">
          <PublishPanel
            status={selectedPage.status || "draft"}
            publishedAt={selectedPage.publishedAt}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            loading={publishing}
          />
          
          <SEOPanel
            seoData={seo}
            onChange={setSeo}
          />

          <RevisionPanel
            revisions={revisions}
            onRestore={handleRestoreRevision}
            onCompare={handleCompareRevision}
          />
        </div>
      </div>

      {/* Revision comparison modal popup */}
      <RevisionCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        revision={selectedRevision}
        currentDraft={currentDraftSnapshot}
      />
    </div>
  );
}

export default PageEditorPage;
