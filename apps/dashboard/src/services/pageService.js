import { database } from "../lib/firebase";
import { ref, get, set, push, remove, onValue, update, serverTimestamp } from "firebase/database";
import contentSyncService from "./contentSyncService";
import revisionService from "./revisionService";
import searchService from "./searchService";
import activityLogService from "./activityLogService";
import { pageConversionService } from "./pageConversionService";

export const pageService = {
  async markPublished(websiteId, pageId, routeId = "") {
    const publishedAt = Date.now();
    const operations = [
      update(ref(database, `pages/${websiteId}/${pageId}`), {
        status: "published",
        publishedAt,
        updatedAt: serverTimestamp()
      })
    ];
    if (routeId) {
      operations.push(update(ref(database, `registry/${websiteId}/routes/${routeId}`), {
        published: true,
        updatedAt: publishedAt
      }));
    }
    await Promise.all(operations);
    return publishedAt;
  },

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

  async updateSourceMetadata(websiteId, pageId, data) {
    await update(ref(database, `pages/${websiteId}/${pageId}`), {
      sourceProvider: data.sourceProvider || null,
      sourceFile: data.sourceFile || null,
      sourceRouterFile: data.sourceRouterFile || null,
      sourceRevision: data.sourceRevision || null,
      sourceWriteback: true,
      updatedAt: serverTimestamp()
    });
    return this.getById(websiteId, pageId);
  },

  async create(websiteId, data) {
    try {
      const pagesRef = ref(database, `pages/${websiteId}`);
      const newPageRef = push(pagesRef);
      const pageId = newPageRef.key;

      const templateBlocks = data.template 
        ? pageConversionService.getTemplateBlocks(data.template)
        : [];

      const routeId = data.routeId || data.id || data.slug || "";
      const routePath = data.route || data.path || (data.slug === "home" ? "/" : `/${data.slug}`);

      const metaTitle = data.metaTitle || data.title;
      const metaDesc = data.metaDescription || data.prompt || "";
      const keywords = data.keywords || "";

      const pageData = {
        title: data.title,
        slug: data.slug || "",
        routeId: routeId,
        route: routePath,
        layout: data.layout || "default",
        status: data.status || "draft",
        source: data.source || (data.prompt ? "generated" : "cms"),
        isImported: data.isImported || false,
        sourceProvider: data.sourceProvider || null,
        sourceFile: data.sourceFile || null,
        sourceRouterFile: data.sourceRouterFile || null,
        sourceComponent: data.sourceComponent || null,
        sourceRevision: data.sourceRevision || null,
        nativeArtifactStatus: data.nativeArtifactStatus || (
          data.isImported ? "source-only" : "ready"
        ),
        prompt: data.prompt || "",
        keywords: keywords,
        locales: data.locales || {
          en: {
            title: data.title,
            slug: data.slug || "",
            seo: {
              metaTitle: metaTitle,
              metaDescription: metaDesc,
              keywords: keywords
            },
            blocks: templateBlocks
          }
        },
        contentTypeRefs: data.contentTypeRefs || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await set(newPageRef, pageData);

      // Register route entry in registry so dynamic route discovery & runtime route registry know this page
      if (routeId) {
        const routeRegistryRef = ref(database, `registry/${websiteId}/routes/${routeId}`);
        await set(routeRegistryRef, {
          id: routeId,
          path: routePath,
          title: data.title,
          slug: data.slug || "",
          layout: data.layout || "default",
          source: pageData.source,
          published: data.status === "published",
          createdAt: Date.now()
        });
      }

      // Initialize content draft in Firebase for this page slug
      const pageSlug = data.slug || routeId || "home";
      if (pageSlug) {
        let initialRegions = {};
        if (!data.isImported) {
          const generatedHeroSubtext = data.prompt
            ? data.prompt
            : `Explore comprehensive ${data.title} solutions designed for modern business growth and success.`;

          const generatedDescription = data.prompt
            ? `Our ${data.title} services deliver end-to-end strategies, tools, and digital solutions. Key focus areas include: ${keywords}. Built to help ambitious organizations scale efficiently.`
            : `We deliver innovative technology, creative marketing, and measurable digital strategies for ${data.title}.`;

          initialRegions = {
            [`${pageSlug}.title`]: data.title,
            [`${pageSlug}.subtext`]: generatedHeroSubtext,
            [`${pageSlug}.heading`]: `About ${data.title}`,
            [`${pageSlug}.description`]: generatedDescription,
            [`${pageSlug}.cta_title`]: `Ready to get started with ${data.title}?`,
            [`${pageSlug}.cta_button`]: "Book Free Consultation"
          };
        }

        await contentSyncService.syncDraft(websiteId, pageSlug, {
          id: pageSlug,
          title: data.title,
          regions: initialRegions,
          updatedAt: Date.now()
        });
      }

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
