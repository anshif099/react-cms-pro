// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RuntimeRenderer } from './RuntimeRenderer';
import type { PageComponentTree } from './types';

it.each(['desktop', 'tablet', 'mobile'] as const)('removes image width constraints on %s', (responsiveMode) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const tree = { id: 'page', type: 'page', version: 2, children: [
    { id: 'image', type: 'image', props: { src: '/photo.jpg', width: '100%' }, children: [] },
  ] } as PageComponentTree;
  for (const mode of ['edit', 'runtime'] as const) {
    act(() => root.render(<RuntimeRenderer tree={tree} mode={mode} responsiveMode={responsiveMode} />));
    const frame = host.querySelector<HTMLElement>('[data-rcms-node="image"]')!;
    expect(frame.style.paddingRight).toBe('0px');
    expect(frame.style.paddingLeft).toBe('0px');
    expect((frame.firstElementChild as HTMLElement).style.maxWidth).toBe('none');
    expect(frame.querySelector('img')!.style.width).toBe('100%');
  }
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
