import { auditAIContext, flattenContextTree } from "./aiWebsiteContextService";

const MODEL_RELEASES = Object.freeze([
  Object.freeze({
    releaseId: "rocket-ai-ultra",
    name: "Rocket AI Ultra",
    version: "1.5",
    description: "Adaptive full-context planning, visual generation, and coordinated page editing"
  })
]);
const DEFAULT_MODEL_RELEASE = "rocket-ai-ultra";
const MODEL_PREFERENCE_VERSION = 2;
const FEEDBACK_KEY = "reactcms_rocket_embedded_curriculum_v1";
const MODEL_STATE_KEY = "reactcms_rocket_embedded_model_state_v1";

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

const ACRONYM_EXPANSIONS = Object.freeze({
  ai: "Artificial Intelligence",
  api: "Application Programming Interface",
  cms: "Content Management System",
  crm: "Customer Relationship Management",
  cta: "Call to Action",
  faq: "Frequently Asked Questions",
  http: "Hypertext Transfer Protocol",
  https: "Hypertext Transfer Protocol Secure",
  kpi: "Key Performance Indicator",
  roi: "Return on Investment",
  saas: "Software as a Service",
  seo: "Search Engine Optimization",
  ui: "User Interface",
  url: "Uniform Resource Locator",
  ux: "User Experience"
});

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

function readStoredJson(key, fallback) {
  const target = storage();
  if (!target) return fallback;
  try {
    const parsed = JSON.parse(target.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function modelRelease(modelId) {
  const requested = String(modelId || "").trim().toLowerCase();
  return MODEL_RELEASES.find((release) => (
    release.releaseId === requested
    || `${release.releaseId}-${release.version}` === requested
  )) || MODEL_RELEASES.find((release) => release.releaseId === DEFAULT_MODEL_RELEASE);
}

function currentModelInfo(preferredModelId = "") {
  const state = readStoredJson(MODEL_STATE_KEY, {});
  const storedPreference = state.modelPreferenceVersion === MODEL_PREFERENCE_VERSION
    ? state.activeModel
    : "";
  const release = modelRelease(preferredModelId || storedPreference);
  const curriculumRevision = Math.max(0, Number(state.curriculumRevision) || 0);
  const trainedExamples = Math.max(0, Number(state.trainedExamples) || 0);
  const interactionCount = Math.max(0, Number(state.interactionCount) || 0);
  const version = curriculumRevision
    ? `${release.version}.${curriculumRevision}`
    : release.version;
  const contextCoverage = Math.min(100, Math.max(0, Number(state.contextCoverage) || 0));
  const learningProgress = Math.min(100, Math.round(
    18
    + Math.min(42, interactionCount * 4)
    + Math.min(25, trainedExamples * 3)
    + contextCoverage * 0.15
  ));
  return {
    id: `${release.releaseId}-${version}`,
    releaseId: release.releaseId,
    name: release.name,
    version,
    baseVersion: release.version,
    nextVersion: `${release.version}.${curriculumRevision + 1}`,
    description: release.description,
    curriculumRevision,
    trainedExamples,
    interactionCount,
    contextCoverage,
    learningProgress,
    lastIntent: String(state.lastIntent || ""),
    updatedAt: Number(state.updatedAt) || null,
    runtime: "browser",
    trainingMode: "full-context adaptive curriculum"
  };
}

function chooseActiveModel(modelId) {
  const release = modelRelease(modelId);
  const target = storage();
  if (!target) return currentModelInfo(release.releaseId);
  const previousState = readStoredJson(MODEL_STATE_KEY, {});
  target.setItem(MODEL_STATE_KEY, JSON.stringify({
    ...previousState,
    activeModel: release.releaseId,
    modelPreferenceVersion: MODEL_PREFERENCE_VERSION,
    updatedAt: Date.now()
  }));
  return currentModelInfo(release.releaseId);
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

const NAMED_COLORS = Object.freeze({
  "off white": "#f8fafc",
  "dark gray": "#1f2937",
  "dark grey": "#1f2937",
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  grey: "#6b7280",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899"
});

function colorFromIntent(intent) {
  const source = String(intent || "");
  const matches = source.match(/#[0-9a-f]{3,8}\b/gi);
  if (matches?.length) return matches.at(-1);

  const text = normalized(source);
  const namedMatch = Object.entries(NAMED_COLORS)
    .map(([name, value]) => ({ name, value, index: text.lastIndexOf(name) }))
    .filter(({ index, name }) => (
      index >= 0
      && new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)
    ))
    .sort((left, right) => right.index - left.index)[0];
  return namedMatch?.value || "";
}

function requestsTextColorChange(intent) {
  const text = normalized(intent);
  return Boolean(colorFromIntent(intent))
    && /\bcolou?r\b/.test(text)
    && !includesAny(text, ["background", " bg ", "bg colour", "bg color"]);
}

function comparableText(value) {
  return normalized(value)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function requestedTextColorSubject(intent) {
  const text = normalized(intent);
  const descriptor = "(?:text|font|copy|heading|headline|title|label|words?)";
  const action = "(?:change|set|make|turn|update)";
  const beforeAction = text.match(new RegExp(
    `^(.+?)\\s+(?:${descriptor}\\s+)?${action}\\b`
  ));
  const afterAction = text.match(new RegExp(
    `^${action}\\s+(?:the\\s+)?(.+?)\\s+(?:${descriptor}\\s+)?colou?r\\b`
  ));
  const subject = comparableText(beforeAction?.[1] || afterAction?.[1] || "")
    .replace(/^(?:the|this|that)\s+/, "")
    .trim();
  return ["", "selected", "selection", "current", "active"].includes(subject)
    ? ""
    : subject;
}

function requestsFullPageScope(intent) {
  const text = normalized(intent);
  return includesAny(text, [
    "full page",
    "whole page",
    "entire page",
    "across the page",
    "all sections",
    "every section",
    "all modules",
    "every module",
    "not only one",
    "not just one",
    "do it everywhere",
    "apply everywhere"
  ]);
}

function previousUserIntent(conversation, predicate) {
  if (!Array.isArray(conversation)) return "";
  return [...conversation].reverse().find((message) => (
    message?.role === "user"
    && typeof message.content === "string"
    && predicate(message.content)
  ))?.content || "";
}

function resolveContextualIntent(intent, conversation = []) {
  const directIntent = String(intent || "").trim();
  const directText = normalized(directIntent);
  const needsBackgroundContext = requestsFullPageScope(directText)
    && (!colorFromIntent(directIntent) || !directText.includes("background"));
  if (!needsBackgroundContext) {
    return { directIntent, resolvedIntent: directIntent, carriedForward: false };
  }

  const previous = previousUserIntent(conversation, (content) => {
    const text = normalized(content);
    return Boolean(colorFromIntent(content))
      && includesAny(text, ["background", " bg ", "bg colour", "bg color"]);
  });
  if (!previous) {
    return { directIntent, resolvedIntent: directIntent, carriedForward: false };
  }
  return {
    directIntent,
    resolvedIntent: `${previous}. Follow-up instruction: ${directIntent}`,
    carriedForward: true
  };
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

function selectedRegions(context, type = "") {
  const page = context?.currentPage || {};
  const regions = Array.isArray(page.selectedRegions) && page.selectedRegions.length
    ? page.selectedRegions
    : page.selectedRegion
      ? [page.selectedRegion]
      : [];
  return Array.from(new Map(regions
    .filter((region) => region?.regionId && (!type || region.type === type))
    .map((region) => [region.regionId, region])).values());
}

function selectedComponents(context, type = "") {
  const page = context?.currentPage || {};
  const components = Array.isArray(page.selectedComponents) && page.selectedComponents.length
    ? page.selectedComponents
    : page.selectedComponent
      ? [page.selectedComponent]
      : [];
  return Array.from(new Map(components
    .filter((component) => component?.id && (!type || component.type === type))
    .map((component) => [component.id, component])).values());
}

function regionOperations(addOperation, context, field, value, summary, reason, type = "") {
  const page = context?.currentPage || {};
  const capabilities = new Set(context?.capabilities || []);
  if (!capabilities.has("update_region")) return [];
  const definitions = page.editableRegionDefinitions || {};
  const values = page.editableRegionValues || {};
  const candidates = Object.entries(definitions)
    .filter(([, definition]) => !type || definition?.type === type)
    .map(([regionId]) => regionId);
  if (type === "section") {
    Object.entries(values).forEach(([regionId, regionValue]) => {
      if (
        regionValue
        && typeof regionValue === "object"
        && ("background" in regionValue || "paddingY" in regionValue)
        && !candidates.includes(regionId)
      ) candidates.push(regionId);
    });
  }
  const selectedIds = selectedRegions(context, type).map((region) => region.regionId);
  const fallbackId = candidates.find((id) => /(?:^|[._-])hero(?:$|[._-])/i.test(id))
    || candidates.find((id) => /(?:main|page|content|body)/i.test(id))
    || candidates[0];
  const regionIds = selectedIds.length ? selectedIds : fallbackId ? [fallbackId] : [];
  return regionIds.map((regionId) => addOperation("update_region", {
    targetId: regionId,
    summary,
    reason,
    patches: [patch(`value.${field}`, value)]
  }));
}

function sectionRegionEntries(context) {
  const page = context?.currentPage || {};
  const definitions = page.editableRegionDefinitions || {};
  const values = page.editableRegionValues || {};
  const entries = new Map();

  Object.entries(definitions).forEach(([regionId, definition]) => {
    if (definition?.type !== "section") return;
    entries.set(regionId, definition);
  });
  Object.entries(values).forEach(([regionId, regionValue]) => {
    if (
      entries.has(regionId)
      || !regionValue
      || typeof regionValue !== "object"
      || Array.isArray(regionValue)
      || (!("background" in regionValue) && !("paddingY" in regionValue))
    ) return;
    entries.set(regionId, { type: "section", label: regionId });
  });
  return Array.from(entries.entries()).slice(0, 79);
}

function pageSectionOperations(addOperation, context, color) {
  if (!(context?.capabilities || []).includes("update_region")) return [];
  return sectionRegionEntries(context).map(([regionId, definition]) => addOperation("update_region", {
    targetId: regionId,
    summary: `Change ${definition?.label || regionId} background to ${color}`,
    reason: "Apply the requested page background consistently across every editable section.",
    patches: [patch("value.background", color)]
  }));
}

function selectedComponentOperations(addOperation, context, path, value, summary, reason) {
  const capabilities = new Set(context?.capabilities || []);
  if (!capabilities.has("update_component")) return [];
  return selectedComponents(context).map((selected) => addOperation("update_component", {
    targetId: selected.id,
    summary,
    reason,
    patches: [patch(path, value)]
  }));
}

function requestsVisualReferenceRemoval(intent, context) {
  const text = normalized(intent);
  const hasVisualReference = Boolean(context?.currentPage?.visualReferences?.length)
    || includesAny(text, [
      "screenshot is attached as a visual reference",
      "image is attached as a visual reference",
      "uploaded screenshot",
      "visual reference"
    ]);
  return hasVisualReference
    && /\b(?:remove|delete|hide)\b/.test(text)
    && /\b(?:this|shown|pictured|highlighted|duplicate|extra|second|area|section|component|block)\b/.test(text);
}

function componentDuplicateSignature(node) {
  return JSON.stringify({
    type: node?.type || "",
    label: node?.label || "",
    props: node?.props || {},
    styles: node?.styles || {},
    children: (node?.children || []).map(componentDuplicateSignature)
  });
}

function duplicateComponentCandidates(tree) {
  const candidates = [];
  const visit = (children, depth = 0) => {
    const seen = new Map();
    (children || []).forEach((node, siblingIndex) => {
      const signature = componentDuplicateSignature(node);
      if (seen.has(signature) && node?.id && !node.locked) {
        candidates.push({ node, depth, siblingIndex });
      } else {
        seen.set(signature, node);
      }
      visit(node?.children, depth + 1);
    });
  };
  visit(tree?.children);
  return candidates.sort((left, right) => (
    left.depth - right.depth || right.siblingIndex - left.siblingIndex
  ));
}

function visualReferenceRemovalOperations(addOperation, context, intent) {
  const capabilities = new Set(context?.capabilities || []);
  if (
    !requestsVisualReferenceRemoval(intent, context)
    || !capabilities.has("remove_component")
  ) return [];

  const target = duplicateComponentCandidates(context?.currentPage?.componentTree)[0]?.node;
  if (!target) return [];
  const locale = context?.currentPage?.locale || "en";
  const title = target.props?.locales?.[locale]?.title
    || target.label
    || target.type
    || "duplicate area";
  return [addOperation("remove_component", {
    targetId: target.id,
    summary: `Remove duplicate ${title}`,
    reason: "Match the structural screenshot request to the repeated editable component and remove only its later duplicate.",
    patches: []
  })];
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
  const requestsImageCollection = /\b(?:images|photos|pictures|illustrations|artworks|visuals)\b/.test(text)
    || /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:\w+\s+){0,3}(?:image|photo|picture|illustration|artwork|visual)s?\b/.test(text);
  if (requestsImageCollection && /\b(?:contents?|captions?|gallery|collection|grid|field|section|block)\b/.test(text)) {
    return ["gallery"];
  }
  const beforeFooter = /\b(?:above|before)\s+(?:the\s+)?footer\b/.test(text);
  const requested = SECTION_TERMS
    .filter(([type, terms]) => (
      !(type === "footer" && beforeFooter) && includesAny(text, terms)
    ))
    .map(([type]) => type);
  if (requested.length) return requested;
  if (/\b(?:api|apis|advertising|advertisement|ad campaign|ad campaigns|ads)\b/.test(text)) {
    return ["features"];
  }
  if (/\b(?:message|description|notes?)\s+(?:input\s+)?field\b/.test(text)) {
    return ["textarea-field"];
  }
  if (/\b(?:dropdown|select)\s+(?:input\s+)?field\b/.test(text)) {
    return ["select-field"];
  }
  if (/\bcheckbox(?:\s+field)?\b/.test(text)) return ["checkbox"];
  if (/\b(?:input\s+field|form\s+field|email\s+field|phone\s+field|new\s+field|fields?)\b/.test(text)) {
    return ["input"];
  }
  if (/\b(?:component|section|block)\b/.test(text)) return ["section"];
  return [];
}

function generatedGalleryItems(context) {
  const prepared = context?.currentPage?.preparedGeneratedAssets;
  if (!Array.isArray(prepared)) return [];
  return prepared.slice(0, 12).map((asset, index) => ({
    id: asset.id || `generated-image-${index + 1}`,
    src: asset.url,
    alt: asset.alt || `Advertisement visual ${index + 1}`,
    caption: asset.caption || asset.description || `Campaign visual ${index + 1}`,
    title: asset.title || `Campaign visual ${index + 1}`,
    description: asset.description || asset.caption || "Generated for this advertising campaign."
  })).filter((asset) => asset.src);
}

function componentIntentPatches(type, intent, locale, context) {
  const text = normalized(intent);
  if (type === "gallery") {
    const images = generatedGalleryItems(context);
    if (!images.length) return [];
    return [
      patch(`props.locales.${locale}.title`, "Advertising Campaign Gallery"),
      patch(
        `props.locales.${locale}.subtitle`,
        `${images.length} coordinated campaign visual${images.length === 1 ? "" : "s"} with matching page content.`
      ),
      patch("props.images", images),
      patch("props.columns", images.length >= 3 ? "3" : String(Math.max(1, images.length))),
      patch("props.gap", 18)
    ];
  }
  if (
    type === "features"
    && /\b(?:api|apis|advertising|advertisement|ad campaign|ad campaigns|ads)\b/.test(text)
  ) {
    return [
      patch(`props.locales.${locale}.title`, "API-Powered Advertising"),
      patch(
        `props.locales.${locale}.subtitle`,
        "Connect advertising platforms, automate campaign workflows, and turn live performance data into measurable growth."
      ),
      patch(`props.locales.${locale}.items`, [
        {
          title: "Advertising API Integration",
          description: "Connect Google, Meta, and other campaign APIs through one reliable integration layer."
        },
        {
          title: "Campaign Automation",
          description: "Synchronize audiences, budgets, creatives, and reporting without repetitive manual work."
        },
        {
          title: "Real-Time Ad Insights",
          description: "Monitor performance data and use actionable analytics to improve return on ad spend."
        }
      ])
    ];
  }
  if (["input", "textarea-field", "select-field", "checkbox"].includes(type)) {
    const label = text.match(/\b(email|phone|name|company|website|budget|message|description|notes?)\b/)?.[1];
    if (!label) return [];
    const fieldLabel = label.charAt(0).toUpperCase() + label.slice(1);
    return [
      patch(`props.locales.${locale}.label`, fieldLabel),
      ...(["input", "textarea-field"].includes(type)
        ? [patch(`props.locales.${locale}.placeholder`, `Enter ${label}`)]
        : [])
    ];
  }
  return [];
}

function selectedRelativePlacement(intent) {
  const text = normalized(intent);
  if (/\b(?:above|before)\s+(?:the\s+)?(?:selected|current|this|active)\s*(?:area|section|component|field|block)?\b/.test(text)) {
    return "before";
  }
  if (/\b(?:below|after)\s+(?:the\s+)?(?:selected|current|this|active)\s*(?:area|section|component|field|block)?\b/.test(text)) {
    return "after";
  }
  if (/\b(?:inside|within|in)\s+(?:the\s+)?(?:selected|current|this|active)\s+(?:area|section|component|field|block)\b/.test(text)) {
    return "inside";
  }
  return "";
}

function runtimePlacementPatches(context, intent) {
  const position = selectedRelativePlacement(intent);
  if (!position) return [];
  const selectedRegion = selectedRegions(context).at(-1);
  if (!selectedRegion?.regionId) return [];
  return [patch("metadata.runtimePlacement", {
    anchorRegionId: selectedRegion.regionId,
    position
  })];
}

function addSections(operations, addOperation, context, types, intent = "") {
  const capabilities = new Set(context?.capabilities || []);
  if (!capabilities.has("insert_component") || !types.length) return false;
  const allowed = new Set(context?.constraints?.registeredComponentTypes || []);
  const roots = context?.currentPage?.componentTree?.children || [];
  const beforeFooter = /\b(?:above|before)\s+(?:the\s+)?footer\b/.test(normalized(intent));
  const footer = beforeFooter ? roots.find((node) => node.type === "footer") : null;
  const relativePosition = selectedRelativePlacement(intent);
  const selectedTreeNode = selectedComponents(context)
    .map((selected) => flattenContextTree(context?.currentPage?.componentTree)
      .find((node) => node.id === selected.id))
    .find(Boolean);
  let targetId = selectedTreeNode?.id || footer?.id || roots.at(-1)?.id || null;
  let position = selectedTreeNode && relativePosition
    ? relativePosition
    : footer ? "before" : "after";
  let inserted = 0;
  const locale = context?.currentPage?.locale || "en";
  const placementPatches = selectedTreeNode?.metadata?.runtimePlacement
    ? [patch("metadata.runtimePlacement", selectedTreeNode.metadata.runtimePlacement)]
    : runtimePlacementPatches(context, intent);

  types.forEach((type) => {
    if (allowed.size && !allowed.has(type)) return;
    const item = addOperation("insert_component", {
      targetId,
      position,
      componentType: type,
      summary: `Add ${type.replaceAll("-", " ")} section`,
      reason: "Build the requested page structure with a native editable component.",
      patches: [
        patch("label", type.split("-").map((part) => (
          part.charAt(0).toUpperCase() + part.slice(1)
        )).join(" ")),
        ...placementPatches,
        ...componentIntentPatches(type, intent, locale, context)
      ]
    });
    operations.push(item);
    targetId = `$op:${item.id}`;
    position = "after";
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

function selectedRegionCopyOperations(addOperation, context, intent) {
  const targets = selectedRegions(context).filter((selected) => (
    ["text", "richtext", "button"].includes(selected.type)
  ));
  const capabilities = new Set(context?.capabilities || []);
  if (
    !targets.length
    || !capabilities.has("update_region")
  ) return [];

  const text = normalized(intent);
  if (requestsTextColorChange(intent)) return [];
  if (includesAny(text, [
    "background", "text color", "text colour", "font color", "font colour",
    "font size", "image", "photo", "picture", "media asset", "link url", "href"
  ])) return [];

  const source = String(intent).trim();
  const selected = targets[targets.length - 1];
  const currentText = typeof selected.value === "object" && selected.value
    ? selected.value.text
    : selected.value;
  const selectedAcronym = normalized(currentText).replace(/[^a-z0-9]/g, "");
  const promptAcronym = Object.keys(ACRONYM_EXPANSIONS).find((acronym) => (
    new RegExp(`\\b${acronym}\\b`, "i").test(source)
  ));
  const asksForExpansion = /\b(full\s*form|spell\s*(?:it\s*)?out|expand(?:\s+the)?\s+acronym)\b/i.test(source);
  const expandedValue = asksForExpansion
    ? ACRONYM_EXPANSIONS[selectedAcronym] || ACRONYM_EXPANSIONS[promptAcronym]
    : "";
  const replacement = source.match(
    /\b(?:change|replace|set|update|rewrite)\b[\s\S]*?\b(?:to|as)\s+["'“]?([\s\S]+?)["'”]?\s*$/i
  ) || source.match(
    /\b(?:make|have)\b[\s\S]*?\b(?:say|read)\s+["'“]?([\s\S]+?)["'”]?\s*$/i
  ) || source.match(
    /^(?:text|copy|heading|headline|title|label|button)\s*:\s*["'“]?([\s\S]+?)["'”]?\s*$/i
  );
  const value = expandedValue || replacement?.[1]?.trim();
  if (!value) return [];

  return targets.map((target) => {
    let path = "value";
    if (target.type === "button") {
      path = target.value && typeof target.value === "object"
        ? "value.text"
        : "value";
    } else if (
      target.type === "text"
      && target.value
      && typeof target.value === "object"
    ) {
      path = "value.text";
    }
    const patchValue = target.type === "button" && path === "value"
      ? { text: value }
      : value;

    return addOperation("update_region", {
      targetId: target.regionId,
      summary: `Rewrite ${target.label || "selected content"}`,
      reason: "Apply the requested copy to the selected areas attached to this chat.",
      patches: [patch(path, patchValue)]
    });
  });
}

function editableTextRegionEntries(context) {
  const page = context?.currentPage || {};
  const definitions = page.editableRegionDefinitions || {};
  const values = page.editableRegionValues || {};
  return Object.entries(definitions)
    .filter(([, definition]) => (
      ["text", "richtext", "button"].includes(definition?.type)
    ))
    .map(([regionId, definition]) => ({
      regionId,
      type: definition.type,
      label: definition.label || regionId,
      value: values[regionId] ?? definition.value ?? definition.defaultValue ?? ""
    }));
}

function namedEditableTextTargets(context, intent) {
  const subject = requestedTextColorSubject(intent);
  if (!subject) return [];
  return editableTextRegionEntries(context)
    .map((region) => {
      const value = region.value && typeof region.value === "object"
        ? region.value.text
        : region.value;
      const candidate = comparableText(value);
      const matches = candidate.length >= 3
        && (candidate.includes(subject) || subject.includes(candidate));
      return { ...region, candidate, matches };
    })
    .filter((region) => region.matches)
    .sort((left, right) => right.candidate.length - left.candidate.length)
    .slice(0, 1);
}

function selectedRegionTextColorOperations(
  addOperation,
  context,
  intent,
  color,
  namedOnly = false
) {
  const namedTargets = namedEditableTextTargets(context, intent);
  const targets = namedTargets.length
    ? namedTargets
    : namedOnly
      ? []
      : selectedRegions(context).filter((selected) => (
        ["text", "richtext", "button"].includes(selected.type)
      ));
  const capabilities = new Set(context?.capabilities || []);
  if (
    !color
    || !targets.length
    || !capabilities.has("update_region")
  ) return [];

  return targets.map((selected) => {
    const currentValue = selected.value;
    const nextValue = currentValue && typeof currentValue === "object"
      ? { ...currentValue, color }
      : { text: String(currentValue ?? ""), color };
    return addOperation("update_region", {
      targetId: selected.regionId,
      summary: `Change ${selected.label || "selected text"} color to ${color}`,
      reason: "Apply the requested color to the selected editable areas attached to this chat.",
      patches: [patch("value", nextValue)]
    });
  });
}

function sourceTextColorOperations(addOperation, context, intent, color) {
  const capabilities = new Set(context?.capabilities || []);
  const files = context?.sourceProject?.files || {};
  const subject = requestedTextColorSubject(intent);
  if (!capabilities.has("replace_source_file") || !subject) return [];

  const elementPattern = /<([a-z][\w.-]*)\b([^>]*\bstyle\s*=\s*\{\{[^>]*?\}\}[^>]*)>([^<>{}\r\n]{2,180})<\/\1>/gi;
  const candidates = [];
  Object.entries(files).forEach(([path, contentValue]) => {
    const content = String(contentValue ?? "");
    if (!content || content.includes("/* ReactCMS context truncated */")) return;
    let match;
    while ((match = elementPattern.exec(content))) {
      const visibleText = comparableText(match[3]);
      if (
        visibleText.length >= 3
        && (visibleText.includes(subject) || subject.includes(visibleText))
      ) {
        candidates.push({
          path,
          content,
          index: match.index,
          source: match[0],
          visibleText
        });
      }
    }
  });
  const target = candidates
    .sort((left, right) => right.visibleText.length - left.visibleText.length)[0];
  if (!target) return [];

  const colorProperty = /(\bcolor\s*:\s*)(["'`])(?:\\.|(?!\2)[\s\S])*?\2/;
  let nextElement = colorProperty.test(target.source)
    ? target.source.replace(colorProperty, (_match, prefix, quote) => (
      `${prefix}${quote}${color}${quote}`
    ))
    : target.source.replace(
      /(style\s*=\s*\{\{)([\s\S]*?)(\}\})/,
      (_match, opening, styles, closing) => (
        `${opening}${styles.trimEnd()}${styles.trim() ? ", " : ""}color: '${color}'${closing}`
      )
    );
  if (nextElement === target.source) return [];

  const nextContent = `${target.content.slice(0, target.index)}${nextElement}${target.content.slice(
    target.index + target.source.length
  )}`;
  return [addOperation("replace_source_file", {
    targetId: target.path,
    summary: `Change ${subject} text color to ${color}`,
    reason: "Update the explicitly named static website text without changing unrelated editable copy.",
    patches: [patch("content", nextContent)]
  })];
}

function requestsSingleLineText(intent) {
  const text = normalized(intent);
  return /\b(?:one|single)\s*[- ]?line\b/.test(text)
    || /\bno\s*[- ]?wrap\b/.test(text)
    || /\bnowrap\b/.test(text)
    || /\b(?:do\s+not|don'?t)\s+wrap\b/.test(text);
}

function selectedRegionSingleLineOperations(addOperation, context, intent) {
  if (!requestsSingleLineText(intent)) return [];
  const capabilities = new Set(context?.capabilities || []);
  if (!capabilities.has("update_region")) return [];

  const page = context?.currentPage || {};
  const selectedTextTargets = selectedRegions(context).filter((selected) => (
    ["text", "richtext"].includes(selected.type)
  ));
  if (!selectedTextTargets.length) return [];

  const requestsEveryTarget = /\b(?:all|both|every)\b/.test(normalized(intent));
  const activeTarget = page.selectedRegion?.regionId
    ? selectedTextTargets.find((target) => target.regionId === page.selectedRegion.regionId)
    : null;
  const targets = requestsEveryTarget
    ? selectedTextTargets
    : [activeTarget || selectedTextTargets.at(-1)];

  return targets.map((target) => {
    const currentValue = target.value;
    const nextValue = currentValue && typeof currentValue === "object"
      ? { ...currentValue }
      : { text: String(currentValue ?? "") };
    nextValue.text = String(nextValue.text ?? "").replace(/\s+/g, " ").trim();

    const currentFontSize = Number.parseFloat(
      nextValue.fontSize || target.computedStyle?.fontSize || ""
    );
    const estimatedFontSize = Math.floor(800 / Math.max(1, nextValue.text.length * 0.58));
    const desktopFontSize = Math.max(16, Math.min(
      32,
      estimatedFontSize,
      Number.isFinite(currentFontSize) ? Math.floor(currentFontSize * 0.9) : 32
    ));
    nextValue.fontSize = `${desktopFontSize}px`;
    nextValue.fontSizeTablet = nextValue.fontSizeTablet || `${Math.min(desktopFontSize, 28)}px`;
    nextValue.fontSizeMobile = nextValue.fontSizeMobile || `${Math.min(desktopFontSize, 22)}px`;
    nextValue.width = "100%";
    nextValue.maxWidth = "100%";
    nextValue.whiteSpaceDesktop = "nowrap";
    nextValue.overflowWrapDesktop = "normal";
    nextValue.wordBreakDesktop = "normal";

    return addOperation("update_region", {
      targetId: target.regionId,
      summary: `Keep ${target.label || "selected heading"} on one line`,
      reason: "Fit the active text within its desktop area while preserving responsive wrapping on smaller screens.",
      patches: [patch("value", nextValue)]
    });
  });
}

function mediaAssetFromIntent(intent, context) {
  const assets = Array.isArray(context?.contentSystem?.assets)
    ? context.contentSystem.assets
    : [];
  const idMatch = String(intent).match(/media\s+asset(?:\s+with)?\s+id\s*["'“”]?([^"'“”\s,;.]+)/i);
  if (idMatch) {
    const byId = assets.find((asset) => String(asset?.id) === idMatch[1]);
    if (byId) return byId;
  }
  const text = normalized(intent);
  return assets.find((asset) => {
    const name = normalized(asset?.name || asset?.title || asset?.fileName);
    return name.length >= 3 && text.includes(name);
  }) || null;
}

function selectedImageTargets(context, allowProminent = false) {
  const page = context?.currentPage || {};
  const targets = [
    ...selectedRegions(context, "image").map((target) => ({ kind: "region", target })),
    ...selectedComponents(context, "image").map((target) => ({ kind: "component", target }))
  ];
  if (targets.length || !allowProminent) return targets;
  const definitions = page.editableRegionDefinitions || {};
  const entries = Object.entries(definitions).filter(([, definition]) => definition?.type === "image");
  const entry = entries.find(([regionId]) => /(?:hero|banner|cover|main)/i.test(regionId)) || entries[0];
  return entry ? [{
    kind: "region",
    target: {
      regionId: entry[0],
      type: "image",
      label: entry[1]?.label || entry[0],
      value: page.editableRegionValues?.[entry[0]]
    }
  }] : [];
}

function selectedImageTarget(context, allowProminent = false) {
  return selectedImageTargets(context, allowProminent)[0] || null;
}

function imageOperations(addOperation, context, intent) {
  const text = normalized(intent);
  if (!includesAny(text, ["image", "photo", "picture", "media asset"])) return [];
  const prepared = context?.currentPage?.preparedImageAssignments;
  if (Array.isArray(prepared) && prepared.length) {
    const locale = context?.currentPage?.locale || "en";
    return prepared.map((assignment) => addOperation(
      assignment.kind === "component" ? "update_component" : "update_region",
      assignment.kind === "component"
        ? {
          targetId: assignment.targetId,
          summary: `Replace ${assignment.label || "selected image"}`,
          reason: "Write the prepared image result to its selected component.",
          patches: [
            patch("props.src", assignment.url),
            patch(`props.locales.${locale}.alt`, assignment.alt || "Website image")
          ]
        }
        : {
          targetId: assignment.targetId,
          summary: `Replace ${assignment.label || "selected image"}`,
          reason: "Write the prepared image result to its selected editable image area.",
          patches: [
            patch("value.src", assignment.url),
            patch("value.alt", assignment.alt || "Website image")
          ]
        }
    ));
  }
  const asset = mediaAssetFromIntent(intent, context);
  const urlMatch = String(intent).match(/https:\/\/[^\s"'<>]+/i);
  const source = asset?.url || urlMatch?.[0] || "";
  if (!source) return [];
  const allowProminent = includesAny(text, ["prominent", "hero", "most appropriate"]);
  const imageTargets = selectedImageTargets(context, allowProminent);
  if (!imageTargets.length) return [];
  const alt = String(
    asset?.alt
    || asset?.name
    || context?.currentPage?.record?.title
    || "Website image"
  ).trim();

  const locale = context?.currentPage?.locale || "en";
  return imageTargets.map((imageTarget) => imageTarget.kind === "region"
    ? addOperation("update_region", {
      targetId: imageTarget.target.regionId,
      summary: `Replace ${imageTarget.target.label || "selected image"}`,
      reason: "Use the requested media asset in the selected editable image area.",
      patches: [
        patch("value.src", source),
        patch("value.alt", alt)
      ]
    })
    : addOperation("update_component", {
      targetId: imageTarget.target.id,
      summary: `Replace ${imageTarget.target.label || "selected image"}`,
      reason: "Use the requested media asset in the selected image component.",
      patches: [
        patch("props.src", source),
        patch(`props.locales.${locale}.alt`, alt)
      ]
    }));
}

function conversationalReply(intent, context) {
  const text = normalized(intent);
  const assets = Array.isArray(context?.contentSystem?.assets)
    ? context.contentSystem.assets
    : [];
  const logoAsset = assets.find((asset) => (
    /logo|brandmark|wordmark/i.test(String(
      asset?.name || asset?.title || asset?.fileName || asset?.alt || ""
    ))
  ));

  if (includesAny(text, ["logo not showing", "logo is not showing", "missing logo", "logo missing", "head logo", "header logo"])) {
    if (context?.constraints?.preserveWebsiteShell) {
      return logoAsset
        ? `I found a logo-like asset (${logoAsset.name || logoAsset.title || logoAsset.fileName || "brand asset"}), but the header belongs to the connected website shell and is not exposed as an editable field on this page. The likely issue is the Header component's asset path or render logic; expose the logo with EditableImage or update the connected Header source so I can change it safely.`
        : "The header belongs to the connected website shell and is not exposed as an editable field on this page. I also do not see a logo-named CMS asset, so check the connected Header component's logo import/path or add the logo to Media and expose it with EditableImage.";
    }
    return "The header logo is not represented by an editable image in the current page model. Select an exposed logo image, or add it as an editable image in the header, and I can replace or configure it safely.";
  }
  if (requestsVisualReferenceRemoval(intent, context)) {
    return "I treated the attachment as a page screenshot, but I could not match it to one safely removable duplicate component. Select the exact area once, then send the screenshot prompt again.";
  }
  if (includesAny(text, ["image", "photo", "picture"])) {
    const selected = selectedImageTarget(context, false);
    return selected
      ? "The image area is selected. Ask me to generate a specific image, include an image URL, or choose an existing item from Assets; I’ll prepare the replacement as an approved draft edit."
      : "Use Select area and click an editable image first. Then ask me to generate, replace, resize, or update that image while the selection stays attached to the chat.";
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    return "Hello! I’m following this page and our conversation. Tell me what should change, or ask me to inspect a problem before editing.";
  }
  if (/^(thanks|thank you|got it|okay|ok)\b/.test(text)) {
    return "You’re welcome. I’ll keep the current page and conversation context for your next instruction.";
  }
  if (includesAny(text, ["what can you do", "help me", "how can you help"])) {
    return "I can continue from earlier instructions, edit exposed page sections and content, update page settings and theme tokens, review UX/SEO, and explain issues that belong to the connected website shell.";
  }
  return "I understand the message, but it does not identify a safe change in the current editable page model. I can still help diagnose it—tell me what is wrong, where it appears, and the result you expect.";
}

function buildPlan({ intent, context, memory = {}, conversation = [], previousPlan, feedback }) {
  const contextualIntent = resolveContextualIntent(
    [intent, feedback].filter(Boolean).join(". "),
    conversation
  );
  const combinedIntent = contextualIntent.resolvedIntent;
  const text = normalized(combinedIntent);
  const addOperation = operationFactory();
  const operations = [];
  const affected = new Set();
  const capabilities = new Set(context?.capabilities || []);
  const color = colorFromIntent(combinedIntent);

  const imageItems = imageOperations(addOperation, context, combinedIntent);
  if (imageItems.length) {
    operations.push(...imageItems);
    affected.add("Selected image");
  }

  const visualRemovalItems = visualReferenceRemovalOperations(
    addOperation,
    context,
    combinedIntent
  );
  if (visualRemovalItems.length) {
    operations.push(...visualRemovalItems);
    affected.add("Screenshot-matched duplicate area");
  }

  const selectedCopyItems = selectedRegionCopyOperations(addOperation, context, combinedIntent);
  if (selectedCopyItems.length) {
    operations.push(...selectedCopyItems);
    affected.add("Selected content");
  }

  const singleLineItems = selectedRegionSingleLineOperations(
    addOperation,
    context,
    combinedIntent
  );
  if (singleLineItems.length) {
    operations.push(...singleLineItems);
    affected.add("Selected text layout");
  }

  if (color && includesAny(text, ["background", " bg ", "bg colour", "bg color"])) {
    const isPageBackground = includesAny(text, [
      "page background", "website background", "site background", "body background",
      "background colour on this page", "background color on this page"
    ]) || requestsFullPageScope(text);
    const pageItems = isPageBackground
      ? pageSectionOperations(addOperation, context, color)
      : [];
    let items = [];
    if (pageItems.length) {
      operations.push(...pageItems);
      affected.add("All editable page sections");
    } else {
      items = regionOperations(
        addOperation,
        context,
        "background",
        color,
        `Change the editable page section background to ${color}`,
        "Apply the requested color directly to the connected website section.",
        "section"
      );
    }
    if (!items.length && !isPageBackground) {
      items = selectedComponentOperations(
        addOperation,
        context,
        "styles.base.background",
        color,
        `Change the selected component background to ${color}`,
        "Apply the requested background without altering page content."
      );
    }
    if (items.length) {
      operations.push(...items);
      affected.add("Selected section");
    } else if (!pageItems.length && capabilities.has("update_theme")) {
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

  if (requestsTextColorChange(combinedIntent)) {
    const namedRegionItems = selectedRegionTextColorOperations(
      addOperation,
      context,
      combinedIntent,
      color,
      true
    );
    const sourceItems = namedRegionItems.length
      ? []
      : sourceTextColorOperations(addOperation, context, combinedIntent, color);
    const selectedRegionItems = namedRegionItems.length || sourceItems.length
      ? []
      : selectedRegionTextColorOperations(
        addOperation,
        context,
        combinedIntent,
        color
      );
    const directItems = namedRegionItems.length
      ? namedRegionItems
      : sourceItems.length
        ? sourceItems
        : selectedRegionItems;
    const items = directItems.length ? directItems : selectedComponentOperations(
      addOperation,
      context,
      "styles.base.color",
      color,
      `Change the selected text color to ${color}`,
      "Apply the requested foreground color to the selected component."
    );
    if (items.length) operations.push(...items);
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
  if (addSections(operations, addOperation, context, sections, combinedIntent)) {
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
      ? contextualIntent.carriedForward
        ? `I carried forward the previous background and color request, then prepared ${operations.length} page-wide edit${operations.length === 1 ? "" : "s"}. Review the plan, then approve it to update the draft.`
        : `I prepared ${operations.length} local edit${operations.length === 1 ? "" : "s"}. Review the plan, then approve it to update the draft.`
      : conversationalReply(contextualIntent.directIntent, context),
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

function promptContextCoverage(context) {
  const page = context?.currentPage || {};
  const checks = [
    Boolean(page.record || page.settings),
    Boolean(page.componentTree),
    Boolean(page.editableRegionDefinitions || page.editableRegionValues),
    Boolean(page.selectedRegion || page.selectedRegions?.length || page.selectedComponent || page.selectedComponents?.length),
    Boolean(context?.designSystem?.theme),
    Array.isArray(context?.contentSystem?.assets),
    Array.isArray(context?.capabilities) && context.capabilities.length > 0,
    Boolean(context?.constraints)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function capturePromptLearning(value) {
  const target = storage();
  if (!target) return false;
  const previousState = readStoredJson(MODEL_STATE_KEY, {});
  const priorInteractions = Math.max(0, Number(previousState.interactionCount) || 0);
  const coverage = promptContextCoverage(value.context);
  const previousCoverage = Math.max(0, Number(previousState.contextCoverage) || 0);
  target.setItem(MODEL_STATE_KEY, JSON.stringify({
    ...previousState,
    activeModel: DEFAULT_MODEL_RELEASE,
    modelPreferenceVersion: MODEL_PREFERENCE_VERSION,
    curriculumRevision: Math.max(0, Number(previousState.curriculumRevision) || 0) + 1,
    interactionCount: priorInteractions + 1,
    contextCoverage: Math.round(((previousCoverage * priorInteractions) + coverage) / (priorInteractions + 1)),
    lastIntent: String(value.intent || "").slice(0, 240),
    lastPlannedOperations: value.plan?.operations?.length || 0,
    updatedAt: Date.now()
  }));
  return true;
}

function captureFeedback(value) {
  const target = storage();
  if (!target) return false;
  const storedFeedback = readStoredJson(FEEDBACK_KEY, []);
  const existing = Array.isArray(storedFeedback) ? storedFeedback : [];
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
  const previousState = readStoredJson(MODEL_STATE_KEY, {});
  target.setItem(MODEL_STATE_KEY, JSON.stringify({
    ...previousState,
    trainedExamples: Math.max(0, Number(previousState.trainedExamples) || 0) + 1,
    updatedAt: record.capturedAt
  }));
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

function proceduralImage(prompt, brandContext = {}, modelId = "") {
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
    model: `${currentModelInfo(modelId).id}-procedural-image`,
    modelInfo: currentModelInfo(modelId)
  };
}

export const rocketLocalEngine = {
  getModelCatalog() {
    return MODEL_RELEASES.map((release) => ({ ...release }));
  },

  getModelInfo(modelId = "") {
    return currentModelInfo(modelId);
  },

  setActiveModel(modelId) {
    return chooseActiveModel(modelId);
  },

  async createPlan(input) {
    const plan = buildPlan(input);
    capturePromptLearning({ ...input, plan });
    const modelInfo = currentModelInfo(input.modelId);
    return {
      plan,
      model: modelInfo.id,
      modelInfo,
      requestId: requestId(),
      usage: {
        runtime: "browser",
        networkRequests: 0,
        contextComponents: input.context?.currentPage?.flattenedComponentIndex?.length || 0,
        plannedOperations: plan.operations.length
      }
    };
  },

  async generateImage({ prompt, brandContext, modelId }) {
    return proceduralImage(prompt, brandContext, modelId);
  },

  async recordFeedback(value) {
    const captured = captureFeedback(value);
    const modelInfo = currentModelInfo();
    return { accepted: true, captured, model: modelInfo.id, modelInfo };
  }
};

export default rocketLocalEngine;
