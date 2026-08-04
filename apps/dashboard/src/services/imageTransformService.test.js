import { describe, expect, it } from "vitest";
import {
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
