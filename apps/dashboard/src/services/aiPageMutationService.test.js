import { describe, expect, it } from "vitest";
import { applyAIPlan } from "./aiPageMutationService";
import { validateAIPlan } from "./aiBuilderContract";

function operation(type, overrides = {}) {
  return {
    id: `${type}-${Math.random()}`,
    type,
    summary: type,
    reason: "Test the coordinated editor operation.",
    targetId: null,
    destinationId: null,
    position: null,
    componentType: null,
    patches: [],
    ...overrides
  };
}

function plan(operations) {
  return {
    title: "Improve the page",
    summary: "A coordinated test plan.",
    assistantMessage: "Ready for approval.",
    risk: "low",
    estimatedEdits: operations.length,
    requiresApproval: true,
    affectedAreas: ["Page"],
    preserved: ["Brand"],
    validationChecks: ["Accessibility"],
    operations
  };
}

const tree = {
  id: "home",
  type: "page",
  version: 2,
  locale: "en",
  children: [{
    id: "hero-1",
    type: "hero",
    label: "Hero",
    props: { locales: { en: { title: "Old title" } } },
    styles: { base: {} },
    children: []
  }]
};

describe("AI page mutation executor", () => {
  it("applies structural, content, responsive, theme, SEO, and region edits in one transaction", () => {
    const execution = applyAIPlan({
      plan: plan([
        operation("update_component", {
          targetId: "hero-1",
          patches: [
            { path: "props.locales.en.title", valueJson: '"Premium platform"' },
            { path: "styles.mobile.padding", valueJson: '"24px"' }
          ]
        }),
        operation("insert_component", {
          targetId: "hero-1",
          position: "after",
          componentType: "pricing",
          patches: [{ path: "label", valueJson: '"Pricing"' }]
        }),
        operation("update_theme", {
          patches: [{ path: "colors.primary", valueJson: '"#7c3aed"' }]
        }),
        operation("update_page", {
          patches: [{ path: "seo.metaTitle", valueJson: '"Premium platform pricing"' }]
        }),
        operation("update_region", {
          targetId: "home.cta",
          patches: [{ path: "value.text", valueJson: '"Start today"' }]
        })
      ]),
      tree,
      theme: { colors: { primary: "#2563eb" } },
      pageSettings: { seo: {} },
      regions: { "home.cta": { text: "Get started" } },
      componentTypes: ["hero", "pricing"],
      createNode: (type) => ({
        id: `${type}-new`,
        type,
        props: {},
        styles: { base: {} },
        children: []
      })
    });

    expect(execution.summary).toEqual({ requested: 5, applied: 5, failed: 0 });
    expect(execution.tree.children[0].props.locales.en.title).toBe("Premium platform");
    expect(execution.tree.children[0].styles.mobile.padding).toBe("24px");
    expect(execution.tree.children[1]).toMatchObject({ id: "pricing-new", label: "Pricing" });
    expect(execution.theme.colors.primary).toBe("#7c3aed");
    expect(execution.pageSettings.seo.metaTitle).toBe("Premium platform pricing");
    expect(execution.regions["home.cta"].text).toBe("Start today");
    expect(execution.before.tree.children).toHaveLength(1);
  });

  it("creates and replaces source drafts without accepting unsafe paths", () => {
    const execution = applyAIPlan({
      plan: plan([
        operation("replace_source_file", {
          targetId: "src/pages/Home.jsx",
          patches: [{ path: "content", valueJson: JSON.stringify("export default function Home(){ return <main />; }") }]
        }),
        operation("create_source_file", {
          targetId: "src/components/Pricing.jsx",
          patches: [{ path: "content", valueJson: JSON.stringify("export default function Pricing(){ return null; }") }]
        })
      ]),
      sourceFiles: { "src/pages/Home.jsx": "export default function Home(){}" }
    });

    expect(execution.summary.failed).toBe(0);
    expect(execution.sourceFiles["src/pages/Home.jsx"]).toContain("<main />");
    expect(execution.sourceFiles["src/components/Pricing.jsx"]).toContain("Pricing");
  });

  it("targets components created earlier in the same coordinated plan", () => {
    const execution = applyAIPlan({
      plan: plan([
        operation("insert_component", {
          id: "add-pricing",
          targetId: "hero-1",
          position: "after",
          componentType: "pricing"
        }),
        operation("insert_component", {
          id: "add-button",
          targetId: "$op:add-pricing",
          position: "inside",
          componentType: "button"
        }),
        operation("update_component", {
          id: "label-button",
          targetId: "$op:add-button",
          patches: [{ path: "label", valueJson: '"Choose a plan"' }]
        })
      ]),
      tree,
      componentTypes: ["pricing", "button"],
      createNode: (type) => ({
        id: `${type}-new`,
        type,
        props: {},
        styles: { base: {} },
        children: []
      })
    });

    expect(execution.summary).toEqual({ requested: 3, applied: 3, failed: 0 });
    expect(execution.tree.children[1].children[0]).toMatchObject({
      id: "button-new",
      label: "Choose a plan"
    });
  });

  it("protects locked components and rejects drive-qualified source paths", () => {
    const lockedTree = structuredClone(tree);
    lockedTree.children[0].locked = true;
    const execution = applyAIPlan({
      plan: plan([
        operation("move_component", {
          targetId: "hero-1",
          destinationId: "hero-1",
          position: "after"
        }),
        operation("create_source_file", {
          targetId: "C:/outside.jsx",
          patches: [{ path: "content", valueJson: '"unsafe"' }]
        })
      ]),
      tree: lockedTree
    });

    expect(execution.summary).toEqual({ requested: 2, applied: 0, failed: 2 });
    expect(execution.results[0].detail).toMatch(/locked/i);
    expect(execution.results[1].detail).toMatch(/invalid source path/i);
  });

  it("does not replace source files that were truncated in AI context", () => {
    const execution = applyAIPlan({
      plan: plan([
        operation("replace_source_file", {
          targetId: "src/pages/Large.jsx",
          patches: [{ path: "content", valueJson: '"incomplete replacement"' }]
        })
      ]),
      sourceFiles: { "src/pages/Large.jsx": "complete original source" },
      blockedSourcePaths: ["src/pages/Large.jsx"]
    });

    expect(execution.summary.failed).toBe(1);
    expect(execution.sourceFiles["src/pages/Large.jsx"]).toBe("complete original source");
    expect(execution.results[0].detail).toMatch(/truncated/i);
  });

  it("rejects prototype-polluting patch paths before execution", () => {
    expect(() => validateAIPlan(plan([
      operation("update_theme", {
        patches: [{ path: "colors.__proto__.polluted", valueJson: '"yes"' }]
      })
    ]))).toThrow(/unsafe patch path/i);
  });
});
