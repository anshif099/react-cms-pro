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

export function decodeRuntimeAdditionsForMode(
  publishedRaw: unknown,
  draftRaw: unknown,
  editMode: boolean,
): PageComponentTree | null {
  return decodeRuntimeAdditions(editMode ? draftRaw : publishedRaw);
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

type RuntimePlacement = {
  anchorRegionId?: string;
  position: DropPosition | 'footer';
};

function normalizedRuntimePlacement(value: unknown): RuntimePlacement {
  if (!value || typeof value !== 'object') return { position: 'footer' };
  const candidate = value as Record<string, unknown>;
  const anchorRegionId = String(candidate.anchorRegionId || '').trim();
  const position = ['before', 'inside', 'after'].includes(String(candidate.position))
    ? candidate.position as DropPosition
    : 'footer';
  return anchorRegionId && position !== 'footer'
    ? { anchorRegionId, position }
    : { position: 'footer' };
}

function placementKey(placement: RuntimePlacement): string {
  return placement.anchorRegionId
    ? `${placement.position}:${placement.anchorRegionId}`
    : 'footer';
}

function makeRuntimeNode(
  type: string,
  locale: string,
  placement: RuntimePlacement = { position: 'footer' },
): ComponentNode {
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
    ...(placement.anchorRegionId ? { metadata: { runtimePlacement: placement } } : {}),
  };
}

function RuntimeAdditionsPortal({
  websiteId,
  pageId,
  locale,
  tree,
  nodes,
  placement,
  hostKey,
  theme,
  editMode,
  onTreeChange,
}: {
  websiteId: string;
  pageId: string;
  locale: string;
  tree: PageComponentTree;
  nodes: ComponentNode[];
  placement: RuntimePlacement;
  hostKey: string;
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
    let portalHost = Array.from(document.querySelectorAll<HTMLElement>('[data-rcms-runtime-additions-host]'))
      .find((candidate) => candidate.dataset.rcmsRuntimeAdditionsHost === hostKey) || null;
    let created = false;
    const attach = () => {
      if (!portalHost) {
        portalHost = document.createElement('div');
        portalHost.dataset.rcmsRuntimeAdditionsHost = hostKey;
        created = true;
      }
      const anchor = placement.anchorRegionId
        ? Array.from(document.querySelectorAll<HTMLElement>('[data-rcms-region]'))
          .find((candidate) => candidate.dataset.rcmsRegion === placement.anchorRegionId)
        : null;
      if (anchor) {
        if (placement.position === 'inside') {
          if (portalHost.parentElement !== anchor) anchor.appendChild(portalHost);
          setHost(portalHost);
          return;
        }
        const parent = anchor.parentElement;
        if (parent && placement.position === 'before') {
          if (portalHost.parentElement !== parent || portalHost.nextSibling !== anchor) {
            parent.insertBefore(portalHost, anchor);
          }
          setHost(portalHost);
          return;
        }
        if (parent && placement.position === 'after') {
          if (portalHost.parentElement !== parent || anchor.nextSibling !== portalHost) {
            parent.insertBefore(portalHost, anchor.nextSibling);
          }
          setHost(portalHost);
          return;
        }
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
  }, [hostKey, placement.anchorRegionId, placement.position]);

  const commit = useCallback((next: PageComponentTree) => {
    onTreeChange(next);
    MessageBus.send('rcms/v1/field-update', websiteId, {
      pageId,
      regionId: RUNTIME_ADDITIONS_REGION,
      value: next,
    });
  }, [onTreeChange, pageId, websiteId]);

  const addNode = useCallback((componentType = 'section', targetId = '', position: DropPosition = 'after') => {
    const addition = makeRuntimeNode(componentType, locale, placement);
    const children = targetId
      ? insertNode(tree.children, targetId, position, addition)
      : [...tree.children, addition];
    commit({ ...tree, children });
    setSelectedIds([addition.id]);
  }, [commit, locale, placement, tree]);

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
    nodes.length ? (
      <RuntimeRenderer
        tree={{ ...tree, children: nodes }}
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
  const editMode = Boolean(cms?.editMode);
  const [tree, setTree] = useState<PageComponentTree | null>(null);
  const [runtimeAdditions, setRuntimeAdditions] = useState<PageComponentTree | null>(null);
  const [theme, setTheme] = useState<Record<string, any> | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const database = getFirebaseDatabase(apiKey);
    const publishedRef = ref(database, paths.contentPublished(websiteId, pageId));
    const draftRef = editMode
      ? ref(database, paths.contentDraft(websiteId, pageId))
      : null;
    const themeRef = ref(database, paths.contentTheme(websiteId));
    const unsubscribePage = onValue(
      publishedRef,
      (snapshot) => {
        const value = snapshot.exists() ? snapshot.val() : null;
        setTree(value ? decodePublishedTree(value, pageId, locale) : null);
        if (!editMode) {
          setRuntimeAdditions(decodeRuntimeAdditionsForMode(value, null, false));
        }
        setResolved(true);
      },
      (error) => {
        console.error('[ReactCMS Runtime] Native page subscription failed:', error);
        setResolved(true);
      },
    );
    const unsubscribeDraft = draftRef
      ? onValue(
        draftRef,
        (snapshot) => {
          const value = snapshot.exists() ? snapshot.val() : null;
          setRuntimeAdditions(decodeRuntimeAdditionsForMode(null, value, true));
        },
        (error) => {
          console.error('[ReactCMS Runtime] Draft additions subscription failed:', error);
        },
      )
      : () => {};
    const unsubscribeTheme = onValue(themeRef, (snapshot) => {
      setTheme(snapshot.exists()
        ? decodeFirebaseObject(snapshot.val())
        : null);
    });
    return () => {
      unsubscribePage();
      unsubscribeDraft();
      unsubscribeTheme();
    };
  }, [apiKey, editMode, locale, pageId, websiteId]);

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
  const additionGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      placement: RuntimePlacement;
      nodes: ComponentNode[];
    }>();
    additionsTree.children.forEach((node) => {
      const placement = normalizedRuntimePlacement(node.metadata?.runtimePlacement);
      const key = placementKey(placement);
      const group = groups.get(key) || { key, placement, nodes: [] };
      group.nodes.push(node);
      groups.set(key, group);
    });
    if (!groups.size && cms?.editMode) {
      groups.set('footer', {
        key: 'footer',
        placement: { position: 'footer' },
        nodes: [],
      });
    }
    return Array.from(groups.values());
  }, [additionsTree, cms?.editMode]);
  const additions = additionGroups.length ? additionGroups.map((group) => (
    <RuntimeAdditionsPortal
      key={group.key}
      websiteId={websiteId}
      pageId={pageId}
      locale={locale}
      tree={additionsTree}
      nodes={group.nodes}
      placement={group.placement}
      hostKey={group.key}
      theme={theme}
      editMode={Boolean(cms?.editMode)}
      onTreeChange={setRuntimeAdditions}
    />
  )) : null;
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
