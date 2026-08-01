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
      `src="${previewOrigin}${previewAssetUrl("/assets/app.js", "https://triosis.vercel.app/")}"`
    );
    expect(result.indexOf("previewRoute")).toBeLessThan(result.indexOf('type="module"'));
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
