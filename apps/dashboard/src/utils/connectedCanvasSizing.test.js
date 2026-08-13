import { describe, expect, it } from "vitest";
import { calculateConnectedCanvasSizing } from "./connectedCanvasSizing";

describe("calculateConnectedCanvasSizing", () => {
  it("fits a desktop canvas inside the viewport without touching its scroll boundary", () => {
    const result = calculateConnectedCanvasSizing({
      viewportWidth: 1200,
      viewportHeight: 800,
      canvasWidth: 1440
    });

    expect(result.scale).toBeCloseTo(1164 / 1440);
    expect(result.layoutWidth).toBeCloseTo(1164);
    expect(result.layoutHeight).toBeCloseTo(764);
    expect(result.frameHeight).toBeCloseTo(764 / result.scale);
  });

  it("keeps a canvas at natural size when the viewport is wide enough", () => {
    const result = calculateConnectedCanvasSizing({
      viewportWidth: 1600,
      viewportHeight: 900,
      canvasWidth: 1440
    });

    expect(result.scale).toBe(1);
    expect(result.layoutWidth).toBe(1440);
    expect(result.layoutHeight).toBe(864);
  });

  it("preserves the minimum logical height and allows intentional vertical scrolling", () => {
    const result = calculateConnectedCanvasSizing({
      viewportWidth: 1200,
      viewportHeight: 500,
      canvasWidth: 1440
    });

    expect(result.frameHeight).toBe(700);
    expect(result.layoutHeight).toBeGreaterThan(500 - 36);
  });
});

