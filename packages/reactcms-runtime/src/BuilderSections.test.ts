import { describe, expect, it } from 'vitest';
import { RUNTIME_ADDITIONS_REGION } from '@anshif.rainhopes/reactcms-renderer';
import {
  attachRuntimeHostFallback,
  decodeRuntimeAdditionsForMode,
} from './BuilderSections';

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
