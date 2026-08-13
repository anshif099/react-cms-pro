import { database } from "../lib/firebase";
import { ref, get, set, push, onValue, update, serverTimestamp } from "firebase/database";
import contentSyncService from "./contentSyncService";
import revisionService from "./revisionService";
import searchService from "./searchService";
import activityLogService from "./activityLogService";
import { pageConversionService } from "./pageConversionService";
import {
  decodeFirebaseObject,
  encodeFirebaseKey,
  paths
} from "@anshif.rainhopes/shared";
import {
  cloneDraftDocument,
  clonePageLocales,
  resolveCreationLayout,
  resolvePageKey
} from "./pageCreationUtils";

function pageDeletionAliases(pageId, page) {
  return Array.from(new Set([
    resolvePageKey(page),
    String(page?.slug || "").replace(/^\/+|\/+$/g, ""),
    String(page?.routeId || "").replace(/^\/+|\/+$/g, ""),
    String(pageId || "").trim()
  ].filter(Boolean)));
}

export function createDeletedPageTombstone(pageKey, deletedAt = Date.now()) {
  const safeKey = String(pageKey || "page").replace(/[^a-zA-Z0-9_-]/g, "-");
  const heading = (id, text, level, color) => ({
    id: `${safeKey}-${id}`,
    type: "heading",
    label: text,
    props: {
      locales: { en: { text } },
      level,
      alignment: "center",
      color
    },
    children: [],
    metadata: {}
  });

  return {
    id: pageKey,
    slug: pageKey,
    title: "Page not found",
    deleted: true,
    deletedAt,
    tree: {
      id: `deleted-${safeKey}`,
      type: "page",
      version: 2,
      title: "Page not found",
      locale: "en",
      styles: {
        base: {
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a"
        }
      },
      children: [{
        id: `${safeKey}-not-found`,
        type: "container",
        label: "Deleted page",
        props: { maxWidth: 840 },
        styles: {
          base: {
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center"
          }
        },
        children: [
          heading("status", "404", "h1", "#ef4444"),
          heading("title", "Page not found", "h2", "#0f172a"),
          heading(
            "message",
            "This page has been removed and is no longer available.",
            "h3",
            "#64748b"
          )
        ],
        metadata: {}
      }],
      metadata: {
        deleted: true,
        deletedAt
      }
    }
  };
}

export function createPageDeletionUpdates(websiteId, pageId, page, deletedAt = Date.now()) {
  const pageKey = resolvePageKey(page);
  const aliases = pageDeletionAliases(pageId, page);
  const updates = {
    [`pages/${websiteId}/${pageId}`]: null,
    [`revisions/${websiteId}/page/${pageId}`]: null,
    [`searchIndex/${websiteId}/${pageId}`]: null
  };

  aliases.forEach((alias) => {
    updates[paths.contentDraft(websiteId, alias)] = null;
    updates[paths.contentPublished(websiteId, alias)] = null;
    updates[paths.registryRegions(websiteId, encodeFirebaseKey(alias))] = null;
    updates[paths.registryPageTree(websiteId, alias)] = null;
  });

  [page?.routeId, page?.slug, pageKey].filter(Boolean).forEach((routeId) => {
    updates[`${paths.registryRoutes(websiteId)}/${routeId}`] = null;
  });

  // Direct-host applications may intentionally contain a source-level
  // catch-all page. Leave a renderer-compatible tombstone for CMS-created
  // routes so the deleted URL cannot fall through and resurrect that page.
  if (!page?.isImported) {
    updates[paths.contentPublished(websiteId, pageKey)] = createDeletedPageTombstone(
      pageKey,
      deletedAt
    );
  }

  return updates;
}

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
      const [layoutsSnapshot, copiedPageSnapshot] = await Promise.all([
        get(ref(database, paths.registryLayouts(websiteId))),
        data.copyFromPageId
          ? get(ref(database, `pages/${websiteId}/${data.copyFromPageId}`))
          : Promise.resolve(null)
      ]);
      const layouts = layoutsSnapshot.exists() ? layoutsSnapshot.val() : {};
      const copiedPage = copiedPageSnapshot?.exists()
        ? { id: data.copyFromPageId, ...copiedPageSnapshot.val() }
        : null;

      if (data.copyFromPageId && !copiedPage) {
        throw new Error("The page selected for copying no longer exists.");
      }

      let copiedDraft = null;
      if (copiedPage) {
        const sourcePageKey = resolvePageKey(copiedPage);
        const [draft, published] = await Promise.all([
          contentSyncService.getDraft(websiteId, sourcePageKey),
          contentSyncService.getPublished(websiteId, sourcePageKey)
        ]);
        const sourceDocument = draft || published;
        if (sourceDocument) {
          copiedDraft = cloneDraftDocument(
            decodeFirebaseObject(sourceDocument),
            {
              sourcePageKey,
              targetPageKey: data.slug || data.routeId || "home",
              title: data.title,
              slug: data.slug || ""
            }
          );
        }
      }

      const pagesRef = ref(database, `pages/${websiteId}`);
      const newPageRef = push(pagesRef);
      const pageId = newPageRef.key;

      const templateBlocks = !copiedPage && data.template
        ? pageConversionService.getTemplateBlocks(data.template)
        : [];

      const routeId = data.routeId || data.id || data.slug || "";
      const routePath = data.route || data.path || (data.slug === "home" ? "/" : `/${data.slug}`);

      const metaTitle = data.metaTitle || data.title;
      const metaDesc = data.metaDescription || data.prompt || "";
      const keywords = data.keywords ?? copiedPage?.keywords ?? "";
      const layout = resolveCreationLayout(
        layouts,
        data.layout,
        copiedPage?.layout
      );
      const locales = data.locales || (copiedPage
        ? clonePageLocales(copiedPage, {
          title: data.title,
          slug: data.slug || "",
          metaTitle,
          metaDescription: data.metaDescription,
          keywords: data.keywords
        })
        : {
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
        });

      const pageData = {
        title: data.title,
        slug: data.slug || "",
        routeId: routeId,
        route: routePath,
        layout,
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
        locales,
        contentTypeRefs: data.contentTypeRefs || copiedPage?.contentTypeRefs || [],
        copiedFromPageId: copiedPage?.id || null,
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
          layout,
          source: pageData.source,
          published: data.status === "published",
          createdAt: Date.now()
        });
      }

      // Initialize content draft in Firebase for this page slug
      const pageSlug = data.slug || routeId || "home";
      if (pageSlug) {
        let initialRegions = {};
        if (data.prompt && !data.isImported && !copiedDraft) {
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

        await contentSyncService.syncDraft(
          websiteId,
          pageSlug,
          copiedDraft || {
            id: pageSlug,
            title: data.title,
            slug: data.slug || "",
            regions: initialRegions,
            updatedAt: Date.now()
          }
        );
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

      if (!page) return true;

      await update(
        ref(database),
        createPageDeletionUpdates(websiteId, pageId, page)
      );

      await activityLogService.logActivity(
        "page_deleted",
        "Page deleted",
        `Deleted page "${page.title}"`,
        websiteId
      );
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
