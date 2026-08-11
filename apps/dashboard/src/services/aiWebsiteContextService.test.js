import { describe, expect, it } from "vitest";
import { asSerializable, flattenContextTree } from "./aiWebsiteContextService";

describe("asSerializable", () => {
  it("serializes shared objects at every valid location", () => {
    const sharedButton = { text: "ABOUT US", href: "about" };

    expect(asSerializable({
      value: sharedButton,
      definition: { defaultValue: sharedButton }
    })).toEqual({
      value: { text: "ABOUT US", href: "about" },
      definition: {
        defaultValue: { text: "ABOUT US", href: "about" }
      }
    });
  });

  it("still replaces actual ancestor cycles", () => {
    const cyclic = { text: "HOME" };
    cyclic.self = cyclic;

    expect(asSerializable(cyclic)).toEqual({
      text: "HOME",
      self: "[circular]"
    });
  });
});

describe("flattenContextTree", () => {
  it("preserves depth-first component order and parent metadata", () => {
    const tree = {
      children: [
        {
          id: "section",
          children: [
            { id: "heading", children: [] },
            { id: "copy", children: [] }
          ]
        },
        { id: "footer", children: [] }
      ]
    };

    expect(flattenContextTree(tree).map(({ id, parentId, siblingIndex }) => ({
      id,
      parentId,
      siblingIndex
    }))).toEqual([
      { id: "section", parentId: null, siblingIndex: 0 },
      { id: "heading", parentId: "section", siblingIndex: 0 },
      { id: "copy", parentId: "section", siblingIndex: 1 },
      { id: "footer", parentId: null, siblingIndex: 1 }
    ]);
  });

  it("stops malformed circular component trees", () => {
    const component = { id: "circular", children: [] };
    component.children.push(component);

    expect(flattenContextTree({ children: [component] })).toHaveLength(1);
  });

  it("caps unusually large trees so local planning stays responsive", () => {
    const children = Array.from({ length: 5200 }, (_, index) => ({
      id: `component-${index}`,
      children: []
    }));

    expect(flattenContextTree({ children })).toHaveLength(5000);
  });
});
