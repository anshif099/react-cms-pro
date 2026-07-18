import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Globe, Info, Plus, Trash2, Mail, Phone, MapPin, Share2 } from "lucide-react";
import { useGlobal } from "../../hooks/useGlobal";
import { useLocale } from "../../hooks/useLocale";
import { useWebsites } from "../../hooks/useWebsites";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ImagePicker from "../../components/ui/ImagePicker";
import RichTextEditor from "../../components/ui/RichTextEditor";

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "github", label: "GitHub" }
];

export function GlobalContentPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();

  const { globalContent, globalLoading, fetchGlobal, updateGlobal } = useGlobal();
  const { selectedWebsite, selectWebsite } = useWebsites();
  const { activeLocales, activeLocale, setLocale } = useLocale(websiteId);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Form fields
  const [logo, setLogo] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [footer, setFooter] = useState("");
  const [socialLinks, setSocialLinks] = useState([]);
  const [customSettings, setCustomSettings] = useState("");

  // Sync settings when loaded
  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
      fetchGlobal(websiteId, activeLocale);
    }
  }, [websiteId, activeLocale, selectWebsite, fetchGlobal]);

  // Sync local state when global content context updates
  useEffect(() => {
    if (globalContent) {
      setLogo(globalContent.logo || "");
      setPhone(globalContent.phone || "");
      setEmail(globalContent.email || "");
      setAddress(globalContent.address || "");
      setFooter(globalContent.footer || "");
      setSocialLinks(globalContent.socialLinks || []);
      
      const customVal = globalContent.settings ? JSON.stringify(globalContent.settings, null, 2) : "{}";
      setCustomSettings(customVal);
    }
  }, [globalContent]);

  const handleAddSocial = () => {
    setSocialLinks(prev => [...prev, { platform: "facebook", url: "" }]);
  };

  const handleRemoveSocial = (idx) => {
    setSocialLinks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSocialChange = (idx, key, value) => {
    setSocialLinks(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const handleSave = async (publish = false) => {
    if (publish) setPublishing(true);
    else setSaving(true);

    try {
      let parsedSettings = {};
      try {
        parsedSettings = JSON.parse(customSettings || "{}");
      } catch (err) {
        alert("Invalid JSON settings format. Please fix and retry.");
        setSaving(false);
        setPublishing(false);
        return;
      }

      const payload = {
        logo,
        phone,
        email,
        address,
        footer,
        socialLinks,
        settings: parsedSettings
      };

      await updateGlobal(websiteId, activeLocale, payload, publish);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading global content...</div>;
  }

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      {/* Back Link */}
      <div>
        <button
          onClick={() => navigate(`/websites/${selectedWebsite.id}`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-admin-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Details
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 px-4 rounded-xl border border-admin-border dark:border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-lg sticky top-0 z-20">
        <div>
          <h2 className="text-xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <span>Global Content Config</span>
          </h2>
          <span className="text-[10px] text-admin-secondary font-bold uppercase tracking-wider block mt-0.5">
            Website: {selectedWebsite.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 justify-end">
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
            onClick={() => handleSave(false)}
            variant="secondary"
            className="gap-1.5 py-1.5 text-xs border-slate-700 hover:border-slate-600"
            loading={saving}
            disabled={publishing}
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>

          <Button
            onClick={() => handleSave(true)}
            variant="primary"
            className="gap-1.5 py-1.5 text-xs font-bold"
            loading={publishing}
            disabled={saving}
          >
            <Globe className="w-3.5 h-3.5" />
            Publish Global
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Contact Card */}
          <Card title="Site Identity & Branding" subtitle="Logo assets and default metadata configurations">
            <div className="space-y-4">
              <ImagePicker
                label="Site Logo Asset"
                value={logo}
                onChange={setLogo}
                placeholder="Upload logo file or enter URL..."
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  icon={Phone}
                />
                <Input
                  label="Contact Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@website.com"
                  icon={Mail}
                  type="email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                  Office Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Country"
                  rows={2.5}
                  className="w-full text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Social Links Card */}
          <Card 
            title="Social Connections" 
            subtitle="Configure social network profile links referenced in layouts"
          >
            <div className="space-y-4">
              {socialLinks.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-xs text-admin-secondary">
                  No social profiles configured yet. Click add button below.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {socialLinks.map((social, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <select
                        value={social.platform}
                        onChange={(e) => handleSocialChange(idx, "platform", e.target.value)}
                        className="text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 w-32"
                      >
                        {SOCIAL_PLATFORMS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <Input
                        value={social.url}
                        onChange={(e) => handleSocialChange(idx, "url", e.target.value)}
                        placeholder="https://..."
                        icon={Share2}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSocial(idx)}
                        className="p-2 text-admin-secondary hover:text-admin-danger bg-slate-900/40 rounded-lg hover:bg-slate-800/40 border border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={handleAddSocial} variant="secondary" className="gap-1.5 border-slate-800">
                  <Plus className="w-4 h-4" /> Add Profile Link
                </Button>
              </div>
            </div>
          </Card>

          {/* Footer Card */}
          <Card title="Footer Content Layout" subtitle="Site footer text and copywriting info layouts">
            <RichTextEditor
              label="Footer Text Description"
              value={footer}
              onChange={setFooter}
              placeholder="e.g. © 2026 Company Name. All Rights Reserved."
            />
          </Card>
        </div>

        {/* Custom JSON sidebar */}
        <div className="space-y-6">
          <Card 
            title="Custom Settings Configuration" 
            subtitle="Inject custom JSON settings directly into page layouts"
          >
            <div className="space-y-3">
              <textarea
                value={customSettings}
                onChange={(e) => setCustomSettings(e.target.value)}
                placeholder='{ "googleAnalyticsId": "G-XXXXXX", "themeColor": "#3B82F6" }'
                rows={10}
                className="w-full text-xs font-mono py-3 px-4 rounded-xl border border-admin-border bg-slate-950/40 text-slate-300 dark:border-slate-800 outline-none hover:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/25 resize-y"
              />
              <div className="flex items-start gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[10px] text-admin-secondary leading-relaxed">
                <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p>This settings config block is passed directly to the SDK as structured JSON inside the <code>useGlobal()</code> hook context.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default GlobalContentPage;
