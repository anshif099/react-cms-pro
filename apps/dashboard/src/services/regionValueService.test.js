import { describe, expect, it } from "vitest";
import {
  isSerializedRegionPlaceholder,
  regionDefaultsFromDefinitions,
  repairSerializedRegionValues
} from "./regionValueService";

describe("regionValueService", () => {
  const definitions = {
    "header.nav_link_1": {
      type: "button",
      defaultValue: { text: "HOME", href: "home" }
    },
    "header.section": { type: "section" }
  };

  it("recognizes internal serialization placeholders", () => {
    expect(isSerializedRegionPlaceholder("[circular]")).toBe(true);
    expect(isSerializedRegionPlaceholder("[CONTEXT DEPTH LIMIT]")).toBe(true);
    expect(isSerializedRegionPlaceholder("Circular economy")).toBe(false);
  });

  it("extracts registered defaults without treating definitions as values", () => {
    expect(regionDefaultsFromDefinitions(definitions)).toEqual({
      "header.nav_link_1": { text: "HOME", href: "home" }
    });
  });

  it("restores placeholders from registered defaults and removes unknown placeholders", () => {
    expect(repairSerializedRegionValues({
      "header.nav_link_1": "[circular]",
      "header.section": "[circular]",
      "hero.title": "A valid title"
    }, definitions)).toEqual({
      changed: true,
      regions: {
        "header.nav_link_1": { text: "HOME", href: "home" },
        "hero.title": "A valid title"
      }
    });
  });
});
