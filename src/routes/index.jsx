import React from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import DashboardLayout from "../components/layouts/DashboardLayout";

// Import Pages
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import WebsitesPage from "../pages/websites/WebsitesPage";
import ConnectWebsitePage from "../pages/websites/ConnectWebsitePage";
import WebsiteDetailsPage from "../pages/websites/WebsiteDetailsPage";
import VerificationPage from "../pages/websites/VerificationPage";
import SDKInstallPage from "../pages/websites/SDKInstallPage";
import ProfilePage from "../pages/profile/ProfilePage";
import SettingsPage from "../pages/settings/SettingsPage";

export const routesConfig = [
  // Authentication Routes
  {
    path: "/login",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    )
  },
  
  // App Shell Layout (Protected Routes)
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: "dashboard",
        element: <DashboardPage />
      },
      {
        path: "websites",
        children: [
          {
            index: true,
            element: <WebsitesPage />
          },
          {
            path: "add",
            element: <ConnectWebsitePage />
          },
          {
            path: ":id",
            element: <WebsiteDetailsPage />
          },
          {
            path: ":id/verify",
            element: <VerificationPage />
          },
          {
            path: ":id/sdk",
            element: <SDKInstallPage />
          }
        ]
      },
      {
        path: "profile",
        element: <ProfilePage />
      },
      {
        path: "settings",
        element: <SettingsPage />
      }
    ]
  },
  
  // Fallback redirect
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
];

export default routesConfig;
