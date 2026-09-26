import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import livePreviewHandler, {
  previewAssetUrl,
  rewriteLegacyRouteBootstrap,
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

  it("lets an older connected bootstrap show draft routes inside the editor", () => {
    const source = `async function start() {
      if (page?.deleted === true || !(await routeExists(pageKey, page))) {
        showDeletedPage();
        return;
      }
    }`;
    const rewritten = rewriteLegacyRouteBootstrap(source);
    expect(rewritten).toContain(
      "window.self === window.top && (page?.deleted === true || !(await routeExists(pageKey, page)))"
    );
    expect(() => new Function(rewritten)).not.toThrow();
  });

  it("routes the Home canvas through the live preview function", () => {
    for (const path of ["../../vercel.json", "../../apps/dashboard/vercel.json"]) {
      const config = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
      const rootCanvasRewrite = config.rewrites.find(
        (rewrite) => rewrite.source === "/"
          && rewrite.has?.some((condition) => condition.key === "__rcms_canvas")
      );
      expect(rootCanvasRewrite?.destination).toBe("/api/live-preview?route=/");
      expect(config.functions).toHaveProperty("api/sftp.js");
      expect(config.functions).toHaveProperty("api/live-preview.js");
    }
  });

  it("keeps both Vercel project roots self-contained", () => {
    for (const name of ["cpanel", "sftp", "live-preview", "media"]) {
      const rootFunction = readFileSync(new URL(`../../api/${name}.js`, import.meta.url), "utf8");
      const dashboardFunction = readFileSync(
        new URL(`../../apps/dashboard/api/${name}.js`, import.meta.url), "utf8"
      );
      expect(rootFunction).toBe(dashboardFunction);
    }
  });

  it("dispatches SFTP requests through the preview function route", async () => {
    const response = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };
    await livePreviewHandler({
      method: "POST",
      query: { sftp: "1" },
      body: { operation: "unsupported" }
    }, response);
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("Unsupported StackCP SFTP operation.");
  });

  it("reports failed proxied application assets to the dashboard", () => {
    const html = rewritePreviewHtml(
      '<html><head></head><body><div id="root"></div></body></html>',
      "https://triosis.in/",
      "/?rcms_preview=1",
      previewOrigin
    );
    const dom = new JSDOM(html, { runScripts: "dangerously", url: `${previewOrigin}/` });
    const postMessage = vi.spyOn(dom.window.parent, "postMessage");
    const script = dom.window.document.createElement("script");
    script.src = `${previewOrigin}/api/live-preview?asset=${encodeURIComponent("https://triosis.in/assets/missing.js")}`;
    dom.window.document.body.appendChild(script);
    script.dispatchEvent(new dom.window.Event("error"));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "rcms/v1/preview-asset-error",
      payload: { asset: "https://triosis.in/assets/missing.js" }
    }), "*");
    dom.window.close();
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

  it("previews runtime button icon size and explicit height with an older connected runtime", async () => {
    const html = rewritePreviewHtml(
      '<html><head></head><body><div data-rcms-node="action" data-rcms-type="button"><div><div><span style="min-height:42px"><span data-rcms-field="label">test</span><span aria-hidden="true">✉</span></span></div></div></div></body></html>',
      "https://triosis.vercel.app/",
      "/?rcms_edit=1",
      previewOrigin
    );
    const dom = new JSDOM(html, { runScripts: "dangerously", url: `${previewOrigin}/`, pretendToBeVisual: true });
    const { window } = dom;
    window.dispatchEvent(new window.MessageEvent("message", {
      source: window,
      data: {
        rcms: true, version: "v1", type: "rcms/v1/field-update",
        payload: { regionId: "__rcms_runtime_additions__", value: {
          children: [{ id: "action", type: "button", props: { icon: "mail", iconSize: 218, iconWidth: 44, iconHeight: 33, iconColor: "#16a34a", height: "12px" } }]
        } }
      }
    }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const icon = window.document.querySelector('[aria-hidden="true"]');
    const button = window.document.querySelector('[data-rcms-field="label"]').parentElement;
    expect(icon.style.getPropertyValue("width")).toBe("44px");
    expect(icon.style.getPropertyValue("height")).toBe("33px");
    expect(icon.style.getPropertyValue("font-size")).toBe("218px");
    expect(icon.style.getPropertyValue("color")).toBe("rgb(22, 163, 74)");
    expect(icon.style.getPropertyPriority("font-size")).toBe("important");
    expect(button.style.getPropertyValue("height")).toBe("12px");
    expect(button.style.getPropertyValue("min-height")).toBe("0px");
    icon.style.setProperty("width", "18px");
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(icon.style.getPropertyValue("width")).toBe("44px");
    window.dispatchEvent(new window.MessageEvent("message", {
      source: window,
      data: {
        rcms: true, version: "v1", type: "rcms/v1/field-update",
        payload: { regionId: "__rcms_runtime_additions__", value: {
          children: [{ id: "action", type: "button", props: { icon: "mail", iconSize: 218, iconOnly: true, height: "12px" } }]
        } }
      }
    }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(window.document.querySelector('[data-rcms-field="label"]').style.display).toBe("none");
    expect(button.style.background).toBe("transparent");
    expect(button.style.height).toBe("auto");
    dom.window.close();
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

  it("rejects an HTML fallback served for a missing stylesheet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "<html><body>SPA fallback</body></html>",
      { status: 200, headers: { "Content-Type": "text/html" } }
    )));
    const response = {
      headers: {},
      statusCode: 0,
      body: null,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };

    await livePreviewHandler({
      method: "GET",
      query: { asset: "https://triosis.in/assets/missing.css" },
      headers: {}
    }, response);

    expect(response.statusCode).toBe(502);
    expect(response.body.error).toContain("returned HTML instead of the requested asset");
    expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
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

  it("routes old canvas add-section clicks to the dashboard content form", () => {
    const result = rewritePreviewHtml(
      "<html><head></head><body><div id=\"root\"></div></body></html>",
      "https://example.com/",
      "/ad?rcms_edit=1"
    );

    expect(result).toContain('event.target.closest("[data-rcms-add-section]")');
    expect(result).toContain('button.closest("[data-rcms-node]")');
    expect(result).toContain('type: "rcms/v1/request-insert-content"');
    expect(result).toContain('event.stopImmediatePropagation()');
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
