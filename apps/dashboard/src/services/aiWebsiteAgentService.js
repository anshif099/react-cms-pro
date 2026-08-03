import { auth } from "../lib/firebase";
import { validateAIPlan } from "./aiBuilderContract";

async function authorizationHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again before using the AI Website Builder.");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function postAIBuilder(body) {
  const response = await fetch("/api/ai-builder", {
    method: "POST",
    headers: await authorizationHeaders(),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error
      || `The AI Website Builder request failed (HTTP ${response.status}).`
    );
  }
  return payload;
}

export const aiWebsiteAgentService = {
  async createPlan({
    intent,
    context,
    memory,
    conversation = [],
    previousPlan = null,
    feedback = ""
  }) {
    const payload = await postAIBuilder({
      action: "plan",
      intent,
      context,
      memory,
      conversation: conversation.slice(-12),
      previousPlan,
      feedback
    });
    return {
      plan: validateAIPlan(payload.plan),
      model: payload.model,
      requestId: payload.requestId,
      usage: payload.usage || null
    };
  },

  async generateImage({ prompt, brandContext, size = "1024x1024", quality = "medium" }) {
    return postAIBuilder({
      action: "generate_image",
      prompt,
      brandContext,
      size,
      quality
    });
  }
};

export default aiWebsiteAgentService;
