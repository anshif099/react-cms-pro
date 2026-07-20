import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  ShieldCheck, 
  Key, 
  Check, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Smartphone, 
  Laptop, 
  Info 
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { settingsService } from "../../services/settingsService";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Table, TableRow, TableCell } from "../../components/ui/Table";
import { motion, AnimatePresence } from "framer-motion";

export function SettingsPage() {
  const { theme, toggleTheme, isDarkMode } = useTheme();
  const toast = useToast();
  const { user, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState("general"); // 'general' | 'security' | 'api'
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [timezone, setTimezone] = useState("IST");
  const [language, setLanguage] = useState("en");

  // API Tokens state
  const [tokens, setTokens] = useState([]);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (!user || !user.uid) return;
      try {
        const settings = await settingsService.getSettings(user.uid);
        setTimezone(settings.timezone);
        setLanguage(settings.language);
        setTokens(settings.tokens || []);
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load CMS settings.");
      }
    }
    loadSettings();
  }, [user, toast]);

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!user || !user.uid) return;
    setLoading(true);
    try {
      await settingsService.updateSettings(user.uid, { language, timezone });
      toast.success("General settings saved successfully");
    } catch (error) {
      toast.error("Failed to save general settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    const currentPassword = e.target.elements[0].value;
    const newPassword = e.target.elements[1].value;
    const confirmPassword = e.target.elements[2].value;

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        toast.success("Password updated successfully");
        e.target.reset();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("An error occurred while updating password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!user || !user.uid) return;
    const name = prompt("Enter a name for the token:", `Token ${tokens.length + 1}`);
    if (!name) return;

    try {
      const newToken = await settingsService.createToken(user.uid, name);
      setTokens([newToken, ...tokens]);
      toast.success("New API token generated successfully");
    } catch (error) {
      toast.error("Failed to generate token.");
    }
  };

  const handleDeleteToken = async (id) => {
    if (!user || !user.uid) return;
    try {
      await settingsService.deleteToken(user.uid, id);
      setTokens(tokens.filter(t => t.id !== id));
      toast.info("API token revoked");
    } catch (error) {
      toast.error("Failed to revoke API token.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-left max-w-4xl mx-auto"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-admin-text tracking-tight">CMS Settings</h2>
        <p className="text-sm text-admin-secondary">Configure platform configuration, security policies, and tokens</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left tabs selector */}
        <div className="md:col-span-1 flex flex-col gap-1 select-none">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg text-left transition-colors cursor-pointer ${
              activeTab === "general"
                ? "bg-primary text-white"
                : "text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Sliders className="w-4 h-4" />
            General
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg text-left transition-colors cursor-pointer ${
              activeTab === "security"
                ? "bg-primary text-white"
                : "text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Security
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg text-left transition-colors cursor-pointer ${
              activeTab === "api"
                ? "bg-primary text-white"
                : "text-admin-secondary hover:text-admin-text hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Key className="w-4 h-4" />
            API Tokens
          </button>
        </div>

        {/* Right Settings Pane */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === "general" && (
              <motion.div
                key="general-pane"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-6"
              >
                <Card title="General Customizations" subtitle="Adjust display language, times, and design mode">
                  <form onSubmit={handleSaveGeneral} className="space-y-5">
                    {/* Dark Mode toggle */}
                    <div className="flex items-center justify-between py-2 border-b border-admin-border dark:border-slate-800/80">
                      <div>
                        <h4 className="font-semibold text-sm text-admin-text">Interface Style</h4>
                        <p className="text-xs text-admin-secondary">Enable high contrast dark theme styling</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        className="text-primary cursor-pointer focus:outline-none"
                      >
                        {isDarkMode ? (
                          <ToggleRight className="w-10 h-10 text-primary" />
                        ) : (
                          <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                        )}
                      </button>
                    </div>

                    {/* Language select */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                        Default Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="max-w-xs text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text outline-none dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Spanish (ES)</option>
                        <option value="fr">French (FR)</option>
                        <option value="de">German (DE)</option>
                      </select>
                    </div>

                    {/* Timezone select */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                        System Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="max-w-xs text-sm py-2 px-3 rounded-lg border border-admin-border bg-white text-admin-text outline-none dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="UTC">UTC (GMT+00:00)</option>
                        <option value="EST">EST (GMT-05:00)</option>
                        <option value="PST">PST (GMT-08:00)</option>
                        <option value="IST">IST (GMT+05:30)</option>
                        <option value="GMT">GMT (GMT+00:00)</option>
                      </select>
                    </div>

                    {/* Submit */}
                    <div className="pt-4 flex justify-end">
                      <Button type="submit" variant="primary" className="px-6">
                        Save Preferences
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                key="security-pane"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-6"
              >
                {/* Mock password reset */}
                <Card title="Update Password" subtitle="Change login credentials for admin account">
                  <form onSubmit={handleSavePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Current Password"
                        type="password"
                        placeholder="••••••••"
                        required
                      />
                      <div />
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="••••••••"
                        required
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="pt-2 flex justify-end">
                      <Button type="submit" variant="primary" loading={loading}>
                        Update Password
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Two Factor authentication */}
                <Card title="Two-Factor Authentication" subtitle="Add another security layer to administrator logins">
                  <div className="flex items-center justify-between py-2">
                    <div className="max-w-md">
                      <h4 className="font-semibold text-sm text-admin-text">Verify logins via mobile Authenticator</h4>
                      <p className="text-xs text-admin-secondary mt-0.5">Require a verification code from Google Authenticator, Authy, or Duo app on login attempts.</p>
                    </div>
                    <button
                      onClick={() => {
                        setTfaEnabled(!tfaEnabled);
                        toast.info(tfaEnabled ? "2FA disabled" : "2FA enabled (requires pairing device)");
                      }}
                      className="text-primary cursor-pointer focus:outline-none"
                    >
                      {tfaEnabled ? (
                        <ToggleRight className="w-10 h-10 text-primary" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                      )}
                    </button>
                  </div>
                </Card>

                {/* Login sessions */}
                <Card title="Active Login Sessions" subtitle="Websites and devices that recently logged in">
                  <div className="space-y-4 text-xs font-semibold text-admin-secondary">
                    <div className="flex items-center gap-3 p-3 border border-admin-border dark:border-slate-800 rounded-lg">
                      <Laptop className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-bold text-admin-text">Current Session</p>
                        <p className="text-[10px] text-admin-secondary">IP: Active client — <span className="text-green-500 font-bold">Connected</span></p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === "api" && (
              <motion.div
                key="api-pane"
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="space-y-6"
              >
                <Card 
                  title="Personal Access Tokens" 
                  subtitle="Manage authorization tokens for webhook deployments and external APIs"
                  headerAction={
                    <Button 
                      onClick={handleGenerateToken} 
                      variant="primary" 
                      size="sm" 
                      className="gap-1 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Generate Token
                    </Button>
                  }
                  noPadding
                >
                  {tokens.length === 0 ? (
                    <div className="p-8 text-center text-admin-secondary text-sm">
                      No personal access tokens generated.
                    </div>
                  ) : (
                    <Table headers={[
                      { label: "Token Name" },
                      { label: "Token Value" },
                      { label: "Created" },
                      { label: "Last Active" },
                      { label: "Actions", className: "text-right" }
                    ]}>
                      {tokens.map((tok) => (
                        <TableRow key={tok.id}>
                          <TableCell>
                            <span className="font-bold text-admin-text">{tok.name}</span>
                          </TableCell>
                          <TableCell>
                            <code className="bg-slate-50 dark:bg-slate-800 py-0.5 px-1.5 border border-admin-border dark:border-slate-700 rounded-sm font-mono text-xs select-all text-admin-text">
                              {tok.token}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-admin-secondary font-medium">{tok.created}</span>
                          </TableCell>
                          <TableCell>
                            <Badge>{tok.lastUsed}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              onClick={() => handleDeleteToken(tok.id)}
                              variant="ghost" 
                              size="sm"
                              className="text-admin-danger hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default SettingsPage;
