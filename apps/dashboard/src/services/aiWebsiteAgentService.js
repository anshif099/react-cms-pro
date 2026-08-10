import { validateAIPlan } from "./aiBuilderContract";
import rocketLocalEngine from "./rocketLocalEngine";

export const aiWebsiteAgentService = {
  getModelCatalog() {
    return rocketLocalEngine.getModelCatalog();
  },

  getModelInfo(modelId = "") {
    return rocketLocalEngine.getModelInfo(modelId);
  },

  setActiveModel(modelId) {
    return rocketLocalEngine.setActiveModel(modelId);
  },

  async createPlan({
    intent,
    context,
    memory,
    modelId = "",
    conversation = [],
    previousPlan = null,
    feedback = ""
  }) {
    const payload = await rocketLocalEngine.createPlan({
      intent,
      context,
      memory,
      modelId,
      conversation: conversation.slice(-60),
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

  async generateImage({ prompt, brandContext, modelId = "", size = "1024x1024", quality = "medium" }) {
    return rocketLocalEngine.generateImage({
      prompt,
      brandContext,
      modelId,
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
