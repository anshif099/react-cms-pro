import { validateAIPlan } from "./aiBuilderContract";
import rocketLocalEngine from "./rocketLocalEngine";

export const aiWebsiteAgentService = {
  getModelInfo() {
    return rocketLocalEngine.getModelInfo();
  },

  async createPlan({
    intent,
    context,
    memory,
    conversation = [],
    previousPlan = null,
    feedback = ""
  }) {
    const payload = await rocketLocalEngine.createPlan({
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
      modelInfo: payload.modelInfo,
      requestId: payload.requestId,
      usage: payload.usage || null
    };
  },

  async generateImage({ prompt, brandContext, size = "1024x1024", quality = "medium" }) {
    return rocketLocalEngine.generateImage({
      prompt,
      brandContext,
      size,
      quality
    });
  },

  async recordFeedback({ intent, context, plan, results, validation }) {
    return rocketLocalEngine.recordFeedback({
      intent,
      context,
      plan,
      results,
      validation
    });
  }
};

export default aiWebsiteAgentService;
