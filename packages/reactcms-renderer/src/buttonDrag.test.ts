// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findButtonDropTarget, startButtonDrag } from './buttonDrag';

function bounds(element: Element, left: number, top: number, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {},
  });
}
function pointer(type: string, x: number, y: number, pointerId = 1) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  window.dispatchEvent(event);
}
let cancel: (() => void) | undefined;
beforeEach(() => {
  document.body.innerHTML = '<section data-rcms-region="hero"><div data-rcms-node="button" data-rcms-type="button" style="display:inline-block">Move me</div><div data-rcms-region="image">Image</div></section><section data-rcms-region="next">Next section</section>';
  bounds(document.querySelector('section')!, 0, 0, 800, 650);
  bounds(document.querySelector('[data-rcms-node]')!, 100, 100, 100, 40);
  bounds(document.querySelector('[data-rcms-region="image"]')!, 100, 200, 500, 400);
  bounds(document.querySelector('[data-rcms-region="next"]')!, 0, 700, 800, 400);
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
});
afterEach(() => { cancel?.(); cancel = undefined; vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('button pointer drag', () => {
  it('targets the image after-edge in blank space instead of its full section', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    expect(findButtonDropTarget(frame, 300, 615)).toMatchObject({ regionId: 'image', position: 'after' });
  });
  it('closes the old gap, opens a destination slot, and commits that slot on release', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    const drop = vi.fn();
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, drop);
    pointer('pointermove', 300, 615);
    expect(frame.style.display).toBe('none');
    const slot = document.querySelector<HTMLElement>('[data-rcms-button-drop-placeholder]')!;
    expect(slot.previousElementSibling?.getAttribute('data-rcms-region')).toBe('image');
    bounds(slot, 100, 600, 500, 40);
    pointer('pointermove', 310, 620);
    pointer('pointerup', 310, 620);
    expect(drop).toHaveBeenCalledTimes(1);
    expect(drop).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'image', position: 'after' }));
    expect(frame.style.display).toBe('inline-block');
    expect(document.querySelector('[data-rcms-drag-ghost]')).toBeNull();
    expect(document.querySelector('[data-rcms-button-drop-placeholder]')).toBeNull();
  });
  it('updates the drop target after wheel scrolling without further pointer movement', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    const drop = vi.fn();
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, drop);
    pointer('pointermove', 300, 400);
    bounds(document.querySelector('[data-rcms-region="image"]')!, 100, -100, 500, 450);
    bounds(document.querySelector('[data-rcms-region="next"]')!, 0, 600, 800, 400);
    window.dispatchEvent(new Event('scroll'));
    pointer('pointerup', 300, 400);
    expect(drop).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'image', position: 'after' }));
  });
  it('allows changing sides of the original anchor', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    expect(findButtonDropTarget(frame, 300, 190)).toMatchObject({ regionId: 'image', position: 'before' });
    expect(findButtonDropTarget(frame, 300, 605)).toMatchObject({ regionId: 'image', position: 'after' });
  });
  it('ignores other pointers and restores layout on Escape without committing', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    const drop = vi.fn();
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, drop);
    pointer('pointermove', 300, 615, 2);
    expect(frame.style.display).toBe('inline-block');
    pointer('pointermove', 300, 615);
    pointer('pointerup', 300, 615, 2);
    expect(drop).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(frame.style.display).toBe('inline-block');
    pointer('pointerup', 300, 615);
    expect(drop).not.toHaveBeenCalled();
  });
  it('does not commit a click or an out-of-viewport release', () => {
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    const drop = vi.fn();
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, drop);
    pointer('pointerup', 120, 120);
    expect(drop).not.toHaveBeenCalled();
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, drop);
    pointer('pointermove', 300, 615);
    pointer('pointerup', -50, -50);
    expect(drop).not.toHaveBeenCalled();
  });
  it('auto-scrolls continuously while held near the edge and stops on cancellation', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callbacks.push(callback); return callbacks.length; });
    const frame = document.querySelector<HTMLElement>('[data-rcms-node]')!;
    cancel = startButtonDrag(frame, { clientX: 120, clientY: 120, pointerId: 1 }, vi.fn());
    pointer('pointermove', 300, window.innerHeight - 5);
    callbacks.shift()!(16);
    callbacks.shift()!(32);
    callbacks.shift()!(48);
    expect(window.scrollBy).toHaveBeenCalledTimes(2);
    cancel();
    callbacks.shift()!(64);
    expect(window.scrollBy).toHaveBeenCalledTimes(2);
  });
});
