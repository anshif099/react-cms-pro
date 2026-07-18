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
      throw error; // Let the caller decide to trigger manual import fallback
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
      const manifest = await this.fetchManifest(website.domain);
      const routes = manifest.routes.map(r => ({
        id: r.id || normalizePathToId(r.path),
        path: r.path,
        title: r.title
      }));

      await this.processRoutes(websiteId, routes, "manifest");
      
      // Update website metadata on success
      await update(websiteRef, {
        syncStatus: "idle",
        syncMode: "manifest",
        lastSync: serverTimestamp(),
        sdkInstalled: true,
        sdkVersion: manifest.sdkVersion || "1.0.0",
        connectionHealth: "healthy",
        updatedAt: serverTimestamp()
      });

      await activityLogService.logActivity(
        "website_sync_success",
        "Website Synced Successfully",
        `Discovered and synchronized ${routes.length} pages via manifest`,
        websiteId
      );

      return { success: true, count: routes.length, mode: "manifest" };
    } catch (error) {
      console.error("Auto manifest sync failed:", error);
      
      await update(websiteRef, {
        syncStatus: "manual", // Indicate manual intervention / manifest check failed
        connectionHealth: "error",
        updatedAt: serverTimestamp()
      });

      throw error; // Re-throw to allow details page to display manual import wizard
    }
  },

  async importRouteList(websiteId, routes, userId) {
    const websiteRef = ref(database, `websites/${websiteId}`);
    
    await update(websiteRef, {
      syncStatus: "syncing",
      updatedAt: serverTimestamp()
    });

    try {
      const formattedRoutes = routes.map(r => ({
        id: r.id ? r.id.trim() : normalizePathToId(r.path),
        path: r.path.trim(),
        title: r.title.trim()
      }));

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
      Object.keys(val).forEach(key => {
        const page = { id: key, ...val[key] };
        if (page.routeId) {
          existingPagesMap[page.routeId] = page;
        }
        if (page.slug) {
          existingSlugsMap[page.slug] = page;
        }
      });
    }

    const processedRouteIds = new Set();

    // 2. Loop through routes
    for (const route of routes) {
      const routeId = route.id;
      processedRouteIds.add(routeId);
      
      const normalizedSlug = routeId === "home" ? "home" : routeId;
      
      // Check duplicate matches
      const matchedPage = existingPagesMap[routeId] || existingSlugsMap[normalizedSlug];

      if (matchedPage) {
        // Update existing page metadata without touching blocks or current editing states
        const pageUpdateRef = ref(database, `pages/${websiteId}/${matchedPage.id}`);
        const updates = {
          title: route.title,
          slug: normalizedSlug,
          routeId: routeId,
          route: route.path,
          source: matchedPage.source || "imported",
          isImported: true,
          lastSynced: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Sync first locale default parameters if locales structure doesn't exist
        if (!matchedPage.locales) {
          updates.locales = {
            en: {
              title: route.title,
              slug: normalizedSlug,
              seo: {
                metaTitle: route.title,
                metaDescription: ""
              },
              blocks: []
            }
          };
        }

        await update(pageUpdateRef, updates);
      } else {
        // Create new imported page
        await pageService.create(websiteId, {
          title: route.title,
          slug: normalizedSlug,
          userId: userId || "system",
          locales: {
            en: {
              title: route.title,
              slug: normalizedSlug,
              seo: {
                metaTitle: route.title,
                metaDescription: ""
              },
              blocks: []
            }
          }
        });

        // Query the newly added page to stamp imported properties
        const freshSnapshot = await get(pagesRef);
        if (freshSnapshot.exists()) {
          const freshVal = freshSnapshot.val();
          const newPageKey = Object.keys(freshVal).find(k => freshVal[k].slug === normalizedSlug && !freshVal[k].routeId);
          if (newPageKey) {
            await update(ref(database, `pages/${websiteId}/${newPageKey}`), {
              routeId: routeId,
              route: route.path,
              source: "imported",
              isImported: true,
              lastSynced: serverTimestamp()
            });
          }
        }
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
      Object.keys(val).forEach(k => {
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

      // Split line by comma, handle simple comma quotes if necessary
      const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 2) continue;

      // Skip header if line matches headers
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
