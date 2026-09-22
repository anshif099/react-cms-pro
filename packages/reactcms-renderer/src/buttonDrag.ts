export type ButtonDropTarget = {
  element: HTMLElement;
  nodeId: string;
  regionId: string;
  position: 'before' | 'after';
  horizontalPosition?: number;
};

/** Fraction of the available horizontal travel, independent of viewport size. */
export function buttonHorizontalPosition(pointerX: number, grabX: number, buttonWidth: number, left: number, width: number): number {
  const travel = width - buttonWidth;
  return travel > 0 ? Math.max(0, Math.min(1, (pointerX - grabX - left) / travel)) : 0;
}

function contentBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  const scale = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  const leftInset = ((parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0)) * scale;
  const rightInset = ((parseFloat(style.borderRightWidth) || 0) + (parseFloat(style.paddingRight) || 0)) * scale;
  return { left: rect.left + leftInset, width: Math.max(0, rect.width - leftInset - rightInset), scale };
}

/** Use nearby edges, not the enclosing section: blank space below an image
 * belongs to the image's after-edge even when the section contains the point. */
export function findButtonDropTarget(frame: HTMLElement, x: number, y: number): ButtonDropTarget | null {
  const doc = frame.ownerDocument;
  const win = doc.defaultView!;
  if (x < 0 || y < 0 || x > win.innerWidth || y > win.innerHeight) return null;
  let best: ButtonDropTarget | null = null;
  let distance = Infinity;
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[data-rcms-node], [data-rcms-region]'))) {
    if (element === frame || frame.contains(element) || element.contains(frame)
      || element.closest('[data-rcms-drag-ghost]')) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > win.innerHeight) continue;
    const horizontal = Math.max(rect.left - x, 0, x - rect.right);
    const inline = element.dataset.rcmsType === 'button' && y >= rect.top && y <= rect.bottom;
    for (const position of ['before', 'after'] as const) {
      const score = inline
        ? Math.abs(x - (position === 'before' ? rect.left : rect.right))
        : Math.hypot(horizontal, y - (position === 'before' ? rect.top : rect.bottom));
      if (score < distance) {
        distance = score;
        best = { element, nodeId: element.dataset.rcmsNode || '', regionId: element.dataset.rcmsRegion || '', position };
      }
    }
  }
  return best;
}

/** A viewport ghost leaves the real layout, allowing the old gap to close.
 * The placeholder owns the destination until the pointer leaves it. */
export function startButtonDrag(
  frame: HTMLElement,
  start: { clientX: number; clientY: number; pointerId: number },
  onDrop: (target: ButtonDropTarget) => void,
): () => void {
  const doc = frame.ownerDocument;
  const win = doc.defaultView!;
  const rect = frame.getBoundingClientRect();
  const originalDisplay = frame.style.display;
  const originalPriority = frame.style.getPropertyPriority('display');
  let x = start.clientX;
  let y = start.clientY;
  let active = false;
  let ended = false;
  let ghost: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let destination: ButtonDropTarget | null = null;
  let animation = 0;
  let lastTick = 0;
  let scrollHost = frame.parentElement;
  while (scrollHost) {
    if (/(auto|scroll)/.test(win.getComputedStyle(scrollHost).overflowY)
      && scrollHost.scrollHeight > scrollHost.clientHeight) break;
    scrollHost = scrollHost.parentElement;
  }
  const update = () => {
    if (!active || ended) return;
    Object.assign(ghost!.style, { left: `${x - (start.clientX - rect.left)}px`, top: `${y - (start.clientY - rect.top)}px` });
    const slot = placeholder?.getBoundingClientRect();
    const next = slot && x >= slot.left && x <= slot.right && y >= slot.top && y <= slot.bottom
      ? destination : findButtonDropTarget(frame, x, y);
    const sameTarget = next?.element === destination?.element && next?.position === destination?.position;
    if (!sameTarget) placeholder?.remove();
    destination = next;
    if (!next?.element.parentElement) return;
    const parent = next.element.parentElement;
    const bounds = contentBounds(parent);
    const horizontalPosition = buttonHorizontalPosition(x, start.clientX - rect.left, rect.width, bounds.left, bounds.width);
    next.horizontalPosition = horizontalPosition;
    placeholder ||= doc.createElement('div');
    placeholder.dataset.rcmsButtonDropPlaceholder = 'true';
    Object.assign(placeholder.style, {
      boxSizing: 'border-box', width: `${rect.width / (bounds.scale || 1)}px`, height: `${rect.height / (bounds.scale || 1)}px`,
      display: 'block', position: 'relative', margin: '0', maxWidth: '100%',
      left: `${horizontalPosition * 100}%`, translate: `${-horizontalPosition * 100}% 0`,
      border: '2px dashed #2563eb', borderRadius: '8px', background: 'rgba(37,99,235,.1)', pointerEvents: 'none',
    });
    if (!sameTarget || !placeholder.isConnected) {
      parent.insertBefore(placeholder, next.position === 'before' ? next.element : next.element.nextSibling);
    }
  };
  const tick = (time: number) => {
    if (ended || !active) return;
    const bounds = scrollHost?.getBoundingClientRect();
    const top = Math.max(0, bounds?.top || 0);
    const bottom = Math.min(win.innerHeight, bounds?.bottom ?? win.innerHeight);
    const speed = y < top + 64 ? -Math.min(1, (top + 64 - y) / 64)
      : y > bottom - 64 ? Math.min(1, (y - bottom + 64) / 64) : 0;
    const delta = speed * Math.min(time - (lastTick || time), 32) * .7;
    lastTick = time;
    if (delta) {
      if (scrollHost) scrollHost.scrollTop += delta;
      else win.scrollBy(0, delta);
      update();
    }
    animation = win.requestAnimationFrame(tick);
  };
  const activate = () => {
    if (active) return;
    active = true;
    ghost = frame.cloneNode(true) as HTMLElement;
    ghost.dataset.rcmsDragGhost = 'true';
    ghost.setAttribute('aria-hidden', 'true');
    // Copy computed styles so moving outside a scaled/theme ancestor is safe.
    const originals = [frame, ...Array.from(frame.querySelectorAll<HTMLElement>('*'))];
    const clones = [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))];
    originals.forEach((element, index) => {
      const computed = win.getComputedStyle(element);
      for (const property of Array.from(computed)) clones[index].style.setProperty(property, computed.getPropertyValue(property));
      clones[index].removeAttribute('id');
      clones[index].removeAttribute('data-rcms-node');
      clones[index].removeAttribute('data-rcms-region');
      clones[index].style.setProperty('pointer-events', 'none', 'important');
    });
    Object.assign(ghost.style, {
      position: 'fixed', width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
      transform: 'none', translate: 'none', animation: 'none', transition: 'none', zIndex: '2147483646', opacity: '.85',
    });
    doc.body.appendChild(ghost);
    frame.style.setProperty('display', 'none', 'important');
    update();
    animation = win.requestAnimationFrame(tick);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    x = event.clientX;
    y = event.clientY;
    if (Math.hypot(x - start.clientX, y - start.clientY) >= 4) activate();
    update();
  };
  const scroll = () => { activate(); update(); };
  const cleanup = () => {
    if (ended) return;
    ended = true;
    win.cancelAnimationFrame(animation);
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', finish, true);
    win.removeEventListener('pointercancel', cancel, true);
    win.removeEventListener('scroll', scroll, true);
    win.removeEventListener('blur', cleanup);
    win.removeEventListener('keydown', keydown, true);
    ghost?.remove();
    placeholder?.remove();
    if (originalDisplay) frame.style.setProperty('display', originalDisplay, originalPriority);
    else frame.style.removeProperty('display');
  };
  const finish = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    // Normally pointermove has already chosen the slot. Never hit-test through
    // the slot on release: that used to select a different enclosing region.
    if (event.clientX !== x || event.clientY !== y) {
      x = event.clientX; y = event.clientY; update();
    }
    const target = destination;
    cleanup();
    if (active && target?.element.isConnected) onDrop(target);
  };
  const cancel = (event: PointerEvent) => { if (event.pointerId === start.pointerId) cleanup(); };
  const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') cleanup(); };
  win.addEventListener('pointermove', move, true);
  win.addEventListener('pointerup', finish, true);
  win.addEventListener('pointercancel', cancel, true);
  win.addEventListener('scroll', scroll, true);
  win.addEventListener('blur', cleanup);
  win.addEventListener('keydown', keydown, true);
  return cleanup;
}
