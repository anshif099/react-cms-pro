import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ExternalLink,
  Files,
  Image as ImageIcon,
  Loader2,
  Newspaper,
  Puzzle,
  RefreshCw,
  Save,
  SearchCheck,
  Sparkles
} from "lucide-react";
import mediaService from "../../services/mediaService";
import pluginService from "../../services/pluginService";
import { buildSEOAudit, validateSchemaMarkup } from "../../services/seoWorkspaceService";

const FIELD_CLASS = "mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-700 focus:border-violet-500";
const SEO_PLUGIN_ID = "seo-booster";
const DEFAULT_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "",
  description: ""
}, null, 2);

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
      <div className="flex items-start gap-2">
        <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-violet-500/10">
          <Icon className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-100">{title}</p>
          {subtitle && <p className="mt-0.5 text-[8px] leading-3 text-slate-600">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, limit, multiline = false }) {
  const Component = multiline ? "textarea" : "input";
  return (
    <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
      <span className="flex items-center justify-between gap-2">
        {label}
        {limit && (
          <span className={value.length > limit ? "text-rose-400" : "text-slate-700"}>
            {value.length}/{limit}
          </span>
        )}
      </span>
      <Component
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        className={`${FIELD_CLASS} ${multiline ? "resize-y leading-4" : "h-9"}`}
      />
    </label>
  );
}

function StatusPill({ good, children }) {
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold ${
      good
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-amber-500/20 bg-amber-500/10 text-amber-300"
    }`}>
      {children}
    </span>
  );
}

export function SEOWorkspacePanel({
  websiteId,
  pageSettings = {},
  context,
  canvasScan,
  contextLoading,
  onRefresh,
  onRequestScan,
  onSaveSEO,
  onRequestFix
}) {
  const storedSEO = pageSettings?.seo || context?.currentPage?.settings?.seo || {};
  const [form, setForm] = useState(() => ({
    focusKeyword: storedSEO.focusKeyword || "",
    metaTitle: storedSEO.metaTitle || "",
    canonicalUrl: storedSEO.canonicalUrl || "",
    metaDescription: storedSEO.metaDescription || "",
    jsonLd: storedSEO.jsonLd || ""
  }));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [schemaError, setSchemaError] = useState("");
  const [assetDrafts, setAssetDrafts] = useState({});
  const [assetSaving, setAssetSaving] = useState("");
  const [pluginBusy, setPluginBusy] = useState(false);

  const storedKey = JSON.stringify([
    storedSEO.focusKeyword || "",
    storedSEO.metaTitle || "",
    storedSEO.canonicalUrl || "",
    storedSEO.metaDescription || "",
    storedSEO.jsonLd || ""
  ]);
  useEffect(() => {
    setForm({
      focusKeyword: storedSEO.focusKeyword || "",
      metaTitle: storedSEO.metaTitle || "",
      canonicalUrl: storedSEO.canonicalUrl || "",
      metaDescription: storedSEO.metaDescription || "",
      jsonLd: storedSEO.jsonLd || ""
    });
  // The serialized key intentionally synchronizes only after stored data changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const audit = useMemo(
    () => buildSEOAudit(context, canvasScan, form.focusKeyword),
    [canvasScan, context, form.focusKeyword]
  );
  const assets = context?.contentSystem?.assets || [];
  const plugins = context?.contentSystem?.plugins || {};
  const pages = context?.website?.pages || [];
  const contentTypes = context?.contentSystem?.contentTypes || [];
  const postTypes = contentTypes.filter((type) => /post|blog|article/i.test(
    `${type?.name || ""} ${type?.title || ""} ${type?.slug || ""} ${type?.id || ""}`
  ));
  const seoPluginEnabled = Boolean(plugins?.[SEO_PLUGIN_ID]?.enabled);
  const missingAssetAlts = assets.filter((asset) => !String(asset?.alt || "").trim());
  const headingHealthy = audit.headingCounts.h1 === 1;
  const keywordInTitle = Boolean(
    form.focusKeyword
    && form.metaTitle.toLowerCase().includes(form.focusKeyword.trim().toLowerCase())
  );
  const scoreItems = [
    Boolean(form.focusKeyword),
    Boolean(form.metaTitle) && form.metaTitle.length <= 60,
    Boolean(form.canonicalUrl),
    Boolean(form.metaDescription) && form.metaDescription.length <= 160,
    headingHealthy,
    audit.missingAlt.length === 0,
    validateSchemaMarkup(form.jsonLd).valid && Boolean(form.jsonLd)
  ];
  const score = Math.round((scoreItems.filter(Boolean).length / scoreItems.length) * 100);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveMessage("");
    if (key === "jsonLd") setSchemaError("");
  };

  const saveSEO = async () => {
    const schema = validateSchemaMarkup(form.jsonLd);
    if (!schema.valid) {
      setSchemaError(schema.error);
      return;
    }
    setSaving(true);
    setSaveMessage("");
    try {
      await onSaveSEO?.({ ...storedSEO, ...form });
      setSaveMessage("SEO draft saved");
      onRequestScan?.();
      await onRefresh?.();
    } catch (error) {
      setSaveMessage(error.message || "SEO draft could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const saveAssetAlt = async (asset) => {
    const value = assetDrafts[asset.id] ?? asset.alt ?? "";
    if (!value.trim()) return;
    setAssetSaving(asset.id);
    try {
      await mediaService.updateAltText(websiteId, asset.id, value.trim());
      setSaveMessage(`Alt text saved for ${asset.name || "image"}`);
      await onRefresh?.();
    } catch (error) {
      setSaveMessage(error.message || "Image alt text could not be saved");
    } finally {
      setAssetSaving("");
    }
  };

  const toggleSEOPlugin = async () => {
    setPluginBusy(true);
    try {
      if (seoPluginEnabled) {
        await pluginService.uninstallPlugin(websiteId, SEO_PLUGIN_ID);
      } else {
        await pluginService.installPlugin(websiteId, SEO_PLUGIN_ID, {
          enableAutoRedirects: true,
          targetScoreMin: 80
        });
      }
      setSaveMessage(seoPluginEnabled ? "SEO Booster disabled" : "SEO Booster enabled");
      await onRefresh?.();
    } catch (error) {
      setSaveMessage(error.message || "Plugin status could not be changed");
    } finally {
      setPluginBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-3 pb-24">
      <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-white">Page SEO score</p>
            <p className="mt-0.5 text-[8px] text-slate-500">Draft metadata + rendered page audit</p>
          </div>
          <span className={`text-xl font-black ${score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-300" : "text-rose-400"}`}>
            {score}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${score}%` }} />
        </div>
        <button
          type="button"
          onClick={() => {
            void onRefresh?.();
            onRequestScan?.();
          }}
          disabled={contextLoading}
          className="mt-3 flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-400 hover:border-slate-700 hover:text-white disabled:opacity-50"
        >
          {contextLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Rescan page SEO
        </button>
      </div>

      <Section icon={SearchCheck} title="Search metadata" subtitle="Saved to this page draft and included when the page is published.">
        <div className="space-y-3">
          <Field
            label="Focus keyword"
            value={form.focusKeyword}
            onChange={(value) => updateForm("focusKeyword", value)}
            placeholder="e.g. API advertising services"
          />
          {form.focusKeyword && (
            <div className="flex flex-wrap gap-1.5">
              <StatusPill good={audit.keywordOccurrences > 0}>
                {audit.keywordOccurrences} page use{audit.keywordOccurrences === 1 ? "" : "s"}
              </StatusPill>
              <StatusPill good={keywordInTitle}>{keywordInTitle ? "In SEO title" : "Missing from title"}</StatusPill>
            </div>
          )}
          <Field
            label="SEO title"
            value={form.metaTitle}
            onChange={(value) => updateForm("metaTitle", value)}
            placeholder="Page title | Brand"
            limit={60}
          />
          <Field
            label="URL"
            value={form.canonicalUrl}
            onChange={(value) => updateForm("canonicalUrl", value)}
            placeholder="https://example.com/page"
          />
          <Field
            label="Meta description"
            value={form.metaDescription}
            onChange={(value) => updateForm("metaDescription", value)}
            placeholder="Describe this page for search results..."
            limit={160}
            multiline
          />
          <button
            type="button"
            onClick={saveSEO}
            disabled={saving || !onSaveSEO}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-[10px] font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save SEO draft
          </button>
          {saveMessage && <p className="text-center text-[9px] text-slate-500">{saveMessage}</p>}
        </div>
      </Section>

      <Section icon={SearchCheck} title="Heading structure" subtitle={`Audited from ${audit.source === "canvas" ? "the rendered website canvas" : "editable page components"}.`}>
        <div className="grid grid-cols-4 gap-1.5">
          {["h1", "h2", "h3", "h4"].map((level) => {
            const count = audit.headingCounts[level];
            const good = level === "h1" ? count === 1 : count > 0;
            return (
              <div key={level} className={`rounded-lg border p-2 text-center ${good ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                <p className="text-[9px] font-bold uppercase text-slate-400">{level}</p>
                <p className={`mt-1 text-sm font-black ${good ? "text-emerald-400" : "text-amber-300"}`}>{count}</p>
              </div>
            );
          })}
        </div>
        {audit.headings.length > 0 && (
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {audit.headings.slice(0, 20).map((heading, index) => (
              <div key={`${heading.id || heading.level}_${index}`} className="flex gap-2 rounded-md bg-slate-900/60 px-2 py-1.5">
                <span className="text-[8px] font-bold uppercase text-violet-400">{heading.level}</span>
                <span className="truncate text-[9px] text-slate-500">{heading.text || "Empty heading"}</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => onRequestFix?.("Review and improve this page heading hierarchy. Keep exactly one descriptive H1, use H2 for main sections, and H3/H4 only where the content hierarchy needs them. Preserve the design and meaning.")}
          className={`mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[9px] font-bold ${
            headingHealthy
              ? "border-violet-500/20 bg-violet-500/5 text-violet-300"
              : "border-amber-500/20 bg-amber-500/5 text-amber-300"
          }`}
        >
          <Sparkles className="h-3 w-3" /> {headingHealthy ? "Improve H1–H4 structure" : "Fix heading structure"}
        </button>
      </Section>

      <Section icon={ImageIcon} title="Image alt text" subtitle={`${audit.images.length} page images · ${audit.missingAlt.length} missing alt text`}>
        {audit.missingAlt.length > 0 ? (
          <div className="space-y-1.5">
            {audit.missingAlt.slice(0, 8).map((image, index) => (
              <div key={`${image.id || image.src}_${index}`} className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 p-2">
                <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-300" />
                <span className="min-w-0 flex-1 truncate text-[9px] text-slate-500">{image.label || image.src || `Image ${index + 1}`}</span>
                <span className="text-[8px] text-amber-300">Missing</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onRequestFix?.("Add concise, descriptive, accessible alt text to every page image that is missing it. Preserve every image and the page layout.")}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 text-[9px] font-bold text-violet-300"
            >
              <Sparkles className="h-3 w-3" /> Fix page image alt text
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[9px] text-emerald-400"><CheckCircle2 className="h-3 w-3" /> All detected page images have alt text.</p>
        )}

        {missingAssetAlts.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="mb-2 text-[8px] font-bold uppercase tracking-wider text-slate-600">Media library missing alt ({missingAssetAlts.length})</p>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {missingAssetAlts.slice(0, 12).map((asset) => (
                <div key={asset.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                  <p className="truncate text-[9px] text-slate-400">{asset.name || asset.id}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      value={assetDrafts[asset.id] ?? asset.alt ?? ""}
                      onChange={(event) => setAssetDrafts((current) => ({ ...current, [asset.id]: event.target.value }))}
                      placeholder="Describe this image"
                      className="h-7 min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-900 px-2 text-[9px] text-slate-300 outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveAssetAlt(asset)}
                      disabled={assetSaving === asset.id || !(assetDrafts[asset.id] ?? "").trim()}
                      className="grid h-7 w-7 place-items-center rounded-md bg-violet-600 text-white disabled:opacity-40"
                      title="Save alt text"
                    >
                      {assetSaving === asset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section icon={Braces} title="Schema markup" subtitle="JSON-LD structured data for search engines.">
        <textarea
          value={form.jsonLd}
          onChange={(event) => updateForm("jsonLd", event.target.value)}
          placeholder={DEFAULT_SCHEMA}
          rows={8}
          spellCheck="false"
          className={`${FIELD_CLASS} resize-y font-mono text-[9px] leading-4`}
        />
        {schemaError && <p className="mt-1.5 text-[9px] leading-4 text-rose-400">{schemaError}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => updateForm("jsonLd", DEFAULT_SCHEMA)}
            className="h-8 flex-1 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-400 hover:text-white"
          >
            Add WebPage schema
          </button>
          <button
            type="button"
            onClick={saveSEO}
            disabled={saving || !onSaveSEO}
            className="h-8 flex-1 rounded-lg bg-violet-600 text-[9px] font-bold text-white disabled:opacity-50"
          >
            Validate & save
          </button>
        </div>
      </Section>

      <Section icon={Puzzle} title="SEO plugin" subtitle="Manage schema and sitemap automation for this website.">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold text-slate-300">SEO Booster & Schema Injector</p>
            <p className="mt-0.5 text-[8px] text-slate-600">{seoPluginEnabled ? "Installed and active" : "Not installed"}</p>
          </div>
          <button
            type="button"
            onClick={toggleSEOPlugin}
            disabled={pluginBusy}
            className={`h-7 rounded-lg px-2.5 text-[8px] font-bold ${seoPluginEnabled ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}
          >
            {pluginBusy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : seoPluginEnabled ? "Disable" : "Enable"}
          </button>
        </div>
        <a href={`/content/${websiteId}/plugins`} className="mt-2 flex items-center justify-center gap-1 text-[8px] font-bold text-violet-400 hover:text-violet-300">
          Open all plugins <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <a href={`/content/${websiteId}/pages`} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 hover:border-violet-500/30">
          <Files className="h-4 w-4 text-cyan-400" />
          <p className="mt-2 text-[10px] font-bold text-slate-200">Pages</p>
          <p className="mt-0.5 text-[8px] text-slate-600">{pages.length} website page{pages.length === 1 ? "" : "s"}</p>
        </a>
        <a href={`/content/${websiteId}/content-types`} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 hover:border-violet-500/30">
          <Newspaper className="h-4 w-4 text-fuchsia-400" />
          <p className="mt-2 text-[10px] font-bold text-slate-200">Posts</p>
          <p className="mt-0.5 text-[8px] text-slate-600">{postTypes.length} post type{postTypes.length === 1 ? "" : "s"}</p>
        </a>
      </div>
    </div>
  );
}

export default SEOWorkspacePanel;
