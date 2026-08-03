import { afterEach, describe, expect, it, vi } from "vitest";
import aiBuilderHandler, {
  AI_PLAN_RESPONSE_SCHEMA,
  buildAIBuilderInstructions
} from "../../api/ai-builder";

function responseDouble() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

const plan = {
  title: "Improve homepage",
  summary: "Improve the complete page.",
  assistantMessage: "I prepared a coordinated plan.",
  risk: "low",
  estimatedEdits: 1,
  requiresApproval: true,
  affectedAreas: ["Hero"],
  preserved: ["Header", "Footer"],
  validationChecks: ["Contrast"],
  operations: [{
    id: "edit-1",
    type: "update_component",
    summary: "Clarify the hero",
    reason: "Improve hierarchy.",
    targetId: "hero-1",
    destinationId: null,
    position: null,
    componentType: null,
    patches: [{ path: "props.locales.en.title", valueJson: '"A better headline"' }]
  }]
};

describe("AI builder API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ROCKET_AI_URL;
    delete process.env.ROCKET_AI_MODEL;
    delete process.env.ROCKET_AI_GATEWAY_KEY;
  });

  it("uses a strict operation schema and instructs the model to reason over data, not screenshots", () => {
    expect(AI_PLAN_RESPONSE_SCHEMA.additionalProperties).toBe(false);
    expect(AI_PLAN_RESPONSE_SCHEMA.properties.operations.maxItems).toBe(80);
    expect(AI_PLAN_RESPONSE_SCHEMA.properties.operations.items.additionalProperties).toBe(false);
    expect(buildAIBuilderInstructions()).toContain("complete editable website/page model");
    expect(buildAIBuilderInstructions()).toContain("never a screenshot");
    expect(buildAIBuilderInstructions()).toContain("requiresApproval to true");
    expect(buildAIBuilderInstructions()).toContain("$op:<operation-id>");
    expect(buildAIBuilderInstructions()).toContain("Rocket AI");
  });

  it("verifies Firebase auth and requests a plan only from the first-party Rocket server", async () => {
    process.env.ROCKET_AI_URL = "http://rocket.internal:8787";
    process.env.ROCKET_AI_GATEWAY_KEY = "rocket-secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [{ localId: "firebase-user-1" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        plan,
        model: "rocket-plan",
        requestId: "rocket_123",
        usage: { input_tokens: 100, output_tokens: 50 }
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = responseDouble();

    await aiBuilderHandler({
      method: "POST",
      headers: { authorization: "Bearer firebase-token" },
      body: {
        action: "plan",
        intent: "Improve this page",
        context: {
          capabilities: ["update_component"],
          currentPage: { componentTree: { children: [{ id: "hero-1" }] } }
        }
      }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.plan).toEqual(plan);
    expect(response.body.model).toBe("rocket-plan");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("http://rocket.internal:8787/v1/plan");
    const rocketRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(rocketRequest.model).toBe("rocket-plan");
    expect(rocketRequest.schema).toEqual(AI_PLAN_RESPONSE_SCHEMA);
    expect(rocketRequest.requester).toHaveLength(64);
    expect(fetchMock.mock.calls[1][1].headers["X-Rocket-Key"]).toBe("rocket-secret");
  });

  it("refuses unauthenticated planning requests", async () => {
    const response = responseDouble();
    await aiBuilderHandler({
      method: "POST",
      headers: {},
      body: { action: "plan", intent: "Improve page", context: {} }
    }, response);
    expect(response.statusCode).toBe(401);
  });

  it("generates brand-aware image data through Rocket Image", async () => {
    process.env.ROCKET_AI_URL = "http://rocket.internal:8787";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [{ localId: "firebase-user-1" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        imageBase64: "aW1hZ2U=",
        mimeType: "image/png",
        model: "rocket-image"
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = responseDouble();

    await aiBuilderHandler({
      method: "POST",
      headers: { authorization: "Bearer firebase-token" },
      body: {
        action: "generate_image",
        prompt: "Premium coral abstract hero image",
        brandContext: { colors: { primary: "#ff5b5b" } },
        size: "1536x1024"
      }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      imageBase64: "aW1hZ2U=",
      mimeType: "image/png",
      model: "rocket-image"
    });
    const imageRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][0]).toBe("http://rocket.internal:8787/v1/images/generate");
    expect(imageRequest.brandContext.colors.primary).toBe("#ff5b5b");
  });

  it("sends approved execution feedback to the private Rocket curriculum", async () => {
    process.env.ROCKET_AI_URL = "http://rocket.internal:8787";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [{ localId: "firebase-user-1" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accepted: true,
        captured: true
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = responseDouble();

    await aiBuilderHandler({
      method: "POST",
      headers: { authorization: "Bearer firebase-token" },
      body: {
        action: "feedback",
        intent: "Improve the page",
        context: { currentPage: { id: "home" } },
        plan,
        results: [{ id: "edit-1", status: "applied" }],
        validation: []
      }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe("http://rocket.internal:8787/v1/feedback");
    const feedback = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(feedback.plan).toEqual(plan);
    expect(feedback.outcome.results[0].status).toBe("applied");
  });
});
