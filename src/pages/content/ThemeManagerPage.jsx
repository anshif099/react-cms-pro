import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sliders, Save, RefreshCw, Palette, Type, ShieldCheck, Settings } from "lucide-react";
import themeService from "../../services/themeService";
import { useToast } from "../../hooks/useToast";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import ImagePicker from "../../components/ui/ImagePicker";
import ColorPicker from "../../components/ui/ColorPicker";

export function ThemeManagerPage() {
  const { websiteId } = useParams();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [themeData, setThemeData] = useState({
    branding: { siteName: "", logo: "", tagline: "" },
    colors: { primary: "#3b82f6", secondary: "#1e293b", accent: "#f59e0b", background: "#ffffff", text: "#0f172a" },
    typography: { headingFont: "Inter", bodyFont: "Roboto", baseSize: "16px" },
    buttons: { borderRadius: "8px", fontWeight: "600" }
  });

  const loadTheme = async () => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const data = await themeService.getTheme(websiteId);
      setThemeData(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load styling theme tokens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTheme();
  }, [websiteId]);

  const handleSaveTheme = async () => {
    if (!websiteId) return;
    setSaving(true);
    try {
      await themeService.saveTheme(websiteId, themeData);
      toast.success("Branding and theme tokens saved & pushed to client SDK successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save theme configurations.");
    } finally {
      setSaving(false);
    }
  };

  const updateBranding = (key, val) => {
    setThemeData(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: val }
    }));
  };

  const updateColor = (key, val) => {
    setThemeData(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: val }
    }));
  };

  const updateTypography = (key, val) => {
    setThemeData(prev => ({
      ...prev,
      typography: { ...prev.typography, [key]: val }
    }));
  };

  const updateButton = (key, val) => {
    setThemeData(prev => ({
      ...prev,
      buttons: { ...prev.buttons, [key]: val }
    }));
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Loading theme configuration...</div>;
  }

  return (
    <div className="p-6 space-y-6 text-left max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-805 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            <span>Theme & Styling Manager</span>
          </h2>
          <p className="text-sm text-admin-secondary mt-1">
            Centrally customize the look, color palettes, fonts, and branding identity of your connected client website.
          </p>
        </div>
        <Button
          onClick={handleSaveTheme}
          variant="primary"
          className="gap-2 font-bold text-xs py-2 px-4 cursor-pointer self-start md:self-auto"
          loading={saving}
        >
          <Save className="w-3.5 h-3.5" />
          Save Theme Tokens
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Form Customizers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Branding Card */}
          <Card className="p-5 border-slate-805 bg-slate-900/35 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Branding & Assets</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Site Brand Name"
                placeholder="e.g. Acme Corp"
                value={themeData.branding.siteName || ""}
                onChange={(e) => updateBranding("siteName", e.target.value)}
              />
              <Input
                label="Site Tagline"
                placeholder="e.g. Software solutions"
                value={themeData.branding.tagline || ""}
                onChange={(e) => updateBranding("tagline", e.target.value)}
              />
            </div>
            <ImagePicker
              label="Brand Logo URL"
              value={themeData.branding.logo || ""}
              onChange={(val) => updateBranding("logo", val)}
              placeholder="Enter or upload site logo..."
            />
          </Card>

          {/* Color System Card */}
          <Card className="p-5 border-slate-805 bg-slate-900/35 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Palette className="w-4 h-4 text-purple-400" />
              <span>Design Color Palettes</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ColorPicker
                label="Primary Brand Color"
                value={themeData.colors.primary}
                onChange={(val) => updateColor("primary", val)}
              />
              <ColorPicker
                label="Secondary Theme Color"
                value={themeData.colors.secondary}
                onChange={(val) => updateColor("secondary", val)}
              />
              <ColorPicker
                label="Accent Color"
                value={themeData.colors.accent}
                onChange={(val) => updateColor("accent", val)}
              />
              <ColorPicker
                label="Body Background"
                value={themeData.colors.background}
                onChange={(val) => updateColor("background", val)}
              />
              <ColorPicker
                label="Main Text Color"
                value={themeData.colors.text}
                onChange={(val) => updateColor("text", val)}
              />
            </div>
          </Card>

          {/* Typography and Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Typography Card */}
            <Card className="p-5 border-slate-805 bg-slate-900/35 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Type className="w-4 h-4 text-emerald-400" />
                <span>Typography Fonts</span>
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                    Headings Font Family
                  </label>
                  <select
                    value={themeData.typography.headingFont}
                    onChange={(e) => updateTypography("headingFont", e.target.value)}
                    className="w-full text-sm py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-350 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    {["Inter", "Playfair Display", "Outfit", "Roboto", "Merriweather", "Georgia"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                    Body Font Family
                  </label>
                  <select
                    value={themeData.typography.bodyFont}
                    onChange={(e) => updateTypography("bodyFont", e.target.value)}
                    className="w-full text-sm py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-350 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    {["Roboto", "Open Sans", "Inter", "Lora", "Merriweather"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Layout Customization (Buttons, border styles) */}
            <Card className="p-5 border-slate-805 bg-slate-900/35 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Button Component Styles</span>
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                    Button Roundness
                  </label>
                  <select
                    value={themeData.buttons.borderRadius}
                    onChange={(e) => updateButton("borderRadius", e.target.value)}
                    className="w-full text-sm py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-350 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="0px">Sharp Squares (0px)</option>
                    <option value="4px">Slight Curve (4px)</option>
                    <option value="8px">Standard Round (8px)</option>
                    <option value="12px">More Round (12px)</option>
                    <option value="9999px">Fully Rounded (Pill)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider block">
                    Button Text Weight
                  </label>
                  <select
                    value={themeData.buttons.fontWeight}
                    onChange={(e) => updateButton("fontWeight", e.target.value)}
                    className="w-full text-sm py-2 px-3 rounded-lg border border-slate-750 bg-slate-850 text-slate-350 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="400">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Columns - Visual Theme Preview */}
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-950/40 sticky top-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-2 mb-4">
              Real-time Design Preview
            </h3>

            {/* Mock Site Container */}
            <div 
              style={{
                backgroundColor: themeData.colors.background,
                color: themeData.colors.text,
                fontFamily: themeData.typography.bodyFont
              }}
              className="border border-slate-800 rounded-xl overflow-hidden shadow-2xl transition-all duration-300"
            >
              {/* Mock Header */}
              <div 
                style={{
                  borderBottom: `1px solid ${themeData.colors.secondary}15`
                }}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {themeData.branding.logo ? (
                    <img 
                      src={themeData.branding.logo} 
                      alt="Brand Logo" 
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <div 
                      style={{ backgroundColor: themeData.colors.primary }}
                      className="w-4 h-4 rounded"
                    />
                  )}
                  <span 
                    style={{ 
                      fontFamily: themeData.typography.headingFont,
                      color: themeData.colors.text
                    }}
                    className="text-xs font-black"
                  >
                    {themeData.branding.siteName || "Brand Name"}
                  </span>
                </div>
                <div className="flex gap-2.5 text-[8px] font-bold">
                  <span style={{ color: themeData.colors.text }}>Home</span>
                  <span style={{ color: themeData.colors.text }} className="opacity-60">Services</span>
                  <span style={{ color: themeData.colors.text }} className="opacity-60">Blog</span>
                </div>
              </div>

              {/* Mock Hero Content */}
              <div className="p-5 text-center space-y-3.5">
                {themeData.branding.tagline && (
                  <span 
                    style={{ 
                      color: themeData.colors.accent,
                      backgroundColor: `${themeData.colors.accent}12`
                    }}
                    className="inline-block text-[9px] px-2 py-0.5 rounded font-black tracking-widest uppercase font-mono"
                  >
                    {themeData.branding.tagline}
                  </span>
                )}
                <h1 
                  style={{
                    fontFamily: themeData.typography.headingFont,
                    color: themeData.colors.text
                  }}
                  className="text-lg font-black leading-tight"
                >
                  Create Premium Experiences
                </h1>
                <p className="text-[10px] opacity-70 leading-relaxed max-w-[200px] mx-auto">
                  A gorgeous layout preview rendering changes live.
                </p>

                <div className="pt-2 flex justify-center gap-2">
                  <button
                    style={{
                      backgroundColor: themeData.colors.primary,
                      borderRadius: themeData.buttons.borderRadius,
                      fontWeight: themeData.buttons.fontWeight
                    }}
                    className="text-[9px] text-white px-3 py-1.5 cursor-pointer shadow-md shadow-primary/10 transition-all hover:brightness-110 active:scale-95"
                  >
                    Get Started
                  </button>
                  <button
                    style={{
                      borderRadius: themeData.buttons.borderRadius,
                      fontWeight: themeData.buttons.fontWeight,
                      border: `1px solid ${themeData.colors.text}25`
                    }}
                    className="text-[9px] px-3 py-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  >
                    Learn More
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 text-center mt-4 italic">
              * Design preview updates instantly as you adjust color sliders or select text fonts.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ThemeManagerPage;
