// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RuntimeRenderer } from './RuntimeRenderer';
import type { PageComponentTree } from './types';

it('shows the default FAQ heading for an empty saved title in edit and runtime modes', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = { id: 'page', type: 'page', version: 2, children: [
    { id: 'faq', type: 'faq', props: { locales: { en: { title: '', items: [] } } }, children: [] }
  ] } as PageComponentTree;
  try {
    for (const mode of ['edit', 'runtime'] as const) {
      act(() => root.render(<RuntimeRenderer tree={tree} mode={mode} />));
      expect(host.querySelector('h2')?.textContent).toBe('Frequently asked questions');
    }
    tree.children[0].props!.locales.en.title = 'Your questions answered';
    act(() => root.render(<RuntimeRenderer tree={tree} mode="edit" />));
    expect(host.querySelector('h2')?.textContent).toBe('Your questions answered');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
