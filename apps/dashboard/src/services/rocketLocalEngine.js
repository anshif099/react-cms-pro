import { auditAIContext, flattenContextTree } from "./aiWebsiteContextService";

const MODEL_NAME = "rocket-embedded-v1";
const FEEDBACK_KEY = "reactcms_rocket_embedded_curriculum_v1";

const THEME_PRESETS = {
  dark: {
    colors: {
      background: "#070b14",
      secondary: "#111827",
      text: "#f8fafc",
      accent: "#8b5cf6"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "10px", fontWeight: "700" }
  },
  futuristic: {
    colors: {
      primary: "#22d3ee",
      secondary: "#111827",
      accent: "#a78bfa",
      background: "#050816",
      text: "#f0f9ff"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "12px", fontWeight: "700" }
  },
  luxury: {
    colors: {
      primary: "#d4af37",
      secondary: "#17130b",
      accent: "#f4df9b",
      background: "#090806",
      text: "#fffaf0"
    },
    typography: { headingFont: "Georgia", bodyFont: "Inter" },
    buttons: { borderRadius: "2px", fontWeight: "600" }
  },
  apple: {
    colors: {
      primary: "#0071e3",
      secondary: "#e8e8ed",
      accent: "#2997ff",
      background: "#f5f5f7",
      text: "#1d1d1f"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "999px", fontWeight: "600" }
  },
  minimal: {
    colors: {
      primary: "#111827",
      secondary: "#e5e7eb",
      accent: "#4f46e5",
      background: "#ffffff",
      text: "#111827"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "8px", fontWeight: "600" }
  },
  linear: {
    colors: {
      primary: "#8b5cf6",
      secondary: "#18181b",
      accent: "#5e6ad2",
      background: "#09090b",
      text: "#fafafa"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "8px", fontWeight: "600" }
  },
  corporate: {
    colors: {
      primary: "#1d4ed8",
      secondary: "#e2e8f0",
      accent: "#0f766e",
      background: "#f8fafc",
      text: "#0f172a"
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    buttons: { borderRadius: "6px", fontWeight: "700" }
  }
};

const SECTION_TERMS = [
  ["testimonials", ["testimonial", "reviews", "social proof"]],
  ["pricing", ["pricing", "price table", "plans"]],
  ["faq", ["faq", "frequently asked", "questions"]],
  ["features", ["features", "benefits"]],
  ["services", ["services"]],
  ["team", ["team", "people"]],
  ["contact", ["contact", "contact form"]],
  ["gallery", ["gallery", "portfolio"]],
  ["newsletter", ["newsletter", "subscribe"]],
  ["cta", ["call to action", "cta"]],
  ["blog-posts", ["blog", "articles"]],
  ["map", ["map", "location"]],
  ["footer", ["footer"]],
  ["hero", ["hero"]]
];

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function json(value) {
  return JSON.stringify(value);
}

function patch(path, value) {
  return { path, valueJson: json(value) };
}

function requestId() {
  if (globalThis.crypto?.randomUUID) return `rocket_${globalThis.crypto.randomUUID()}`;
  return `rocket_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function operationFactory() {
  let number = 0;
  return (type, values = {}) => ({
    id: `rocket-edit-${++number}`,
    type,
    summary: values.summary || "Improve the page",
    reason: values.reason || "Apply the requested improvement.",
    targetId: values.targetId ?? null,
    destinationId: values.destinationId ?? null,
    position: values.position ?? null,
    componentType: values.componentType ?? null,
    patches: values.patches || []
  });
}

function themePatches(preset) {
  return Object.entries(preset).flatMap(([group, values]) => (
    Object.entries(values).map(([key, value]) => patch(`${group}.${key}`, value))
  ));
}

function colorFromIntent(intent) {
  const matches = String(intent || "").match(/#[0-9a-f]{3,8}\b/gi);
  return matches?.at(-1) || "";
}

function titleFromContext(context) {
  return context?.currentPage?.record?.title
    || context?.currentPage?.settings?.title
    || context?.website?.record?.name
    || "Website";
}

function companyFromContext(context, memory) {
  return String(memory?.companyInfo || "").trim()
    || context?.designSystem?.theme?.branding?.siteName
    || context?.website?.record?.name
    || "your business";
}

function selectedRegionOperation(addOperation, context, field, value, summary, reason) {
  const selected = context?.currentPage?.selectedRegion;
  const capabilities = new Set(context?.capabilities || []);
  if (!selected?.regionId || !capabilities.has("update_region")) return null;
  return addOperation("update_region", {
    targetId: selected.regionId,
    summary,
    reason,
    patches: [patch(`value.${field}`, value)]
  });
}

function selectedComponentOperation(addOperation, context, path, value, summary, reason) {
  const selected = context?.currentPage?.selectedComponent;
  const capabilities = new Set(context?.capabilities || []);
  if (!selected?.id || !capabilities.has("update_component")) return null;
  return addOperation("update_component", {
    targetId: selected.id,
    summary,
    reason,
    patches: [patch(path, value)]
  });
}

function addThemeOperation(operations, addOperation, patches, summary, reason) {
  if (!patches.length) return;
  operations.push(addOperation("update_theme", { patches, summary, reason }));
}

function findPreset(text) {
  if (includesAny(text, ["apple", "ios style"])) return ["apple", THEME_PRESETS.apple];
  if (includesAny(text, ["linear", "framer", "dark minimal"])) return ["linear", THEME_PRESETS.linear];
  if (includesAny(text, ["futuristic", "cyber", "neon"])) return ["futuristic", THEME_PRESETS.futuristic];
  if (includesAny(text, ["luxury", "luxurious", "gold"] )) return ["luxury", THEME_PRESETS.luxury];
  if (includesAny(text, ["corporate", "professional"] )) return ["corporate", THEME_PRESETS.corporate];
  if (includesAny(text, ["minimal", "clean", "light theme"] )) return ["minimal", THEME_PRESETS.minimal];
  if (includesAny(text, ["dark", "black theme"] )) return ["dark", THEME_PRESETS.dark];
  return null;
}

function requestedSections(text) {
  const explicitAction = includesAny(text, ["add ", "insert ", "create ", "build ", "make a "]);
  if (!explicitAction) return [];
  if (includesAny(text, ["landing page", "homepage", "home page", "saas website", "agency website"])) {
    return ["hero", "features", "testimonials", "pricing", "faq", "cta"];
  }
  return SECTION_TERMS
    .filter(([, terms]) => includesAny(text, terms))
    .map(([type]) => type);
}

function addSections(operations, addOperation, context, types) {
  const capabilities = new Set(context?.capabilities || []);
  if (!capabilities.has("insert_component") || !types.length) return false;
  const allowed = new Set(context?.constraints?.registeredComponentTypes || []);
  const roots = context?.currentPage?.componentTree?.children || [];
  let targetId = roots.at(-1)?.id || null;
  let inserted = 0;

  types.forEach((type) => {
    if (allowed.size && !allowed.has(type)) return;
    const item = addOperation("insert_component", {
      targetId,
      position: "after",
      componentType: type,
      summary: `Add ${type.replaceAll("-", " ")} section`,
      reason: "Build the requested page structure with a native editable component.",
      patches: [patch("label", type.split("-").map((part) => (
        part.charAt(0).toUpperCase() + part.slice(1)
      )).join(" "))]
    });
    operations.push(item);
    targetId = `$op:${item.id}`;
    inserted += 1;
  });
  return inserted > 0;
}

function addResponsiveEdits(operations, addOperation, context) {
  const nodes = flattenContextTree(context?.currentPage?.componentTree).filter((node) => !node.locked);
  nodes.slice(0, 12).forEach((node) => {
    operations.push(addOperation("update_component", {
      targetId: node.id,
      summary: `Optimize ${node.label || node.type} for mobile`,
      reason: "Improve narrow-screen spacing and prevent cramped layouts.",
      patches: [
        patch("styles.mobile.paddingLeft", "16px"),
        patch("styles.mobile.paddingRight", "16px"),
        patch("styles.mobile.maxWidth", "100%")
      ]
    }));
  });
}

function addReviewFixes(operations, addOperation, context) {
  const issues = auditAIContext(context);
  const capabilities = new Set(context?.capabilities || []);
  const title = titleFromContext(context);
  const nodes = flattenContextTree(context?.currentPage?.componentTree);

  if (issues.some((issue) => issue.category === "seo") && capabilities.has("update_page")) {
    operations.push(addOperation("update_page", {
      summary: "Complete essential SEO metadata",
      reason: "Give search engines a clear title and useful page description.",
      patches: [
        patch("seo.metaTitle", `${title} | Official Website`),
        patch("seo.metaDescription", `Explore ${title}, its services, benefits, and ways to get started.`)
      ]
    }));
  }

  if (issues.some((issue) => issue.category === "responsive") && capabilities.has("update_component")) {
    addResponsiveEdits(operations, addOperation, context);
  }

  const imageNodes = nodes.filter((node) => node.type === "image" && !node.locked);
  imageNodes.forEach((node) => {
    const locale = context?.currentPage?.locale || "en";
    const localized = node.props?.locales?.[locale] || {};
    if (localized.alt || node.props?.alt) return;
    operations.push(addOperation("update_component", {
      targetId: node.id,
      summary: `Add alternative text to ${node.label || "image"}`,
      reason: "Improve accessibility for visitors using screen readers.",
      patches: [patch(`props.locales.${locale}.alt`, `${title} visual`)]
    }));
  });

  if (issues.some((issue) => issue.category === "conversion")) {
    addSections(operations, addOperation, context, ["cta"]);
  }
  return issues;
}

function addCopyEdit(operations, addOperation, context, intent) {
  const match = String(intent).match(/(?:heading|headline|title)(?:\s+text)?\s*(?:to|:)\s*["“']?(.+?)["”']?\s*$/i);
  if (!match) return false;
  const value = match[1].trim();
  const locale = context?.currentPage?.locale || "en";
  const nodes = flattenContextTree(context?.currentPage?.componentTree);
  const selected = context?.currentPage?.selectedComponent;
  const target = selected || nodes.find((node) => ["hero", "heading"].includes(node.type));
  if (!target?.id) return false;
  const field = target.type === "hero" ? "title" : "text";
  operations.push(addOperation("update_component", {
    targetId: target.id,
    summary: "Rewrite the selected heading",
    reason: "Use the exact message requested while preserving the component structure.",
    patches: [patch(`props.locales.${locale}.${field}`, value)]
  }));
  return true;
}

function buildPlan({ intent, context, memory = {}, previousPlan, feedback }) {
  const combinedIntent = [intent, feedback].filter(Boolean).join(". ");
  const text = normalized(combinedIntent);
  const addOperation = operationFactory();
  const operations = [];
  const affected = new Set();
  const capabilities = new Set(context?.capabilities || []);
  const selectedRegion = context?.currentPage?.selectedRegion;
  const color = colorFromIntent(combinedIntent);

  if (color && includesAny(text, ["background", " bg ", "bg colour", "bg color"])) {
    let item = selectedRegion?.type === "section"
      ? selectedRegionOperation(
        addOperation,
        context,
        "background",
        color,
        `Change ${selectedRegion.label || "section"} background to ${color}`,
        "Apply the requested color directly to the selected website section."
      )
      : null;
    if (!item) {
      item = selectedComponentOperation(
        addOperation,
        context,
        "styles.base.background",
        color,
        `Change the selected component background to ${color}`,
        "Apply the requested background without altering page content."
      );
    }
    if (item) {
      operations.push(item);
      affected.add("Selected section");
    } else if (capabilities.has("update_theme")) {
      addThemeOperation(
        operations,
        addOperation,
        [patch("colors.background", color)],
        `Change the website background to ${color}`,
        "Update the shared website background design token."
      );
      affected.add("Theme");
    }
  }

  if (color && includesAny(text, ["text color", "text colour", "font color", "font colour"])) {
    const item = selectedComponentOperation(
      addOperation,
      context,
      "styles.base.color",
      color,
      `Change the selected text color to ${color}`,
      "Apply the requested foreground color to the selected component."
    );
    if (item) operations.push(item);
    else if (capabilities.has("update_theme")) {
      addThemeOperation(
        operations,
        addOperation,
        [patch("colors.text", color)],
        `Change the website text color to ${color}`,
        "Update the shared text color token."
      );
    }
    affected.add("Typography");
  }

  const preset = findPreset(text);
  if (preset && capabilities.has("update_theme")) {
    addThemeOperation(
      operations,
      addOperation,
      themePatches(preset[1]),
      `Apply the ${preset[0]} design system`,
      "Coordinate colors, typography, and buttons as one consistent theme."
    );
    affected.add("Theme");
    affected.add("Typography");
    affected.add("Buttons");
  }

  const sections = requestedSections(text);
  if (addSections(operations, addOperation, context, sections)) {
    sections.forEach((section) => affected.add(section.replaceAll("-", " ")));
  }

  if (includesAny(text, ["mobile", "responsive", "tablet"]) && capabilities.has("update_component")) {
    addResponsiveEdits(operations, addOperation, context);
    affected.add("Responsive layout");
  }

  let issues = [];
  if (includesAny(text, [
    "review", "accessibility", "readability", "improve seo", "conversion",
    "ux issues", "optimize", "optimise"
  ])) {
    issues = addReviewFixes(operations, addOperation, context);
    affected.add("UX review");
  }

  if (includesAny(text, ["reduce whitespace", "less whitespace", "tighten spacing"]) && capabilities.has("update_component")) {
    flattenContextTree(context?.currentPage?.componentTree)
      .filter((node) => !node.locked)
      .slice(0, 12)
      .forEach((node) => operations.push(addOperation("update_component", {
        targetId: node.id,
        summary: `Tighten spacing in ${node.label || node.type}`,
        reason: "Reduce excessive whitespace while retaining readable separation.",
        patches: [
          patch("styles.base.marginTop", "0px"),
          patch("styles.base.marginBottom", "24px")
        ]
      })));
    affected.add("Spacing");
  }

  if (includesAny(text, ["seo", "meta title", "meta description"]) && capabilities.has("update_page")
      && !operations.some((item) => item.type === "update_page")) {
    const pageTitle = titleFromContext(context);
    const company = companyFromContext(context, memory);
    operations.push(addOperation("update_page", {
      summary: "Improve page SEO metadata",
      reason: "Clarify the page topic for search results and link previews.",
      patches: [
        patch("seo.metaTitle", `${pageTitle} | ${company}`),
        patch("seo.metaDescription", `Discover ${pageTitle} from ${company}. Learn about the benefits, services, and next steps.`)
      ]
    }));
    affected.add("SEO");
  }

  addCopyEdit(operations, addOperation, context, combinedIntent);

  if (!operations.length && previousPlan?.operations?.length && feedback) {
    previousPlan.operations.slice(0, 80).forEach((item) => operations.push({ ...item }));
    affected.add("Modified plan");
  }

  if (!operations.length && capabilities.has("update_theme")) {
    const currentPrimary = context?.designSystem?.theme?.colors?.primary || "#2563eb";
    addThemeOperation(
      operations,
      addOperation,
      [
        patch("colors.primary", currentPrimary),
        patch("buttons.borderRadius", "10px"),
        patch("buttons.fontWeight", "700")
      ],
      "Polish the current design system",
      "Improve interface consistency while preserving the existing brand color."
    );
    affected.add("Theme");
  }

  const risk = operations.some((item) => [
    "remove_component", "replace_source_file", "create_source_file"
  ].includes(item.type))
    ? "high"
    : operations.length > 6
      ? "medium"
      : "low";
  const modified = Boolean(previousPlan && feedback);
  const areas = Array.from(affected);

  return {
    schemaVersion: 1,
    title: modified ? "Revised Rocket plan" : "Rocket page improvement plan",
    summary: operations.length
      ? `${operations.length} coordinated local edit${operations.length === 1 ? "" : "s"} prepared from the complete editable page model.`
      : "No safe editable operation matched this request.",
    assistantMessage: operations.length
      ? `I prepared ${operations.length} local edit${operations.length === 1 ? "" : "s"}. Review the plan, then approve it to update the draft.`
      : "I could not map that request to a safe editable field on this page. Select a component or section and describe the exact result.",
    risk,
    estimatedEdits: operations.length,
    requiresApproval: true,
    affectedAreas: areas.length ? areas : ["Page"],
    preserved: context?.constraints?.preserveWebsiteShell
      ? ["Connected website header", "Connected website footer", "Brand assets"]
      : ["Existing content", "Brand assets", "Revision history"],
    validationChecks: [
      "Editable-target validity",
      "Responsive layout",
      "Color contrast",
      "Draft rollback safety",
      ...(issues.length ? [`${issues.length} detected UX issue${issues.length === 1 ? "" : "s"}`] : [])
    ],
    operations
  };
}

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function captureFeedback(value) {
  const target = storage();
  if (!target) return false;
  const existing = JSON.parse(target.getItem(FEEDBACK_KEY) || "[]");
  const record = {
    capturedAt: Date.now(),
    intent: String(value.intent || "").slice(0, 1000),
    surface: value.context?.editorSurface || "unknown",
    pageType: value.context?.currentPage?.record?.type || "page",
    operations: (value.plan?.operations || []).map((operation) => ({
      type: operation.type,
      componentType: operation.componentType,
      patches: operation.patches?.map((item) => item.path) || []
    })),
    results: (value.results || []).map((result) => ({
      type: result.type,
      status: result.status
    })),
    validationCount: value.validation?.length || 0
  };
  target.setItem(FEEDBACK_KEY, JSON.stringify([...existing.slice(-49), record]));
  return true;
}

function xml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function base64Utf8(value) {
  if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  throw new Error("This browser cannot encode the locally generated artwork.");
}

function proceduralImage(prompt, brandContext = {}) {
  const colors = brandContext?.theme?.colors || {};
  const primary = colors.primary || "#7c3aed";
  const accent = colors.accent || "#22d3ee";
  const background = colors.background || "#080b14";
  const seed = Array.from(String(prompt)).reduce((sum, char) => (
    (sum * 31 + char.charCodeAt(0)) >>> 0
  ), 2166136261);
  const circles = Array.from({ length: 12 }, (_, index) => {
    const x = (seed * (index + 3) * 17) % 1200;
    const y = (seed * (index + 5) * 29) % 800;
    const radius = 28 + ((seed + index * 41) % 150);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="url(#glow)" opacity="${0.08 + (index % 4) * 0.05}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${xml(background)}"/><stop offset="1" stop-color="#050816"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="${xml(primary)}"/><stop offset="1" stop-color="${xml(accent)}" stop-opacity="0"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="34"/></filter>
    </defs>
    <rect width="1200" height="800" fill="url(#bg)"/>
    <g filter="url(#blur)">${circles}</g>
    <path d="M-80 620 C260 390 470 760 760 500 S1180 300 1320 470" fill="none" stroke="${xml(primary)}" stroke-width="3" opacity=".65"/>
    <path d="M-120 690 C220 460 520 790 820 560 S1160 420 1300 520" fill="none" stroke="${xml(accent)}" stroke-width="1.5" opacity=".55"/>
    <text x="72" y="710" fill="#ffffff" opacity=".72" font-family="Inter,Arial,sans-serif" font-size="22">${xml(String(prompt).slice(0, 72))}</text>
  </svg>`;
  return {
    imageBase64: base64Utf8(svg),
    mimeType: "image/svg+xml",
    model: `${MODEL_NAME}-procedural-image`
  };
}

export const rocketLocalEngine = {
  async createPlan(input) {
    const plan = buildPlan(input);
    return {
      plan,
      model: MODEL_NAME,
      requestId: requestId(),
      usage: {
        runtime: "browser",
        networkRequests: 0,
        contextComponents: input.context?.currentPage?.flattenedComponentIndex?.length || 0,
        plannedOperations: plan.operations.length
      }
    };
  },

  async generateImage({ prompt, brandContext }) {
    return proceduralImage(prompt, brandContext);
  },

  async recordFeedback(value) {
    return { accepted: true, captured: captureFeedback(value), model: MODEL_NAME };
  }
};

export default rocketLocalEngine;
