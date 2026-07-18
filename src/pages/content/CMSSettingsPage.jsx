import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sliders, Save, ArrowLeft, Globe, Languages } from "lucide-react";
import { useWebsites } from "../../hooks/useWebsites";
import { useLocale } from "../../hooks/useLocale";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { cn } from "../../utils/cn";

const AVAILABLE_LOCALES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "fr", name: "French (Français)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "de", name: "German (Deutsch)" }
];

const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "GMT", label: "GMT (Greenwich Mean Time)" },
  { value: "EST", label: "EST (Eastern Standard Time)" },
  { value: "PST", label: "PST (Pacific Standard Time)" },
  { value: "IST", label: "IST (Indian Standard Time)" }
];

export function CMSSettingsPage() {
  const { websiteId } = useParams();
  const navigate = useNavigate();
  const { selectWebsite, selectedWebsite } = useWebsites();
  const { activeLocales, defaultLocale, updateLocales, loading: localeLoading } = useLocale(websiteId);

  const [saving, setSaving] = useState(false);
  const [selectedDefault, setSelectedDefault] = useState("en");
  const [selectedActive, setSelectedActive] = useState(["en"]);
  const [selectedTimezone, setSelectedTimezone] = useState("UTC");

  // Sync settings when loaded
  useEffect(() => {
    if (websiteId) {
      selectWebsite(websiteId);
    }
  }, [websiteId, selectWebsite]);

  useEffect(() => {
    if (defaultLocale) setSelectedDefault(defaultLocale);
    if (activeLocales) setSelectedActive(activeLocales);
  }, [defaultLocale, activeLocales]);

  if (!selectedWebsite) {
    return <div className="text-left text-slate-400 py-6">Loading CMS settings...</div>;
  }

  const handleCheckboxChange = (code) => {
    setSelectedActive(prev => {
      if (prev.includes(code)) {
        // Prevent unchecking if it's the default locale
        if (code === selectedDefault) return prev;
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleDefaultChange = (code) => {
    setSelectedDefault(code);
    setSelectedActive(prev => {
      if (!prev.includes(code)) {
        return [...prev, code];
      }
      return prev;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLocales(selectedDefault, selectedActive);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" />
            <span>CMS Localisation Settings</span>
          </h2>
          <p className="text-sm text-admin-secondary">
            Configure default and secondary languages for <span className="font-semibold text-admin-text">{selectedWebsite.name}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Settings Form Card */}
        <div className="md:col-span-2 space-y-6">
          <Card 
            title="Language Configuration" 
            subtitle="Configure locales and multilingual translation capabilities"
          >
            <div className="space-y-6">
              {/* Default Language Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-admin-secondary uppercase tracking-wider block">
                  Default System Locale
                </label>
                <p className="text-xs text-admin-secondary mb-3">
                  This language serves as the fallback value if a translation is missing.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABLE_LOCALES.map((locale) => (
                    <label 
                      key={locale.code}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer bg-slate-950/20",
                        selectedDefault === locale.code 
                          ? "border-primary bg-primary/5 text-admin-text" 
                          : "border-admin-border dark:border-slate-800 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      <input
                        type="radio"
                        name="defaultLocale"
                        value={locale.code}
                        checked={selectedDefault === locale.code}
                        onChange={() => handleDefaultChange(locale.code)}
                        className="text-primary focus:ring-primary focus:ring-offset-0 border-slate-700 bg-slate-900 cursor-pointer"
                      />
                      <div className="text-sm font-semibold">
                        {locale.name} <span className="text-xs text-admin-secondary font-mono">({locale.code})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active Locales Selection */}
              <div className="space-y-2 pt-6 border-t border-admin-border dark:border-slate-800">
                <label className="text-xs font-bold text-admin-secondary uppercase tracking-wider block">
                  Active Translation Locales
                </label>
                <p className="text-xs text-admin-secondary mb-3">
                  Choose which secondary languages content editors are allowed to translate.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABLE_LOCALES.map((locale) => (
                    <label 
                      key={locale.code}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer bg-slate-950/20",
                        selectedActive.includes(locale.code) 
                          ? "border-primary/50 bg-primary/5 text-admin-text" 
                          : "border-admin-border dark:border-slate-800 text-slate-400 hover:border-slate-700",
                        selectedDefault === locale.code ? "opacity-60 cursor-not-allowed" : ""
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedActive.includes(locale.code)}
                        disabled={selectedDefault === locale.code}
                        onChange={() => handleCheckboxChange(locale.code)}
                        className="rounded text-primary focus:ring-primary focus:ring-offset-0 border-slate-700 bg-slate-900 cursor-pointer"
                      />
                      <div className="text-sm font-semibold">
                        {locale.name} <span className="text-xs text-admin-secondary font-mono">({locale.code})</span>
                      </div>
                      {selectedDefault === locale.code && (
                        <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-full ml-auto uppercase">Default</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Save CTA */}
              <div className="pt-6 border-t border-admin-border dark:border-slate-800 flex justify-end">
                <Button
                  onClick={handleSave}
                  variant="primary"
                  className="gap-2 font-bold px-6"
                  loading={saving || localeLoading}
                >
                  <Save className="w-4 h-4" />
                  Save Localisation Settings
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Side Help Card */}
        <div className="space-y-6">
          <Card title="Information">
            <div className="space-y-4 text-xs text-admin-secondary leading-relaxed">
              <div className="flex items-start gap-2.5">
                <Languages className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-admin-text mb-1">Multi-language SDK</h5>
                  <p>Connected SDK applications read localized content configurations dynamically using hooks like <code>usePage(slug, locale)</code>.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 pt-3 border-t border-admin-border dark:border-slate-800">
                <Globe className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-admin-text mb-1">SEO Translation</h5>
                  <p>SEO meta properties are stored uniquely for every active language, allowing search engines to index translated subdomains easily.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CMSSettingsPage;
