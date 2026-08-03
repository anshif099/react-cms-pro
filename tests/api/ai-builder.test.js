import { afterEach, describe, expect, it, vi } from "vitest";
import aiBuilderHandler, {
  AI_PLAN_RESPONSE_SCHEMA,
  buildAIBuilderInstructions,
  extractResponseText
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
    delete process.env.OPENAI_API_KEY;
  });

  it("uses a strict operation schema and instructs the model to reason over data, not screenshots", () => {
    expect(AI_PLAN_RESPONSE_SCHEMA.additionalProperties).toBe(false);
    expect(AI_PLAN_RESPONSE_SCHEMA.properties.operations.maxItems).toBe(80);
    expect(AI_PLAN_RESPONSE_SCHEMA.properties.operations.items.additionalProperties).toBe(false);
    expect(buildAIBuilderInstructions()).toContain("complete editable website/page model");
    expect(buildAIBuilderInstructions()).toContain("never a screenshot");
    expect(buildAIBuilderInstructions()).toContain("requiresApproval to true");
    expect(buildAIBuilderInstructions()).toContain("$op:<operation-id>");
  });

  it("extracts structured output text from Responses API output items", () => {
    expect(extractResponseText({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(plan) }] }]
    })).toBe(JSON.stringify(plan));
  });

  it("verifies Firebase auth and returns a structured Responses API plan", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [{ localId: "firebase-user-1" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "resp_123",
        output_text: JSON.stringify(plan),
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
    expect(response.body.model).toBe("gpt-5.6-sol");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const openAIRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(openAIRequest.model).toBe("gpt-5.6-sol");
    expect(openAIRequest.text.format.type).toBe("json_schema");
    expect(openAIRequest.store).toBe(false);
    expect(openAIRequest.safety_identifier).toHaveLength(64);
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

  it("generates brand-aware image data through the current image model", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [{ localId: "firebase-user-1" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ b64_json: "aW1hZ2U=" }]
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
      model: "gpt-image-2"
    });
    const imageRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(imageRequest.model).toBe("gpt-image-2");
    expect(imageRequest.prompt).toContain("#ff5b5b");
  });
});
