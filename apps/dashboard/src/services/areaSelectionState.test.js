import { describe, expect, it } from "vitest";
import { didAreaSelectionComplete } from "./areaSelectionState";

describe("didAreaSelectionComplete", () => {
  it("completes when a different target key is selected", () => {
    expect(didAreaSelectionComplete({
      startKey: "ad.title",
      currentKey: "ad.description",
      startVersion: 3,
      currentVersion: 3
    })).toBe(true);
  });

  it("completes when the same target is selected again", () => {
    expect(didAreaSelectionComplete({
      startKey: "ad.title",
      currentKey: "ad.title",
      startVersion: 3,
      currentVersion: 4
    })).toBe(true);
  });

  it("keeps waiting until a new selection event arrives", () => {
    expect(didAreaSelectionComplete({
      startKey: "ad.title",
      currentKey: "ad.title",
      startVersion: 3,
      currentVersion: 3
    })).toBe(false);
  });
});
