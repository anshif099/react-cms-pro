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

  const tag = editableTags(source).find((candidate) => {
    const regionProp = findPropValueRange(candidate.source, "regionId");
    return regionProp && staticStringFromJsx(regionProp.value) === regionId;
  });

  if (!tag) {
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
