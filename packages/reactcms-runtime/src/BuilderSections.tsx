import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { onValue, ref } from 'firebase/database';
import {
  blocksToPageTree,
  createRuntimeAdditionsTree,
  isPageComponentTree,
  RUNTIME_ADDITIONS_REGION,
  RuntimeRenderer,
} from '@anshif.rainhopes/reactcms-renderer';
import {
  decodeFirebaseObject,
  paths,
} from '@anshif.rainhopes/shared';
import {
  CMSContext,
  getFirebaseDatabase,
  MessageBus,
} from '@anshif.rainhopes/reactcms-sdk';
import type {
  ComponentNode,
  DropPosition,
  PageComponentTree,
  RendererMutation,
} from '@anshif.rainhopes/reactcms-renderer';

export const BUILDER_BLOCKS_REGION = '__rcms_builder_blocks__';
export const NATIVE_PAGE_TREE_FIELD = 'tree';

function resolvePageId(): string {
  if (typeof window === 'undefined') return 'home';
  try {
    const queryPage = new URLSearchParams(window.location.search).get('page');
    if (queryPage) return queryPage;
  } catch {
    // Continue to pathname resolution.
  }
  return window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
}

function resolveLocale(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    return new URLSearchParams(window.location.search).get('rcms_locale')
      || document.documentElement.lang
      || 'en';
  } catch {
    return 'en';
  }
}

function decodePublishedTree(
  raw: unknown,
  pageId: string,
  locale: string,
): PageComponentTree | null {
  if (!raw || typeof raw !== 'object') return null;
  const decoded = decodeFirebaseObject(raw as Record<string, any>);
  if (isPageComponentTree(decoded[NATIVE_PAGE_TREE_FIELD])) {
    return decoded[NATIVE_PAGE_TREE_FIELD];
  }

  const regions = decoded.regions && typeof decoded.regions === 'object'
    ? decoded.regions
    : {};
  const blocks = Array.isArray(regions[BUILDER_BLOCKS_REGION])
    ? regions[BUILDER_BLOCKS_REGION]
    : [];
  return blocks.length
    ? blocksToPageTree(blocks, {
      id: pageId,
      title: decoded.title,
      locale,
    })
    : null;
}

function decodeRuntimeAdditions(raw: unknown): PageComponentTree | null {
  if (!raw || typeof raw !== 'object') return null;
  const decoded = decodeFirebaseObject(raw as Record<string, any>);
  const regions = decoded.regions && typeof decoded.regions === 'object'
    ? decoded.regions
    : {};
  return isPageComponentTree(regions[RUNTIME_ADDITIONS_REGION])
    ? regions[RUNTIME_ADDITIONS_REGION]
    : null;
}

function findNode(nodes: ComponentNode[], nodeId: string): ComponentNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode(node.children || [], nodeId);
    if (child) return child;
  }
  return null;
}

function setAtPath(source: any, path: Array<string | number>, value: unknown): any {
  if (!path.length) return value;
  const [head, ...tail] = path;
  const next = Array.isArray(source) ? [...source] : { ...(source || {}) };
  next[head as any] = setAtPath(next[head as any], tail, value);
  return next;
}

function updateNode(
  nodes: ComponentNode[],
  nodeId: string,
  path: Array<string | number>,
  value: unknown,
): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return setAtPath(node, path, value);
    if (!node.children?.length) return node;
    return { ...node, children: updateNode(node.children, nodeId, path, value) };
  });
}

function removeNode(nodes: ComponentNode[], nodeId: string): ComponentNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => node.children?.length
      ? { ...node, children: removeNode(node.children, nodeId) }
      : node);
}

function insertNode(
  nodes: ComponentNode[],
  targetId: string,
  position: DropPosition,
  addition: ComponentNode,
): ComponentNode[] {
  const targetIndex = nodes.findIndex((node) => node.id === targetId);
  if (targetIndex >= 0) {
    if (position === 'inside') {
      return nodes.map((node, index) => index === targetIndex
        ? { ...node, children: [...(node.children || []), addition] }
        : node);
    }
    const next = [...nodes];
    next.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, addition);
    return next;
  }
  return nodes.map((node) => {
    if (!node.children?.length) return node;
    const children = insertNode(node.children, targetId, position, addition);
    return children === node.children ? node : { ...node, children };
  });
}

function reorderNode(nodes: ComponentNode[], nodeId: string, direction: -1 | 1): ComponentNode[] {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index >= 0) {
    const destination = index + direction;
    if (destination < 0 || destination >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  }
  return nodes.map((node) => {
    if (!node.children?.length) return node;
    const children = reorderNode(node.children, nodeId, direction);
    return children === node.children ? node : { ...node, children };
  });
}

function refreshNodeIds(node: ComponentNode, suffix: string): ComponentNode {
  return {
    ...node,
    id: `${node.id}_${suffix}`,
    children: node.children?.map((child, index) => refreshNodeIds(child, `${suffix}_${index}`)),
  };
}

function makeRuntimeNode(type: string, locale: string): ComponentNode {
  const safeType = type || 'section';
  const id = `${safeType.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now().toString(36)}`;
  const field = ['input', 'textarea-field', 'select-field', 'checkbox'].includes(safeType);
  return {
    id,
    type: safeType,
    label: safeType.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' '),
    props: {
      locales: {
        [locale]: field
          ? { label: 'New field', placeholder: 'Enter a value' }
          : { title: 'New section', text: 'Double-click this text to edit it.' },
      },
      design: {},
    },
    children: [],
  };
}

function RuntimeAdditionsPortal({
  websiteId,
  pageId,
  locale,
  tree,
  theme,
  editMode,
  onTreeChange,
}: {
  websiteId: string;
  pageId: string;
  locale: string;
  tree: PageComponentTree;
  theme: Record<string, any> | null;
  editMode: boolean;
  onTreeChange: (tree: PageComponentTree) => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const clipboard = useRef<ComponentNode | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let portalHost = document.querySelector<HTMLElement>('[data-rcms-runtime-additions-host]');
    let created = false;
    const attach = () => {
      if (!portalHost) {
        portalHost = document.createElement('div');
        portalHost.dataset.rcmsRuntimeAdditionsHost = 'true';
        created = true;
      }
      const footer = document.querySelector<HTMLElement>(
        'footer, [data-rcms-type="footer"], .footer-section',
      );
      const parent = footer?.parentElement || document.querySelector<HTMLElement>('#root') || document.body;
      if (footer && footer.parentElement === parent) {
        if (portalHost.parentElement !== parent || portalHost.nextSibling !== footer) {
          parent.insertBefore(portalHost, footer);
        }
      } else if (portalHost.parentElement !== parent) {
        parent.appendChild(portalHost);
      }
      setHost(portalHost);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (created) portalHost?.remove();
    };
  }, []);

  const commit = useCallback((next: PageComponentTree) => {
    onTreeChange(next);
    MessageBus.send('rcms/v1/field-update', websiteId, {
      pageId,
      regionId: RUNTIME_ADDITIONS_REGION,
      value: next,
    });
  }, [onTreeChange, pageId, websiteId]);

  const addNode = useCallback((componentType = 'section', targetId = '', position: DropPosition = 'after') => {
    const addition = makeRuntimeNode(componentType, locale);
    const children = targetId
      ? insertNode(tree.children, targetId, position, addition)
      : [...tree.children, addition];
    commit({ ...tree, children });
    setSelectedIds([addition.id]);
  }, [commit, locale, tree]);

  const handleMutation = useCallback((mutation: RendererMutation) => {
    commit({
      ...tree,
      children: updateNode(tree.children, mutation.nodeId, mutation.path, mutation.value),
    });
  }, [commit, tree]);

  const handleSelect = useCallback((nodeId: string, additive = false) => {
    const node = findNode(tree.children, nodeId);
    if (!node) return;
    setSelectedIds((current) => additive
      ? current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId]
      : [nodeId]);
    MessageBus.send('rcms/v1/region-selected', websiteId, {
      regionId: RUNTIME_ADDITIONS_REGION,
      type: 'runtime-component',
      pageId,
      value: tree,
      componentId: nodeId,
      componentType: node.type,
      label: node.label || node.type,
      additive,
    });
    MessageBus.send('rcms/v1/open-inspector', websiteId, {
      regionId: RUNTIME_ADDITIONS_REGION,
      type: 'runtime-component',
      pageId,
      componentId: nodeId,
    });
  }, [pageId, tree, websiteId]);

  const handleCommand = useCallback((command: string, nodeId: string) => {
    const node = findNode(tree.children, nodeId);
    if (!node) return;
    if (command === 'copy') {
      clipboard.current = structuredClone(node);
      return;
    }
    if (command === 'paste' && clipboard.current) {
      const addition = refreshNodeIds(structuredClone(clipboard.current), `copy_${Date.now().toString(36)}`);
      commit({ ...tree, children: insertNode(tree.children, nodeId, 'after', addition) });
      setSelectedIds([addition.id]);
      return;
    }
    if (command === 'delete') {
      commit({ ...tree, children: removeNode(tree.children, nodeId) });
      setSelectedIds((current) => current.filter((id) => id !== nodeId));
      return;
    }
    if (command === 'duplicate') {
      const addition = refreshNodeIds(structuredClone(node), `copy_${Date.now().toString(36)}`);
      commit({ ...tree, children: insertNode(tree.children, nodeId, 'after', addition) });
      setSelectedIds([addition.id]);
      return;
    }
    if (command === 'move-up' || command === 'move-down') {
      commit({
        ...tree,
        children: reorderNode(tree.children, nodeId, command === 'move-up' ? -1 : 1),
      });
    }
  }, [commit, tree]);

  const handleMove = useCallback((nodeId: string, targetId: string, position: DropPosition) => {
    const node = findNode(tree.children, nodeId);
    if (!node || findNode(node.children || [], targetId)) return;
    const without = removeNode(tree.children, nodeId);
    commit({ ...tree, children: insertNode(without, targetId, position, node) });
  }, [commit, tree]);

  if (!host) return null;
  return createPortal(
    tree.children.length ? (
      <RuntimeRenderer
        tree={tree}
        locale={locale}
        responsiveMode="desktop"
        mode={editMode ? 'edit' : 'runtime'}
        theme={theme}
        selectedIds={selectedIds}
        hoveredId={hoveredId}
        onSelect={handleSelect}
        onHover={setHoveredId}
        onMutation={handleMutation}
        onMove={handleMove}
        onInsert={addNode}
        onCommand={handleCommand}
      />
    ) : editMode ? (
      <div
        data-rcms-empty-additions="true"
        style={{
          margin: '20px auto',
          maxWidth: '1120px',
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          border: '1px dashed #60a5fa',
          borderRadius: '12px',
          background: 'rgba(37, 99, 235, .06)',
          color: '#1d4ed8',
          font: '600 12px Inter, system-ui, sans-serif',
        }}
      >
        <span>CMS insertion area above the footer</span>
        <button type="button" onClick={() => addNode('section')}>+ Section</button>
        <button type="button" onClick={() => addNode('input')}>+ Input field</button>
        <button type="button" onClick={() => addNode('textarea-field')}>+ Message field</button>
      </div>
    ) : null,
    host,
  );
}

export interface BuilderSectionsProps {
  websiteId: string;
  apiKey: string;
  pageId?: string;
  fallback?: React.ReactNode;
  layout?: React.ComponentType<any> | null;
}

export function BuilderSections({
  websiteId,
  apiKey,
  pageId: pageIdOverride,
  fallback = null,
  layout: Layout = null,
}: BuilderSectionsProps) {
  const pageId = useMemo(
    () => pageIdOverride?.replace(/^\/+|\/+$/g, '') || resolvePageId(),
    [pageIdOverride],
  );
  const locale = useMemo(resolveLocale, []);
  const cms = useContext(CMSContext);
  const [tree, setTree] = useState<PageComponentTree | null>(null);
  const [runtimeAdditions, setRuntimeAdditions] = useState<PageComponentTree | null>(null);
  const [theme, setTheme] = useState<Record<string, any> | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const database = getFirebaseDatabase(apiKey);
    const publishedRef = ref(database, paths.contentPublished(websiteId, pageId));
    const themeRef = ref(database, paths.contentTheme(websiteId));
    const unsubscribePage = onValue(
      publishedRef,
      (snapshot) => {
        const value = snapshot.exists() ? snapshot.val() : null;
        setTree(value ? decodePublishedTree(value, pageId, locale) : null);
        setRuntimeAdditions(value ? decodeRuntimeAdditions(value) : null);
        setResolved(true);
      },
      (error) => {
        console.error('[ReactCMS Runtime] Native page subscription failed:', error);
        setResolved(true);
      },
    );
    const unsubscribeTheme = onValue(themeRef, (snapshot) => {
      setTheme(snapshot.exists()
        ? decodeFirebaseObject(snapshot.val())
        : null);
    });
    return () => {
      unsubscribePage();
      unsubscribeTheme();
    };
  }, [apiKey, locale, pageId, websiteId]);

  useEffect(() => MessageBus.subscribe((message) => {
    if (message.type !== 'rcms/v1/field-update') return;
    const payload = message.payload as {
      pageId?: string;
      regionId?: string;
      value?: unknown;
    };
    if (
      payload?.regionId === RUNTIME_ADDITIONS_REGION
      && (!payload.pageId || payload.pageId === pageId)
      && isPageComponentTree(payload.value)
    ) {
      setRuntimeAdditions(payload.value);
    }
  }), [pageId]);

  const additionsTree = runtimeAdditions || createRuntimeAdditionsTree(pageId, locale);
  const additions = (runtimeAdditions?.children.length || cms?.editMode) ? (
    <RuntimeAdditionsPortal
      websiteId={websiteId}
      pageId={pageId}
      locale={locale}
      tree={additionsTree}
      theme={theme}
      editMode={Boolean(cms?.editMode)}
      onTreeChange={setRuntimeAdditions}
    />
  ) : null;
  if (!resolved || !tree) return <>{fallback}{additions}</>;
  const page = (
    <>
      <RuntimeRenderer
        tree={tree}
        locale={locale}
        responsiveMode="desktop"
        mode={cms?.editMode ? 'edit' : 'runtime'}
        theme={theme}
      />
      {additions}
    </>
  );
  return Layout ? <Layout>{page}</Layout> : page;
}

export default BuilderSections;
