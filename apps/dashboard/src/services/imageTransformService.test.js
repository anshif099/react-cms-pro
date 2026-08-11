import { describe, expect, it } from "vitest";
import {
  imageTargetsForRequest,
  isImageRecolorRequest,
  recolorSvgMarkup,
  requestedImageColor
} from "./imageTransformService";

describe("selected image transformation", () => {
  it("understands a natural-language logo recolor request", () => {
    expect(isImageRecolorRequest("logo colour change to another without white")).toBe(true);
    expect(isImageRecolorRequest("change this heading text")).toBe(false);
  });

  it("uses a non-white brand color when the prompt omits a hex value", () => {
    expect(requestedImageColor("remove white from this logo", {
      colors: { primary: "#FF5757", accent: "#ffffff" }
    })).toBe("#ff5757");
  });

  it("understands rose as an explicit image color", () => {
    expect(requestedImageColor("logo colour change rose", {
      colors: { primary: "#2563eb" }
    })).toBe("#f43f5e");
  });

  it("targets the current page logo instead of an unrelated selected image", () => {
    const context = {
      currentPage: {
        pageKey: "ad",
        record: { title: "Ad" },
        selectedRegion: {
          regionId: "ad.hero_image",
          type: "image",
          label: "Hero Visual",
          value: { src: "/hero.jpg", alt: "Campaign" }
        },
        editableRegionDefinitions: {
          "header.logo": { type: "image", label: "Header Logo" },
          "ad.hero_image": { type: "image", label: "Hero Visual" },
          "ad.cta_logo": { type: "image", label: "CTA Logo Symbol" }
        },
        editableRegionValues: {
          "header.logo": { src: "/header.png", alt: "Triosis Logo" },
          "ad.hero_image": { src: "/hero.jpg", alt: "Campaign" },
          "ad.cta_logo": { src: "/symbol.png", alt: "Triosis Symbol" }
        }
      }
    };

    expect(imageTargetsForRequest(context, "logo colour change rose")[0].targetId)
      .toBe("ad.cta_logo");
    expect(imageTargetsForRequest(context, "header logo colour rose")[0].targetId)
      .toBe("header.logo");
    expect(imageTargetsForRequest(context, "image colour change rose")[0].targetId)
      .toBe("ad.hero_image");
  });

  it("recolors white SVG logo paint while preserving transparency", () => {
    const result = recolorSvgMarkup(
      '<svg><path fill="#fff" d="M0 0h10v10z"/><path stroke="white" d="M1 1h8"/></svg>',
      "#FF5757"
    );
    expect(result.replacements).toBe(2);
    expect(result.markup).toContain('fill="#ff5757"');
    expect(result.markup).toContain('stroke="#ff5757"');
  });
});
