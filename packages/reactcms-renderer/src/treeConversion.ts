import type { ComponentNode, PageComponentTree } from './types';

function labelFromType(type: string) {
  return type
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferRegionNode(regionId: string, value: any): ComponentNode {
  const clean = regionId.toLowerCase();
  let type = 'paragraph';
  let props: Record<string, any> = {
    locales: { en: { text: typeof value === 'string' ? value : JSON.stringify(value) } },
  };

  if (clean.includes('heading') || clean.includes('title')) {
    type = 'heading';
    props = { locales: { en: { text: value?.text ?? value ?? '' } }, level: 'h2' };
  } else if (clean.includes('image') || clean.includes('logo') || value?.src) {
    type = 'image';
    props = {
      src: value?.src ?? value ?? '',
      locales: { en: { alt: value?.alt ?? labelFromType(regionId) } },
    };
  } else if (clean.includes('button') || clean.includes('cta') || value?.href) {
    type = 'button';
    props = {
      url: value?.href ?? value?.url ?? '#',
      color: value?.color ?? '#2563eb',
      locales: { en: { label: value?.text ?? value?.label ?? value ?? 'Learn More' } },
    };
  }

  return {
    id: `region_${regionId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    type,
    label: labelFromType(regionId),
    props,
    children: [],
    metadata: { regionId },
  };
}

export function blockToComponentNode(block: Record<string, any>): ComponentNode {
  const { id, type, children, ...props } = block;
  return {
    id: id || `node_${Math.random().toString(36).slice(2, 10)}`,
    type: type || 'container',
    label: block.label || labelFromType(type || 'container'),
    props,
    children: Array.isArray(children) ? children.map(blockToComponentNode) : [],
    hidden: !!block.hidden,
    locked: !!block.locked,
    metadata: block.metadata || {},
  };
}

export function blocksToPageTree(
  blocks: Array<Record<string, any>> = [],
  options: { id?: string; title?: string; locale?: string } = {},
): PageComponentTree {
  return {
    id: options.id || 'page',
    type: 'page',
    version: 2,
    title: options.title,
    locale: options.locale || 'en',
    children: blocks.map(blockToComponentNode),
    metadata: { migratedFrom: 'blocks' },
  };
}

export function componentNodeToBlock(node: ComponentNode): Record<string, any> {
  return {
    id: node.id,
    type: node.type,
    ...(node.props || {}),
    ...(node.children?.length
      ? { children: node.children.map(componentNodeToBlock) }
      : {}),
    ...(node.hidden ? { hidden: true } : {}),
    ...(node.locked ? { locked: true } : {}),
    ...(node.metadata && Object.keys(node.metadata).length
      ? { metadata: node.metadata }
      : {}),
  };
}

export function pageTreeToBlocks(tree: PageComponentTree): Array<Record<string, any>> {
  return (tree.children || []).map(componentNodeToBlock);
}

export function regionsToPageTree(
  regions: Record<string, any>,
  options: { id?: string; title?: string; locale?: string } = {},
): PageComponentTree {
  const regionNodes = Object.entries(regions || {}).map(([id, value]) => (
    inferRegionNode(id, value)
  ));

  return {
    id: options.id || 'page',
    type: 'page',
    version: 2,
    title: options.title,
    locale: options.locale || 'en',
    children: regionNodes.length
      ? [{
        id: 'imported_content',
        type: 'section',
        label: 'Imported Content',
        props: {
          design: { paddingY: 64, maxWidth: 1120, background: '#ffffff' },
        },
        children: regionNodes,
        metadata: { migratedFrom: 'editable-regions' },
      }]
      : [],
    metadata: { migratedFrom: 'editable-regions' },
  };
}

export function isPageComponentTree(value: unknown): value is PageComponentTree {
  if (!value || typeof value !== 'object') return false;
  const tree = value as Partial<PageComponentTree>;
  return tree.type === 'page' && tree.version === 2 && Array.isArray(tree.children);
}
