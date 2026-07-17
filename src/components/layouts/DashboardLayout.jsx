import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Breadcrumbs from "./Breadcrumbs";

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-admin-bg dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Layout */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header Panel */}
        <TopBar setMobileOpen={setMobileOpen} />

        {/* Dynamic Navigation Trail */}
        <div className="bg-admin-card border-b border-admin-border dark:bg-slate-900/60 dark:border-slate-800 transition-colors">
          <Breadcrumbs />
        </div>

        {/* Main Content Outlet with Page Animations */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
