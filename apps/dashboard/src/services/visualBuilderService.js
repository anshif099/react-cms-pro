import { ref, get, set, update } from "firebase/database";
import {
  decodeFirebaseObject,
  encodeFirebaseKey,
  encodeFirebaseObject,
  paths
} from "@anshif.rainhopes/shared";
import { database } from "../lib/firebase";
import BLOCK_SCHEMAS from "../components/blocks/blockSchemas";

export const BUILDER_BLOCKS_REGION = "__rcms_builder_blocks__";

const RCMS_MESSAGE_VERSION = "v1";

const BLOCK_STARTER_VALUES = {
  hero: {
    localized: {
      title: "Build something remarkable",
      subtitle: "Create a clear, memorable first impression with a focused headline and call to action.",
      buttonText: "Get Started"
    },
    global: { buttonUrl: "#", overlayOpacity: 0.68 }
  },
  heading: {
    localized: { text: "A clear section heading" },
    global: { level: "h2", alignment: "left", color: "#0f172a" }
  },
  paragraph: {
    localized: { text: "<p>Add your story here. Double-click this text on the canvas to edit it inline.</p>" },
    global: { alignment: "left" }
  },
  button: {
    localized: { label: "Learn More" },
    global: { url: "#", variant: "primary", size: "md", color: "#2563eb", radius: 10 }
  },
  gallery: { global: { columns: "3", gap: 16, images: [] } },
  features: {
    localized: {
      title: "Everything you need",
      subtitle: "Highlight the benefits that make your product or service stand out.",
      items: [
        { title: "Fast to launch", description: "Build and publish polished pages without leaving your CMS." },
        { title: "Easy to edit", description: "Update content directly on the live website canvas." },
        { title: "Ready to scale", description: "Reuse sections, components, themes, and structured content." }
      ]
    }
  },
  cards: {
    localized: {
      title: "Explore what we offer",
      cards: [
        { title: "Strategy", description: "Turn ideas into a focused plan.", buttonText: "Learn more", buttonUrl: "#" },
        { title: "Design", description: "Create a memorable digital experience.", buttonText: "Learn more", buttonUrl: "#" },
        { title: "Growth", description: "Improve performance with measurable results.", buttonText: "Learn more", buttonUrl: "#" }
      ]
    }
  },
  testimonials: {
    localized: {
      items: [
        { name: "Happy Customer", role: "Client", quote: "Working with this team made our next step simple and successful.", rating: 5 }
      ]
    }
  },
  faq: {
    localized: {
      title: "Frequently asked questions",
      items: [
        { question: "How does this work?", answer: "Add your answer here and edit it from the Inspector." },
        { question: "Can I customize this section?", answer: "Yes. Content, layout, colors, and spacing are editable." }
      ]
    }
  },
  accordion: {
    localized: {
      title: "More information",
      items: [
        { title: "First panel", content: "Add supporting information here." },
        { title: "Second panel", content: "Use panels to organize longer content." }
      ]
    }
  },
  cta: {
    localized: {
      title: "Ready to get started?",
      subtitle: "Take the next step with a clear and focused call to action.",
      primaryButtonText: "Get Started"
    },
    global: { primaryButtonUrl: "#", background: "#2563eb" }
  },
  pricing: {
    localized: {
      title: "Simple pricing",
      subtitle: "Choose the option that fits you best.",
      plans: [
        { name: "Starter", price: 29, period: "month", features: "Core features, Email support", buttonText: "Choose Starter" },
        { name: "Professional", price: 79, period: "month", features: "Everything in Starter, Priority support", buttonText: "Choose Pro", highlighted: true }
      ]
    }
  },
  team: {
    localized: {
      title: "Meet the team",
      subtitle: "Introduce the people behind the work.",
      members: [
        { name: "Team Member", role: "Founder", bio: "Add a short biography and role description." },
        { name: "Team Member", role: "Creative Lead", bio: "Add a short biography and role description." }
      ]
    }
  },
  contact: {
    localized: {
      title: "Contact us",
      subtitle: "Tell us how we can help.",
      submitText: "Send Message"
    },
    global: {
      fields: [
        { name: "name", placeholder: "Your name", required: true },
        { name: "email", placeholder: "Email address", required: true },
        { name: "message", placeholder: "How can we help?", required: true }
      ]
    }
  },
  columns: {
    global: { columns: "2", gap: 24 },
    localized: {
      items: [
        { title: "First column", text: "Add content for this column." },
        { title: "Second column", text: "Add content for this column." }
      ]
    }
  },
  container: {
    localized: { title: "Container", text: "Group related content inside a reusable layout container." },
    global: { maxWidth: 1120, padding: 32, background: "#ffffff" }
  },
  services: {
    localized: {
      title: "Our Services",
      subtitle: "Explain the ways you help your customers.",
      items: [
        { title: "Consulting", description: "Expert guidance shaped around your goals.", url: "#" },
        { title: "Implementation", description: "Practical delivery from concept to launch.", url: "#" },
        { title: "Support", description: "Ongoing help that keeps your work moving.", url: "#" }
      ]
    }
  },
  "blog-posts": {
    localized: {
      title: "Latest Articles",
      items: [
        { title: "Your first article", excerpt: "Connect a content source or curate posts manually.", url: "#" },
        { title: "Another useful story", excerpt: "Share useful ideas with your audience.", url: "#" }
      ]
    },
    global: { source: "latest", limit: 3 }
  },
  map: {
    localized: { title: "Find us", address: "Add your address" },
    global: { height: 420 }
  },
  newsletter: {
    localized: {
      title: "Stay in the loop",
      subtitle: "Get useful updates delivered to your inbox.",
      placeholder: "you@example.com",
      buttonText: "Subscribe"
    }
  },
  spacer: { global: { height: 64 } },
  divider: { global: { style: "solid", color: "#cbd5e1", margin: 24 } },
  html: { global: { code: "<div style=\"padding:24px;text-align:center\">Custom HTML content</div>" } },
  footer: { localized: { copyright: "© Your Company" } }
};

function createMessage(type, websiteId, payload = {}) {
  return {
    rcms: true,
    version: RCMS_MESSAGE_VERSION,
    type,
    websiteId,
    payload,
    timestamp: Date.now()
  };
}

function getTargetOrigin(targetUrl) {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return "*";
  }
}

function decodeRegions(raw) {
  if (!raw || typeof raw !== "object") return {};
  const decoded = decodeFirebaseObject(raw);
  const source = decoded.regions && typeof decoded.regions === "object"
    ? decoded.regions
    : decoded;

  return Object.fromEntries(
    Object.entries(source).filter(([key]) => (
      !["id", "title", "slug", "updatedAt", "publishedAt"].includes(key)
    ))
  );
}

export const visualBuilderService = {
  normalizeDomain(domain) {
    if (!domain) return "";
    const trimmed = domain.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
    return `https://${trimmed.replace(/\/+$/, "")}`;
  },

  resolvePageKey(page) {
    const route = page?.route || page?.slug || "home";
    const clean = String(route).split("?")[0].replace(/^\/+|\/+$/g, "");
    return clean || "home";
  },

  buildCanvasUrl(domain, page, mode, locale = "en") {
    const base = this.normalizeDomain(domain);
    if (!base) return "";

    const route = page?.route || (page?.slug === "home" ? "/" : `/${page?.slug || ""}`);
    const url = new URL(route || "/", `${base}/`);
    url.searchParams.set("page", this.resolvePageKey(page));
    url.searchParams.set(mode === "edit" ? "rcms_edit" : "rcms_preview", "1");
    url.searchParams.set("rcms_embed", "1");
    url.searchParams.set("rcms_locale", locale);
    return url.toString();
  },

  postToCanvas(iframe, targetUrl, websiteId, type, payload = {}) {
    if (!iframe?.contentWindow) return;
    const message = createMessage(type, websiteId, payload);
    const targetOrigin = getTargetOrigin(targetUrl);

    try {
      iframe.contentWindow.postMessage(message, targetOrigin);
    } catch (error) {
      console.warn(`[VisualBuilder] Could not send ${type} to canvas:`, error);
    }
  },

  setCanvasMode(iframe, targetUrl, websiteId, mode) {
    this.postToCanvas(
      iframe,
      targetUrl,
      websiteId,
      mode === "edit" ? "rcms/v1/enter-edit-mode" : "rcms/v1/exit-edit-mode"
    );
  },

  hydrateCanvas(iframe, targetUrl, websiteId, pageKey, regions) {
    Object.entries(regions || {}).forEach(([regionId, value]) => {
      this.postToCanvas(iframe, targetUrl, websiteId, "rcms/v1/field-update", {
        pageId: pageKey,
        regionId,
        value
      });
    });
  },

  updateCanvasRegion(iframe, targetUrl, websiteId, pageKey, regionId, value) {
    this.postToCanvas(iframe, targetUrl, websiteId, "rcms/v1/field-update", {
      pageId: pageKey,
      regionId,
      value
    });
  },

  updateCanvasBlocks(iframe, targetUrl, websiteId, pageKey, blocks) {
    this.updateCanvasRegion(
      iframe,
      targetUrl,
      websiteId,
      pageKey,
      BUILDER_BLOCKS_REGION,
      blocks
    );
    this.postToCanvas(iframe, targetUrl, websiteId, "rcms/v1/builder-structure-update", {
      pageId: pageKey,
      blocks
    });
  },

  async loadRegions(websiteId, pageKey) {
    const [draftSnapshot, publishedSnapshot] = await Promise.all([
      get(ref(database, paths.contentDraft(websiteId, pageKey))),
      get(ref(database, paths.contentPublished(websiteId, pageKey)))
    ]);

    const published = publishedSnapshot.exists()
      ? decodeRegions(publishedSnapshot.val())
      : {};
    const draft = draftSnapshot.exists()
      ? decodeRegions(draftSnapshot.val())
      : {};

    return {
      published,
      draft: { ...published, ...draft }
    };
  },

  async persistRegion(websiteId, pageKey, regionId, value) {
    const encodedRegionId = encodeFirebaseKey(regionId);
    const regionRef = ref(
      database,
      `${paths.contentDraft(websiteId, pageKey)}/regions/${encodedRegionId}`
    );
    await set(regionRef, encodeFirebaseObject(value));
  },

  async saveDraft({
    websiteId,
    pageId,
    pageKey,
    locale,
    page,
    pageSettings,
    regions,
    blocks
  }) {
    const title = pageSettings.title || page.title || "Untitled Page";
    const slug = pageSettings.slug ?? page.slug ?? "";
    const route = pageSettings.route || (slug === "home" ? "/" : `/${slug}`);
    const seo = pageSettings.seo || {};
    const draftPayload = {
      id: pageKey,
      title,
      slug,
      regions: {
        ...regions,
        [BUILDER_BLOCKS_REGION]: blocks
      },
      updatedAt: Date.now()
    };
    const nextPageKey = String(route || slug || pageKey)
      .split("?")[0]
      .replace(/^\/+|\/+$/g, "") || "home";

    const pageUpdates = {
      updatedAt: Date.now(),
      route,
      layout: pageSettings.layout || page.layout || "default",
      [`locales/${locale}/title`]: title,
      [`locales/${locale}/slug`]: slug,
      [`locales/${locale}/seo`]: seo,
      [`locales/${locale}/blocks`]: blocks
    };

    if (locale === "en") {
      pageUpdates.title = title;
      pageUpdates.slug = slug;
    }

    const operations = [
      set(
        ref(database, paths.contentDraft(websiteId, pageKey)),
        encodeFirebaseObject(draftPayload)
      ),
      update(ref(database, `pages/${websiteId}/${pageId}`), pageUpdates)
    ];

    if (nextPageKey !== pageKey) {
      operations.push(
        set(
          ref(database, paths.contentDraft(websiteId, nextPageKey)),
          encodeFirebaseObject({ ...draftPayload, id: nextPageKey })
        )
      );
    }

    if (page.routeId || page.slug) {
      operations.push(
        update(ref(database, `registry/${websiteId}/routes/${page.routeId || page.slug}`), {
          title,
          path: route,
          slug,
          layout: pageSettings.layout || page.layout || "default",
          updatedAt: Date.now()
        })
      );
    }

    await Promise.all(operations);

    return draftPayload;
  },

  async publish({ websiteId, pageId, pageKey, routeId }) {
    const draftRef = ref(database, paths.contentDraft(websiteId, pageKey));
    const draftSnapshot = await get(draftRef);
    if (!draftSnapshot.exists()) {
      throw new Error("Save a draft before publishing.");
    }

    const payload = {
      ...draftSnapshot.val(),
      publishedAt: Date.now()
    };
    const updates = {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now()
    };

    const operations = [
      set(ref(database, paths.contentPublished(websiteId, pageKey)), payload),
      update(ref(database, `pages/${websiteId}/${pageId}`), updates)
    ];

    if (routeId) {
      operations.push(
        update(ref(database, `registry/${websiteId}/routes/${routeId}`), {
          published: true,
          updatedAt: Date.now()
        })
      );
    }

    await Promise.all(operations);
    return true;
  }
};

export function createVisualBlock(type, locale = "en") {
  const schema = BLOCK_SCHEMAS.find((item) => item.type === type);
  if (!schema) return null;

  const block = {
    id: `block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    locales: { [locale]: {} },
    design: {}
  };

  schema.fields.forEach((field) => {
    let value = field.defaultValue ?? "";
    if (field.type === "number" && field.defaultValue === undefined) value = 0;
    if (field.type === "boolean" && field.defaultValue === undefined) value = false;
    if (field.type === "array" && field.defaultValue === undefined) value = [];

    if (field.localized) {
      block.locales[locale][field.key] = value;
    } else {
      block[field.key] = value;
    }
  });

  const starter = BLOCK_STARTER_VALUES[type];
  if (starter?.global) Object.assign(block, structuredClone(starter.global));
  if (starter?.localized) {
    block.locales[locale] = {
      ...block.locales[locale],
      ...structuredClone(starter.localized)
    };
  }

  return block;
}

export default visualBuilderService;
