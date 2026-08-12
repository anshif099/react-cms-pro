import { describe, expect, it } from "vitest";
import { buildSEOAudit, validateSchemaMarkup } from "./seoWorkspaceService";

describe("SEO workspace audit", () => {
  it("uses the connected canvas scan for heading and image-alt status", () => {
    const audit = buildSEOAudit({}, {
      headings: [
        { level: "h1", text: "API services" },
        { level: "h2", text: "Campaign automation" }
      ],
      images: [
        { id: "logo", alt: "Triosis Digital" },
        { id: "hero", alt: "" }
      ],
      text: "API services make API campaigns easier"
    }, "API");

    expect(audit.source).toBe("canvas");
    expect(audit.headingCounts).toMatchObject({ h1: 1, h2: 1, h3: 0, h4: 0 });
    expect(audit.missingAlt).toHaveLength(1);
    expect(audit.keywordOccurrences).toBe(2);
  });

  it("audits native hero, heading, and image components", () => {
    const audit = buildSEOAudit({
      currentPage: {
        locale: "en",
        componentTree: {
          children: [
            { id: "hero", type: "hero", props: { locales: { en: { title: "Welcome" } } } },
            { id: "heading", type: "heading", props: { level: "h3", locales: { en: { text: "Details" } } } },
            { id: "image", type: "image", props: { locales: { en: { src: "/photo.jpg", alt: "" } } } }
          ]
        }
      }
    });

    expect(audit.headingCounts.h1).toBe(1);
    expect(audit.headingCounts.h3).toBe(1);
    expect(audit.missingAlt[0].id).toBe("image");
  });

  it("validates JSON-LD before it is saved", () => {
    expect(validateSchemaMarkup('{"@type":"WebPage"}').valid).toBe(true);
    expect(validateSchemaMarkup("{broken").valid).toBe(false);
    expect(validateSchemaMarkup("SEO text").valid).toBe(false);
  });
});
