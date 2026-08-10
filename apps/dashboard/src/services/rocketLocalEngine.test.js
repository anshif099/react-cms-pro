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

function connectedRuntimeAdditionsContext() {
  const context = connectedContext();
  context.capabilities = [
    ...context.capabilities,
    "insert_component",
    "update_component",
    "remove_component",
    "move_component",
    "duplicate_component"
  ];
  context.currentPage.componentTree = {
    id: "runtime_additions_ad",
    type: "page",
    version: 2,
    locale: "en",
    children: [],
    metadata: { supplemental: true, placement: "before-footer" }
  };
  context.currentPage.flattenedComponentIndex = [];
  context.constraints.runtimeAdditionsRegion = "__rcms_runtime_additions__";
  context.constraints.registeredComponentTypes = [
    ...context.constraints.registeredComponentTypes,
    "section",
    "input",
    "textarea-field",
    "select-field",
    "checkbox"
  ];
  return context;
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
  it("adds an API advertising component to a connected page above its footer", async () => {
    const context = connectedRuntimeAdditionsContext();
    const response = await rocketLocalEngine.createPlan({
      intent: "add a component above footer api and ads related",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "insert_component",
      targetId: null,
      position: "after",
      componentType: "features"
    });
    expect(response.plan.operations[0].patches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "props.locales.en.title",
        valueJson: '"API-Powered Advertising"'
      }),
      expect.objectContaining({ path: "props.locales.en.items" })
    ]));

    const execution = applyAIPlan({
      plan: response.plan,
      tree: context.currentPage.componentTree,
      componentTypes: context.constraints.registeredComponentTypes,
      createNode: (type) => ({
        id: "generated_features",
        type,
        label: "Features",
        props: { locales: { en: {} } },
        children: []
      })
    });
    expect(execution.changed).toBe(true);
    expect(execution.tree.children[0]).toMatchObject({
      type: "features",
      props: {
        locales: {
          en: {
            title: "API-Powered Advertising"
          }
        }
      }
    });
    expect(execution.tree.children[0].props.locales.en.items).toHaveLength(3);
  });

  it("adds a requested field to the connected runtime component tree", async () => {
    const response = await rocketLocalEngine.createPlan({
      intent: "add an email field above the footer",
      context: connectedRuntimeAdditionsContext(),
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "insert_component",
      componentType: "input",
      patches: expect.arrayContaining([
        expect.objectContaining({
          path: "props.locales.en.label",
          valueJson: '"Email"'
        }),
        expect.objectContaining({
          path: "props.locales.en.placeholder",
          valueJson: '"Enter email"'
        })
      ])
    });
  });

  it("changes the selected connected section background without an API request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await aiWebsiteAgentService.createPlan({
      intent: "change the page background colour black to this: #F5F5F7",
      context: connectedContext(),
      memory: {}
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.model).toBe("rocket-ai-ultra-1.5");
    expect(response.modelInfo).toMatchObject({
      name: "Rocket AI Ultra",
      version: "1.5",
      curriculumRevision: 0
    });
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

  it("understands a named background color for the selected runtime section", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = {
      regionId: "api-live-preview.hero",
      type: "section",
      label: "Hero section",
      pageId: "api-live-preview",
      value: { background: "#000000", paddingY: 80 }
    };
    context.currentPage.editableRegionDefinitions = {
      "api-live-preview.hero": {
        type: "section",
        label: "Hero section",
        pageId: "api-live-preview"
      }
    };
    context.currentPage.editableRegionValues = {
      "api-live-preview.hero": { background: "#000000", paddingY: 80 }
    };

    const response = await rocketLocalEngine.createPlan({
      intent: "change background colour from black to white",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "api-live-preview.hero",
      patches: [{ path: "value.background", valueJson: '"#ffffff"' }]
    });
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues
    });
    expect(execution.changed).toBe(true);
    expect(execution.regions["api-live-preview.hero"].background).toBe("#ffffff");
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

  it("replaces the image selected as the chat area with an existing media asset", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = {
      regionId: "ad.hero_image",
      type: "image",
      label: "Hero visual",
      value: { src: "https://example.com/old.jpg", alt: "Old visual" }
    };
    context.currentPage.editableRegionDefinitions["ad.hero_image"] = {
      type: "image",
      label: "Hero visual"
    };
    context.currentPage.editableRegionValues["ad.hero_image"] = context.currentPage.selectedRegion.value;
    context.contentSystem = {
      assets: [{
        id: "asset-new-hero",
        name: "Technology hero",
        alt: "Connected technology network",
        type: "image/jpeg",
        url: "https://cdn.example.com/new-hero.jpg"
      }]
    };

    const response = await rocketLocalEngine.createPlan({
      intent: 'Use the existing media asset with ID "asset-new-hero" in the selected image',
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.hero_image",
      patches: [
        { path: "value.src", valueJson: '"https://cdn.example.com/new-hero.jpg"' },
        { path: "value.alt", valueJson: '"Connected technology network"' }
      ]
    });
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues
    });
    expect(execution.regions["ad.hero_image"]).toEqual({
      src: "https://cdn.example.com/new-hero.jpg",
      alt: "Connected technology network"
    });
  });

  it("writes a selected media asset to every selected image", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = null;
    context.currentPage.selectedRegions = ["first", "second"].map((name) => ({
      regionId: `ad.${name}_image`,
      type: "image",
      label: `${name} visual`,
      value: { src: `https://example.com/${name}.jpg` }
    }));
    context.currentPage.selectedRegions.forEach((region) => {
      context.currentPage.editableRegionDefinitions[region.regionId] = { type: "image" };
      context.currentPage.editableRegionValues[region.regionId] = region.value;
    });
    context.contentSystem = {
      assets: [{
        id: "asset-shared",
        name: "Shared visual",
        alt: "Shared campaign visual",
        type: "image/png",
        url: "https://cdn.example.com/shared.png"
      }]
    };

    const response = await rocketLocalEngine.createPlan({
      intent: 'Use the existing media asset with ID "asset-shared" in all selected images',
      context,
      memory: {}
    });

    expect(response.plan.operations.map((operation) => operation.targetId)).toEqual([
      "ad.first_image",
      "ad.second_image"
    ]);
    expect(response.plan.operations.every((operation) => (
      operation.patches[0].valueJson === '"https://cdn.example.com/shared.png"'
    ))).toBe(true);
  });

  it("asks for an image area when an image request has no selection", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = null;
    const response = await rocketLocalEngine.createPlan({
      intent: "generate a premium technology image",
      context,
      memory: {}
    });

    expect(response.plan.operations).toEqual([]);
    expect(response.plan.assistantMessage).toMatch(/select area/i);
    expect(response.plan.assistantMessage).toMatch(/editable image/i);
  });

  it("rewrites only the connected text area attached to the chat", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = {
      regionId: "ad.title",
      type: "text",
      label: "Page title",
      value: "Ad"
    };
    context.currentPage.editableRegionDefinitions["ad.title"] = {
      type: "text",
      label: "Page title"
    };
    context.currentPage.editableRegionValues["ad.title"] = "Ad";

    const response = await rocketLocalEngine.createPlan({
      intent: "change this text to Smarter Growth Campaigns",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.title",
      patches: [
        { path: "value", valueJson: '"Smarter Growth Campaigns"' }
      ]
    });
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues
    });
    expect(execution.regions["ad.title"]).toBe("Smarter Growth Campaigns");
  });

  it("expands a selected acronym from typo-tolerant natural language", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = {
      regionId: "api-live-preview.title",
      type: "text",
      label: "Page title",
      value: "API"
    };
    context.currentPage.editableRegionDefinitions["api-live-preview.title"] = {
      type: "text",
      label: "Page title"
    };
    context.currentPage.editableRegionValues["api-live-preview.title"] = "API";

    const response = await rocketLocalEngine.createPlan({
      intent: "api to fthere full form",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "api-live-preview.title",
      patches: [{ path: "value", valueJson: '"Application Programming Interface"' }]
    });
  });

  it("changes the color on the selected connected text instead of the shared theme", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = {
      regionId: "ad.heading",
      type: "text",
      label: "About heading",
      value: "About Api/live Preview",
      computedStyle: { color: "#ffffff" }
    };
    context.currentPage.editableRegionDefinitions["ad.heading"] = {
      type: "text",
      label: "About heading"
    };
    context.currentPage.editableRegionValues["ad.heading"] = "About Api/live Preview";

    const response = await rocketLocalEngine.createPlan({
      intent: "change the selected text color to #FF5757",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(1);
    expect(response.plan.operations[0]).toMatchObject({
      type: "update_region",
      targetId: "ad.heading",
      patches: [{
        path: "value",
        valueJson: JSON.stringify({ text: "About Api/live Preview", color: "#FF5757" })
      }]
    });
    expect(response.plan.operations.some((operation) => operation.type === "update_theme")).toBe(false);
    const execution = applyAIPlan({
      plan: response.plan,
      regions: context.currentPage.editableRegionValues,
      theme: context.designSystem.theme
    });
    expect(execution.changed).toBe(true);
    expect(execution.regions["ad.heading"]).toEqual({
      text: "About Api/live Preview",
      color: "#FF5757"
    });
  });

  it("changes every selected text region in one coordinated plan", async () => {
    const context = connectedContext();
    context.currentPage.selectedRegion = null;
    context.currentPage.selectedRegions = ["campaigns", "satisfaction", "impressions", "brands"]
      .map((name) => ({
        regionId: `ad.${name}`,
        type: "text",
        label: name,
        value: name
      }));
    context.currentPage.selectedRegions.forEach((region) => {
      context.currentPage.editableRegionDefinitions[region.regionId] = { type: "text" };
      context.currentPage.editableRegionValues[region.regionId] = region.value;
    });

    const response = await rocketLocalEngine.createPlan({
      intent: "change selected text color to black",
      context,
      memory: {}
    });

    expect(response.plan.operations).toHaveLength(4);
    expect(response.plan.operations.map((operation) => operation.targetId)).toEqual([
      "ad.campaigns",
      "ad.satisfaction",
      "ad.impressions",
      "ad.brands"
    ]);
    expect(response.plan.operations.every((operation) => (
      JSON.parse(operation.patches[0].valueJson).color === "#000000"
    ))).toBe(true);
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

    expect(result.model).toBe("rocket-ai-ultra-1.5-procedural-image");
    expect(result.mimeType).toBe("image/svg+xml");
    expect(result.imageBase64.length).toBeGreaterThan(100);
  });

  it("keeps release versions separate from training and supports all model tracks", async () => {
    const values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    });
    try {
      expect(rocketLocalEngine.getModelInfo()).toMatchObject({
        id: "rocket-ai-ultra-1.5",
        name: "Rocket AI Ultra",
        version: "1.5",
        trainedExamples: 0
      });
      const feedback = await rocketLocalEngine.recordFeedback({
        intent: "change selected heading color",
        context: connectedContext(),
        plan: { operations: [] },
        results: [],
        validation: []
      });
      expect(feedback.captured).toBe(true);
      expect(feedback.modelInfo).toMatchObject({
        id: "rocket-ai-ultra-1.5",
        version: "1.5",
        curriculumRevision: 1,
        trainedExamples: 1
      });
      expect(rocketLocalEngine.getModelCatalog().map(({ name, version }) => ({ name, version }))).toEqual([
        { name: "Rocket AI Instant", version: "1.01" },
        { name: "Rocket AI Pro", version: "1.2" },
        { name: "Rocket AI Ultra", version: "1.5" }
      ]);
      expect(rocketLocalEngine.setActiveModel("rocket-ai-ultra")).toMatchObject({
        id: "rocket-ai-ultra-1.5",
        name: "Rocket AI Ultra",
        version: "1.5",
        trainedExamples: 1
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
