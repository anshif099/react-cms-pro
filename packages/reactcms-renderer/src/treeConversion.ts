import type { ComponentNode, PageComponentTree } from './types';

function labelFromType(type: string) {
  return type
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferRegionNode(regionId: string, value: any, locale = 'en'): ComponentNode {
  const clean = regionId.toLowerCase();
  const definition = value
    && typeof value === 'object'
    && value.id
    && value.type
    ? value
    : null;
  const actualValue = definition
    ? definition.defaultValue ?? definition.value ?? ''
    : value;
  const declaredType = String(definition?.type || '').toLowerCase();
  let type = 'paragraph';
  let props: Record<string, any> = {
    locales: {
      [locale]: {
        text: typeof actualValue === 'string'
          ? actualValue
          : actualValue?.text ?? JSON.stringify(actualValue),
      },
    },
  };

  if (
    declaredType === 'section'
    || declaredType === 'container'
  ) {
    type = declaredType;
    props = {
      design: typeof actualValue === 'object' ? actualValue : {},
    };
  } else if (
    declaredType === 'image'
    || clean.includes('image')
    || clean.includes('logo')
    || actualValue?.src
  ) {
    type = 'image';
    props = {
      src: actualValue?.src ?? actualValue ?? '',
      width: actualValue?.width,
      height: actualValue?.height,
      objectFit: actualValue?.objectFit,
      locales: {
        [locale]: {
          alt: actualValue?.alt ?? definition?.label ?? labelFromType(regionId),
        },
      },
    };
  } else if (
    declaredType === 'button'
    || clean.includes('button')
    || clean.includes('cta')
    || actualValue?.href
  ) {
    type = 'button';
    props = {
      url: actualValue?.href ?? actualValue?.url ?? '#',
      color: actualValue?.color ?? '#2563eb',
      locales: {
        [locale]: {
          label: actualValue?.text
            ?? actualValue?.label
            ?? actualValue
            ?? 'Learn More',
        },
      },
    };
  } else if (declaredType === 'video') {
    type = 'video';
    props = {
      url: actualValue?.url ?? actualValue?.src ?? actualValue ?? '',
      poster: actualValue?.poster,
      controls: actualValue?.controls ?? true,
    };
  } else if (declaredType === 'repeater' && Array.isArray(actualValue)) {
    type = 'cards';
    props = {
      locales: {
        [locale]: {
          title: definition?.label || labelFromType(regionId),
          cards: actualValue,
        },
      },
    };
  } else if (
    declaredType === 'heading'
    || clean.includes('heading')
    || clean.includes('title')
  ) {
    type = 'heading';
    props = {
      locales: {
        [locale]: {
          text: actualValue?.text ?? actualValue ?? '',
        },
      },
      level: actualValue?.level || 'h2',
    };
  }

  return {
    id: `region_${regionId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    type,
    label: definition?.label || labelFromType(regionId),
    props,
    children: [],
    metadata: {
      regionId,
      ...(definition ? { regionDefinition: definition } : {}),
    },
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
  const locale = options.locale || 'en';
  const regionNodes = Object.entries(regions || {}).map(([id, value]) => (
    inferRegionNode(id, value, locale)
  ));

  return {
    id: options.id || 'page',
    type: 'page',
    version: 2,
    title: options.title,
    locale,
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
