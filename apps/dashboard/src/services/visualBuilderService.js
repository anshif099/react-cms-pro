import { ref, get, set, update } from "firebase/database";
import {
  decodeFirebaseKey,
  decodeFirebaseObject,
  encodeFirebaseKey,
  encodeFirebaseObject,
  paths
} from "@anshif.rainhopes/shared";
import { database } from "../lib/firebase";
import BLOCK_SCHEMAS from "../components/blocks/blockSchemas";
import {
  blockToComponentNode,
  isPageComponentTree
} from "@anshif.rainhopes/reactcms-renderer";

export const BUILDER_BLOCKS_REGION = "__rcms_builder_blocks__";
export const NATIVE_PAGE_TREE_FIELD = "tree";

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
  footer: { localized: { copyright: "(c) Your Company" } }
};

function decodeRegions(raw) {
  if (!raw || typeof raw !== "object") return {};
  const rawObj = raw.regions && typeof raw.regions === "object"
    ? raw.regions
    : raw;
  const decoded = decodeFirebaseObject(rawObj);

  return Object.fromEntries(
    Object.entries(decoded).filter(([key]) => (
      !["id", "title", "slug", "updatedAt", "publishedAt"].includes(key)
    )).map(([key, value]) => [
      decodeFirebaseKey(key.replace(/_DOT_/g, ".")),
      value
    ])
  );
}

function decodePageDocument(raw) {
  if (!raw || typeof raw !== "object") {
    return { tree: null, regions: {}, blocks: [], metadata: {} };
  }

  const decoded = decodeFirebaseObject(raw);
  const regions = decodeRegions(decoded);
  const blocks = Array.isArray(regions[BUILDER_BLOCKS_REGION])
    ? regions[BUILDER_BLOCKS_REGION]
    : [];
  delete regions[BUILDER_BLOCKS_REGION];

  return {
    tree: isPageComponentTree(decoded[NATIVE_PAGE_TREE_FIELD])
      ? decoded[NATIVE_PAGE_TREE_FIELD]
      : null,
    regions,
    blocks,
    metadata: {
      id: decoded.id,
      title: decoded.title,
      slug: decoded.slug,
      updatedAt: decoded.updatedAt,
      publishedAt: decoded.publishedAt
    }
  };
}

function stableJson(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== "object") return entry;
    return Object.fromEntries(
      Object.keys(entry).sort().map((key) => [key, normalize(entry[key])])
    );
  };
  return JSON.stringify(normalize(value));
}

export const visualBuilderService = {
  resolvePageKey(page) {
    const route = page?.route || page?.slug || "home";
    const clean = String(route).split("?")[0].replace(/^\/+|\/+$/g, "");
    return clean || "home";
  },

  async loadNativePage(websiteId, pageKey, pageIdentity = {}) {
    const registryKeys = Array.from(new Set([
      pageKey,
      pageIdentity?.pageId,
      pageIdentity?.routeId,
      pageIdentity?.slug,
      pageIdentity?.route,
      pageKey ? String(pageKey).replace(/\//g, "-") : null,
      pageIdentity?.route ? String(pageIdentity.route).replace(/^\/+|\/+$/g, "").replace(/\//g, "-") : null
    ]
      .filter(Boolean)
      .map((value) => String(value).split("?")[0].replace(/^\/+|\/+$/g, "") || "home")));

    const [
      draftSnapshots,
      publishedSnapshots,
      registeredTreeSnapshots,
      registeredRegionSnapshots
    ] = await Promise.all([
      Promise.all(registryKeys.map((key) => (
        get(ref(database, paths.contentDraft(websiteId, key)))
      ))),
      Promise.all(registryKeys.map((key) => (
        get(ref(database, paths.contentPublished(websiteId, key)))
      ))),
      Promise.all(registryKeys.map((key) => (
        get(ref(database, paths.registryPageTree(websiteId, key)))
      ))),
      Promise.all(registryKeys.map((key) => (
        get(ref(database, paths.registryRegions(websiteId, key)))
      )))
    ]);

    let published = decodePageDocument(null);
    publishedSnapshots.forEach((snapshot) => {
      if (snapshot.exists()) {
        const decoded = decodePageDocument(snapshot.val());
        published = {
          ...published,
          ...decoded,
          regions: { ...published.regions, ...decoded.regions }
        };
      }
    });

    let draftDocument = decodePageDocument(null);
    const mergedDraftRegions = {};
    draftSnapshots.forEach((snapshot) => {
      if (!snapshot.exists()) return;
      const decoded = decodePageDocument(snapshot.val());
      Object.assign(mergedDraftRegions, decoded.regions);
      if (decoded.tree || decoded.blocks.length || Object.keys(decoded.regions).length) {
        draftDocument = {
          ...decoded,
          tree: decoded.tree || draftDocument.tree,
          blocks: decoded.blocks.length ? decoded.blocks : draftDocument.blocks
        };
      }
    });
    draftDocument.regions = mergedDraftRegions;

    const registeredTree = registeredTreeSnapshots.find((snapshot) => (
      snapshot.exists() && isPageComponentTree(snapshot.val())
    ))?.val() || null;

    const registeredRegions = registeredRegionSnapshots.reduce((all, snapshot) => {
      if (!snapshot.exists()) return all;
      return {
        ...all,
        ...decodeFirebaseObject(snapshot.val())
      };
    }, {});

    return {
      published,
      draft: {
        ...draftDocument,
        tree: draftDocument.tree || published.tree || registeredTree,
        blocks: draftDocument.blocks.length ? draftDocument.blocks : published.blocks,
        regions: {
          ...registeredRegions,
          ...published.regions,
          ...draftDocument.regions
        }
      }
    };
  },

  async loadRegions(websiteId, pageKey) {
    const { published, draft } = await this.loadNativePage(websiteId, pageKey);
    return {
      published: {
        ...published.regions,
        [BUILDER_BLOCKS_REGION]: published.blocks
      },
      draft: {
        ...draft.regions,
        [BUILDER_BLOCKS_REGION]: draft.blocks
      }
    };
  },

  async loadSavedDraftRegions(websiteId, pageKey, pageIdentity = {}) {
    const candidateKeys = Array.from(new Set([
      pageKey,
      pageIdentity?.pageId,
      pageIdentity?.routeId,
      pageIdentity?.slug,
      pageIdentity?.route,
      pageKey ? String(pageKey).replace(/\//g, "-") : null,
      pageIdentity?.route ? String(pageIdentity.route).replace(/^\/+|\/+$/g, "").replace(/\//g, "-") : null
    ]
      .filter(Boolean)
      .map((value) => String(value).split("?")[0].replace(/^\/+|\/+$/g, "") || "home")));

    const snapshots = await Promise.all(
      candidateKeys.map((key) => get(ref(database, paths.contentDraft(websiteId, key))))
    );

    const mergedRegions = {};
    snapshots.forEach((snapshot) => {
      if (snapshot.exists()) {
        const decoded = decodePageDocument(snapshot.val());
        Object.assign(mergedRegions, decoded.regions);
      }
    });

    return mergedRegions;
  },

  async persistRegion(websiteId, pageKey, regionId, value) {
    return this.persistRegionTargets(
      [{ websiteId, pageKey }],
      regionId,
      value
    );
  },

  async persistRegionTargets(targets, regionId, value) {
    const uniqueTargets = Array.from(new Map(
      (targets || [])
        .filter((target) => target?.websiteId && target?.pageKey)
        .map((target) => [`${target.websiteId}:${target.pageKey}`, target])
    ).values());
    if (!uniqueTargets.length) {
      throw new Error("No connected draft destination was available.");
    }

    const encodedRegionId = encodeFirebaseKey(regionId);
    const encodedValue = encodeFirebaseObject(value);
    const regionPaths = uniqueTargets.map((target) => (
      `${paths.contentDraft(target.websiteId, target.pageKey)}/regions/${encodedRegionId}`
    ));
    await update(ref(database), Object.fromEntries(
      regionPaths.map((path) => [path, encodedValue])
    ));

    const snapshots = await Promise.all(regionPaths.map((path) => get(ref(database, path))));
    const expected = stableJson(value);
    const missingTargets = uniqueTargets.filter((_target, index) => {
      const snapshot = snapshots[index];
      return !snapshot.exists()
        || stableJson(decodeFirebaseObject(snapshot.val())) !== expected;
    });
    if (missingTargets.length) {
      throw new Error(
        `Connected draft verification failed for ${missingTargets.length} runtime destination(s).`
      );
    }
    return uniqueTargets;
  },

  async saveDraft({
    websiteId,
    pageId,
    pageKey,
    locale,
    page = {},
    pageSettings = {},
    regions = {},
    blocks = [],
    tree = null
  }) {
    const title = pageSettings?.title || page?.title || "Untitled Page";
    const slug = pageSettings?.slug ?? page?.slug ?? "";
    const route = pageSettings?.route || (slug === "home" ? "/" : `/${slug}`);
    const seo = pageSettings?.seo || {};
    const draftPayload = {
      id: pageKey,
      title,
      slug,
      [NATIVE_PAGE_TREE_FIELD]: tree,
      regions: {
        ...regions,
        [BUILDER_BLOCKS_REGION]: blocks
      },
      updatedAt: Date.now()
    };
    const nextPageKey = String(route || slug || pageKey)
      .split("?")[0]
      .replace(/^\/+|\/+$/g, "") || "home";

    const targetDraftKeys = Array.from(new Set([
      pageKey,
      nextPageKey,
      pageId,
      page?.id,
      page?.routeId,
      page?.slug,
      pageKey ? String(pageKey).replace(/\//g, "-") : null,
      nextPageKey ? String(nextPageKey).replace(/\//g, "-") : null
    ]
      .filter(Boolean)
      .map((value) => String(value).split("?")[0].replace(/^\/+|\/+$/g, "") || "home")));

    const pageUpdates = {
      updatedAt: Date.now(),
      route,
      layout: pageSettings?.layout || page?.layout || "default",
      [`locales/${locale}/title`]: title,
      [`locales/${locale}/slug`]: slug,
      [`locales/${locale}/seo`]: seo,
      [`locales/${locale}/blocks`]: blocks,
      [`locales/${locale}/componentTree`]: tree
    };

    if (locale === "en") {
      pageUpdates.title = title;
      pageUpdates.slug = slug;
    }

    const operations = [
      ...targetDraftKeys.map((key) => set(
        ref(database, paths.contentDraft(websiteId, key)),
        encodeFirebaseObject({ ...draftPayload, id: key })
      )),
      update(ref(database, `pages/${websiteId}/${pageId}`), pageUpdates)
    ];

    if (page?.routeId || page?.slug) {
      operations.push(
        update(ref(database, `registry/${websiteId}/routes/${page.routeId || page.slug}`), {
          title,
          path: route,
          slug,
          layout: pageSettings?.layout || page?.layout || "default",
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
    const decodedDraft = decodeFirebaseObject(draftSnapshot.val());
    if (!isPageComponentTree(decodedDraft[NATIVE_PAGE_TREE_FIELD])) {
      throw new Error("The native component tree is missing or invalid.");
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

export function createVisualNode(type, locale = "en") {
  const block = createVisualBlock(type, locale);
  return block ? blockToComponentNode(block) : null;
}

export default visualBuilderService;
