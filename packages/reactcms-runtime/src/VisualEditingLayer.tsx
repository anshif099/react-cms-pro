import { useContext, useEffect } from 'react';
import {
  CMSContext,
  MessageBus,
  PageContext,
  editableSync,
} from '@anshif.rainhopes/reactcms-sdk';

function resolvePageId(currentPage: any): string {
  if (currentPage?.id) return currentPage.id;
  if (currentPage?.slug) return currentPage.slug;
  try {
    const params = new URLSearchParams(window.location.search);
    const queryPage = params.get('page');
    if (queryPage) return queryPage;
  } catch {
    // Continue with pathname resolution.
  }
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return pathname || 'home';
}

function humanize(value: string): string {
  return value
    .split(/[._:/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getElementValue(element: HTMLElement, pageId: string, regionId: string, type: string) {
  const stored = MessageBus.getStoredRegionValue(pageId, regionId);
  if (stored !== undefined) return stored;
  if (type === 'image' && element instanceof HTMLImageElement) {
    return { src: element.src, alt: element.alt };
  }
  if (type === 'button') {
    return {
      text: element.textContent || '',
      href: element.getAttribute('href') || '',
    };
  }
  return element.textContent || '';
}

function getStyleSnapshot(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    width: style.width,
    height: style.height,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    borderRadius: style.borderRadius,
  };
}

export interface VisualEditingLayerProps {
  websiteId: string;
  apiKey: string;
}

export function VisualEditingLayer({ websiteId, apiKey }: VisualEditingLayerProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  useEffect(() => {
    if (!cms?.editMode || typeof document === 'undefined') return undefined;

    const pageId = resolvePageId(page?.currentPage);
    const overlay = document.createElement('div');
    const label = document.createElement('div');
    const styleTag = document.createElement('style');
    let activeElement: HTMLElement | null = null;
    let selectedElement: HTMLElement | null = null;
    let editingElement: HTMLElement | null = null;
    let originalText = '';

    styleTag.setAttribute('data-rcms-visual-layer', 'true');
    styleTag.textContent = `
      .rcms-editable-region {
        outline: 2px solid transparent !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
      }
      [data-rcms-builder-block] {
        position: relative;
      }
      [data-rcms-inline-editing="true"] {
        outline: 2px solid #2563eb !important;
        cursor: text !important;
        user-select: text !important;
      }
      .rcms-editable-text > [title="Drag handle to resize text area width"] {
        display: none !important;
      }
    `;
    document.head.appendChild(styleTag);

    Object.assign(overlay.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '2147483645',
      border: '2px solid #2563eb',
      borderRadius: '3px',
      boxSizing: 'border-box',
      boxShadow: '0 0 0 1px rgba(255,255,255,.7)',
      transition: 'left 70ms ease, top 70ms ease, width 70ms ease, height 70ms ease',
    });
    Object.assign(label.style, {
      position: 'absolute',
      left: '-2px',
      top: '-24px',
      height: '22px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      background: '#2563eb',
      color: '#fff',
      borderRadius: '4px 4px 4px 0',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '10px',
      lineHeight: '1',
      fontWeight: '700',
      letterSpacing: '.01em',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 12px rgba(15,23,42,.28)',
    });
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    const positionOverlay = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      overlay.style.display = rect.width > 0 && rect.height > 0 ? 'block' : 'none';
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      const regionId = element.dataset.rcmsRegion || '';
      label.textContent = element.dataset.rcmsLabel || humanize(regionId);
      activeElement = element;
    };

    const unsubscribeMessages = MessageBus.subscribe((message) => {
      if (message.type !== 'rcms/v1/select-region') return;
      const payload = message.payload as { regionId?: string };
      if (!payload.regionId) return;
      const element = Array.from(document.querySelectorAll<HTMLElement>('[data-rcms-region]'))
        .find((candidate) => candidate.dataset.rcmsRegion === payload.regionId);
      if (!element) return;
      selectedElement = element;
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      window.setTimeout(() => positionOverlay(element), 220);
    });

    const closestRegion = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>('[data-rcms-region]');
    };

    const handleMouseOver = (event: MouseEvent) => {
      const element = closestRegion(event.target);
      if (element) positionOverlay(element);
    };

    const handleMouseOut = (event: MouseEvent) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && activeElement?.contains(nextTarget)) return;
      if (editingElement) return;
      if (selectedElement) {
        positionOverlay(selectedElement);
        return;
      }
      overlay.style.display = 'none';
      activeElement = null;
    };

    const handleScroll = () => {
      if (activeElement) positionOverlay(activeElement);
    };

    const sendSelection = (element: HTMLElement) => {
      const regionId = element.dataset.rcmsRegion || '';
      const type = element.dataset.rcmsType || 'text';
      const rect = element.getBoundingClientRect();
      const blockId = element.dataset.rcmsBuilderBlock;

      MessageBus.send('rcms/v1/region-selected', websiteId, {
        regionId,
        type,
        pageId,
        blockId,
        label: element.dataset.rcmsLabel || humanize(regionId),
        value: getElementValue(element, pageId, regionId, type),
        computedStyle: getStyleSnapshot(element),
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      const element = closestRegion(event.target);
      if (!element) return;
      // Prevent legacy editable primitives from turning a normal selection into
      // a drag operation. Reordering belongs to the builder section handles.
      event.stopPropagation();
    };

    const handleClick = (event: MouseEvent) => {
      const element = closestRegion(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      selectedElement = element;
      positionOverlay(element);
      sendSelection(element);
    };

    const finishInlineEdit = async (commit: boolean) => {
      if (!editingElement) return;
      const element = editingElement;
      const regionId = element.dataset.rcmsRegion || '';
      const currentValue = MessageBus.getStoredRegionValue(pageId, regionId);
      const nextText = commit ? (element.innerText || '').trim() : originalText;
      const nextValue = currentValue && typeof currentValue === 'object'
        ? { ...(currentValue as Record<string, unknown>), text: nextText }
        : nextText;

      element.contentEditable = 'false';
      element.removeAttribute('data-rcms-inline-editing');
      editingElement = null;
      originalText = '';

      if (!commit) {
        element.innerText = nextText;
        return;
      }

      MessageBus.setStoredRegionValue(pageId, regionId, nextValue);
      MessageBus.send('rcms/v1/field-update', websiteId, {
        pageId,
        regionId,
        value: nextValue,
      });
      if (apiKey) {
        await editableSync.saveDraftRegion(apiKey, websiteId, pageId, regionId, nextValue);
      }
      positionOverlay(element);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const element = closestRegion(event.target);
      if (!element) return;
      const type = element.dataset.rcmsType || 'text';
      if (!['text', 'textarea', 'richtext'].includes(type)) return;

      event.preventDefault();
      event.stopPropagation();
      editingElement = element;
      originalText = element.innerText || '';
      element.contentEditable = 'true';
      element.setAttribute('data-rcms-inline-editing', 'true');
      element.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (editingElement && event.target === editingElement) {
        finishInlineEdit(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editingElement) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finishInlineEdit(false);
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        finishInlineEdit(true);
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('dblclick', handleDoubleClick, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('dblclick', handleDoubleClick, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      unsubscribeMessages();
      overlay.remove();
      styleTag.remove();
    };
  }, [apiKey, cms?.editMode, page?.currentPage, websiteId]);

  return null;
}

export default VisualEditingLayer;
