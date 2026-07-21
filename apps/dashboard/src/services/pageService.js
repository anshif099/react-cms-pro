import { database } from "../lib/firebase";
import { ref, get, set, push, update, remove, onValue, serverTimestamp } from "firebase/database";
import contentSyncService from "./contentSyncService";
import revisionService from "./revisionService";
import searchService from "./searchService";
import activityLogService from "./activityLogService";
import { pageConversionService } from "./pageConversionService";

export const pageService = {
  async getAll(websiteId) {
    try {
      const pagesRef = ref(database, `pages/${websiteId}`);
      const snapshot = await get(pagesRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        return Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch pages for website ${websiteId}:`, error);
      throw error;
    }
  },

  async getById(websiteId, pageId) {
    try {
      const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
      const snapshot = await get(pageRef);
      if (snapshot.exists()) {
        return {
          id: pageId,
          ...snapshot.val()
        };
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch page ${pageId}:`, error);
      throw error;
    }
  },

  async create(websiteId, data) {
    try {
      const pagesRef = ref(database, `pages/${websiteId}`);
      const newPageRef = push(pagesRef);
      const pageId = newPageRef.key;

      const templateBlocks = data.template 
        ? pageConversionService.getTemplateBlocks(data.template)
        : [];

      const pageData = {
        title: data.title,
        slug: data.slug || "",
        routeId: data.routeId || data.id || data.slug || "",
        route: data.route || data.path || (data.slug === "home" ? "/" : `/${data.slug}`),
        layout: data.layout || "default",
        status: data.status || "draft",
        source: data.source || (data.template ? "generated" : "cms"),
        isImported: data.isImported || false,
        locales: data.locales || {
          en: {
            title: data.title,
            slug: data.slug || "",
            seo: {
              metaTitle: data.title,
              metaDescription: ""
            },
            blocks: templateBlocks
          }
        },
        contentTypeRefs: data.contentTypeRefs || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await set(newPageRef, pageData);

      // Save initial revision
      await revisionService.save(websiteId, "page", pageId, pageData, data.userId);

      // Index page
      await searchService.index(websiteId, pageId, {
        type: "page",
        title: pageData.title,
        slug: pageData.slug,
        locales: pageData.locales
      });

      // Log activity
      await activityLogService.logActivity(
        "page_created",
        "Page created",
        `Created page "${data.title}"`,
        websiteId
      );

      return {
        id: pageId,
        ...pageData
      };
    } catch (error) {
      console.error("Failed to create page:", error);
      throw error;
    }
  },

  async update(websiteId, pageId, locale, data) {
    try {
      const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
      const snapshot = await get(pageRef);
      if (!snapshot.exists()) {
        throw new Error("Page not found");
      }

      const existingPage = snapshot.val();
      
      // Update specific locale and top-level fields
      const updatedPage = {
        ...existingPage,
        title: locale === "en" ? data.title || existingPage.title : existingPage.title,
        slug: locale === "en" ? data.slug || existingPage.slug : existingPage.slug,
        status: data.status || existingPage.status || "draft",
        updatedAt: serverTimestamp()
      };

      if (!updatedPage.locales) updatedPage.locales = {};
      updatedPage.locales[locale] = {
        title: data.title || "",
        slug: data.slug || "",
        seo: data.seo || {},
        blocks: data.blocks || []
      };

      if (data.contentTypeRefs) {
        updatedPage.contentTypeRefs = data.contentTypeRefs;
      }

      await set(pageRef, updatedPage);

      // Update index
      await searchService.index(websiteId, pageId, {
        type: "page",
        title: updatedPage.title,
        slug: updatedPage.slug,
        locales: updatedPage.locales
      });

      // Sync draft for live preview
      await contentSyncService.syncDraft(websiteId, "pages", pageId, {
        id: pageId,
        title: updatedPage.title,
        slug: updatedPage.slug,
        locales: updatedPage.locales,
        updatedAt: Date.now()
      });

      // If page was already published, automatically sync to published
      if (updatedPage.status === "published") {
        await contentSyncService.syncPublished(websiteId, "pages", pageId, {
          id: pageId,
          title: updatedPage.title,
          slug: updatedPage.slug,
          locales: updatedPage.locales,
          publishedAt: Date.now()
        });
      }

      return {
        id: pageId,
        ...updatedPage
      };
    } catch (error) {
      console.error(`Failed to update page ${pageId}:`, error);
      throw error;
    }
  },

  async delete(websiteId, pageId) {
    try {
      const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
      const snapshot = await get(pageRef);
      const page = snapshot.val();

      await remove(pageRef);

      // Remove from sync paths
      await contentSyncService.unsync(websiteId, "pages", pageId);

      // Remove from search index
      await searchService.removeFromIndex(websiteId, pageId);

      if (page) {
        await activityLogService.logActivity(
          "page_deleted",
          "Page deleted",
          `Deleted page "${page.title}"`,
          websiteId
        );
      }
      return true;
    } catch (error) {
      console.error(`Failed to delete page ${pageId}:`, error);
      throw error;
    }
  },

  async publish(websiteId, pageId, userId) {
    try {
      const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
      const snapshot = await get(pageRef);
      if (!snapshot.exists()) {
        throw new Error("Page not found");
      }

      const page = snapshot.val();
      const updatedPage = {
        ...page,
        status: "published",
        publishedAt: Date.now(),
        updatedAt: serverTimestamp()
      };

      await set(pageRef, updatedPage);

      // Sync to published path
      await contentSyncService.syncPublished(websiteId, "pages", pageId, {
        id: pageId,
        title: updatedPage.title,
        slug: updatedPage.slug,
        locales: updatedPage.locales,
        publishedAt: Date.now()
      });

      // Save revision
      await revisionService.save(websiteId, "page", pageId, updatedPage, userId);

      await activityLogService.logActivity(
        "page_published",
        "Page published",
        `Published page "${page.title}"`,
        websiteId
      );

      return {
        id: pageId,
        ...updatedPage
      };
    } catch (error) {
      console.error(`Failed to publish page ${pageId}:`, error);
      throw error;
    }
  },

  async unpublish(websiteId, pageId) {
    try {
      const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
      const snapshot = await get(pageRef);
      if (!snapshot.exists()) {
        throw new Error("Page not found");
      }

      const page = snapshot.val();
      const updatedPage = {
        ...page,
        status: "draft",
        updatedAt: serverTimestamp()
      };

      await set(pageRef, updatedPage);

      // Remove from published sync path, keep in draft
      await contentSyncService.unsync(websiteId, "pages", pageId);
      await contentSyncService.syncDraft(websiteId, "pages", pageId, {
        id: pageId,
        title: updatedPage.title,
        slug: updatedPage.slug,
        locales: updatedPage.locales,
        updatedAt: Date.now()
      });

      await activityLogService.logActivity(
        "page_unpublished",
        "Page unpublished",
        `Unpublished page "${page.title}"`,
        websiteId
      );

      return {
        id: pageId,
        ...updatedPage
      };
    } catch (error) {
      console.error(`Failed to unpublish page ${pageId}:`, error);
      throw error;
    }
  },

  subscribeToPage(websiteId, pageId, callback) {
    const pageRef = ref(database, `pages/${websiteId}/${pageId}`);
    return onValue(pageRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({
          id: pageId,
          ...snapshot.val()
        });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Subscription error for page ${pageId}:`, error);
    });
  }
};

export default pageService;
