import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

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

function runtimeBootstrap(origin, route) {
  return `<script>
(function () {
  var sourceOrigin = ${JSON.stringify(origin)};
  var previewRoute = ${JSON.stringify(route)};
  var embeddedEditorToolbarHidden = false;
  try { history.replaceState(null, "", previewRoute); } catch (_) {}

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
    if (value.slice(0, 2) === "//") return "https:" + value;
    if (value.charAt(0) === "/") return sourceOrigin + value;
    return value;
  }

  function repairElement(element) {
    if (!element || !element.getAttribute) return;
    ["src", "poster"].forEach(function (name) {
      var value = element.getAttribute(name);
      if (value && value.charAt(0) === "/") {
        element.setAttribute(name, absoluteSourceUrl(value));
      }
    });
    var srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute("srcset", srcset.split(",").map(function (entry) {
        var parts = entry.trim().split(/\\s+/);
        parts[0] = absoluteSourceUrl(parts[0]);
        return parts.join(" ");
      }).join(", "));
    }
    var style = element.getAttribute("style");
    if (style && style.indexOf("url(/") !== -1) {
      element.setAttribute("style", style.replace(/url\\((['"]?)\\//g, "url($1" + sourceOrigin + "/"));
    }
  }

  function repairTree(root) {
    repairElement(root);
    if (root && root.querySelectorAll) {
      root.querySelectorAll("[src], [srcset], [poster], [style]").forEach(repairElement);
    }
  }

  function hideEmbeddedEditorToolbar() {
    if (embeddedEditorToolbarHidden || !document.body) return;

    var labels = document.querySelectorAll("span");
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
        repairTree(mutation.target);
        mutation.addedNodes.forEach(repairTree);
      });
      hideEmbeddedEditorToolbar();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "poster", "style"]
    });
  });
})();
</script>`;
}

export function rewritePreviewHtml(html, upstreamUrl, route) {
  const url = new URL(upstreamUrl);
  const origin = url.origin;
  const baseUrl = new URL(".", url).toString();
  let output = String(html || "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(
      /<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/gi,
      ""
    )
    .replace(
      /(\b(?:src|href|poster)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,
      (_match, prefix, quote, path) => `${prefix}${quote}${origin}${path}${quote}`
    )
    .replace(
      /(\bsrcset\s*=\s*)(["'])([^"']*)\2/gi,
      (_match, prefix, quote, value) => {
        const rewritten = value.split(",").map((entry) => {
          const parts = entry.trim().split(/\s+/);
          if (parts[0]?.startsWith("/") && !parts[0].startsWith("//")) {
            parts[0] = `${origin}${parts[0]}`;
          }
          return parts.join(" ");
        }).join(", ");
        return `${prefix}${quote}${rewritten}${quote}`;
      }
    );

  const injection = `<base href="${escapeAttribute(baseUrl)}">${runtimeBootstrap(origin, route)}`;
  if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/<head\b([^>]*)>/i, `<head$1>${injection}`);
  } else {
    output = `${injection}${output}`;
  }
  return output;
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const target = firstQueryValue(request.query?.target);
    const mode = firstQueryValue(request.query?.mode) === "edit" ? "edit" : "preview";
    const route = previewRoute(firstQueryValue(request.query?.route), mode);
    const targetUrl = await publicHttpsUrl(target);
    targetUrl.search = "";
    targetUrl.hash = "";
    const { html, url } = await fetchPublicHtml(targetUrl);
    const previewHtml = rewritePreviewHtml(html, url, route);

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
    return response.status(400).json({
      error: error.message || "The connected website could not be prepared for Live Preview."
    });
  }
}
