import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Globe, 
  Settings, 
  User, 
  LogOut, 
  PlusCircle, 
  ShieldCheck, 
  Terminal, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Layers,
  Image,
  Database,
  Search,
  Sliders,
  Palette,
  Puzzle
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useWebsites } from "../../hooks/useWebsites";
import { cn } from "../../utils/cn";

export function Sidebar({ mobileOpen, setMobileOpen }) {
  const { logout } = useAuth();
  const { websites, selectedWebsite } = useWebsites();
  const location = useLocation();
  const [websitesMenuOpen, setWebsitesMenuOpen] = useState(
    location.pathname.startsWith("/websites")
  );
  const [contentMenuOpen, setContentMenuOpen] = useState(
    location.pathname.startsWith("/content")
  );

  const activeWebsiteId = selectedWebsite?.id || websites[0]?.id;

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
    }
  };

  const navItemClass = ({ isActive }) =>
    cn(
      "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg",
      isActive
        ? "bg-primary text-white"
        : "text-slate-400 hover:text-white hover:bg-slate-800"
    );

  const subNavItemClass = ({ isActive }) =>
    cn(
      "flex items-center gap-3 pl-11 pr-4 py-2 text-xs font-medium transition-colors rounded-lg",
      isActive
        ? "text-white bg-slate-800 font-semibold"
        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
    );

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 flex flex-col w-64 border-r transition-transform lg:translate-x-0 bg-sidebar border-slate-800 text-slate-100",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-3.5 h-16 px-6 border-b border-slate-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white font-black text-sm select-none">
            RC
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight select-none">ReactCMS <span className="text-primary text-[10px] font-black uppercase bg-primary/20 px-1.5 py-0.5 rounded-full ml-1.5">Pro</span></h1>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {/* Dashboard */}
          <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className={navItemClass}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>Dashboard</span>
          </NavLink>

          {/* Websites Group */}
          <div>
            <button
              onClick={() => setWebsitesMenuOpen(!websitesMenuOpen)}
              className={cn(
                "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer",
                location.pathname.startsWith("/websites") ? "text-white bg-slate-800/40" : ""
              )}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span>Websites</span>
              </div>
              {websitesMenuOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {websitesMenuOpen && (
              <div className="mt-1 space-y-1 transition-all duration-200">
                {/* My Websites */}
                <NavLink to="/websites" end onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                  <Globe className="w-3.5 h-3.5" />
                  <span>My Websites</span>
                </NavLink>

                {/* Add Website */}
                <NavLink to="/websites/add" onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Website</span>
                </NavLink>

                {/* Verification (Contextual to active website) */}
                <NavLink
                  to={activeWebsiteId ? `/websites/${activeWebsiteId}/verify` : "/websites"}
                  onClick={() => setMobileOpen(false)}
                  className={subNavItemClass}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verification</span>
                </NavLink>

                {/* SDK (Contextual to active website) */}
                <NavLink
                  to={activeWebsiteId ? `/websites/${activeWebsiteId}/sdk` : "/websites"}
                  onClick={() => setMobileOpen(false)}
                  className={subNavItemClass}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>SDK Guide</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Content Group */}
          {activeWebsiteId && (
            <div>
              <button
                onClick={() => setContentMenuOpen(!contentMenuOpen)}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer",
                  location.pathname.startsWith(`/content/${activeWebsiteId}`) ? "text-white bg-slate-800/40" : ""
                )}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 flex-shrink-0" />
                  <span>Content</span>
                </div>
                {contentMenuOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {contentMenuOpen && (
                <div className="mt-1 space-y-1 transition-all duration-200">
                  {/* Pages */}
                  <NavLink to={`/content/${activeWebsiteId}/pages`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Pages</span>
                  </NavLink>

                  {/* Content Types */}
                  <NavLink to={`/content/${activeWebsiteId}/content-types`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Content Types</span>
                  </NavLink>

                  {/* Media */}
                  <NavLink to={`/content/${activeWebsiteId}/media`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Image className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Media</span>
                  </NavLink>

                  {/* Global Content */}
                  <NavLink to={`/content/${activeWebsiteId}/global`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Global Content</span>
                  </NavLink>

                  {/* SEO Suite */}
                  <NavLink to={`/content/${activeWebsiteId}/seo`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Search className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>SEO Dashboard</span>
                  </NavLink>

                  {/* Theme Manager */}
                  <NavLink to={`/content/${activeWebsiteId}/theme`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Palette className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Theme Manager</span>
                  </NavLink>

                  {/* Plugins Marketplace */}
                  <NavLink to={`/content/${activeWebsiteId}/plugins`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Puzzle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Plugin Marketplace</span>
                  </NavLink>

                  <div className="my-1 border-t border-slate-800/60 mx-4" />

                  {/* CMS Settings */}
                  <NavLink to={`/content/${activeWebsiteId}/settings`} onClick={() => setMobileOpen(false)} className={subNavItemClass}>
                    <Sliders className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>CMS Settings</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={navItemClass}>
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span>Settings</span>
          </NavLink>

          {/* Profile */}
          <NavLink to="/profile" onClick={() => setMobileOpen(false)} className={navItemClass}>
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile</span>
          </NavLink>
        </nav>

        {/* Logout Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
