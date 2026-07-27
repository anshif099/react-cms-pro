import React, { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import DashboardLayout from "../components/layouts/DashboardLayout";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

import RouteErrorBoundary from "../components/ui/RouteErrorBoundary";

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

// Safe Lazy Import Wrapper to handle Vercel deployment chunk updates gracefully
const safeLazy = (importFn) =>
  lazy(async () => {
    try {
      const component = await importFn();
      sessionStorage.removeItem("retry_chunk_reload");
      return component;
    } catch (error) {
      const isChunkError =
        error?.name === "TypeError" ||
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Importing a module script failed") ||
        error?.message?.includes("dynamically imported module");

      if (isChunkError && !sessionStorage.getItem("retry_chunk_reload")) {
        sessionStorage.setItem("retry_chunk_reload", "true");
        window.location.reload();
        return new Promise(() => {}); // Wait for browser reload
      }
      sessionStorage.removeItem("retry_chunk_reload");
      throw error;
    }
  });

// Lazy Loaded CMS Pages with Safe Chunk Fallback
const PagesListPage = safeLazy(() => import("../pages/content/PagesListPage"));
const PageEditorPage = safeLazy(() => import("../pages/content/PageEditorPage"));
const ContentTypesPage = safeLazy(() => import("../pages/content/ContentTypesPage"));
const ContentTypeEditorPage = safeLazy(() => import("../pages/content/ContentTypeEditorPage"));
const MediaLibraryPage = safeLazy(() => import("../pages/content/MediaLibraryPage"));
const GlobalContentPage = safeLazy(() => import("../pages/content/GlobalContentPage"));
const SearchPage = safeLazy(() => import("../pages/content/SearchPage"));
const LivePreviewPage = safeLazy(() => import("../pages/content/LivePreviewPage"));
const CMSSettingsPage = safeLazy(() => import("../pages/content/CMSSettingsPage"));
const SEODashboardPage = safeLazy(() => import("../pages/content/SEODashboardPage"));
const ThemeManagerPage = safeLazy(() => import("../pages/content/ThemeManagerPage"));
const PluginsPage = safeLazy(() => import("../pages/content/PluginsPage"));
const NavigationPage = safeLazy(() => import("../pages/content/NavigationPage"));
const LayoutsPage = safeLazy(() => import("../pages/content/LayoutsPage"));
const EditableRegionsPage = safeLazy(() => import("../pages/content/EditableRegionsPage"));
const VisualEditorPage = safeLazy(() => import("../pages/content/VisualEditorPage"));

const lazyLoad = (Component) => (
  <Suspense fallback={<div className="p-6"><LoadingSkeleton variant="card" /></div>}>
    <Component />
  </Suspense>
);

export const routesConfig = [
  // Authentication Routes
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    )
  },
  
  // Full-screen Visual Editor & Live Preview (Protected, no Sidebar/DashboardLayout)
  {
    path: "/content/:websiteId/pages/:pageId/editor",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        {lazyLoad(VisualEditorPage)}
      </ProtectedRoute>
    )
  },
  {
    path: "/content/:websiteId/preview/:pageId",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        {lazyLoad(VisualEditorPage)}
      </ProtectedRoute>
    )
  },

  // App Shell Layout (Protected Routes)
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
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
        path: "content/:websiteId",
        children: [
          {
            path: "pages",
            children: [
              {
                index: true,
                element: lazyLoad(PagesListPage)
              },
              {
                path: "new",
                element: lazyLoad(PageEditorPage)
              },
              {
                path: ":pageId",
                element: lazyLoad(VisualEditorPage)
              }
            ]
          },
          {
            path: "content-types",
            children: [
              {
                index: true,
                element: lazyLoad(ContentTypesPage)
              },
              {
                path: "new",
                element: lazyLoad(ContentTypeEditorPage)
              },
              {
                path: ":typeId",
                element: lazyLoad(ContentTypeEditorPage)
              }
            ]
          },
          {
            path: "media",
            element: lazyLoad(MediaLibraryPage)
          },
          {
            path: "global",
            element: lazyLoad(GlobalContentPage)
          },
          {
            path: "search",
            element: lazyLoad(SearchPage)
          },
          {
            path: "settings",
            element: lazyLoad(CMSSettingsPage)
          },
          {
            path: "seo",
            element: lazyLoad(SEODashboardPage)
          },
          {
            path: "theme",
            element: lazyLoad(ThemeManagerPage)
          },
          {
            path: "plugins",
            element: lazyLoad(PluginsPage)
          },
          {
            path: "navigation",
            element: lazyLoad(NavigationPage)
          },
          {
            path: "layouts",
            element: lazyLoad(LayoutsPage)
          },
          {
            path: "editable",
            element: lazyLoad(EditableRegionsPage)
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
