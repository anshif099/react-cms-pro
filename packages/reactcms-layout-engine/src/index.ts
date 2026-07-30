import type {
  ComponentNode,
  DropPosition,
  PageComponentTree,
} from '@anshif.rainhopes/reactcms-renderer';

export function createNodeId(prefix = 'node') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function flattenTree(tree: PageComponentTree): ComponentNode[] {
  const result: ComponentNode[] = [];
  const visit = (nodes: ComponentNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children?.length) visit(node.children);
    });
  };
  visit(tree.children || []);
  return result;
}

export function findNode(tree: PageComponentTree, nodeId: string): ComponentNode | null {
  return flattenTree(tree).find((node) => node.id === nodeId) || null;
}

export function findParentNode(tree: PageComponentTree, nodeId: string): ComponentNode | null {
  let parent: ComponentNode | null = null;
  const visit = (nodes: ComponentNode[], currentParent: ComponentNode | null) => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        parent = currentParent;
        return true;
      }
      if (node.children?.length && visit(node.children, node)) return true;
    }
    return false;
  };
  visit(tree.children || [], null);
  return parent;
}

export function getNodePath(tree: PageComponentTree, nodeId: string): ComponentNode[] {
  const path: ComponentNode[] = [];
  const visit = (nodes: ComponentNode[], trail: ComponentNode[]): boolean => {
    for (const node of nodes) {
      const nextTrail = [...trail, node];
      if (node.id === nodeId) {
        path.push(...nextTrail);
        return true;
      }
      if (node.children?.length && visit(node.children, nextTrail)) return true;
    }
    return false;
  };
  visit(tree.children || [], []);
  return path;
}

export function setValueAtPath(source: any, path: Array<string | number>, value: unknown): any {
  if (!path.length) return value;
  const [head, ...tail] = path;
  const next = Array.isArray(source) ? [...source] : { ...(source || {}) };
  next[head as any] = setValueAtPath(next[head as any], tail, value);
  return next;
}

function updateNodes(
  nodes: ComponentNode[],
  nodeId: string,
  updater: (node: ComponentNode) => ComponentNode,
): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node);
    if (!node.children?.length) return node;
    return { ...node, children: updateNodes(node.children, nodeId, updater) };
  });
}

export function updateNode(
  tree: PageComponentTree,
  nodeId: string,
  updater: ((node: ComponentNode) => ComponentNode) | Partial<ComponentNode>,
): PageComponentTree {
  const update = typeof updater === 'function'
    ? updater
    : (node: ComponentNode) => ({ ...node, ...updater });
  return { ...tree, children: updateNodes(tree.children || [], nodeId, update) };
}

export function updateNodeValue(
  tree: PageComponentTree,
  nodeId: string,
  path: Array<string | number>,
  value: unknown,
): PageComponentTree {
  return updateNode(tree, nodeId, (node) => setValueAtPath(node, path, value));
}

function removeFromNodes(nodes: ComponentNode[], nodeId: string): {
  nodes: ComponentNode[];
  removed: ComponentNode | null;
} {
  let removed: ComponentNode | null = null;
  const next: ComponentNode[] = [];

  for (const node of nodes) {
    if (node.id === nodeId) {
      removed = node;
      continue;
    }
    if (node.children?.length) {
      const childResult = removeFromNodes(node.children, nodeId);
      if (childResult.removed) removed = childResult.removed;
      next.push({ ...node, children: childResult.nodes });
    } else {
      next.push(node);
    }
  }
  return { nodes: next, removed };
}

export function removeNode(tree: PageComponentTree, nodeId: string): PageComponentTree {
  const result = removeFromNodes(tree.children || [], nodeId);
  return { ...tree, children: result.nodes };
}

function insertIntoNodes(
  nodes: ComponentNode[],
  targetId: string | null,
  position: DropPosition,
  node: ComponentNode,
): { nodes: ComponentNode[]; inserted: boolean } {
  if (!targetId) return { nodes: [...nodes, node], inserted: true };
  const next: ComponentNode[] = [];
  let inserted = false;

  for (const current of nodes) {
    if (current.id === targetId) {
      if (position === 'before') next.push(node);
      if (position === 'inside') {
        next.push({ ...current, children: [...(current.children || []), node] });
      } else {
        next.push(current);
      }
      if (position === 'after') next.push(node);
      inserted = true;
      continue;
    }
    if (current.children?.length) {
      const childResult = insertIntoNodes(current.children, targetId, position, node);
      if (childResult.inserted) inserted = true;
      next.push({ ...current, children: childResult.nodes });
    } else {
      next.push(current);
    }
  }
  return { nodes: next, inserted };
}

export function insertNode(
  tree: PageComponentTree,
  node: ComponentNode,
  targetId: string | null = null,
  position: DropPosition = 'after',
): PageComponentTree {
  const result = insertIntoNodes(tree.children || [], targetId, position, node);
  return {
    ...tree,
    children: result.inserted ? result.nodes : [...tree.children, node],
  };
}

function containsNode(node: ComponentNode, nodeId: string): boolean {
  if (node.id === nodeId) return true;
  return (node.children || []).some((child) => containsNode(child, nodeId));
}

export function moveNode(
  tree: PageComponentTree,
  nodeId: string,
  targetId: string,
  position: DropPosition,
): PageComponentTree {
  const source = findNode(tree, nodeId);
  if (!source || nodeId === targetId || containsNode(source, targetId)) return tree;
  const removed = removeFromNodes(tree.children || [], nodeId);
  return insertNode({ ...tree, children: removed.nodes }, source, targetId, position);
}

function cloneNodeWithIds(node: ComponentNode): ComponentNode {
  return {
    ...structuredClone(node),
    id: createNodeId(node.type),
    children: (node.children || []).map(cloneNodeWithIds),
  };
}

export function duplicateNode(tree: PageComponentTree, nodeId: string): {
  tree: PageComponentTree;
  node: ComponentNode | null;
} {
  const node = findNode(tree, nodeId);
  if (!node) return { tree, node: null };
  const copy = cloneNodeWithIds(node);
  return { tree: insertNode(tree, copy, nodeId, 'after'), node: copy };
}

export function moveNodeByOffset(
  tree: PageComponentTree,
  nodeId: string,
  offset: number,
): PageComponentTree {
  const parent = findParentNode(tree, nodeId);
  const siblings = parent?.children || tree.children;
  const currentIndex = siblings.findIndex((node) => node.id === nodeId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblings.length) return tree;
  const nextSiblings = [...siblings];
  [nextSiblings[currentIndex], nextSiblings[nextIndex]] = [
    nextSiblings[nextIndex],
    nextSiblings[currentIndex],
  ];
  if (!parent) return { ...tree, children: nextSiblings };
  return updateNode(tree, parent.id, { children: nextSiblings });
}

export function normalizeTree(tree: PageComponentTree): PageComponentTree {
  const seen = new Set<string>();
  const normalize = (nodes: ComponentNode[]): ComponentNode[] => nodes.map((node) => {
    let id = node.id || createNodeId(node.type);
    if (seen.has(id)) id = createNodeId(node.type);
    seen.add(id);
    return {
      ...node,
      id,
      props: node.props || {},
      styles: node.styles || { base: {} },
      children: normalize(node.children || []),
    };
  });
  return { ...tree, version: 2, children: normalize(tree.children || []) };
}

export class DragDropEngine {
  insert(tree: PageComponentTree, node: ComponentNode, targetId?: string | null, position?: DropPosition) {
    return insertNode(tree, node, targetId, position);
  }

  move(tree: PageComponentTree, nodeId: string, targetId: string, position: DropPosition) {
    return moveNode(tree, nodeId, targetId, position);
  }

  copy(tree: PageComponentTree, nodeId: string) {
    return duplicateNode(tree, nodeId);
  }

  nest(tree: PageComponentTree, nodeId: string, parentId: string) {
    return moveNode(tree, nodeId, parentId, 'inside');
  }

  split(tree: PageComponentTree, nodeId: string) {
    const node = findNode(tree, nodeId);
    if (!node) return tree;
    const copy = cloneNodeWithIds(node);
    return insertNode(tree, copy, nodeId, 'after');
  }

  merge(tree: PageComponentTree, sourceId: string, targetId: string) {
    const source = findNode(tree, sourceId);
    const target = findNode(tree, targetId);
    if (!source || !target) return tree;
    const withoutSource = removeNode(tree, sourceId);
    return updateNode(withoutSource, targetId, {
      children: [...(target.children || []), ...(source.children || [])],
    });
  }
}
