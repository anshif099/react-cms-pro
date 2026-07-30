import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HistoryEngine } from '@anshif.rainhopes/reactcms-history';
import {
  duplicateNode as duplicateTreeNode,
  findNode,
  getNodePath,
  insertNode as insertTreeNode,
  moveNode as moveTreeNode,
  moveNodeByOffset,
  normalizeTree,
  removeNode,
  updateNode,
  updateNodeValue,
} from '@anshif.rainhopes/reactcms-layout-engine';
import type {
  ComponentNode,
  DropPosition,
  PageComponentTree,
  RendererMutation,
} from '@anshif.rainhopes/reactcms-renderer';
import {
  SelectionManager,
  SelectionProvider,
  useSelection,
} from '@anshif.rainhopes/reactcms-selection';

export interface EditorChangeMetadata {
  label: string;
  source: 'canvas' | 'inspector' | 'layers' | 'history' | 'keyboard' | 'system';
}

export interface NativeEditorContextValue {
  tree: PageComponentTree;
  selectedIds: string[];
  activeId: string | null;
  hoveredId: string | null;
  selectedNode: ComponentNode | null;
  breadcrumbs: ComponentNode[];
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
  select: (nodeId: string, additive?: boolean) => void;
  selectMany: (nodeIds: string[], additive?: boolean) => void;
  hover: (nodeId: string | null) => void;
  clearSelection: () => void;
  mutate: (mutation: RendererMutation, label?: string) => void;
  update: (nodeId: string, updater: Partial<ComponentNode> | ((node: ComponentNode) => ComponentNode), label?: string) => void;
  insert: (node: ComponentNode, targetId?: string | null, position?: DropPosition, label?: string) => void;
  move: (nodeId: string, targetId: string, position: DropPosition) => void;
  moveByOffset: (nodeId: string, offset: number) => void;
  duplicate: (nodeId: string) => void;
  remove: (nodeId: string) => void;
  copy: (nodeId?: string) => void;
  paste: (targetId?: string | null, position?: DropPosition) => void;
  toggleHidden: (nodeId: string) => void;
  toggleLocked: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  replaceTree: (tree: PageComponentTree, label?: string) => void;
  command: (command: string, nodeId: string) => void;
  createBranch: (name: string) => ReturnType<HistoryEngine<PageComponentTree>['createBranch']>;
  history: ReturnType<HistoryEngine<PageComponentTree>['list']>;
}

const NativeEditorContext = createContext<NativeEditorContextValue | null>(null);

function cloneWithFreshIds(node: ComponentNode): ComponentNode {
  const copy = structuredClone(node);
  const renew = (current: ComponentNode): ComponentNode => ({
    ...current,
    id: `${current.type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    children: (current.children || []).map(renew),
  });
  return renew(copy);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function EditorState({
  initialTree,
  readOnly,
  onChange,
  children,
}: {
  initialTree: PageComponentTree;
  readOnly: boolean;
  onChange?: (tree: PageComponentTree, metadata: EditorChangeMetadata) => void;
  children: React.ReactNode;
}) {
  const initial = useMemo(() => normalizeTree(initialTree), [initialTree]);
  const [tree, setTree] = useState(initial);
  const [, setHistoryVersion] = useState(0);
  const historyRef = useRef(new HistoryEngine<PageComponentTree>(initial, { maxEntries: 120 }));
  const clipboardRef = useRef<ComponentNode | null>(null);
  const { manager: selection, state: selectionState } = useSelection();

  useEffect(() => {
    const next = normalizeTree(initialTree);
    setTree(next);
    historyRef.current.reset(next, 'Page loaded');
    selection.clear();
    setHistoryVersion((value) => value + 1);
  }, [initialTree, selection]);

  const commit = useCallback((
    next: PageComponentTree,
    metadata: EditorChangeMetadata,
    recordHistory = true,
  ) => {
    if (readOnly) return;
    const normalized = normalizeTree(next);
    setTree(normalized);
    if (recordHistory) historyRef.current.push(normalized, metadata.label);
    setHistoryVersion((value) => value + 1);
    onChange?.(normalized, metadata);
  }, [onChange, readOnly]);

  const select = useCallback((nodeId: string, additive = false) => {
    selection.select(nodeId, additive);
  }, [selection]);

  const selectMany = useCallback((nodeIds: string[], additive = false) => {
    selection.boxSelect(nodeIds, additive);
  }, [selection]);

  const mutate = useCallback((mutation: RendererMutation, label = 'Edit content') => {
    commit(
      updateNodeValue(tree, mutation.nodeId, mutation.path, mutation.value),
      { label, source: 'canvas' },
    );
  }, [commit, tree]);

  const update = useCallback((
    nodeId: string,
    updater: Partial<ComponentNode> | ((node: ComponentNode) => ComponentNode),
    label = 'Edit component',
  ) => {
    commit(updateNode(tree, nodeId, updater), { label, source: 'inspector' });
  }, [commit, tree]);

  const insert = useCallback((
    node: ComponentNode,
    targetId: string | null = null,
    position: DropPosition = 'after',
    label = 'Add component',
  ) => {
    commit(insertTreeNode(tree, node, targetId, position), { label, source: 'layers' });
    selection.select(node.id);
  }, [commit, selection, tree]);

  const move = useCallback((nodeId: string, targetId: string, position: DropPosition) => {
    commit(moveTreeNode(tree, nodeId, targetId, position), { label: 'Move component', source: 'layers' });
    selection.select(nodeId);
  }, [commit, selection, tree]);

  const moveByOffset = useCallback((nodeId: string, offset: number) => {
    commit(moveNodeByOffset(tree, nodeId, offset), { label: 'Reorder component', source: 'layers' });
  }, [commit, tree]);

  const duplicate = useCallback((nodeId: string) => {
    const result = duplicateTreeNode(tree, nodeId);
    if (!result.node) return;
    commit(result.tree, { label: 'Duplicate component', source: 'layers' });
    selection.select(result.node.id);
  }, [commit, selection, tree]);

  const remove = useCallback((nodeId: string) => {
    const node = findNode(tree, nodeId);
    if (!node || node.locked) return;
    commit(removeNode(tree, nodeId), { label: 'Delete component', source: 'layers' });
    selection.clear();
  }, [commit, selection, tree]);

  const copy = useCallback((nodeId?: string) => {
    const sourceId = nodeId || selectionState.activeId;
    const node = sourceId ? findNode(tree, sourceId) : null;
    if (node) clipboardRef.current = structuredClone(node);
  }, [selectionState.activeId, tree]);

  const paste = useCallback((
    targetId: string | null = selectionState.activeId,
    position: DropPosition = 'after',
  ) => {
    if (!clipboardRef.current) return;
    const copyNode = cloneWithFreshIds(clipboardRef.current);
    insert(copyNode, targetId, position, 'Paste component');
  }, [insert, selectionState.activeId]);

  const toggleHidden = useCallback((nodeId: string) => {
    const node = findNode(tree, nodeId);
    if (node) update(nodeId, { hidden: !node.hidden }, node.hidden ? 'Show component' : 'Hide component');
  }, [tree, update]);

  const toggleLocked = useCallback((nodeId: string) => {
    const node = findNode(tree, nodeId);
    if (node) update(nodeId, { locked: !node.locked }, node.locked ? 'Unlock component' : 'Lock component');
  }, [tree, update]);

  const undo = useCallback(() => {
    if (readOnly) return;
    const previous = historyRef.current.undo();
    if (!previous) return;
    setTree(previous);
    setHistoryVersion((value) => value + 1);
    onChange?.(previous, { label: 'Undo', source: 'history' });
  }, [onChange, readOnly]);

  const redo = useCallback(() => {
    if (readOnly) return;
    const next = historyRef.current.redo();
    if (!next) return;
    setTree(next);
    setHistoryVersion((value) => value + 1);
    onChange?.(next, { label: 'Redo', source: 'history' });
  }, [onChange, readOnly]);

  const replaceTree = useCallback((nextTree: PageComponentTree, label = 'Restore tree') => {
    const next = normalizeTree(nextTree);
    setTree(next);
    historyRef.current.push(next, label);
    setHistoryVersion((value) => value + 1);
    selection.clear();
    onChange?.(next, { label, source: 'system' });
  }, [onChange, selection]);

  const command = useCallback((commandName: string, nodeId: string) => {
    if (commandName === 'move-up') moveByOffset(nodeId, -1);
    if (commandName === 'move-down') moveByOffset(nodeId, 1);
    if (commandName === 'duplicate') duplicate(nodeId);
    if (commandName === 'copy') copy(nodeId);
    if (commandName === 'paste') paste(nodeId);
    if (commandName === 'delete') remove(nodeId);
    if (commandName === 'hide') toggleHidden(nodeId);
    if (commandName === 'lock') toggleLocked(nodeId);
  }, [copy, duplicate, moveByOffset, paste, remove, toggleHidden, toggleLocked]);

  useEffect(() => {
    if (readOnly) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'd' && selectionState.activeId) {
        event.preventDefault();
        duplicate(selectionState.activeId);
        return;
      }
      if (modifier && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copy();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        paste();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectionState.activeId) {
        event.preventDefault();
        remove(selectionState.activeId);
        return;
      }
      if (event.key === 'Escape') {
        selection.clear();
        return;
      }
      if (event.key === 'ArrowUp') selection.navigate(tree, -1);
      if (event.key === 'ArrowDown') selection.navigate(tree, 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copy, duplicate, paste, readOnly, redo, remove, selection, selectionState.activeId, tree, undo]);

  const selectedNode = selectionState.activeId ? findNode(tree, selectionState.activeId) : null;
  const historyState = historyRef.current.getState();
  const value = useMemo<NativeEditorContextValue>(() => ({
    tree,
    selectedIds: selectionState.selectedIds,
    activeId: selectionState.activeId,
    hoveredId: selectionState.hoveredId,
    selectedNode,
    breadcrumbs: selectionState.activeId ? getNodePath(tree, selectionState.activeId) : [],
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    readOnly,
    select,
    selectMany,
    hover: selection.hover.bind(selection),
    clearSelection: selection.clear.bind(selection),
    mutate,
    update,
    insert,
    move,
    moveByOffset,
    duplicate,
    remove,
    copy,
    paste,
    toggleHidden,
    toggleLocked,
    undo,
    redo,
    replaceTree,
    command,
    createBranch: historyRef.current.createBranch.bind(historyRef.current),
    history: historyRef.current.list(),
  }), [
    command,
    copy,
    duplicate,
    historyState.canRedo,
    historyState.canUndo,
    insert,
    move,
    moveByOffset,
    mutate,
    paste,
    readOnly,
    redo,
    remove,
    replaceTree,
    select,
    selectMany,
    selectedNode,
    selection,
    selectionState.activeId,
    selectionState.hoveredId,
    selectionState.selectedIds,
    toggleHidden,
    toggleLocked,
    tree,
    undo,
    update,
  ]);

  return <NativeEditorContext.Provider value={value}>{children}</NativeEditorContext.Provider>;
}

export function NativeEditorProvider({
  initialTree,
  readOnly = false,
  onChange,
  children,
}: {
  initialTree: PageComponentTree;
  readOnly?: boolean;
  onChange?: (tree: PageComponentTree, metadata: EditorChangeMetadata) => void;
  children: React.ReactNode;
}) {
  const manager = useMemo(() => new SelectionManager(), []);
  return (
    <SelectionProvider manager={manager}>
      <EditorState initialTree={initialTree} readOnly={readOnly} onChange={onChange}>
        {children}
      </EditorState>
    </SelectionProvider>
  );
}

export function useNativeEditor() {
  const value = useContext(NativeEditorContext);
  if (!value) throw new Error('useNativeEditor must be used inside NativeEditorProvider.');
  return value;
}

export default NativeEditorProvider;
