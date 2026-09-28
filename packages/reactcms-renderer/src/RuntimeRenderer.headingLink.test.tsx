// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RuntimeRenderer } from './RuntimeRenderer';
import type { PageComponentTree } from './types';

it('enables heading navigation at runtime and preserves editable text without navigation in the editor', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = { id: 'page', type: 'page', version: 2, children: [
    { id: 'heading', type: 'heading', props: { text: 'Contact us', linkUrl: '/contact', newTab: true, level: 'h3' }, children: [] }
  ] } as PageComponentTree;
  act(() => root.render(<RuntimeRenderer tree={tree} mode="runtime" />));
  expect(host.querySelector('a')!.getAttribute('href')).toBe('/contact');
  expect(host.querySelector('a')!.rel).toBe('noopener noreferrer');
  act(() => root.render(<RuntimeRenderer tree={tree} mode="edit" selectedIds={['heading']} />));
  expect(host.querySelector('a')!.hasAttribute('href')).toBe(false);
  expect(host.querySelector('h3')!.textContent).toBe('Contact us');
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
