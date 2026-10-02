import { describe, expect, it } from "vitest";
import { applyPageBackground, connectedPageBackgroundPlan } from "./pageBackground";
import { applyAIPlan } from "../services/aiPageMutationService";

describe("page background", () => {
  it("covers responsive section backgrounds while preserving content and button colors", () => {
    const tree = { id: "page", type: "page", children: [
      { id: "hero", type: "hero", props: { title: "Hello", design: { paddingY: 80 } }, styles: { mobile: { background: "red" } } },
      { id: "button", type: "button", props: { color: "blue" } }
    ] };
    const result = applyPageBackground(tree, "#123456");
    expect(result.styles.base.background).toBe("#123456");
    expect(result.children[0].styles.mobile.background).toBe("#123456");
    expect(result.children[0].props).toEqual({ title: "Hello", design: { paddingY: 80, background: "#123456" } });
    expect(result.children[1]).toEqual(tree.children[1]);
    expect(tree.children[0].styles.mobile.background).toBe("red");
  });

  it("updates every connected section through the existing persistence contract", () => {
    const context = { currentPage: {
      editableRegionDefinitions: { hero: { type: "section" }, footer: { type: "section" }, title: { type: "text" } },
      editableRegionValues: { hero: { background: "red", paddingY: 20 }, footer: { background: "blue" }, title: "Hello" }
    } };
    const result = applyAIPlan({ plan: connectedPageBackgroundPlan(context, "#123456"), regions: context.currentPage.editableRegionValues });
    expect(result.regions.hero).toEqual({ background: "#123456", paddingY: 20 });
    expect(result.regions.footer.background).toBe("#123456");
    expect(result.regions.title).toBe("Hello");
  });

  it("rejects invalid colors and pages without editable sections", () => {
    expect(() => applyPageBackground({}, "invalid")).toThrow();
    expect(() => connectedPageBackgroundPlan({}, "#123456")).toThrow("no editable sections");
  });
});
