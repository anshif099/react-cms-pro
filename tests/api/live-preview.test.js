import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import livePreviewHandler, {
  previewAssetUrl,
  rewritePreviewCss,
  rewritePreviewHtml,
  rewritePreviewJavaScript
} from "../../api/live-preview";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
}));

const previewOrigin = "https://reactcms.example";

describe("live preview HTML rewriting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes the Home canvas through the live preview function", () => {
    const config = JSON.parse(
      readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")
    );
    const rootCanvasRewrite = config.rewrites.find(
      (rewrite) => rewrite.source === "/"
        && rewrite.has?.some((condition) => condition.key === "__rcms_canvas")
    );

    expect(rootCanvasRewrite?.destination).toBe("/api/live-preview?route=/");
  });

  it("boots the requested route before the connected React bundle", () => {
    const result = rewritePreviewHtml(
      '<html><head></head><body><script type="module" src="/assets/app.js"></script></body></html>',
      "https://triosis.vercel.app/",
      "/contact?rcms_preview=1",
      previewOrigin
    );

    expect(result).toContain('<base href="https://triosis.vercel.app/">');
    expect(result).toContain('var previewRoute = "/contact?rcms_preview=1"');
    expect(result).toContain(
      "var previewHistoryUrl = new URL(previewRoute, window.location.href)"
    );
    expect(result).toContain(
      'history.replaceState(null, "", previewHistoryUrl.toString())'
    );
    expect(result).not.toContain('history.replaceState(null, "", previewRoute)');
    expect(result).toContain(
      `src="${previewOrigin}${previewAssetUrl("/assets/app.js", "https://triosis.vercel.app/")}"`
    );
    expect(result.indexOf("previewRoute")).toBeLessThan(result.indexOf('type="module"'));
  });

  it("keeps the deleted-route bootstrap app import on the connected origin", () => {
    const result = rewritePreviewHtml(
      '<html><head></head><body><script type="module" src="/reactcms-route-bootstrap.js?rcms=1" data-reactcms-route-bootstrap="true" data-reactcms-app="/assets/app.js?rcms=2"></script></body></html>',
      "https://triosis.in/ad",
      "/best-ads-company?rcms_edit=1",
      previewOrigin
    );

    expect(result).toContain(
      `src="${previewOrigin}${previewAssetUrl("/reactcms-route-bootstrap.js?rcms=1", "https://triosis.in/")}"`
    );
    expect(result).toContain(
      `data-reactcms-app="${previewOrigin}${previewAssetUrl("/assets/app.js?rcms=2", "https://triosis.in/")}"`
    );
    expect(result).not.toContain('data-reactcms-app="/assets/app.js');
  });

  it("rewrites root-relative stylesheets, images, and responsive images", () => {
    const result = rewritePreviewHtml(
      '<link href="/assets/app.css"><img src="/hero.png" srcset="/small.png 1x, /large.png 2x">',
      "https://example.com/site/",
      "/about?rcms_edit=1",
      previewOrigin
    );

    expect(result).toContain(
      `href="${previewOrigin}${previewAssetUrl("/assets/app.css", "https://example.com/site/")}"`
    );
    expect(result).toContain(
      `src="${previewOrigin}${previewAssetUrl("/hero.png", "https://example.com/site/")}"`
    );
    expect(result).toContain(
      `srcset="${previewOrigin}${previewAssetUrl("/small.png", "https://example.com/site/")} 1x, ${previewOrigin}${previewAssetUrl("/large.png", "https://example.com/site/")} 2x"`
    );
  });

  it("rewrites CSS assets and JavaScript module imports through the preview proxy", () => {
    const css = rewritePreviewCss(
      '@font-face{src:url("./font.woff2")}@import "./theme.css";',
      "https://triosis.in/assets/app.css"
    );
    expect(css).toContain(previewAssetUrl("./font.woff2", "https://triosis.in/assets/app.css"));
    expect(css).toContain(previewAssetUrl("./theme.css", "https://triosis.in/assets/app.css"));

    const javascript = rewritePreviewJavaScript(
      'import React from "react"; import("./chunk.js"); export { x } from "./shared.js";',
      "https://triosis.in/assets/app.js"
    );
    expect(javascript).toContain('from "react"');
    expect(javascript).toContain(previewAssetUrl("./chunk.js", "https://triosis.in/assets/app.js"));
    expect(javascript).toContain(previewAssetUrl("./shared.js", "https://triosis.in/assets/app.js"));
  });

  it("serves preview assets with CORS permission for the opaque sandbox origin", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      'console.log("preview asset")',
      {
        status: 200,
        headers: { "Content-Type": "text/javascript" }
      }
    )));
    const response = {
      headers: {},
      statusCode: 0,
      body: null,
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(value) {
        this.body = value;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      }
    };

    await livePreviewHandler({
      method: "GET",
      query: { asset: "https://triosis.in/assets/app.js" },
      headers: {}
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.headers["content-type"]).toBe("text/javascript");
    expect(Buffer.isBuffer(response.body)).toBe(true);
  });

  it("reports a missing SPA deep link so the dashboard can use a root fallback", async () => {
    const cancel = vi.fn(async () => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ "Content-Type": "text/html" }),
      body: { cancel }
    })));
    const response = {
      headers: {},
      statusCode: 0,
      body: null,
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      }
    };

    await livePreviewHandler({
      method: "GET",
      query: { probe: "https://triosis.in/faqs?rcms_preview=1" },
      headers: {}
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      status: 404,
      url: "https://triosis.in/faqs?rcms_preview=1"
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("removes upstream base and meta CSP before adding the sandbox bootstrap", () => {
    const result = rewritePreviewHtml(
      '<head><base href="/old/"><meta http-equiv="Content-Security-Policy" content="script-src none"></head>',
      "https://example.com/sub/index.html",
      "/"
    );

    expect(result).not.toContain("script-src none");
    expect(result).not.toContain('href="/old/"');
    expect(result).toContain('<base href="https://example.com/sub/">');
  });

  it("suppresses legacy editor chrome inside the connected page canvas", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><div id=\"root\"></div></body></html>",
      "https://example.com/",
      "/services?rcms_preview=1"
    );

    expect(result).toContain('"ReactCMS Visual Editor"');
    expect(result).toContain('data-rcms-embedded-toolbar');
    expect(result).toContain(
      'document.body.style.setProperty("margin-top", "0px", "important")'
    );
  });

  it("does not rescan an animated element subtree for every style mutation", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><div id=\"root\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );

    expect(result).toContain('if (mutation.type === "attributes")');
    expect(result).toContain("repairElement(mutation.target)");
    expect(result).not.toContain("repairTree(mutation.target)");
    expect(result).toContain("hideEmbeddedEditorToolbar(node)");
  });

  it("suppresses connected-site preloaders in edit mode without changing preview mode", () => {
    const editResult = rewritePreviewHtml(
      "<html><head></head><body><div class=\"preloader-overlay\">Loading</div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );
    const previewResult = rewritePreviewHtml(
      "<html><head></head><body><div class=\"preloader-overlay\">Loading</div></body></html>",
      "https://example.com/",
      "/ad?rcms_preview=1"
    );

    expect(editResult).toContain('data-rcms-connected-canvas="edit"');
    expect(editResult).toContain(".preloader-overlay");
    expect(editResult).toContain("overflow: auto !important");
    expect(previewResult).not.toContain("data-rcms-canvas-reset");
  });

  it("stabilizes animated connected sites only inside the edit canvas", () => {
    const editResult = rewritePreviewHtml(
      "<html><head></head><body><div class=\"custom-cursor-dot\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );
    const previewResult = rewritePreviewHtml(
      "<html><head></head><body><div class=\"custom-cursor-dot\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_preview=1"
    );

    expect(editResult).toContain("animation-duration: 0.01ms !important");
    expect(editResult).toContain("transition-duration: 0.01ms !important");
    expect(editResult).toContain(".custom-cursor-dot");
    expect(editResult).toContain("outline-style: solid !important");
    expect(editResult).toContain("cursor: auto !important");
    expect(previewResult).not.toContain("animation-duration: 0.01ms !important");
    expect(previewResult).not.toContain("outline-style: solid !important");
  });

  it("bridges section styles for connected sites using an older SDK", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><div id=\"root\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );

    expect(result).toContain('message.type !== "rcms/v1/field-update"');
    expect(result).toContain('document.querySelectorAll("[data-rcms-region]")');
    expect(result).toContain('element.style.setProperty(property, nextValue, "important")');
    expect(result).toContain('setBridgedStyle(element, "background", value.background, hasBackground)');
    expect(result).toContain('setBridgedStyle(element, "color", value.color, hasColor)');
    expect(result).toContain('setBridgedStyle(element, "font-size", responsiveFontSize, hasFontSize)');
  });

  it("bridges one-shot AI area selection from an opaque sandbox", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><div id=\"root\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );

    expect(result).toContain('message.type === "rcms/v1/enter-area-select"');
    expect(result).toContain('event.target.closest("[data-rcms-region]")');
    expect(result).toContain('type: "rcms/v1/region-selected"');
    expect(result).toContain("selectedRegionValue(target, regionId, type)");
    expect(result).toContain("event.stopImmediatePropagation()");
  });

  it("audits and previews SEO metadata inside the connected canvas", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><h1>Welcome</h1><img src=\"/hero.jpg\"></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );

    expect(result).toContain('message.type === "rcms/v1/request-seo-scan"');
    expect(result).toContain('type: "rcms/v1/seo-scan"');
    expect(result).toContain('document.querySelectorAll(level)');
    expect(result).toContain('document.images || []');
    expect(result).toContain('message.type === "rcms/v1/seo-update"');
    expect(result).toContain('script[data-rcms-seo="json-ld"]');
  });

  it("blocks javascript iframe navigation without granting preview same-origin access", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body></body></html>",
      "https://example.com/",
      "/?rcms_edit=1"
    );

    expect(result).toContain("blockUnsafeFrameNavigation");
    expect(result).toContain(
      'target.indexOf("javascript:") === 0 ? "about:blank" : value'
    );
    expect(result).not.toContain("allow-same-origin");
  });
});
