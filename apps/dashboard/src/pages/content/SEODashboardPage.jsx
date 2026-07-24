import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ShieldAlert, 
  ArrowRight, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Globe, 
  FileText, 
  Search, 
  AlertCircle, 
  CheckCircle,
  Copy,
  ExternalLink
} from "lucide-react";
import { useSEO } from "../../hooks/useSEO";
import { usePages } from "../../hooks/usePages";
import { useWebsites } from "../../hooks/useWebsites";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";

export function SEODashboardPage() {
  const { websiteId } = useParams();
  const { selectedWebsite } = useWebsites();
  const { pages, fetchPages } = usePages();
  const { 
    loading, 
    seoConfig, 
    fetchSEOConfig, 
    saveRobotsTxt, 
    saveRedirects, 
    generateSitemap, 
    analyzeWebsite 
  } = useSEO(websiteId);

  const [activeTab, setActiveTab] = useState("overview");
  const [analysis, setAnalysis] = useState({ score: 0, issues: [], pagesAnalyzedCount: 0 });
  const [robotsText, setRobotsText] = useState("");
  const [redirectRules, setRedirectRules] = useState([]);
  const [newRedirect, setNewRedirect] = useState({ from: "", to: "", type: "301" });
  
  // Load data
  const loadSEO = async () => {
    await fetchPages(websiteId);
    await fetchSEOConfig();
    const result = await analyzeWebsite();
    setAnalysis(result);
  };

  useEffect(() => {
    if (websiteId) {
      loadSEO();
    }
  }, [websiteId]);

  // Sync state once seoConfig loaded
  useEffect(() => {
    if (seoConfig) {
      setRobotsText(seoConfig.robotsTxt || "");
      setRedirectRules(seoConfig.redirects || []);
    }
  }, [seoConfig]);

  const handleRunAnalysis = async () => {
    const result = await analyzeWebsite();
    setAnalysis(result);
  };

  const handleSaveRobots = async () => {
    await saveRobotsTxt(robotsText);
  };

  const handleAddRedirect = () => {
    if (!newRedirect.from.trim() || !newRedirect.to.trim()) return;
    const updated = [...redirectRules, { ...newRedirect }];
    setRedirectRules(updated);
    setNewRedirect({ from: "", to: "", type: "301" });
  };

  const handleRemoveRedirect = (index) => {
    const updated = redirectRules.filter((_, i) => i !== index);
    setRedirectRules(updated);
  };

  const handleSaveRedirectsList = async () => {
    await saveRedirects(redirectRules);
  };

  const handleRebuildSitemap = async () => {
    if (!selectedWebsite?.domain) return;
    await generateSitemap(selectedWebsite.domain, pages);
  };

  const getScoreColorClass = (score) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/5";
    if (score >= 50) return "text-amber-400 border-amber-500/30 bg-amber-500/5";
    return "text-rose-400 border-rose-500/30 bg-rose-500/5";
  };

  return (
    <div className="p-6 space-y-6 text-left max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-805 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            <span>SEO Dashboard Suite</span>
          </h2>
          <p className="text-sm text-admin-secondary mt-1">
            Optimize search indexing, manage custom redirects, customize crawler settings, and build sitemaps.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadSEO}
            variant="outline"
            className="border-slate-800 gap-2 cursor-pointer font-bold text-xs"
            loading={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Scan Website
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Dial */}
        <Card className="flex flex-col items-center justify-center p-6 border-slate-805 bg-slate-900/35 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10" />
          <div className="text-xs text-admin-secondary font-bold uppercase tracking-wider mb-2">Overall SEO Health</div>
          <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center font-extrabold text-3xl shadow-inner ${getScoreColorClass(analysis.score)}`}>
            {analysis.score}%
          </div>
          <div className="text-xs font-semibold mt-3 text-slate-300">
            {analysis.score >= 80 ? "Excellent Crawlability" : analysis.score >= 50 ? "Needs Optimizations" : "Critical SEO Issues"}
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 border-slate-805 bg-slate-900/35 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">Checked Pages</span>
              <span className="text-3xl font-black text-admin-text mt-1.5 block">{analysis.pagesAnalyzedCount}</span>
            </div>
            <p className="text-xs text-admin-secondary mt-2">Active pages indexed in the site structure.</p>
          </Card>

          <Card className="p-5 border-slate-805 bg-slate-900/35 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">Identified Issues</span>
              <span className="text-3xl font-black text-rose-400 mt-1.5 block">{analysis.issues.length}</span>
            </div>
            <p className="text-xs text-admin-secondary mt-2">Errors blocking search optimization.</p>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        {[
          { id: "overview", label: "Analysis Checklist" },
          { id: "sitemap", label: "Sitemap Builder" },
          { id: "robots", label: "Robots.txt Crawler" },
          { id: "redirects", label: "Redirect Rules" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id 
                ? "border-primary text-white" 
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-200">Actionable Audits ({analysis.issues.length})</h3>
            </div>

            {analysis.issues.length === 0 ? (
              <Card className="p-8 border-slate-805 bg-slate-900/10 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h4 className="font-bold text-sm text-slate-200">Zero Issues Discovered</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Excellent job! All active pages contain valid title tags, meta descriptions, canonical links, and OG thumbnail fields.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {analysis.issues.map((issue, idx) => (
                  <Card key={idx} className="p-4 border-slate-805 bg-slate-900/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {issue.severity === "high" ? (
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                        ) : issue.severity === "medium" ? (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">{issue.message}</span>
                          <span className={`text-[9px] font-bold uppercase py-0.5 px-1.5 rounded ${
                            issue.severity === "high" 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                              : issue.severity === "medium"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-slate-800 text-slate-400"
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Page: {issue.pageTitle}</p>
                      </div>
                    </div>
                    <Link
                      to={`/content/${websiteId}/pages/${issue.pageId}/editor`}
                      className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 self-start sm:self-auto shrink-0 hover:underline"
                    >
                      <span>Fix Metadata</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sitemap Tab */}
        {activeTab === "sitemap" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-200">Sitemap XML Generator</h3>
                <p className="text-xs text-slate-400 mt-0.5">Produce a search-engine compatible sitemap cataloging site urls.</p>
              </div>
              <Button
                onClick={handleRebuildSitemap}
                variant="primary"
                className="py-1.5 px-4 font-bold text-xs gap-2"
                loading={loading}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Build Sitemap XML
              </Button>
            </div>

            <Card className="border-slate-805 bg-slate-900/35 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-slate-805">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-slate-300">XML Preview</span>
                </div>
                {seoConfig.sitemap && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(seoConfig.sitemap);
                      alert("Copied sitemap XML to clipboard!");
                    }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy XML"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-4 overflow-x-auto">
                {seoConfig.sitemap ? (
                  <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre max-h-96 select-text text-left">
                    {seoConfig.sitemap}
                  </pre>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-8">
                    No Sitemap generated yet. Click "Build Sitemap XML" above to compile url mapping rules.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Robots Tab */}
        {activeTab === "robots" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-200">Robots.txt Rules Editor</h3>
              <p className="text-xs text-slate-400 mt-0.5">Control which directories search spider engines (Googlebot, Bingbot) can crawl.</p>
            </div>

            <Card className="p-5 border-slate-805 bg-slate-900/35 space-y-4">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                  Crawler Rule Sheet
                </label>
                <textarea
                  value={robotsText}
                  onChange={(e) => setRobotsText(e.target.value)}
                  placeholder="User-agent: *&#10;Allow: /"
                  rows={8}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 outline-none font-mono focus:border-primary focus:ring-2 focus:ring-primary/25 resize-y"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveRobots}
                  variant="primary"
                  className="py-1.5 px-4 font-bold text-xs"
                  loading={loading}
                >
                  Save Robots.txt
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Redirects Tab */}
        {activeTab === "redirects" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-200">301 / 302 Path Redirects</h3>
                <p className="text-xs text-slate-400 mt-0.5">Reroute incoming browser queries automatically to new URLs.</p>
              </div>
            </div>

            {/* Add redirect rule card */}
            <Card className="p-4 border-slate-805 bg-slate-900/35 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <Input
                label="Old Path (Redirect From)"
                placeholder="e.g. /about-us"
                value={newRedirect.from}
                onChange={(e) => setNewRedirect(prev => ({ ...prev, from: e.target.value }))}
              />
              <Input
                label="Redirect To (Target URL)"
                placeholder="e.g. /about"
                value={newRedirect.to}
                onChange={(e) => setNewRedirect(prev => ({ ...prev, to: e.target.value }))}
              />
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                  Redirect Code
                </label>
                <select
                  value={newRedirect.type}
                  onChange={(e) => setNewRedirect(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full text-sm py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  <option value="301">301 (Permanent)</option>
                  <option value="302">302 (Temporary)</option>
                </select>
              </div>
              <Button
                onClick={handleAddRedirect}
                variant="outline"
                className="w-full border-slate-800 gap-1 font-bold text-xs py-2 px-4 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </Button>
            </Card>

            {/* Rules list */}
            <Card className="border-slate-805 bg-slate-900/35 overflow-hidden">
              <div className="p-4 border-b border-slate-805 bg-slate-950/20 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Configured Redirect Rules ({redirectRules.length})</span>
                {redirectRules.length > 0 && (
                  <Button
                    onClick={handleSaveRedirectsList}
                    variant="primary"
                    className="py-1 px-3 text-[10px] font-bold"
                    loading={loading}
                  >
                    Save Redirects
                  </Button>
                )}
              </div>

              {redirectRules.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8">
                  No redirects configured. Enter rule parameters above to capture traffic redirects.
                </div>
              ) : (
                <div className="divide-y divide-slate-805">
                  {redirectRules.map((rule, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                        <span className="bg-slate-950/50 px-2 py-0.5 border border-slate-800 rounded font-semibold text-purple-400">
                          {rule.type}
                        </span>
                        <span className="text-slate-400 select-all">{rule.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-200 select-all">{rule.to}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveRedirect(idx)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                        title="Remove Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default SEODashboardPage;
