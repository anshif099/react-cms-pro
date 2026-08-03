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

  it("does not claim a fake edit for an unrelated prompt", async () => {
    const response = await rocketLocalEngine.createPlan({
      intent: "I was checking the screen sharing option, but the live ended",
      context: connectedContext(),
      memory: {}
    });

    expect(response.plan.operations).toEqual([]);
    expect(response.plan.assistantMessage).toMatch(/could not map/i);
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
