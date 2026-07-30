import React, {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type {
  ComponentNode,
  PageComponentTree,
} from '@anshif.rainhopes/reactcms-renderer';

export interface SelectionState {
  selectedIds: string[];
  activeId: string | null;
  hoveredId: string | null;
  focusedId: string | null;
  anchorId: string | null;
}

const EMPTY_STATE: SelectionState = {
  selectedIds: [],
  activeId: null,
  hoveredId: null,
  focusedId: null,
  anchorId: null,
};

function flatten(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
}

function nodePath(nodes: ComponentNode[], nodeId: string, trail: ComponentNode[] = []): ComponentNode[] {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === nodeId) return next;
    const childPath = nodePath(node.children || [], nodeId, next);
    if (childPath.length) return childPath;
  }
  return [];
}

export class SelectionManager {
  private state: SelectionState = EMPTY_STATE;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private update(next: SelectionState) {
    this.state = next;
    this.listeners.forEach((listener) => listener());
    return next;
  }

  select(nodeId: string, additive = false) {
    const selectedIds = additive
      ? this.state.selectedIds.includes(nodeId)
        ? this.state.selectedIds.filter((id) => id !== nodeId)
        : [...this.state.selectedIds, nodeId]
      : [nodeId];
    return this.update({
      ...this.state,
      selectedIds,
      activeId: nodeId,
      focusedId: nodeId,
      anchorId: additive ? this.state.anchorId || nodeId : nodeId,
    });
  }

  selectMany(nodeIds: string[], activeId?: string | null) {
    const unique = Array.from(new Set(nodeIds));
    const lastId = unique.length ? unique[unique.length - 1] : null;
    return this.update({
      ...this.state,
      selectedIds: unique,
      activeId: activeId === undefined ? lastId : activeId,
      focusedId: activeId === undefined ? lastId : activeId,
      anchorId: unique[0] || null,
    });
  }

  boxSelect(nodeIds: string[], additive = false) {
    return this.selectMany(
      additive ? [...this.state.selectedIds, ...nodeIds] : nodeIds,
    );
  }

  hover(nodeId: string | null) {
    return this.update({ ...this.state, hoveredId: nodeId });
  }

  focus(nodeId: string | null) {
    return this.update({ ...this.state, focusedId: nodeId });
  }

  clear() {
    return this.update({ ...EMPTY_STATE });
  }

  navigate(tree: PageComponentTree, direction: -1 | 1) {
    const nodes = flatten(tree.children || []);
    if (!nodes.length) return this.state;
    const current = nodes.findIndex((node) => node.id === this.state.activeId);
    const next = current < 0
      ? nodes[0]
      : nodes[Math.max(0, Math.min(nodes.length - 1, current + direction))];
    return this.select(next.id);
  }

  breadcrumbs(tree: PageComponentTree) {
    if (!this.state.activeId) return [];
    return nodePath(tree.children || [], this.state.activeId);
  }
}

interface SelectionContextValue {
  manager: SelectionManager;
  state: SelectionState;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({
  manager: providedManager,
  children,
}: {
  manager?: SelectionManager;
  children: React.ReactNode;
}) {
  const manager = useMemo(() => providedManager || new SelectionManager(), [providedManager]);
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const value = useMemo(() => ({ manager, state }), [manager, state]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection must be used inside SelectionProvider.');
  return value;
}

export default SelectionManager;
