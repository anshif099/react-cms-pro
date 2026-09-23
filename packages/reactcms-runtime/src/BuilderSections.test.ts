import { describe, expect, it } from 'vitest';
import { RUNTIME_ADDITIONS_REGION } from '@anshif.rainhopes/reactcms-renderer';
import {
  attachRuntimeHostFallback,
  decodeRuntimeAdditionsForMode,
  moveRuntimeAddition,
} from './BuilderSections';
import type { PageComponentTree } from '@anshif.rainhopes/reactcms-renderer';

describe('moveRuntimeAddition', () => {
  const tree = {
    id: 'additions', type: 'page', version: 2,
    children: [
      { id: 'button', type: 'button', props: { offsetX: 50, offsetY: 80 }, metadata: { runtimePlacement: { anchorRegionId: 'heading', position: 'after' } } },
      { id: 'other', type: 'button', metadata: { runtimePlacement: { anchorRegionId: 'image', position: 'after' } } },
    ],
  } as PageComponentTree;
  it('persists the destination portal, not just array order, through serialization', () => {
    const next = JSON.parse(JSON.stringify(moveRuntimeAddition(tree, 'button', 'other', 'after')));
    expect(next.children.map((node: { id: string }) => node.id)).toEqual(['other', 'button']);
    expect(next.children[1].metadata.runtimePlacement).toEqual({ anchorRegionId: 'image', position: 'after' });
    expect(next.children[1].props).toMatchObject({ offsetX: 0, offsetY: 0 });
    expect(tree.children[0].metadata?.runtimePlacement).toEqual({ anchorRegionId: 'heading', position: 'after' });
  });
  it('does not delete a node for a missing or self target', () => {
    expect(moveRuntimeAddition(tree, 'button', 'missing', 'after')).toBe(tree);
    expect(moveRuntimeAddition(tree, 'button', 'button', 'after')).toBe(tree);
  });
  it('places a button beside its target without a horizontal offset', () => {
    const next = JSON.parse(JSON.stringify(moveRuntimeAddition(tree, 'button', 'other', 'after', .83)));
    expect(next.children[1].props).toMatchObject({ offsetX: 0, offsetY: 0 });
    expect(next.children[1].props.horizontalPosition).toBeUndefined();
    expect(next.children[1].metadata.runtimePlacement.anchorRegionId).toBe('image');
  });
  it('inherits the top-level destination placement for nested targets', () => {
    const nested = { ...tree, children: [...tree.children, { id: 'section', type: 'section', metadata: { runtimePlacement: { anchorRegionId: 'footer', position: 'before' } }, children: [{ id: 'child', type: 'paragraph' }] }] } as PageComponentTree;
    const next = moveRuntimeAddition(nested, 'button', 'child', 'after');
    expect(next.children[1].children?.[1].metadata?.runtimePlacement).toEqual({ anchorRegionId: 'footer', position: 'before' });
  });
});

const publishedTree = {
  id: 'runtime_additions_published',
  type: 'page',
  version: 2,
  children: [{ id: 'published-section', type: 'section', children: [] }],
};

const draftTree = {
  id: 'runtime_additions_draft',
  type: 'page',
  version: 2,
  children: [{ id: 'draft-section', type: 'features', children: [] }],
};

describe('decodeRuntimeAdditionsForMode', () => {
  it('uses saved draft additions in edit mode', () => {
    expect(decodeRuntimeAdditionsForMode(
      { regions: { [RUNTIME_ADDITIONS_REGION]: publishedTree } },
      { regions: { [RUNTIME_ADDITIONS_REGION]: draftTree } },
      true,
    )).toEqual(draftTree);
  });

  it('uses published additions outside edit mode', () => {
    expect(decodeRuntimeAdditionsForMode(
      { regions: { [RUNTIME_ADDITIONS_REGION]: publishedTree } },
      { regions: { [RUNTIME_ADDITIONS_REGION]: draftTree } },
      false,
    )).toEqual(publishedTree);
  });
});

describe('attachRuntimeHostFallback', () => {
  it('does not make multiple fallback hosts fight for the footer position', () => {
    const parent = {
      insertBefore: (host: { parentElement: unknown }, _footer: unknown) => {
        host.parentElement = parent;
      },
      appendChild: (host: { parentElement: unknown }) => {
        host.parentElement = parent;
      },
    };
    const footer = { parentElement: parent };
    const firstHost = { parentElement: null };
    const secondHost = { parentElement: null };

    expect(attachRuntimeHostFallback(
      firstHost as unknown as HTMLElement,
      parent as unknown as HTMLElement,
      footer as unknown as HTMLElement,
    )).toBe(true);
    expect(attachRuntimeHostFallback(
      secondHost as unknown as HTMLElement,
      parent as unknown as HTMLElement,
      footer as unknown as HTMLElement,
    )).toBe(true);

    expect(attachRuntimeHostFallback(
      firstHost as unknown as HTMLElement,
      parent as unknown as HTMLElement,
      footer as unknown as HTMLElement,
    )).toBe(false);
    expect(attachRuntimeHostFallback(
      secondHost as unknown as HTMLElement,
      parent as unknown as HTMLElement,
      footer as unknown as HTMLElement,
    )).toBe(false);
  });
});
