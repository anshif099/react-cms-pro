import { database } from "../lib/firebase";
import { ref, get, set, update, serverTimestamp } from "firebase/database";
import pageService from "./pageService";
import activityLogService from "./activityLogService";

function normalizePathToId(path) {
  if (!path || path === "/") return "home";
  return path
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "") // remove leading/trailing slashes
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

export const websiteSyncService = {
  async fetchManifest(domain) {
    let cleanDomain = domain.trim();
    if (!/^https?:\/\//i.test(cleanDomain)) {
      cleanDomain = `https://${cleanDomain}`;
    }
    // Remove trailing slash
    cleanDomain = cleanDomain.replace(/\/$/, "");

    const url = `${cleanDomain}/.well-known/rcms-manifest.json`;
    
    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Manifest request failed with status: ${response.status}`);
      }
      const data = await response.json();
      if (!data || !data.rcms || !Array.isArray(data.routes)) {
        throw new Error("Invalid manifest schema");
      }
      return data;
    } catch (error) {
      console.warn(`Failed to fetch manifest from ${url}:`, error);
      throw error;
    }
  },

  async runSync(website) {
    const websiteId = website.id;
    const websiteRef = ref(database, `websites/${websiteId}`);

    // Update website status to syncing
    await update(websiteRef, {
      syncStatus: "syncing",
      updatedAt: serverTimestamp()
    });

    try {
      let routes = [];
      let syncMode = "registry";

      // 1. First read runtime routes registered in Firebase Database: registry/{websiteId}/routes
      const registryRoutesRef = ref(database, `registry/${websiteId}/routes`);
      const registrySnap = await get(registryRoutesRef);

      if (registrySnap.exists()) {
        const val = registrySnap.val();
        routes = Object.values(val || {}).map((r) => {
          const routeId = r.id || normalizePathToId(r.path || "/");
          const routePath = r.path || (routeId === "home" ? "/" : `/${routeId}`);
          const slug = r.slug || (routeId === "home" ? "home" : routeId.replace(/^\/+/, ""));
          return {
            id: routeId,
            routeId: routeId,
            path: routePath,
            route: routePath,
            slug: slug,
            title: r.title || (routeId.charAt(0).toUpperCase() + routeId.slice(1)),
            layout: r.layout || "default",
            source: r.source || "imported",
            published: r.published !== undefined ? r.published : true
          };
        });
      }

      // 2. Fallback to manifest HTTP fetch if registry routes are empty
      if (routes.length === 0 && website.domain) {
        try {
          const manifest = await this.fetchManifest(website.domain);
          syncMode = "manifest";
          routes = (manifest.routes || []).map((r) => {
            const routeId = r.id || normalizePathToId(r.path || "/");
            const routePath = r.path || (routeId === "home" ? "/" : `/${routeId}`);
            const slug = r.slug || (routeId === "home" ? "home" : routeId.replace(/^\/+/, ""));
            return {
              id: routeId,
              routeId: routeId,
              path: routePath,
              route: routePath,
              slug: slug,
              title: r.title || (routeId.charAt(0).toUpperCase() + routeId.slice(1)),
              layout: r.layout || "default",
              source: "imported"
            };
          });
        } catch (manifestErr) {
          console.warn("Manifest fetch fallback failed:", manifestErr);
        }
      }

      if (routes.length === 0) {
        throw new Error("No runtime routes found in registry or manifest. Ensure connected app is running with ReactCMS Runtime.");
      }

      await this.processRoutes(websiteId, routes, syncMode);
      
      // Update website metadata on success
      await update(websiteRef, {
        syncStatus: "idle",
        syncMode: syncMode,
        lastSync: serverTimestamp(),
        sdkInstalled: true,
        connectionHealth: "healthy",
        updatedAt: serverTimestamp()
      });

      await activityLogService.logActivity(
        "website_sync_success",
        "Website Synced Successfully",
        `Discovered and synchronized ${routes.length} pages via ${syncMode}`,
        websiteId
      );

      return { success: true, count: routes.length, mode: syncMode };
    } catch (error) {
      console.warn("Sync failed:", error.message);
      
      await update(websiteRef, {
        syncStatus: "manual",
        connectionHealth: "error",
        updatedAt: serverTimestamp()
      });

      throw error;
    }
  },

  async importRouteList(websiteId, routes, userId) {
    const websiteRef = ref(database, `websites/${websiteId}`);
    
    await update(websiteRef, {
      syncStatus: "syncing",
      updatedAt: serverTimestamp()
    });

    try {
      const formattedRoutes = routes.map((r) => {
        const routeId = r.id ? r.id.trim() : normalizePathToId(r.path);
        const routePath = r.path.trim();
        const slug = r.slug || (routeId === "home" ? "home" : routeId.replace(/^\/+/, ""));
        return {
          id: routeId,
          routeId: routeId,
          path: routePath,
          route: routePath,
          slug: slug,
          title: r.title.trim(),
          layout: r.layout || "default",
          source: "imported"
        };
      });

      await this.processRoutes(websiteId, formattedRoutes, "manual", userId);

      await update(websiteRef, {
        syncStatus: "idle",
        syncMode: "manual",
        lastSync: serverTimestamp(),
        connectionHealth: "healthy",
        updatedAt: serverTimestamp()
      });

      await activityLogService.logActivity(
        "website_sync_manual",
        "Manual Route Import Completed",
        `Imported ${formattedRoutes.length} pages manually`,
        websiteId
      );

      return { success: true, count: formattedRoutes.length, mode: "manual" };
    } catch (error) {
      console.error("Manual route import failed:", error);
      await update(websiteRef, {
        syncStatus: "error",
        updatedAt: serverTimestamp()
      });
      throw error;
    }
  },

  async processRoutes(websiteId, routes, syncMode, userId) {
    // 1. Fetch existing pages
    const pagesRef = ref(database, `pages/${websiteId}`);
    const snapshot = await get(pagesRef);
    const existingPagesMap = {};
    const existingSlugsMap = {};

    if (snapshot.exists()) {
      const val = snapshot.val();
      Object.keys(val).forEach((key) => {
        const page = { id: key, ...val[key] };
        if (page.routeId) {
          existingPagesMap[page.routeId] = page;
        }
        if (page.slug) {
          existingSlugsMap[page.slug] = page;
        }
        if (page.route) {
          existingSlugsMap[page.route] = page;
        }
      });
    }

    const processedRouteIds = new Set();

    // 2. Loop through routes
    for (const route of routes) {
      const routeId = route.id || route.routeId || normalizePathToId(route.path || "/");
      processedRouteIds.add(routeId);

      const routePath = route.path || route.route || (routeId === "home" ? "/" : `/${routeId}`);
      const slug = route.slug || (routeId === "home" ? "home" : routeId.replace(/^\/+/, ""));
      const title = route.title || (routeId.charAt(0).toUpperCase() + routeId.slice(1));
      const layout = route.layout || "default";

      // Match existing page by routeId, slug, or route path
      const matchedPage = existingPagesMap[routeId] || existingSlugsMap[slug] || existingSlugsMap[routePath];

      if (matchedPage) {
        // Update existing page metadata without overwriting custom blocks or editing state
        const pageUpdateRef = ref(database, `pages/${websiteId}/${matchedPage.id}`);
        const updates = {
          title: title,
          slug: slug,
          routeId: routeId,
          route: routePath,
          layout: layout,
          source: matchedPage.source || "imported",
          isImported: true,
          lastSynced: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (!matchedPage.locales) {
          updates.locales = {
            en: {
              title: title,
              slug: slug,
              seo: {
                metaTitle: title,
                metaDescription: ""
              },
              blocks: []
            }
          };
        }

        await update(pageUpdateRef, updates);
      } else {
        // Create new imported page preserving full route metadata
        await pageService.create(websiteId, {
          title: title,
          slug: slug,
          routeId: routeId,
          route: routePath,
          layout: layout,
          source: "imported",
          isImported: true,
          userId: userId || "system",
          locales: {
            en: {
              title: title,
              slug: slug,
              seo: {
                metaTitle: title,
                metaDescription: ""
              },
              blocks: []
            }
          }
        });
      }
    }

    // 3. Mark omitted imported pages as archived
    if (snapshot.exists()) {
      const val = snapshot.val();
      for (const key of Object.keys(val)) {
        const page = val[key];
        // Only archive pages that were previously imported and are now missing in the sync session
        if (page.isImported && page.routeId && !processedRouteIds.has(page.routeId)) {
          await update(ref(database, `pages/${websiteId}/${key}`), {
            status: "archived",
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 4. Calculate stats and save to website node
    const finalSnapshot = await get(pagesRef);
    let totalPages = 0;
    let importedPages = 0;
    let cmsPages = 0;
    let drafts = 0;
    let published = 0;
    let archived = 0;

    if (finalSnapshot.exists()) {
      const val = finalSnapshot.val();
      Object.keys(val).forEach((k) => {
        const page = val[k];
        totalPages++;
        if (page.source === "imported") {
          importedPages++;
        } else {
          cmsPages++;
        }

        if (page.status === "published") {
          published++;
        } else if (page.status === "archived") {
          archived++;
        } else {
          drafts++;
        }
      });
    }

    const statsRef = ref(database, `websites/${websiteId}/syncStats`);
    await set(statsRef, {
      totalPages,
      importedPages,
      cmsPages,
      drafts,
      published,
      archived
    });
  },

  parseRouteCSV(csvText) {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.split("\n");
    const routes = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 2) continue;

      if (parts[0].toLowerCase() === "id" || parts[0].toLowerCase() === "path" || parts[0].toLowerCase() === "route") {
        continue;
      }

      if (parts.length >= 3) {
        routes.push({
          id: parts[0],
          path: parts[1],
          title: parts[2]
        });
      } else {
        routes.push({
          path: parts[0],
          title: parts[1]
        });
      }
    }

    return routes;
  }
};

export default websiteSyncService;
