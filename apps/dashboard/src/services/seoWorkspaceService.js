import { flattenContextTree } from "./aiWebsiteContextService";

const HEADING_LEVELS = ["h1", "h2", "h3", "h4"];

function localizedProps(node, locale) {
  return {
    ...(node?.props || {}),
    ...(node?.props?.locales?.[locale] || {}),
    ...(node?.locales?.[locale] || {})
  };
}

function textValue(value) {
  if (typeof value === "string") return value.replace(/<[^>]*>/g, " ").trim();
  return "";
}

function treeAudit(context) {
  const locale = context?.currentPage?.locale || "en";
  const nodes = flattenContextTree(context?.currentPage?.componentTree);
  const headings = [];
  const images = [];

  nodes.forEach((node) => {
    const props = localizedProps(node, locale);
    if (node.type === "heading") {
      const level = String(props.level || "h2").toLowerCase();
      if (HEADING_LEVELS.includes(level)) {
        headings.push({
          id: node.id,
          level,
          text: textValue(props.text || props.title) || node.label || "Untitled heading"
        });
      }
    } else if (node.type === "hero") {
      headings.push({
        id: node.id,
        level: "h1",
        text: textValue(props.title) || node.label || "Hero heading"
      });
    }

    if (node.type === "image") {
      images.push({
        id: node.id,
        src: props.src || props.url || "",
        alt: textValue(props.alt),
        label: node.label || "Page image",
        regionId: ""
      });
    }
  });

  return { headings, images, text: nodes.map((node) => {
    const props = localizedProps(node, locale);
    return [props.text, props.title, props.subtitle, props.description, props.alt]
      .map(textValue)
      .filter(Boolean)
      .join(" ");
  }).join(" ") };
}

export function validateSchemaMarkup(value) {
  const source = String(value || "").trim();
  if (!source) return { valid: true, parsed: null, error: "" };
  try {
    const parsed = JSON.parse(source);
    if (!parsed || (typeof parsed !== "object")) {
      return { valid: false, parsed: null, error: "Schema markup must be a JSON object or array." };
    }
    return { valid: true, parsed, error: "" };
  } catch (error) {
    return { valid: false, parsed: null, error: `Invalid JSON: ${error.message}` };
  }
}

export function buildSEOAudit(context, canvasScan, focusKeyword = "") {
  const fallback = treeAudit(context);
  const hasCanvasScan = Boolean(canvasScan && Array.isArray(canvasScan.headings));
  const headings = hasCanvasScan ? canvasScan.headings : fallback.headings;
  const images = hasCanvasScan && Array.isArray(canvasScan.images)
    ? canvasScan.images
    : fallback.images;
  const counts = Object.fromEntries(HEADING_LEVELS.map((level) => [
    level,
    headings.filter((heading) => heading.level === level).length
  ]));
  const pageText = String(canvasScan?.text || fallback.text || "").toLowerCase();
  const keyword = String(focusKeyword || "").trim().toLowerCase();
  const occurrences = keyword
    ? pageText.split(keyword).length - 1
    : 0;

  return {
    source: hasCanvasScan ? "canvas" : "component-tree",
    headings,
    headingCounts: counts,
    images,
    missingAlt: images.filter((image) => !String(image.alt || "").trim()),
    wordCount: (pageText.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length,
    keywordOccurrences: occurrences
  };
}

export default {
  buildSEOAudit,
  validateSchemaMarkup
};
