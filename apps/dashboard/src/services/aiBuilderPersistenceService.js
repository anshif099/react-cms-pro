import { get, push, ref, remove, set, update } from "firebase/database";
import { database } from "../lib/firebase";

const MAX_SNAPSHOT_LENGTH = 1800000;
const MAX_CONVERSATION_MESSAGES = 120;
const MAX_MESSAGE_LENGTH = 6000;

function compactPlan(plan) {
  return {
    ...plan,
    operations: (plan?.operations || []).map((operation) => {
      if (!["create_source_file", "replace_source_file"].includes(operation.type)) {
        return operation;
      }
      return {
        ...operation,
        patches: operation.patches.map((patch) => patch.path === "content" ? {
          ...patch,
          valueJson: `"[${patch.valueJson.length} characters stored in the source snapshot]"`
        } : patch)
      };
    })
  };
}

function runPath(websiteId, pageId) {
  return `aiBuilder/${websiteId}/pages/${pageId}/runs`;
}

function conversationsPath(websiteId, pageId) {
  return `aiBuilder/${websiteId}/pages/${pageId}/conversations`;
}

function activeConversationPath(websiteId, pageId) {
  return `aiBuilder/${websiteId}/pages/${pageId}/activeConversationId`;
}

function memoryPath(websiteId) {
  return `aiBuilder/${websiteId}/memory`;
}

export function stringifyAISnapshot(snapshot) {
  const value = JSON.stringify(snapshot ?? null);
  if (value.length > MAX_SNAPSHOT_LENGTH) {
    throw new Error("The AI rollback snapshot exceeds the 1.8 MB safety limit.");
  }
  return value;
}

export function parseAISnapshot(value) {
  if (!value) return null;
  return JSON.parse(value);
}

export function compactAIConversationMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && ["assistant", "user"].includes(message.role))
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message, index) => ({
      id: String(message.id || `message_${index}`),
      role: message.role,
      content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH),
      ...(message.error ? { error: true } : {})
    }));
}

export function inferAIConversationTitle(messages = [], fallback = "New chat") {
  const firstUserMessage = (Array.isArray(messages) ? messages : []).find((message) => (
    message?.role === "user" && String(message.content || "").trim()
  ));
  return normalizeAIConversationTitle(firstUserMessage?.content || fallback);
}

export function normalizeAIConversationTitle(value, fallback = "New chat") {
  const title = String(value || fallback || "New chat")
    .replace(/\s+/g, " ")
    .trim();
  return title.length > 64 ? `${title.slice(0, 61).trimEnd()}...` : title || "New chat";
}

export const aiBuilderPersistenceService = {
  async createConversation(websiteId, pageId, data = {}) {
    const conversationsRef = ref(database, conversationsPath(websiteId, pageId));
    const nextRef = push(conversationsRef);
    const now = Date.now();
    const messages = compactAIConversationMessages(data.messages);
    const customTitle = Boolean(data.customTitle);
    const conversation = {
      id: nextRef.key,
      title: customTitle
        ? normalizeAIConversationTitle(data.title)
        : inferAIConversationTitle(messages, data.title),
      customTitle,
      messages,
      modelId: String(data.modelId || ""),
      surface: String(data.surface || ""),
      pageTitle: String(data.pageTitle || ""),
      createdAt: now,
      updatedAt: now
    };
    await set(nextRef, conversation);
    await set(ref(database, activeConversationPath(websiteId, pageId)), nextRef.key);
    return conversation;
  },

  async saveConversation(websiteId, pageId, conversationId, data = {}) {
    if (!conversationId) throw new Error("A Rocket AI conversation ID is required.");
    const messages = compactAIConversationMessages(data.messages);
    const customTitle = Boolean(data.customTitle);
    const changes = {
      title: customTitle
        ? normalizeAIConversationTitle(data.title)
        : inferAIConversationTitle(messages, data.title),
      customTitle,
      messages,
      modelId: String(data.modelId || ""),
      surface: String(data.surface || ""),
      pageTitle: String(data.pageTitle || ""),
      updatedAt: Date.now()
    };
    await update(
      ref(database, `${conversationsPath(websiteId, pageId)}/${conversationId}`),
      changes
    );
    return { id: conversationId, ...changes };
  },

  async renameConversation(websiteId, pageId, conversationId, title) {
    if (!conversationId) throw new Error("A Rocket AI conversation ID is required.");
    const changes = {
      title: normalizeAIConversationTitle(title),
      customTitle: true,
      updatedAt: Date.now()
    };
    await update(
      ref(database, `${conversationsPath(websiteId, pageId)}/${conversationId}`),
      changes
    );
    return { id: conversationId, ...changes };
  },

  async deleteConversation(websiteId, pageId, conversationId) {
    if (!conversationId) throw new Error("A Rocket AI conversation ID is required.");
    await remove(ref(
      database,
      `${conversationsPath(websiteId, pageId)}/${conversationId}`
    ));
    return conversationId;
  },

  async getConversations(websiteId, pageId) {
    const snapshot = await get(ref(database, conversationsPath(websiteId, pageId)));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val()).map(([id, conversation]) => ({
      id,
      ...conversation,
      messages: compactAIConversationMessages(conversation?.messages)
    })).sort((first, second) => (second.updatedAt || 0) - (first.updatedAt || 0));
  },

  async getActiveConversationId(websiteId, pageId) {
    const snapshot = await get(ref(database, activeConversationPath(websiteId, pageId)));
    return snapshot.exists() ? String(snapshot.val() || "") : "";
  },

  async setActiveConversationId(websiteId, pageId, conversationId) {
    await set(
      ref(database, activeConversationPath(websiteId, pageId)),
      String(conversationId || "")
    );
  },

  async createRun(websiteId, pageId, data) {
    const runsRef = ref(database, runPath(websiteId, pageId));
    const nextRef = push(runsRef);
    const run = {
      id: nextRef.key,
      status: "planned",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...data,
      ...(data.plan ? { plan: compactPlan(data.plan) } : {})
    };
    await set(nextRef, run);
    return run;
  },

  async completeRun(websiteId, pageId, runId, {
    before,
    after,
    results,
    validation,
    status = "applied"
  }) {
    const changes = {
      status,
      results: results || [],
      validation: validation || [],
      beforeSnapshotJson: stringifyAISnapshot(before),
      afterSnapshotJson: stringifyAISnapshot(after),
      appliedAt: Date.now(),
      updatedAt: Date.now()
    };
    await update(ref(database, `${runPath(websiteId, pageId)}/${runId}`), changes);
    return changes;
  },

  async markRolledBack(websiteId, pageId, runId) {
    await update(ref(database, `${runPath(websiteId, pageId)}/${runId}`), {
      status: "rolled_back",
      rolledBackAt: Date.now(),
      updatedAt: Date.now()
    });
  },

  async failRun(websiteId, pageId, runId, error) {
    await update(ref(database, `${runPath(websiteId, pageId)}/${runId}`), {
      status: "failed",
      error: String(error || "The AI run failed."),
      updatedAt: Date.now()
    });
  },

  async getRuns(websiteId, pageId) {
    const snapshot = await get(ref(database, runPath(websiteId, pageId)));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val()).map(([id, run]) => ({ id, ...run }))
      .sort((first, second) => (second.createdAt || 0) - (first.createdAt || 0));
  },

  async getMemory(websiteId) {
    const snapshot = await get(ref(database, memoryPath(websiteId)));
    return snapshot.exists() ? snapshot.val() : {
      companyInfo: "",
      brandVoice: "",
      targetAudience: "",
      businessGoals: "",
      preferredColors: "",
      preferredLayout: "",
      typography: "",
      designLanguage: ""
    };
  },

  async saveMemory(websiteId, memory) {
    const next = { ...memory, updatedAt: Date.now() };
    await set(ref(database, memoryPath(websiteId)), next);
    return next;
  }
};

export default aiBuilderPersistenceService;
