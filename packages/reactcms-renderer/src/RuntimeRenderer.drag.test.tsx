// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeRenderer } from './RuntimeRenderer';
import type { PageComponentTree } from './types';

function pointer(target: EventTarget, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => target.dispatchEvent(event));
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('rendered button drag wiring', () => {
  it('drags the button label, not its section, and emits the saved image placement', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    const image = document.createElement('div');
    image.dataset.rcmsRegion = 'hero-image';
    document.body.append(host, image);
    const tree: PageComponentTree = {
      id: 'test', type: 'page', version: 2, children: [{
        id: 'button', type: 'button', props: { text: 'Move button', url: '/contact', offsetX: 25, offsetY: 30 },
        metadata: { runtimePlacement: { anchorRegionId: 'heading', position: 'after' } },
      }],
    };
    const onMutation = vi.fn();
    const onSelect = vi.fn();
    const root = createRoot(host);
    act(() => root.render(<RuntimeRenderer tree={tree} mode="edit" locale="en" responsiveMode="desktop" onSelect={onSelect} onMutation={onMutation} />));
    const frame = host.querySelector<HTMLElement>('[data-rcms-node="button"]')!;
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 120, height: 40, right: 220, bottom: 140 } as DOMRect);
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200, width: 500, height: 300, right: 600, bottom: 500 } as DOMRect);
    const label = frame.querySelector('[data-rcms-inline]')!;
    expect(label).not.toBeNull();
    expect(frame.style.width).toBe('fit-content');
    pointer(label, 'pointerdown', 120, 120);
    pointer(window, 'pointermove', 300, 520);
    expect(frame.style.display).toBe('none');
    expect(onSelect).toHaveBeenCalledWith('button', false);
    pointer(window, 'pointerup', 300, 520);
    expect(onMutation).toHaveBeenCalledTimes(1);
    expect(onMutation).toHaveBeenCalledWith({
      nodeId: 'button', path: [],
      value: expect.objectContaining({
        props: expect.objectContaining({ offsetX: 0, offsetY: 0 }),
        metadata: { runtimePlacement: { anchorRegionId: 'hero-image', position: 'after' } },
      }),
    });
    expect(frame.style.display).toBe('inline-block');
    act(() => root.unmount());
    expect(document.querySelector('[data-rcms-drag-ghost]')).toBeNull();
  });
});
