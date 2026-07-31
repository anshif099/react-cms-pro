import { describe, expect, it } from "vitest";
import { rewritePreviewHtml } from "../../api/live-preview";

describe("live preview HTML rewriting", () => {
  it("boots the requested route before the connected React bundle", () => {
    const result = rewritePreviewHtml(
      '<html><head></head><body><script type="module" src="/assets/app.js"></script></body></html>',
      "https://triosis.vercel.app/",
      "/contact?rcms_preview=1"
    );

    expect(result).toContain('<base href="https://triosis.vercel.app/">');
    expect(result).toContain('var previewRoute = "/contact?rcms_preview=1"');
    expect(result).toContain('src="https://triosis.vercel.app/assets/app.js"');
    expect(result.indexOf("previewRoute")).toBeLessThan(result.indexOf('type="module"'));
  });

  it("rewrites root-relative stylesheets, images, and responsive images", () => {
    const result = rewritePreviewHtml(
      '<link href="/assets/app.css"><img src="/hero.png" srcset="/small.png 1x, /large.png 2x">',
      "https://example.com/site/",
      "/about?rcms_edit=1"
    );

    expect(result).toContain('href="https://example.com/assets/app.css"');
    expect(result).toContain('src="https://example.com/hero.png"');
    expect(result).toContain(
      'srcset="https://example.com/small.png 1x, https://example.com/large.png 2x"'
    );
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
});
