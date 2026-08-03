import {
  duplicateNode,
  findNode,
  insertNode,
  moveNode,
  removeNode,
  updateNode
} from "@anshif.rainhopes/reactcms-layout-engine";
import {
  applyAIPatches,
  parseAIValue,
  splitAIPath,
  validateAIPlan
} from "./aiBuilderContract";

const NODE_PATCH_ROOTS = new Set([
  "label",
  "props",
  "styles",
  "metadata",
  "hidden",
  "locked"
]);
const THEME_PATCH_ROOTS = new Set([
  "branding",
  "colors",
  "typography",
  "buttons",
  "spacing",
  "breakpoints",
  "animations"
]);
const PAGE_PATCH_ROOTS = new Set(["title", "slug", "route", "layout", "seo"]);
const OPERATION_REFERENCE_PREFIX = "$op:";

function patchRoot(patch) {
  return splitAIPath(patch.path)[0];
}

function assertPatchRoots(patches, allowedRoots, operationId) {
  patches.forEach((patch) => {
    if (!allowedRoots.has(patchRoot(patch))) {
      throw new Error(
        `Operation ${operationId} cannot change "${patch.path}" in this editing surface.`
      );
    }
  });
}

function result(operation, status, detail, extra = {}) {
  return {
    id: operation.id,
    type: operation.type,
    summary: operation.summary,
    reason: operation.reason,
    status,
    detail,
    ...extra
  };
}

function snapshotsDiffer(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function sourceContentFromOperation(operation) {
  const contentPatch = operation.patches.find((patch) => patch.path === "content");
  if (!contentPatch) {
    throw new Error(`Operation ${operation.id} is missing its complete source content.`);
  }
  const content = parseAIValue(contentPatch.valueJson);
  if (typeof content !== "string") {
    throw new Error(`Operation ${operation.id} source content must be a string.`);
  }
  if (content.length > 1024 * 1024) {
    throw new Error(`Operation ${operation.id} exceeds the 1 MB source-file limit.`);
  }
  return content;
}

function resolveOperationReference(value, operationTargets, operationId, field) {
  if (!String(value || "").startsWith(OPERATION_REFERENCE_PREFIX)) return value;
  const referencedOperation = String(value).slice(OPERATION_REFERENCE_PREFIX.length);
  const resolved = operationTargets.get(referencedOperation);
  if (!resolved) {
    throw new Error(
      `Operation ${operationId} references unavailable ${field} operation "${referencedOperation}".`
    );
  }
  return resolved;
}

function safeSourcePath(value, operationId) {
  const path = String(value || "").replaceAll("\\", "/");
  const segments = path.split("/");
  if (
    !path
    || path.length > 240
    || path.startsWith("/")
    || path.includes(":")
    || path.includes("\0")
    || segments.some((segment) => !segment || segment === "." || segment === "..")
    || !/^[a-z0-9._@/+\- [\]()]+$/i.test(path)
  ) {
    throw new Error(`Operation ${operationId} has an invalid source path.`);
  }
  return path;
}

export function applyAIPlan({
  plan,
  tree = null,
  theme = {},
  pageSettings = {},
  regions = {},
  sourceFiles = {},
  blockedSourcePaths = [],
  componentTypes = [],
  createNode
}) {
  const validPlan = validateAIPlan(plan);
  const allowedComponents = new Set(componentTypes);
  const before = structuredClone({
    tree,
    theme: theme || {},
    pageSettings: pageSettings || {},
    regions: regions || {},
    sourceFiles: sourceFiles || {}
  });
  let nextTree = tree ? structuredClone(tree) : null;
  let nextTheme = structuredClone(theme || {});
  let nextPageSettings = structuredClone(pageSettings || {});
  let nextRegions = structuredClone(regions || {});
  let nextSourceFiles = structuredClone(sourceFiles || {});
  const results = [];
  const operationTargets = new Map();
  const blockedSources = new Set(blockedSourcePaths);

  validPlan.operations.forEach((operation) => {
    try {
      const targetId = resolveOperationReference(
        operation.targetId,
        operationTargets,
        operation.id,
        "target"
      );
      const destinationId = resolveOperationReference(
        operation.destinationId,
        operationTargets,
        operation.id,
        "destination"
      );

      if (operation.type === "insert_component") {
        if (!nextTree) throw new Error("This page does not expose a component tree.");
        if (!operation.componentType || !allowedComponents.has(operation.componentType)) {
          throw new Error(`Component "${operation.componentType || "unknown"}" is not registered.`);
        }
        const node = createNode?.(operation.componentType);
        if (!node) throw new Error(`Component "${operation.componentType}" could not be created.`);
        assertPatchRoots(operation.patches, NODE_PATCH_ROOTS, operation.id);
        const patchedNode = applyAIPatches(node, operation.patches);
        const targetNode = targetId ? findNode(nextTree, targetId) : null;
        if (targetNode?.locked && (operation.position || "after") === "inside") {
          throw new Error(`Component "${targetId}" is locked.`);
        }
        nextTree = insertNode(
          nextTree,
          patchedNode,
          targetId || null,
          operation.position || "after"
        );
        operationTargets.set(operation.id, patchedNode.id);
        results.push(result(operation, "applied", `Inserted ${operation.componentType}.`, {
          targetId: patchedNode.id
        }));
        return;
      }

      if (operation.type === "update_component") {
        if (!nextTree) throw new Error("This page does not expose a component tree.");
        const node = targetId ? findNode(nextTree, targetId) : null;
        if (!node) throw new Error(`Component "${targetId}" was not found.`);
        if (node.locked) throw new Error(`Component "${targetId}" is locked.`);
        assertPatchRoots(operation.patches, NODE_PATCH_ROOTS, operation.id);
        nextTree = updateNode(nextTree, node.id, (current) => (
          applyAIPatches(current, operation.patches)
        ));
        results.push(result(operation, "applied", `Updated ${node.label || node.type}.`));
        return;
      }

      if (operation.type === "remove_component") {
        if (!nextTree) throw new Error("This page does not expose a component tree.");
        const node = targetId ? findNode(nextTree, targetId) : null;
        if (!node) throw new Error(`Component "${targetId}" was not found.`);
        if (node.locked) throw new Error(`Component "${targetId}" is locked.`);
        nextTree = removeNode(nextTree, node.id);
        results.push(result(operation, "applied", `Removed ${node.label || node.type}.`));
        return;
      }

      if (operation.type === "move_component") {
        if (!nextTree) throw new Error("This page does not expose a component tree.");
        const node = targetId ? findNode(nextTree, targetId) : null;
        const destination = destinationId ? findNode(nextTree, destinationId) : null;
        if (!node) throw new Error(`Component "${targetId}" was not found.`);
        if (node.locked) throw new Error(`Component "${targetId}" is locked.`);
        if (!destination) throw new Error(`Destination "${destinationId}" was not found.`);
        if (destination.locked && (operation.position || "after") === "inside") {
          throw new Error(`Destination "${destinationId}" is locked.`);
        }
        nextTree = moveNode(
          nextTree,
          targetId,
          destinationId,
          operation.position || "after"
        );
        results.push(result(operation, "applied", "Moved the component."));
        return;
      }

      if (operation.type === "duplicate_component") {
        if (!nextTree) throw new Error("This page does not expose a component tree.");
        const node = targetId ? findNode(nextTree, targetId) : null;
        if (!node) throw new Error(`Component "${targetId}" was not found.`);
        if (node.locked) throw new Error(`Component "${targetId}" is locked.`);
        const duplicated = duplicateNode(nextTree, targetId);
        nextTree = duplicated.tree;
        operationTargets.set(operation.id, duplicated.node.id);
        results.push(result(operation, "applied", "Duplicated the component.", {
          targetId: duplicated.node.id
        }));
        return;
      }

      if (operation.type === "update_theme") {
        assertPatchRoots(operation.patches, THEME_PATCH_ROOTS, operation.id);
        nextTheme = applyAIPatches(nextTheme, operation.patches);
        results.push(result(operation, "applied", "Updated the website design tokens."));
        return;
      }

      if (operation.type === "update_page") {
        assertPatchRoots(operation.patches, PAGE_PATCH_ROOTS, operation.id);
        nextPageSettings = applyAIPatches(nextPageSettings, operation.patches);
        results.push(result(operation, "applied", "Updated page settings and SEO."));
        return;
      }

      if (operation.type === "update_region") {
        if (!targetId) throw new Error("The editable region id is missing.");
        if (!Object.prototype.hasOwnProperty.call(nextRegions, targetId)) {
          throw new Error(`Editable region "${targetId}" was not found.`);
        }
        let value = nextRegions[targetId];
        operation.patches.forEach((patch) => {
          const segments = splitAIPath(patch.path);
          if (segments[0] !== "value") {
            throw new Error(`Operation ${operation.id} must patch the region value.`);
          }
          const nextValue = parseAIValue(patch.valueJson);
          value = segments.length === 1
            ? nextValue
            : applyAIPatches(value, [{
              ...patch,
              path: segments.slice(1).join(".")
            }]);
        });
        nextRegions[targetId] = value;
        results.push(result(operation, "applied", `Updated region ${targetId}.`));
        return;
      }

      if (
        operation.type === "create_source_file"
        || operation.type === "replace_source_file"
      ) {
        const path = safeSourcePath(targetId, operation.id);
        const exists = Object.prototype.hasOwnProperty.call(nextSourceFiles, path);
        if (operation.type === "create_source_file" && exists) {
          throw new Error(`Source file "${path}" already exists.`);
        }
        if (operation.type === "replace_source_file" && !exists) {
          throw new Error(`Source file "${path}" is not loaded in the page context.`);
        }
        if (operation.type === "replace_source_file" && blockedSources.has(path)) {
          throw new Error(`Source file "${path}" was truncated in AI context and cannot be replaced safely.`);
        }
        nextSourceFiles[path] = sourceContentFromOperation(operation);
        results.push(result(
          operation,
          "applied",
          `${exists ? "Replaced" : "Created"} ${path}.`,
          { targetId: path }
        ));
      }
    } catch (error) {
      results.push(result(operation, "failed", error.message || "The edit could not be applied."));
    }
  });

  const after = {
    tree: nextTree,
    theme: nextTheme,
    pageSettings: nextPageSettings,
    regions: nextRegions,
    sourceFiles: nextSourceFiles
  };
  const applied = results.filter((item) => item.status === "applied").length;
  const failed = results.length - applied;

  return {
    ...after,
    before,
    after: structuredClone(after),
    results,
    changed: snapshotsDiffer(before, after),
    summary: {
      requested: validPlan.operations.length,
      applied,
      failed
    }
  };
}

export default { applyAIPlan };
