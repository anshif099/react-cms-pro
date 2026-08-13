import React from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";

export function WebsiteAccessRoute({ children }) {
  const { id, websiteId } = useParams();
  const { canAccessWebsite, loading } = useAuth();
  const requestedWebsiteId = websiteId || id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-admin-bg dark:bg-slate-900">
        <div className="w-full max-w-lg space-y-4">
          <LoadingSkeleton variant="text" count={3} />
        </div>
      </div>
    );
  }

  if (!canAccessWebsite(requestedWebsiteId)) {
    return <Navigate to="/websites" replace />;
  }

  return children || <Outlet />;
}

export default WebsiteAccessRoute;
