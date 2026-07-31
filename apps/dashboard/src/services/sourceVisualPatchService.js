const EDITABLE_COMPONENT_PATTERN = /<Editable(?:Text|RichText|Button|Image|Video|Section|Repeater)\b/g;

function scanQuotedValue(source, start, quote) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === quote) return index + 1;
  }
  return source.length;
}

function scanExpressionValue(source, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return source.length;
}

function findTagEnd(source, start) {
  let expressionDepth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") expressionDepth += 1;
    if (character === "}") expressionDepth = Math.max(0, expressionDepth - 1);
    if (character === ">" && expressionDepth === 0) return index + 1;
  }

  return -1;
}

function findPropValueRange(tag, propName) {
  const propPattern = new RegExp(`\\b${propName}\\s*=`, "g");
  const match = propPattern.exec(tag);
  if (!match) return null;

  let start = match.index + match[0].length;
  while (/\s/.test(tag[start] || "")) start += 1;
  if (start >= tag.length) return null;

  const first = tag[start];
  let end;
  if (first === "'" || first === '"') {
    end = scanQuotedValue(tag, start, first);
  } else if (first === "{") {
    end = scanExpressionValue(tag, start);
  } else {
    end = start;
    while (end < tag.length && !/[\s/>]/.test(tag[end])) end += 1;
  }

  return { start, end, value: tag.slice(start, end) };
}

function staticStringFromJsx(value) {
  let candidate = String(value || "").trim();
  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (
    (candidate.startsWith('"') && candidate.endsWith('"'))
    || (candidate.startsWith("'") && candidate.endsWith("'"))
  ) {
    return candidate.slice(1, -1);
  }
  return "";
}

function jsxValue(value) {
  return `{${JSON.stringify(value)}}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dynamicRegionMatches(value, regionId) {
  let candidate = String(value || "").trim();
  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (!candidate.startsWith("`") || !candidate.endsWith("`")) return false;

  const template = candidate.slice(1, -1);
  let pattern = "";
  let cursor = 0;
  const expressionPattern = /\$\{[^}]+\}/g;
  let expression;
  while ((expression = expressionPattern.exec(template))) {
    pattern += escapeRegExp(template.slice(cursor, expression.index));
    pattern += "[^.]+";
    cursor = expression.index + expression[0].length;
  }
  pattern += escapeRegExp(template.slice(cursor));
  return new RegExp(`^${pattern}$`).test(regionId);
}

function scanObjectValue(source, start) {
  let quote = "";
  let escaped = false;
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") braces += 1;
    if (character === "[") brackets += 1;
    if (character === "(") parentheses += 1;
    if (character === "}") {
      if (braces === 0 && brackets === 0 && parentheses === 0) return index;
      braces = Math.max(0, braces - 1);
    }
    if (character === "]") brackets = Math.max(0, brackets - 1);
    if (character === ")") parentheses = Math.max(0, parentheses - 1);
    if (
      character === ","
      && braces === 0
      && brackets === 0
      && parentheses === 0
    ) {
      return index;
    }
  }

  return source.length;
}

function findObjectPropertyValueRange(source, property) {
  const pattern = new RegExp(`\\b${escapeRegExp(property)}\\s*:`, "g");
  const match = pattern.exec(source);
  if (!match) return null;

  let start = match.index + match[0].length;
  while (/\s/.test(source[start] || "")) start += 1;
  return {
    start,
    end: scanObjectValue(source, start)
  };
}

function collectionValue(field, value) {
  if (field === "image" && value && typeof value === "object") {
    return value.src;
  }
  if (value && typeof value === "object" && "text" in value) {
    return value.text;
  }
  return value;
}

function patchDynamicCollectionRegion(source, regionId, value, component) {
  const segments = String(regionId).split(".");
  if (segments.length < 3) return null;
  const itemId = segments.at(-2);
  const field = segments.at(-1);
  const itemPattern = new RegExp(
    "\\b(?:num|id|key|slug)\\s*:\\s*([\"'`])"
      + escapeRegExp(itemId)
      + "\\1"
  );
  const itemMatch = itemPattern.exec(source);
  if (!itemMatch) return null;

  const absoluteItemIndex = itemMatch.index;
  let objectStart = source.lastIndexOf("{", absoluteItemIndex);
  let objectEnd = -1;
  while (objectStart >= 0) {
    const candidateEnd = scanExpressionValue(source, objectStart);
    if (candidateEnd > absoluteItemIndex) {
      objectEnd = candidateEnd;
      break;
    }
    objectStart = source.lastIndexOf("{", objectStart - 1);
  }
  if (objectStart < 0 || objectEnd < 0) return null;

  const objectSource = source.slice(objectStart, objectEnd);
  const fieldRange = findObjectPropertyValueRange(objectSource, field);
  const nextValue = collectionValue(field, value);
  if (!fieldRange || nextValue === undefined) return null;

  const replacement = JSON.stringify(nextValue);
  const nextObject = `${objectSource.slice(0, fieldRange.start)}${replacement}${objectSource.slice(fieldRange.end)}`;
  return {
    content: `${source.slice(0, objectStart)}${nextObject}${source.slice(objectEnd)}`,
    changed: nextObject !== objectSource,
    component,
    dynamic: true,
    error: ""
  };
}

function editableTags(source) {
  const tags = [];
  EDITABLE_COMPONENT_PATTERN.lastIndex = 0;
  let match;
  while ((match = EDITABLE_COMPONENT_PATTERN.exec(source)) !== null) {
    const end = findTagEnd(source, match.index);
    if (end === -1) break;
    tags.push({
      start: match.index,
      end,
      component: match[0].slice(1),
      source: source.slice(match.index, end)
    });
    EDITABLE_COMPONENT_PATTERN.lastIndex = end;
  }
  return tags;
}

export function patchEditableRegionSource(source, regionId, value) {
  if (!source || !regionId) {
    return {
      content: source || "",
      changed: false,
      error: "The connected source or region ID is missing."
    };
  }

  const tags = editableTags(source);
  const tag = tags.find((candidate) => {
    const regionProp = findPropValueRange(candidate.source, "regionId");
    return regionProp && staticStringFromJsx(regionProp.value) === regionId;
  });

  if (!tag) {
    const dynamicTag = tags.find((candidate) => {
      const regionProp = findPropValueRange(candidate.source, "regionId");
      return regionProp && dynamicRegionMatches(regionProp.value, regionId);
    });
    if (dynamicTag) {
      const dynamicResult = patchDynamicCollectionRegion(
        source,
        regionId,
        value,
        dynamicTag.component
      );
      if (dynamicResult) return dynamicResult;
    }
    return {
      content: source,
      changed: false,
      error: `Region "${regionId}" is not declared in ${"this page source file"}.`
    };
  }

  const defaultProp = findPropValueRange(tag.source, "defaultValue");
  const replacement = jsxValue(value);
  let nextTag;

  if (defaultProp) {
    nextTag = `${tag.source.slice(0, defaultProp.start)}${replacement}${tag.source.slice(defaultProp.end)}`;
  } else {
    const insertAt = tag.source.endsWith("/>")
      ? tag.source.length - 2
      : tag.source.length - 1;
    nextTag = `${tag.source.slice(0, insertAt)} defaultValue=${replacement}${tag.source.slice(insertAt)}`;
  }

  return {
    content: `${source.slice(0, tag.start)}${nextTag}${source.slice(tag.end)}`,
    changed: nextTag !== tag.source,
    component: tag.component,
    error: ""
  };
}

function normalizeSourcePath(value) {
  const parts = [];
  String(value || "").replaceAll("\\", "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

export function discoverLocalSourceImports(importerPath, source) {
  const importerParts = normalizeSourcePath(importerPath).split("/");
  importerParts.pop();
  const importerDirectory = importerParts.join("/");
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(source))) {
      if (match[1]?.startsWith(".")) specifiers.add(match[1]);
    }
  });

  const sourceExtensions = [".jsx", ".tsx", ".js", ".ts", ".mjs", ".cjs"];
  return Array.from(specifiers).flatMap((specifier) => {
    const resolved = normalizeSourcePath(`${importerDirectory}/${specifier}`);
    const extension = resolved.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    if (extension && !sourceExtensions.includes(extension)) return [];
    const candidates = extension
      ? [resolved]
      : [
          ...sourceExtensions.map((candidate) => `${resolved}${candidate}`),
          ...sourceExtensions.map((candidate) => `${resolved}/index${candidate}`)
        ];
    return [{ specifier, candidates }];
  });
}

export function mergeRegionSelection(current, payload) {
  if (!payload?.regionId) return current || null;
  if (!current || current.regionId !== payload.regionId) return payload;

  return {
    ...current,
    ...payload,
    type: payload.type || current.type,
    pageId: payload.pageId || current.pageId,
    value: payload.value === undefined ? current.value : payload.value
  };
}

export function buildConnectedPageUrl(website, page, mode = "preview") {
  const domain = String(website?.domain || "").trim();
  if (!domain) return "";

  try {
    const url = new URL(domain);
    if (url.protocol !== "https:") return "";
    const pageRoute = page?.route
      || (page?.slug === "home" ? "/" : `/${String(page?.slug || "").replace(/^\/+/, "")}`);
    const normalizedRoute = pageRoute === "/"
      ? "/"
      : `/${String(pageRoute).replace(/^\/+|\/+$/g, "")}`;
    const parameters = new URLSearchParams({
      target: url.toString(),
      route: normalizedRoute,
      mode: mode === "edit" ? "edit" : "preview"
    });
    return `/api/live-preview?${parameters.toString()}`;
  } catch {
    return "";
  }
}

export function createRuntimeMessage(type, payload = {}) {
  return {
    rcms: true,
    version: "v1",
    type,
    websiteId: "",
    payload,
    timestamp: Date.now()
  };
}
