import React, { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import DashboardLayout from "../components/layouts/DashboardLayout";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

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

// Lazy Loaded CMS Pages
const PagesListPage = lazy(() => import("../pages/content/PagesListPage"));
const PageEditorPage = lazy(() => import("../pages/content/PageEditorPage"));
const ContentTypesPage = lazy(() => import("../pages/content/ContentTypesPage"));
const ContentTypeEditorPage = lazy(() => import("../pages/content/ContentTypeEditorPage"));
const MediaLibraryPage = lazy(() => import("../pages/content/MediaLibraryPage"));
const GlobalContentPage = lazy(() => import("../pages/content/GlobalContentPage"));
const SearchPage = lazy(() => import("../pages/content/SearchPage"));
const LivePreviewPage = lazy(() => import("../pages/content/LivePreviewPage"));
const CMSSettingsPage = lazy(() => import("../pages/content/CMSSettingsPage"));
const SEODashboardPage = lazy(() => import("../pages/content/SEODashboardPage"));
const ThemeManagerPage = lazy(() => import("../pages/content/ThemeManagerPage"));
const PluginsPage = lazy(() => import("../pages/content/PluginsPage"));
const NavigationPage = lazy(() => import("../pages/content/NavigationPage"));
const LayoutsPage = lazy(() => import("../pages/content/LayoutsPage"));
const EditableRegionsPage = lazy(() => import("../pages/content/EditableRegionsPage"));
const VisualEditorPage = lazy(() => import("../pages/content/VisualEditorPage"));

const lazyLoad = (Component) => (
  <Suspense fallback={<div className="p-6"><LoadingSkeleton variant="card" /></div>}>
    <Component />
  </Suspense>
);

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
  
  // Full-screen Visual Editor & Live Preview (Protected, no Sidebar/DashboardLayout)
  {
    path: "/content/:websiteId/pages/:pageId/editor",
    element: (
      <ProtectedRoute>
        {lazyLoad(VisualEditorPage)}
      </ProtectedRoute>
    )
  },
  {
    path: "/content/:websiteId/preview/:pageId",
    element: (
      <ProtectedRoute>
        {lazyLoad(VisualEditorPage)}
      </ProtectedRoute>
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
                element: lazyLoad(PageEditorPage)
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
