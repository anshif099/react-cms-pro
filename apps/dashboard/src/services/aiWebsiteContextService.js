import BLOCK_SCHEMAS from "../components/blocks/blockSchemas";
import { decodeFirebaseObject } from "@anshif.rainhopes/shared";
import {
  createRuntimeAdditionsTree,
  isPageComponentTree,
  RUNTIME_ADDITIONS_REGION
} from "@anshif.rainhopes/reactcms-renderer";
import contentSyncService from "./contentSyncService";
import contentTypeService from "./contentTypeService";
import globalService from "./globalService";
import mediaService from "./mediaService";
import pageService from "./pageService";
import pluginService from "./pluginService";
import registryService from "./registryService";
import seoService from "./seoService";
import settingsService from "./settingsService";
import themeService from "./themeService";

const MAX_STRING = 180000;
const MAX_ARRAY = 250;
const MAX_DEPTH = 12;
const MAX_TREE_NODES = 5000;
const MAX_CONTEXT_OBJECTS = 20000;
const MAX_CONTEXT_TEXT = 1500000;
const MAX_OBJECT_KEYS = 500;
const MAX_SOURCE_CONTEXT = 1200000;
const SOURCE_TRUNCATED_MARKER = "\n/* ReactCMS context truncated */";

export function asSerializable(
  value,
  depth = 0,
  ancestors = new WeakSet(),
  budget = { objects: 0, text: 0 }
) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") {
    const available = Math.max(0, MAX_CONTEXT_TEXT - budget.text);
    if (!available) return "[context text limit]";
    const length = Math.min(value.length, MAX_STRING, available);
    budget.text += length;
    return length < value.length
      ? `${value.slice(0, length)}${SOURCE_TRUNCATED_MARKER}`
      : value;
  }
  if (["number", "boolean"].includes(typeof value)) return value;
  if (typeof value !== "object") return String(value);
  if (depth >= MAX_DEPTH) return "[context depth limit]";
  if (ancestors.has(value)) return "[circular]";
  budget.objects += 1;
  if (budget.objects > MAX_CONTEXT_OBJECTS) return "[context size limit]";
  ancestors.add(value);

  const serialized = Array.isArray(value)
    ? value.slice(0, MAX_ARRAY).map((item) => asSerializable(item, depth + 1, ancestors, budget))
    : Object.fromEntries(Object.entries(value).slice(0, MAX_OBJECT_KEYS).map(([key, item]) => [
        key,
        asSerializable(item, depth + 1, ancestors, budget)
      ]));
  ancestors.delete(value);
  return serialized;
}

async function safeRead(read, fallback) {
  try {
    return await read();
  } catch (error) {
    console.warn("AI context source was unavailable", error);
    return fallback;
  }
}

export function flattenContextTree(tree) {
  const nodes = [];
  const visited = new WeakSet();
  const roots = Array.isArray(tree?.children) ? tree.children : [];
  const stack = roots.map((node, siblingIndex) => ({
    node,
    parentId: null,
    siblingIndex,
    depth: 0
  })).reverse();

  while (stack.length && nodes.length < MAX_TREE_NODES) {
    const current = stack.pop();
    const node = current?.node;
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    nodes.push({
      ...node,
      parentId: current.parentId,
      siblingIndex: current.siblingIndex
    });

    if (current.depth >= MAX_DEPTH) continue;
    const children = Array.isArray(node.children) ? node.children : [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        node: children[index],
        parentId: node.id,
        siblingIndex: index,
        depth: current.depth + 1
      });
    }
  }
  return nodes;
}

export function countTreeNodes(tree) {
  return flattenContextTree(tree).length;
}

function componentLibraryContext() {
  return BLOCK_SCHEMAS.map((schema) => ({
    type: schema.type,
    label: schema.label,
    category: schema.category,
    description: schema.description,
    fields: schema.fields.map((field) => ({
      key: field.key,
      type: field.type,
      localized: Boolean(field.localized),
      defaultValue: field.defaultValue,
      options: field.options?.map((option) => option.value),
      itemFields: field.fields?.map((item) => ({ key: item.key, type: item.type }))
    }))
  }));
}

function resolveRegionValues(
  definitions,
  draft,
  published,
  current,
  selectedRegion,
  selectedRegions = []
) {
  const values = {
    ...(published?.regions || {})
  };
  Object.entries(definitions || {}).forEach(([regionId, definition]) => {
    if (Object.prototype.hasOwnProperty.call(values, regionId)) return;
    values[regionId] = definition?.value ?? definition?.defaultValue ?? null;
  });
  Object.assign(values, draft?.regions || {}, current || {});
  if (selectedRegion?.regionId) values[selectedRegion.regionId] = selectedRegion.value;
  selectedRegions.forEach((region) => {
    if (region?.regionId) values[region.regionId] = region.value;
  });
  return values;
}

function sourceProjectContext(sourceFiles, entryFile) {
  const entries = Object.entries(sourceFiles || {}).sort(([first], [second]) => {
    if (first === entryFile) return -1;
    if (second === entryFile) return 1;
    return first.localeCompare(second);
  });
  const files = {};
  let remaining = MAX_SOURCE_CONTEXT;
  let completeFileCount = 0;

  entries.forEach(([path, rawContent]) => {
    const content = String(rawContent ?? "");
    if (content.length <= MAX_STRING && content.length <= remaining) {
      files[path] = content;
      remaining -= content.length;
      completeFileCount += 1;
      return;
    }
    const available = Math.max(0, Math.min(MAX_STRING, remaining) - SOURCE_TRUNCATED_MARKER.length);
    files[path] = `${content.slice(0, available)}${SOURCE_TRUNCATED_MARKER}`;
    remaining = Math.max(0, remaining - available - SOURCE_TRUNCATED_MARKER.length);
  });

  return {
    files,
    totalFileCount: entries.length,
    completeFileCount,
    truncatedFileCount: entries.length - completeFileCount,
    totalSourceCharacters: entries.reduce((sum, [, content]) => (
      sum + String(content ?? "").length
    ), 0)
  };
}

export async function collectAIWebsiteContext({
  websiteId,
  runtimeWebsiteId = "",
  pageId,
  pageKey,
  locale = "en",
  surface = "native",
  page,
  website,
  tree = null,
  selectedNode = null,
  selectedNodes = [],
  selectedRegion = null,
  selectedRegions = [],
  pageSettings = {},
  theme = null,
  regions = null,
  sourceFiles = {},
  editorHistory = []
}) {
  const reads = await Promise.all([
    safeRead(() => pageService.getAll(websiteId), []),
    safeRead(() => registryService.getRuntimeStatus(websiteId), null),
    safeRead(() => registryService.getRoutes(websiteId), {}),
    safeRead(() => registryService.getLayouts(websiteId), {}),
    safeRead(() => registryService.getNavigation(websiteId), {}),
    safeRead(() => registryService.getEditableRegionsForPage(websiteId, pageKey), {}),
    safeRead(() => themeService.getTheme(websiteId), theme || {}),
    safeRead(() => mediaService.getAll(websiteId), []),
    safeRead(() => seoService.getSEOConfig(websiteId), {}),
    safeRead(() => globalService.get(websiteId, locale), {}),
    safeRead(() => contentTypeService.getAll(websiteId), []),
    safeRead(() => pluginService.getInstalledPlugins(websiteId), {}),
    safeRead(() => settingsService.getCMSSettings(websiteId), {}),
    safeRead(() => contentSyncService.getDraft(websiteId, pageKey), null),
    safeRead(() => contentSyncService.getPublished(websiteId, pageKey), null),
    runtimeWebsiteId && runtimeWebsiteId !== websiteId
      ? safeRead(() => registryService.getEditableRegionsForPage(runtimeWebsiteId, pageKey), {})
      : Promise.resolve({})
  ]);
  const [
    pages,
    registryRuntime,
    routes,
    layouts,
    navigation,
    editableRegions,
    resolvedTheme,
    assets,
    seo,
    globalContent,
    contentTypes,
    plugins,
    cmsSettings,
    draftContent,
    publishedContent,
    runtimeEditableRegions
  ] = reads;
  const pageRegions = {
    ...runtimeEditableRegions,
    ...editableRegions
  };
  const decodedDraftContent = draftContent ? decodeFirebaseObject(draftContent) : null;
  const decodedPublishedContent = publishedContent
    ? decodeFirebaseObject(publishedContent)
    : null;
  const regionValues = resolveRegionValues(
    pageRegions,
    decodedDraftContent,
    decodedPublishedContent,
    regions,
    selectedRegion,
    selectedRegions
  );
  const runtimeAdditionsTree = surface === "connected-runtime"
    ? isPageComponentTree(regionValues[RUNTIME_ADDITIONS_REGION])
      ? regionValues[RUNTIME_ADDITIONS_REGION]
      : createRuntimeAdditionsTree(pageKey || pageId, locale)
    : null;
  if (runtimeAdditionsTree) {
    regionValues[RUNTIME_ADDITIONS_REGION] = runtimeAdditionsTree;
  }
  const editableTree = tree || runtimeAdditionsTree;
  const sourceFileCount = Object.keys(sourceFiles || {}).length;
  const componentTypes = BLOCK_SCHEMAS.map((schema) => schema.type);
  const capabilities = ["update_page", "update_theme"];
  if (editableTree) capabilities.push(
    "insert_component",
    "update_component",
    "remove_component",
    "move_component",
    "duplicate_component"
  );
  if (Object.keys(regionValues).length) {
    capabilities.push("update_region");
  }
  if (sourceFileCount) capabilities.push("create_source_file", "replace_source_file");

  const context = {
    contextVersion: 1,
    generatedAt: new Date().toISOString(),
    editorSurface: surface,
    capabilities,
    currentPage: {
      id: pageId,
      pageKey,
      locale,
      record: page,
      settings: pageSettings,
      selectedComponent: selectedNode,
      selectedComponents: selectedNodes,
      selectedRegion,
      selectedRegions,
      draftContent: decodedDraftContent,
      publishedContent: decodedPublishedContent,
      editableRegionValues: regionValues,
      componentTree: editableTree,
      flattenedComponentIndex: flattenContextTree(editableTree).map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        parentId: node.parentId,
        siblingIndex: node.siblingIndex,
        hidden: node.hidden,
        locked: node.locked
      })),
      editableRegionDefinitions: pageRegions,
      editorHistory: editorHistory.slice(-40)
    },
    website: {
      record: website,
      runtimeWebsiteId: runtimeWebsiteId || websiteId,
      pages,
      routes,
      navigation,
      layouts,
      globalContent,
      cmsSettings,
      registryRuntime
    },
    designSystem: {
      theme: resolvedTheme || theme,
      registryTheme: null,
      componentLibrary: componentLibraryContext(),
      breakpoints: {
        desktop: 1440,
        laptop: 1200,
        tablet: 768,
        mobile: 390
      }
    },
    contentSystem: {
      contentTypes,
      plugins,
      seo,
      assets,
      allEditableRegions: { [pageKey]: editableRegions }
    },
    sourceProject: sourceFileCount ? {
      provider: website?.connection?.provider,
      framework: website?.framework,
      entryFile: page?.sourceFile,
      ...sourceProjectContext(sourceFiles, page?.sourceFile)
    } : null,
    revisionHistory: [],
    constraints: {
      screenshotReferenceMode: "selected-area-and-page-context",
      preserveWebsiteShell: surface === "connected-runtime",
      requireApproval: true,
      maxOperations: 80,
      registeredComponentTypes: componentTypes,
      sourceChangesRemainDraftUntilPublish: true,
      runtimeAdditionsRegion: runtimeAdditionsTree ? RUNTIME_ADDITIONS_REGION : null
    }
  };

  return asSerializable(context);
}

function hexToRgb(color) {
  const normalized = String(color || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function luminance(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  const values = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function auditAIContext(context) {
  const issues = [];
  const tree = context?.currentPage?.componentTree;
  const nodes = flattenContextTree(tree);
  const pageSettings = context?.currentPage?.settings || {};
  const colors = context?.designSystem?.theme?.colors || {};
  const headingOnes = nodes.filter((node) => (
    node.type === "heading" && node.props?.level === "h1"
  ));

  if (!nodes.length && context?.editorSurface === "native") {
    issues.push({ severity: "high", category: "structure", message: "The page has no components." });
  }
  if (nodes.length && !headingOnes.length && !nodes.some((node) => node.type === "hero")) {
    issues.push({ severity: "high", category: "accessibility", message: "The page has no clear H1 or hero heading." });
  }
  if (headingOnes.length > 1) {
    issues.push({ severity: "medium", category: "seo", message: "The page contains multiple H1 headings." });
  }
  nodes.filter((node) => node.type === "image").forEach((node) => {
    const localized = node.props?.locales?.[context?.currentPage?.locale || "en"] || {};
    if (!localized.alt && !node.props?.alt) {
      issues.push({
        severity: "high",
        category: "accessibility",
        targetId: node.id,
        message: `${node.label || "Image"} is missing alternative text.`
      });
    }
  });
  if (nodes.length && !nodes.some((node) => ["button", "cta", "contact", "newsletter"].includes(node.type))) {
    issues.push({ severity: "medium", category: "conversion", message: "The page has no obvious conversion action." });
  }
  if (!pageSettings.seo?.metaTitle) {
    issues.push({ severity: "medium", category: "seo", message: "The page is missing an SEO title." });
  }
  if (!pageSettings.seo?.metaDescription) {
    issues.push({ severity: "medium", category: "seo", message: "The page is missing an SEO description." });
  }
  const ratio = contrastRatio(colors.text, colors.background);
  if (ratio !== null && ratio < 4.5) {
    issues.push({
      severity: "high",
      category: "accessibility",
      message: `Theme text contrast is ${ratio.toFixed(2)}:1; normal text should reach 4.5:1.`
    });
  }
  if (nodes.length && !nodes.some((node) => Object.keys(node.styles?.mobile || {}).length)) {
    issues.push({
      severity: "low",
      category: "responsive",
      message: "No component has an explicit mobile override; review narrow-screen spacing and stacking."
    });
  }
  return issues;
}

export { BLOCK_SCHEMAS as AI_COMPONENT_LIBRARY };

export default {
  auditAIContext,
  collectAIWebsiteContext,
  countTreeNodes,
  flattenContextTree
};
