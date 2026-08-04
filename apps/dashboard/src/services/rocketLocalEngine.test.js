import { describe, expect, it, vi } from "vitest";
import { validateAIPlan } from "./aiBuilderContract";
import { applyAIPlan } from "./aiPageMutationService";
import aiWebsiteAgentService from "./aiWebsiteAgentService";
import rocketLocalEngine from "./rocketLocalEngine";

function connectedContext() {
  return {
    editorSurface: "connected-runtime",
    capabilities: ["update_page", "update_theme", "update_region"],
    currentPage: {
      locale: "en",
      record: { title: "Ad" },
      settings: { seo: {} },
      componentTree: null,
      flattenedComponentIndex: [],
      selectedRegion: {
        regionId: "ad.hero",
        type: "section",
        label: "ad.hero",
        value: { background: "#000000", paddingY: 80 }
      },
      editableRegionDefinitions: {
        "ad.hero": { type: "section", label: "Hero section" }
      },
      editableRegionValues: {
        "ad.hero": { background: "#000000", paddingY: 80 }
      }
    },
    designSystem: {
      theme: { colors: { primary: "#ff5b5b", background: "#000000", text: "#ffffff" } }
    },
    constraints: {
      preserveWebsiteShell: true,
      registeredComponentTypes: ["hero", "features", "pricing", "faq", "cta"]
    }
  };
}

function nativeContext() {
  return {
    editorSurface: "native",
    capabilities: [
      "update_page",
      "update_theme",
      "insert_component",
      "update_component"
    ],
    currentPage: {
      locale: "en",
      record: { title: "Home" },
      settings: { seo: {} },
      componentTree: {
        id: "home",
        type: "page",
        children: []
      },
      flattenedComponentIndex: []
    },
    designSystem: {
      theme: { colors: { primary: "#2563eb", background: "#ffffff", text: "#0f172a" } }
    },
    constraints: {
      preserveWebsiteShell: false,
      registeredComponentTypes: ["hero", "features", "testimonials", "pricing", "faq", "cta"]
    }
  };
}

function connectedFullPageContext() {
  const context = connectedContext();
  context.currentPage.editableRegionDefinitions = {
    "ad.hero": { type: "section", label: "Hero section" },
    "ad.stats_carousel_section": { type: "section", label: "Statistics" },
    "ad.body_section": { type: "section", label: "Main content" },
    "ad.cta_section": { type: "section", label: "Call to action" },
    "ad.title": { type: "text", label: "Page title" }
  };
  context.currentPage.editableRegionValues = {
    "ad.hero": { background: "#000000", paddingY: 80 },
    "ad.stats_carousel_section": { background: "#111111" },
    "ad.body_section": { background: "#0d0d0d" },
    "ad.cta_section": { background: "#111111" },
    "ad.title": "Ad"
  };
  return context;
}

describe("embedded Rocket AI engine", () => {
  it("changes the selected connected section background without an API request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await aiWebsiteAgentService.createPlan({
      intent: "change the page background colour black to this: #F5F5F7",
      context: connectedContext(),
      memory: {}
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.model).toBe("rocket-embedded-v1");
    expect(response.usage.networkRequests).toBe(0);
    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.hero",
      patches: [{ path: "value.background", valueJson: '"#F5F5F7"' }]
    });
    expect(() => validateAIPlan(response.plan)).not.toThrow();
    const execution = applyAIPlan({
      plan: response.plan,
      regions: connectedContext().currentPage.editableRegionValues
    });
    expect(execution.changed).toBe(true);
    expect(execution.regions["ad.hero"].background).toBe("#F5F5F7");
    fetchSpy.mockRestore();
  });

  it("finds the page section when it is not currently selected", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = null;
    const response = await rocketLocalEngine.createPlan({
      intent: "Change the page background to #f5f5f7",
      context,
      memory: {}
    });

    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.hero",
      patches: [{ path: "value.background", valueJson: '"#f5f5f7"' }]
    });
  });

  it("applies an explicit page background request to every editable section", async () => {
    const context = connectedFullPageContext();
    const response = await rocketLocalEngine.createPlan({
      intent: "change background colour on this page black change to add: #F5F5F7",
      context,
      memory: {}
    });

    expect(response.plan.operations.map((operation) => operation.targetId)).toEqual([
      "ad.hero",
      "ad.stats_carousel_section",
      "ad.body_section",
      "ad.cta_section"
    ]);
    expect(response.plan.operations.every((operation) => (
      operation.patches[0].valueJson === '"#F5F5F7"'
    ))).toBe(true);
  });

  it("carries the prior background and color into a natural-language follow-up", async () => {
    const context = connectedFullPageContext();
    const response = await rocketLocalEngine.createPlan({
      intent: "full page change not only one module",
      context,
      memory: {},
      conversation: [
        { role: "user", content: "change the page background from black to #F5F5F7" },
        { role: "assistant", content: "Applied the selected section edit." }
      ]
    });

    expect(response.plan.operations).toHaveLength(4);
    expect(response.plan.operations.map((operation) => operation.targetId)).toEqual([
      "ad.hero",
      "ad.stats_carousel_section",
      "ad.body_section",
      "ad.cta_section"
    ]);
    expect(response.plan.assistantMessage).toMatch(/carried forward/i);
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues
    });
    expect(execution.regions["ad.body_section"].background).toBe("#F5F5F7");
    expect(execution.regions["ad.cta_section"].background).toBe("#F5F5F7");
  });

  it("prefers the visible hero when connected section values have not hydrated", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = null;
    context.currentPage.editableRegionDefinitions = {
      "ad.body_section": { type: "section", label: "Main content" },
      "ad.hero": { type: "section", label: "Ad hero" }
    };
    context.currentPage.editableRegionValues = {
      "ad.body_section": null,
      "ad.hero": null
    };

    const response = await rocketLocalEngine.createPlan({
      intent: "Change the black background colour into #191919",
      context,
      memory: {}
    });

    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.hero",
      patches: [{ path: "value.background", valueJson: '"#191919"' }]
    });
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues
    });
    expect(execution.regions["ad.hero"]).toEqual({ background: "#191919" });
  });

  it("does not claim a fake edit for an unrelated prompt", async () => {
    const response = await rocketLocalEngine.createPlan({
      intent: "I was checking the screen sharing option, but the live ended",
      context: connectedContext(),
      memory: {}
    });

    expect(response.plan.operations).toEqual([]);
    expect(response.plan.assistantMessage).toMatch(/help diagnose/i);
  });

  it("continues the conversation with a useful shell-level logo diagnosis", async () => {
    const response = await rocketLocalEngine.createPlan({
      intent: "head logo not showing",
      context: connectedContext(),
      memory: {},
      conversation: [
        { role: "user", content: "full page change not only one module" }
      ]
    });

    expect(response.plan.operations).toEqual([]);
    expect(response.plan.assistantMessage).toMatch(/connected website shell/i);
    expect(response.plan.assistantMessage).toMatch(/header component/i);
  });

  it("builds a native landing page from real registered components", async () => {
    const response = await rocketLocalEngine.createPlan({
      intent: "Build a SaaS landing page",
      context: nativeContext(),
      memory: {}
    });

    expect(response.plan.operations.map((operation) => operation.componentType)).toEqual([
      "hero",
      "features",
      "testimonials",
      "pricing",
      "faq",
      "cta"
    ]);
    expect(response.plan.operations[1].targetId).toBe("$op:rocket-edit-1");
    expect(() => validateAIPlan(response.plan)).not.toThrow();
  });

  it("creates brand-aware procedural artwork entirely in the browser", async () => {
    const result = await rocketLocalEngine.generateImage({
      prompt: "Coral technology network",
      brandContext: {
        theme: { colors: { primary: "#ff5b5b", accent: "#22d3ee", background: "#080b14" } }
      }
    });

    expect(result.model).toBe("rocket-embedded-v1-procedural-image");
    expect(result.mimeType).toBe("image/svg+xml");
    expect(result.imageBase64.length).toBeGreaterThan(100);
  });
});
