import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const ASSET_PROXY_PATH = "/api/live-preview?asset=";

function isPrivateAddress(address) {
  const normalized = String(address || "").toLowerCase();
  if (normalized.includes(":")) {
    return normalized === "::1"
      || normalized === "::"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe8")
      || normalized.startsWith("fe9")
      || normalized.startsWith("fea")
      || normalized.startsWith("feb");
  }
  const octets = normalized.split(".").map(Number);
  return (
    octets[0] === 0
    || octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || octets[0] >= 224
  );
}

async function publicHttpsUrl(value) {
  const url = new URL(String(value || ""));
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") {
    throw new Error("Live Preview only loads HTTPS websites.");
  }
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("The Live Preview website URL is not allowed.");
  }
  if (
    hostname === "localhost"
    || hostname.endsWith(".local")
    || isIP(hostname)
  ) {
    throw new Error("The Live Preview hostname is not allowed.");
  }
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The Live Preview hostname must resolve to a public server.");
  }
  return url;
}

function previewRoute(value, mode) {
  const raw = String(value || "/").trim();
  if (raw.length > 2048 || raw.startsWith("//")) {
    throw new Error("The Live Preview route is invalid.");
  }
  const parsed = new URL(raw.startsWith("/") ? raw : `/${raw}`, "https://preview.invalid");
  const parameters = parsed.searchParams;
  parameters.delete("rcms_edit");
  parameters.delete("rcms_preview");
  parameters.set(mode === "edit" ? "rcms_edit" : "rcms_preview", "1");
  return `${parsed.pathname}${parameters.size ? `?${parameters.toString()}` : ""}${parsed.hash}`;
}

async function fetchPublicHtml(initialUrl) {
  let current = await publicHttpsUrl(initialUrl);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const upstream = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ReactCMS-Live-Preview/1.0"
      }
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("The connected website redirected too many times.");
      }
      current = await publicHttpsUrl(new URL(location, current).toString());
      continue;
    }
    if (!upstream.ok) {
      throw new Error(`The connected website root returned HTTP ${upstream.status}.`);
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("The connected website root did not return an HTML document.");
    }
    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) {
      throw new Error("The connected website HTML exceeds the 2 MB preview limit.");
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_HTML_BYTES) {
      throw new Error("The connected website HTML exceeds the 2 MB preview limit.");
    }
    return {
      html: new TextDecoder("utf-8").decode(bytes),
      url: current
    };
  }

  throw new Error("The connected website could not be loaded.");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

export function previewAssetUrl(value, baseUrl, proxyOrigin = "") {
  const raw = String(value || "").trim();
  const proxyPath = `${String(proxyOrigin || "").replace(/\/$/, "")}${ASSET_PROXY_PATH}`;
  if (
    !raw
    || raw.startsWith("#")
    || /^(?:data|blob|javascript|mailto|tel):/i.test(raw)
    || raw.startsWith(proxyPath)
  ) {
    return raw;
  }
  try {
    const resolved = new URL(raw.startsWith("//") ? `https:${raw}` : raw, baseUrl);
    if (resolved.protocol !== "https:") return raw;
    return `${proxyPath}${encodeURIComponent(resolved.toString())}`;
  } catch {
    return raw;
  }
}

function rewriteAttribute(tag, attribute, baseUrl, proxyOrigin) {
  const pattern = new RegExp(`(\\b${attribute}\\s*=\\s*)(["'])([^"']*)\\2`, "gi");
  return tag.replace(pattern, (_match, prefix, quote, value) => (
    `${prefix}${quote}${escapeAttribute(previewAssetUrl(value, baseUrl, proxyOrigin))}${quote}`
  ));
}

function rewriteSrcsetAttribute(tag, baseUrl, proxyOrigin) {
  return tag.replace(
    /(\bsrcset\s*=\s*)(["'])([^"']*)\2/gi,
    (_match, prefix, quote, value) => {
      const rewritten = value.split(",").map((entry) => {
        const parts = entry.trim().split(/\s+/);
        parts[0] = previewAssetUrl(parts[0], baseUrl, proxyOrigin);
        return parts.join(" ");
      }).join(", ");
      return `${prefix}${quote}${escapeAttribute(rewritten)}${quote}`;
    }
  );
}

function rewriteResourceTags(html, baseUrl, proxyOrigin) {
  return String(html || "").replace(
    /<(?:script|link|img|source|video|audio|track|input)\b[^>]*>/gi,
    (tag) => {
      const name = tag.match(/^<\s*([a-z]+)/i)?.[1]?.toLowerCase();
      let rewritten = tag;
      if (name === "link") rewritten = rewriteAttribute(rewritten, "href", baseUrl, proxyOrigin);
      if (["script", "img", "source", "video", "audio", "track", "input"].includes(name)) {
        rewritten = rewriteAttribute(rewritten, "src", baseUrl, proxyOrigin);
      }
      if (["img", "source"].includes(name)) {
        rewritten = rewriteSrcsetAttribute(rewritten, baseUrl, proxyOrigin);
      }
      if (name === "video") rewritten = rewriteAttribute(rewritten, "poster", baseUrl, proxyOrigin);
      return rewritten;
    }
  );
}

export function rewritePreviewCss(css, assetUrl, proxyOrigin = "") {
  const rewriteValue = (value) => previewAssetUrl(value, assetUrl, proxyOrigin);
  return String(css || "")
    .replace(
      /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
      (_match, quote, value) => `url(${quote}${rewriteValue(value)}${quote})`
    )
    .replace(
      /(@import\s+)(["'])([^"']+)\2/gi,
      (_match, prefix, quote, value) => `${prefix}${quote}${rewriteValue(value)}${quote}`
    );
}

export function rewritePreviewJavaScript(source, assetUrl) {
  const rewriteSpecifier = (value) => (
    /^(?:\.{0,2}\/|https?:\/\/|\/\/)/.test(value)
      ? previewAssetUrl(value, assetUrl)
      : value
  );
  return String(source || "")
    .replace(
      /(\bfrom\s*)(["'])([^"']+)\2/g,
      (_match, prefix, quote, value) => `${prefix}${quote}${rewriteSpecifier(value)}${quote}`
    )
    .replace(
      /(\bimport\s*\(\s*)(["'])([^"']+)\2/g,
      (_match, prefix, quote, value) => `${prefix}${quote}${rewriteSpecifier(value)}${quote}`
    )
    .replace(
      /(\bimport\s*)(["'])([^"']+)\2/g,
      (_match, prefix, quote, value) => `${prefix}${quote}${rewriteSpecifier(value)}${quote}`
    )
    .replace(
      /(new\s+URL\s*\(\s*)(["'])([^"']+)\2(\s*,\s*import\.meta\.url)/g,
      (_match, prefix, quote, value, suffix) => (
        `${prefix}${quote}${previewAssetUrl(value, assetUrl)}${quote}${suffix}`
      )
    );
}

function runtimeBootstrap(baseUrl, route, proxyOrigin) {
  return `<script>
(function () {
  var sourceBaseUrl = ${JSON.stringify(baseUrl)};
  var assetProxyPath = ${JSON.stringify(`${proxyOrigin}${ASSET_PROXY_PATH}`)};
  var previewRoute = ${JSON.stringify(route)};
  var embeddedEditorToolbarHidden = false;
  var areaSelectionArmed = false;
  var bridgeWebsiteId = "";
  var liveRegionValues = Object.create(null);
  var bridgedElementStyles = typeof WeakMap === "function" ? new WeakMap() : null;
  try { history.replaceState(null, "", previewRoute); } catch (_) {}

  function originalElementStyles(element) {
    if (!bridgedElementStyles) return null;
    var originals = bridgedElementStyles.get(element);
    if (!originals) {
      originals = Object.create(null);
      bridgedElementStyles.set(element, originals);
    }
    return originals;
  }

  function setBridgedStyle(element, property, value, enabled) {
    if (!element || !element.style) return;
    var originals = originalElementStyles(element);
    if (enabled) {
      if (originals && !Object.prototype.hasOwnProperty.call(originals, property)) {
        originals[property] = {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        };
      }
      var nextValue = String(value);
      if (
        element.style.getPropertyValue(property) !== nextValue
        || element.style.getPropertyPriority(property) !== "important"
      ) {
        element.style.setProperty(property, nextValue, "important");
      }
      return;
    }
    if (!originals || !Object.prototype.hasOwnProperty.call(originals, property)) return;
    var original = originals[property];
    if (original.value) {
      element.style.setProperty(property, original.value, original.priority || "");
    } else {
      element.style.removeProperty(property);
    }
    delete originals[property];
  }

  function applyLiveRegionValue(element) {
    if (!element || !element.getAttribute) return;
    var regionId = element.getAttribute("data-rcms-region");
    if (!regionId || !Object.prototype.hasOwnProperty.call(liveRegionValues, regionId)) return;
    var value = liveRegionValues[regionId];
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    var hasBackground = typeof value.background === "string";
    var hasBackgroundColor = typeof value.backgroundColor === "string";
    var hasPadding = typeof value.paddingY === "number" && Number.isFinite(value.paddingY);
    var hasLayout = value.layout === "flex" || value.layout === "grid";
    var hasFullWidth = value.layout === "full";
    setBridgedStyle(element, "background", value.background, hasBackground);
    setBridgedStyle(element, "background-color", value.backgroundColor, hasBackgroundColor);
    setBridgedStyle(element, "padding-top", hasPadding ? value.paddingY + "px" : "", hasPadding);
    setBridgedStyle(element, "padding-bottom", hasPadding ? value.paddingY + "px" : "", hasPadding);
    setBridgedStyle(element, "display", value.layout, hasLayout);
    setBridgedStyle(element, "width", "100%", hasFullWidth);
  }

  function applyLiveRegion(regionId) {
    if (!regionId || !document.querySelectorAll) return;
    document.querySelectorAll("[data-rcms-region]").forEach(function (element) {
      if (element.getAttribute("data-rcms-region") === regionId) applyLiveRegionValue(element);
    });
  }

  function selectedRegionValue(element, regionId, type) {
    if (Object.prototype.hasOwnProperty.call(liveRegionValues, regionId)) {
      return liveRegionValues[regionId];
    }
    if (type === "image") {
      return {
        src: element.currentSrc || element.getAttribute("src") || "",
        alt: element.getAttribute("alt") || ""
      };
    }
    if (type === "video") {
      return { src: element.currentSrc || element.getAttribute("src") || "" };
    }
    if (type === "button") {
      return {
        text: (element.textContent || "").trim(),
        url: element.getAttribute("href") || ""
      };
    }
    if (type === "section") {
      var style = window.getComputedStyle(element);
      return {
        background: style.backgroundColor || "",
        paddingY: parseFloat(style.paddingTop || "0") || 0
      };
    }
    return (element.textContent || "").trim();
  }

  function bridgeAreaSelection(event) {
    if (!areaSelectionArmed) return;
    var target = event.target && event.target.closest
      ? event.target.closest("[data-rcms-region]")
      : null;
    if (!target) return;
    var regionId = target.getAttribute("data-rcms-region");
    if (!regionId) return;
    var type = target.getAttribute("data-rcms-type") || "text";
    var label = target.getAttribute("data-rcms-label") || regionId;
    areaSelectionArmed = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    var base = {
      rcms: true,
      version: "v1",
      websiteId: bridgeWebsiteId,
      timestamp: Date.now()
    };
    window.parent.postMessage(Object.assign({}, base, {
      type: "rcms/v1/region-selected",
      payload: {
        regionId: regionId,
        type: type,
        label: label,
        value: selectedRegionValue(target, regionId, type),
        additive: !!(event.metaKey || event.ctrlKey || event.shiftKey)
      }
    }), "*");
    window.parent.postMessage(Object.assign({}, base, {
      type: "rcms/v1/open-inspector",
      payload: { regionId: regionId, type: type, label: label }
    }), "*");
  }

  document.addEventListener("click", bridgeAreaSelection, true);

  function pageSEOScan() {
    var headings = [];
    ["h1", "h2", "h3", "h4"].forEach(function (level) {
      document.querySelectorAll(level).forEach(function (element, index) {
        headings.push({
          id: element.id || level + "-" + index,
          level: level,
          text: (element.textContent || "").trim().slice(0, 500),
          regionId: element.closest && element.closest("[data-rcms-region]")
            ? element.closest("[data-rcms-region]").getAttribute("data-rcms-region") || ""
            : ""
        });
      });
    });
    var images = Array.prototype.map.call(document.images || [], function (element, index) {
      var region = element.closest && element.closest("[data-rcms-region]");
      return {
        id: element.id || "image-" + index,
        label: element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("src") || "Image " + (index + 1),
        src: element.currentSrc || element.getAttribute("src") || "",
        alt: element.getAttribute("alt") || "",
        regionId: region ? region.getAttribute("data-rcms-region") || "" : ""
      };
    });
    return {
      title: document.title || "",
      metaDescription: (document.querySelector('meta[name="description"]') || {}).content || "",
      canonicalUrl: (document.querySelector('link[rel="canonical"]') || {}).href || "",
      headings: headings,
      images: images,
      schemas: Array.prototype.map.call(
        document.querySelectorAll('script[type="application/ld+json"]'),
        function (element) { return (element.textContent || "").trim(); }
      ),
      text: ((document.body && document.body.innerText) || "").slice(0, 50000),
      scannedAt: Date.now()
    };
  }

  function postSEOScan() {
    window.parent.postMessage({
      rcms: true,
      version: "v1",
      websiteId: bridgeWebsiteId,
      type: "rcms/v1/seo-scan",
      payload: pageSEOScan(),
      timestamp: Date.now()
    }, "*");
  }

  function applySEOUpdate(payload) {
    if (!payload || typeof payload !== "object") return;
    if (typeof payload.metaTitle === "string") document.title = payload.metaTitle;
    if (typeof payload.metaDescription === "string") {
      var description = document.querySelector('meta[name="description"]');
      if (!description) {
        description = document.createElement("meta");
        description.setAttribute("name", "description");
        document.head.appendChild(description);
      }
      description.setAttribute("content", payload.metaDescription);
    }
    if (typeof payload.canonicalUrl === "string") {
      var canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical && payload.canonicalUrl) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        canonical.setAttribute("data-rcms-seo", "canonical");
        document.head.appendChild(canonical);
      }
      if (canonical) {
        if (payload.canonicalUrl) canonical.setAttribute("href", payload.canonicalUrl);
        else canonical.remove();
      }
    }
    if (typeof payload.jsonLd === "string") {
      var schema = document.querySelector('script[data-rcms-seo="json-ld"]');
      if (!schema && payload.jsonLd.trim()) {
        schema = document.createElement("script");
        schema.setAttribute("type", "application/ld+json");
        schema.setAttribute("data-rcms-seo", "json-ld");
        document.head.appendChild(schema);
      }
      if (schema) {
        if (payload.jsonLd.trim()) schema.textContent = payload.jsonLd;
        else schema.remove();
      }
    }
  }

  window.addEventListener("message", function (event) {
    var message = event.data;
    if (
      event.source !== window.parent
      || !message
      || typeof message !== "object"
      || message.rcms !== true
      || message.version !== "v1"
    ) return;
    if (typeof message.websiteId === "string") bridgeWebsiteId = message.websiteId;
    if (message.type === "rcms/v1/enter-area-select") {
      areaSelectionArmed = true;
      return;
    }
    if (message.type === "rcms/v1/exit-area-select") {
      areaSelectionArmed = false;
      return;
    }
    if (message.type === "rcms/v1/request-seo-scan") {
      postSEOScan();
      return;
    }
    if (message.type === "rcms/v1/seo-update") {
      applySEOUpdate(message.payload);
      postSEOScan();
      return;
    }
    if (message.type !== "rcms/v1/field-update") return;
    var payload = message.payload;
    if (!payload || typeof payload.regionId !== "string") return;
    liveRegionValues[payload.regionId] = payload.value;
    applyLiveRegion(payload.regionId);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () { applyLiveRegion(payload.regionId); });
    }
  });

  function blockUnsafeFrameNavigation() {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype,
        "src"
      );
      if (!descriptor || !descriptor.get || !descriptor.set) return;

      Object.defineProperty(HTMLIFrameElement.prototype, "src", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: function () {
          return descriptor.get.call(this);
        },
        set: function (value) {
          var target = String(value || "").trim().toLowerCase();
          descriptor.set.call(
            this,
            target.indexOf("javascript:") === 0 ? "about:blank" : value
          );
        }
      });
    } catch (_) {}
  }

  blockUnsafeFrameNavigation();

  function absoluteSourceUrl(value) {
    if (!value || typeof value !== "string") return value;
    if (value.indexOf(assetProxyPath) === 0) return value;
    if (value.slice(0, 2) === "//") return "https:" + value;
    try { return new URL(value, sourceBaseUrl).toString(); } catch (_) { return value; }
  }

  function proxySourceUrl(value) {
    var absolute = absoluteSourceUrl(value);
    if (!absolute || absolute.indexOf(assetProxyPath) === 0) return absolute;
    if (absolute.indexOf("https://") !== 0) return absolute;
    return assetProxyPath + encodeURIComponent(absolute);
  }

  function repairElement(element) {
    if (!element || !element.getAttribute) return;
    var tagName = String(element.tagName || "").toLowerCase();
    var proxyable = ["script", "link", "img", "source", "video", "audio", "track", "input"].indexOf(tagName) !== -1;
    ["src", "poster"].forEach(function (name) {
      var value = element.getAttribute(name);
      if (value && proxyable) {
        var rewrittenValue = proxySourceUrl(value);
        if (rewrittenValue !== value) element.setAttribute(name, rewrittenValue);
      }
    });
    if (tagName === "link") {
      var href = element.getAttribute("href");
      if (href) {
        var rewrittenHref = proxySourceUrl(href);
        if (rewrittenHref !== href) element.setAttribute("href", rewrittenHref);
      }
    }
    var srcset = element.getAttribute("srcset");
    if (srcset && (tagName === "img" || tagName === "source")) {
      var rewrittenSrcset = srcset.split(",").map(function (entry) {
        var parts = entry.trim().split(/\\s+/);
        parts[0] = proxySourceUrl(parts[0]);
        return parts.join(" ");
      }).join(", ");
      if (rewrittenSrcset !== srcset) element.setAttribute("srcset", rewrittenSrcset);
    }
    var style = element.getAttribute("style");
    if (style && style.indexOf("url(") !== -1) {
      var rewrittenStyle = style.replace(/url\\(\\s*(['"]?)([^'\\")]+)\\1\\s*\\)/g, function (_match, quote, value) {
        return "url(" + quote + proxySourceUrl(value) + quote + ")";
      });
      if (rewrittenStyle !== style) element.setAttribute("style", rewrittenStyle);
    }
    applyLiveRegionValue(element);
  }

  function repairTree(root) {
    repairElement(root);
    if (root && root.querySelectorAll) {
      root.querySelectorAll("[src], [href], [srcset], [poster], [style]").forEach(repairElement);
    }
  }

  function hideEmbeddedEditorToolbar(root) {
    if (embeddedEditorToolbarHidden || !document.body) return;

    var scope = root && root.nodeType === 1
      ? root
      : document;
    var labels = [];
    if (scope.matches && scope.matches("span")) labels.push(scope);
    if (scope.querySelectorAll) {
      labels = labels.concat(Array.prototype.slice.call(scope.querySelectorAll("span")));
    }
    var label = Array.prototype.find.call(labels, function (element) {
      return (element.textContent || "").indexOf("ReactCMS Visual Editor") !== -1;
    });
    if (!label) return;

    var toolbar = label;
    while (toolbar && toolbar !== document.body) {
      var style = window.getComputedStyle(toolbar);
      if (style.position === "fixed" && style.top === "0px") break;
      toolbar = toolbar.parentElement;
    }
    if (!toolbar || toolbar === document.body) return;

    toolbar.setAttribute("data-rcms-embedded-toolbar", "hidden");
    toolbar.style.setProperty("display", "none", "important");
    document.body.style.setProperty("margin-top", "0px", "important");
    embeddedEditorToolbarHidden = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    repairTree(document.documentElement);
    hideEmbeddedEditorToolbar();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes") {
          // Attribute changes can be emitted every animation frame. Repair only
          // the changed element; walking its whole subtree here can saturate the
          // main thread on animated connected sites.
          repairElement(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(function (node) {
          repairTree(node);
          hideEmbeddedEditorToolbar(node);
        });
      });
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "srcset", "poster", "style"]
    });
  });
})();
</script>`;
}

function editorCanvasReset(route) {
  let editMode = false;
  try {
    editMode = new URL(String(route || "/"), "https://preview.invalid")
      .searchParams.get("rcms_edit") === "1";
  } catch {
    editMode = false;
  }
  if (!editMode) return "";

  return `<style data-rcms-canvas-reset>
html[data-rcms-connected-canvas="edit"] body {
  overflow: auto !important;
}
html[data-rcms-connected-canvas="edit"] .preloader,
html[data-rcms-connected-canvas="edit"] .preloader-overlay,
html[data-rcms-connected-canvas="edit"] #preloader,
html[data-rcms-connected-canvas="edit"] [data-preloader],
html[data-rcms-connected-canvas="edit"] .page-loader,
html[data-rcms-connected-canvas="edit"] .loading-screen,
html[data-rcms-connected-canvas="edit"] .splash-screen {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  animation: none !important;
  transition: none !important;
}
</style><script>document.documentElement.setAttribute("data-rcms-connected-canvas", "edit");</script>`;
}

export function rewritePreviewHtml(html, upstreamUrl, route, proxyOrigin = "") {
  const url = new URL(upstreamUrl);
  const baseUrl = new URL(".", url).toString();
  const normalizedProxyOrigin = String(proxyOrigin || "").replace(/\/$/, "");
  let output = rewriteResourceTags(String(html || ""), baseUrl, normalizedProxyOrigin)
    .replace(/<base\b[^>]*>/gi, "")
    .replace(
      /<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/gi,
      ""
    )
    .replace(
      /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
      (_match, attributes, css) => (
        `<style${attributes}>${rewritePreviewCss(css, baseUrl, normalizedProxyOrigin)}</style>`
      )
    )
    .replace(
      /(\bstyle\s*=\s*)(["'])([^"']*)\2/gi,
      (_match, prefix, quote, css) => (
        `${prefix}${quote}${escapeAttribute(rewritePreviewCss(css, baseUrl, normalizedProxyOrigin))}${quote}`
      )
    );

  const injection = `<base href="${escapeAttribute(baseUrl)}">${editorCanvasReset(route)}${runtimeBootstrap(baseUrl, route, normalizedProxyOrigin)}`;
  if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/<head\b([^>]*)>/i, `<head$1>${injection}`);
  } else {
    output = `${injection}${output}`;
  }
  return output;
}

async function fetchPublicAsset(initialUrl) {
  let current = await publicHttpsUrl(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const upstream = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "*/*",
        "User-Agent": "ReactCMS-Live-Preview/1.0"
      }
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("The preview asset redirected too many times.");
      }
      current = await publicHttpsUrl(new URL(location, current).toString());
      continue;
    }
    if (!upstream.ok) {
      throw new Error(`The connected website asset returned HTTP ${upstream.status}.`);
    }
    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_ASSET_BYTES) {
      throw new Error("The connected website asset exceeds the 4 MB preview limit.");
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_ASSET_BYTES) {
      throw new Error("The connected website asset exceeds the 4 MB preview limit.");
    }
    return {
      bytes,
      contentType: upstream.headers.get("content-type") || "application/octet-stream",
      url: current
    };
  }
  throw new Error("The connected website asset could not be loaded.");
}

async function probePublicRoute(initialUrl) {
  let current = await publicHttpsUrl(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const upstream = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ReactCMS-Live-Preview/1.0"
      }
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      await upstream.body?.cancel();
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("The connected website route redirected too many times.");
      }
      current = await publicHttpsUrl(new URL(location, current).toString());
      continue;
    }
    await upstream.body?.cancel();
    return {
      ok: upstream.ok,
      status: upstream.status,
      url: current.toString()
    };
  }
  throw new Error("The connected website route could not be checked.");
}

async function proxyPreviewAsset(asset, response) {
  const { bytes, contentType, url } = await fetchPublicAsset(asset);
  const normalizedType = contentType.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  let body = bytes;
  if (
    normalizedType.includes("javascript")
    || normalizedType.includes("ecmascript")
    || /\.m?js$/.test(pathname)
  ) {
    body = new TextEncoder().encode(
      rewritePreviewJavaScript(new TextDecoder("utf-8").decode(bytes), url)
    );
  } else if (normalizedType.includes("text/css") || pathname.endsWith(".css")) {
    body = new TextEncoder().encode(
      rewritePreviewCss(new TextDecoder("utf-8").decode(bytes), url)
    );
  }

  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(200).send(Buffer.from(body));
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function requestOrigin(request) {
  const forwardedHost = firstQueryValue(request.headers?.["x-forwarded-host"]);
  const hostHeader = forwardedHost || firstQueryValue(request.headers?.host);
  const host = String(hostHeader || "").split(",")[0].trim().toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) {
    throw new Error("The Live Preview proxy hostname is invalid.");
  }
  const forwardedProtocol = String(
    firstQueryValue(request.headers?.["x-forwarded-proto"]) || "https"
  ).split(",")[0].trim().toLowerCase();
  const protocol = forwardedProtocol === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Max-Age", "86400");
    return response.status(204).end();
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET, OPTIONS");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const asset = firstQueryValue(request.query?.asset);
    if (asset) return await proxyPreviewAsset(asset, response);
    const probe = firstQueryValue(request.query?.probe);
    if (probe) {
      const result = await probePublicRoute(probe);
      response.setHeader("Cache-Control", "private, no-store, max-age=0");
      response.setHeader("X-Content-Type-Options", "nosniff");
      return response.status(200).json(result);
    }
    const target = firstQueryValue(request.query?.target);
    const mode = firstQueryValue(request.query?.mode) === "edit" ? "edit" : "preview";
    const route = previewRoute(firstQueryValue(request.query?.route), mode);
    const targetUrl = await publicHttpsUrl(target);
    targetUrl.search = "";
    targetUrl.hash = "";
    const { html, url } = await fetchPublicHtml(targetUrl);
    const previewHtml = rewritePreviewHtml(html, url, route, requestOrigin(request));

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads; "
      + "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; "
      + "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; "
      + "style-src * data: blob: 'unsafe-inline'; "
      + "img-src * data: blob:; connect-src * data: blob:; font-src * data:; "
      + "frame-ancestors 'self'"
    );
    return response.status(200).send(previewHtml);
  } catch (error) {
    if (firstQueryValue(request.query?.asset)) {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
    return response.status(400).json({
      error: error.message || "The connected website could not be prepared for Live Preview."
    });
  }
}
