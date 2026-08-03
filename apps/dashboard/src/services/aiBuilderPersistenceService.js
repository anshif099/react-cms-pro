import { get, push, ref, set, update } from "firebase/database";
import { database } from "../lib/firebase";

const MAX_SNAPSHOT_LENGTH = 1800000;

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

export const aiBuilderPersistenceService = {
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
