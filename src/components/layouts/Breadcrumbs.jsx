import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import websiteService from "../../services/websiteService";

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // If we are on dashboard root, no need to show breadcrumbs
  if (location.pathname === "/dashboard" || location.pathname === "/") {
    return (
      <div className="flex items-center text-xs font-semibold text-admin-secondary select-none py-1">
        <Home className="w-3.5 h-3.5 mr-1 text-primary" />
        <span>Dashboard</span>
      </div>
    );
  }

  const getBreadcrumbLabel = (path, index, paths) => {
    // Check if path is a website ID (starts with rcms_)
    if (path.startsWith("rcms_")) {
      const website = websiteService.getById(path);
      return website ? website.name : "Website Details";
    }

    const labels = {
      dashboard: "Dashboard",
      websites: "Websites",
      add: "Add Website",
      verify: "Verification",
      sdk: "SDK Guide",
      profile: "Profile",
      settings: "Settings"
    };

    return labels[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs font-medium text-admin-secondary select-none py-2 px-6">
      <Link
        to="/dashboard"
        className="flex items-center hover:text-primary transition-colors text-slate-400"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const label = getBreadcrumbLabel(value, index, pathnames);

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            {last ? (
              <span className="font-semibold text-admin-text dark:text-slate-200">
                {label}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-primary transition-colors text-slate-400"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
