import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-admin-bg dark:bg-slate-900">
        <div className="w-full max-w-lg space-y-4">
          <LoadingSkeleton variant="text" count={3} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save current location for post-auth redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
