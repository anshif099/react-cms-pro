export const AI_OPERATION_TYPES = [
  "insert_component",
  "update_component",
  "remove_component",
  "move_component",
  "duplicate_component",
  "update_theme",
  "update_page",
  "update_region",
  "create_source_file",
  "replace_source_file"
];

export const AI_PLAN_SCHEMA_VERSION = 1;

const FORBIDDEN_PATH_SEGMENTS = new Set([
  "__proto__",
  "prototype",
  "constructor"
]);

export function parseAIValue(valueJson) {
  if (typeof valueJson !== "string") return valueJson;
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
}

export function splitAIPath(path) {
  const segments = String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) throw new Error("An AI patch path cannot be empty.");
  if (segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) {
    throw new Error("The AI plan contains an unsafe patch path.");
  }
  return segments;
}

export function setAIValueAtPath(source, path, value) {
  const segments = Array.isArray(path) ? path : splitAIPath(path);
  const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor = root;

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    if (isLast) {
      cursor[segment] = value;
      return;
    }
    const current = cursor[segment];
    cursor[segment] = Array.isArray(current) ? [...current] : { ...(current || {}) };
    cursor = cursor[segment];
  });
  return root;
}

export function applyAIPatches(source, patches = []) {
  return patches.reduce((next, patch) => setAIValueAtPath(
    next,
    patch.path,
    parseAIValue(patch.valueJson)
  ), source);
}

function assertNullableString(value, field, operationId) {
  if (value !== null && typeof value !== "string") {
    throw new Error(`Operation ${operationId} has an invalid ${field}.`);
  }
}

export function validateAIPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("The AI response did not contain a valid plan.");
  }
  if (!String(plan.title || "").trim()) {
    throw new Error("The AI plan is missing a title.");
  }
  if (!Array.isArray(plan.operations)) {
    throw new Error("The AI plan is missing its operations.");
  }
  if (plan.operations.length > 80) {
    throw new Error("The AI plan exceeds the 80-edit safety limit.");
  }

  const ids = new Set();
  plan.operations.forEach((operation, index) => {
    const operationId = String(operation?.id || `operation-${index + 1}`);
    if (!operation || typeof operation !== "object") {
      throw new Error(`Operation ${operationId} is invalid.`);
    }
    if (!AI_OPERATION_TYPES.includes(operation.type)) {
      throw new Error(`Operation ${operationId} uses unsupported type "${operation.type}".`);
    }
    if (ids.has(operationId)) {
      throw new Error(`Operation id "${operationId}" is duplicated.`);
    }
    ids.add(operationId);
    assertNullableString(operation.targetId, "targetId", operationId);
    assertNullableString(operation.destinationId, "destinationId", operationId);
    assertNullableString(operation.componentType, "componentType", operationId);
    if (!Array.isArray(operation.patches)) {
      throw new Error(`Operation ${operationId} has invalid patches.`);
    }
    operation.patches.forEach((patch) => {
      splitAIPath(patch?.path);
      if (typeof patch?.valueJson !== "string") {
        throw new Error(`Operation ${operationId} has an invalid patch value.`);
      }
    });
  });

  return {
    ...plan,
    schemaVersion: AI_PLAN_SCHEMA_VERSION,
    estimatedEdits: Number.isFinite(plan.estimatedEdits)
      ? plan.estimatedEdits
      : plan.operations.length,
    requiresApproval: true
  };
}

export function summarizeAIPlan(plan) {
  const groups = {};
  (plan?.operations || []).forEach((operation) => {
    groups[operation.type] = (groups[operation.type] || 0) + 1;
  });
  return groups;
}

export default {
  AI_OPERATION_TYPES,
  AI_PLAN_SCHEMA_VERSION,
  applyAIPatches,
  parseAIValue,
  setAIValueAtPath,
  splitAIPath,
  summarizeAIPlan,
  validateAIPlan
};
