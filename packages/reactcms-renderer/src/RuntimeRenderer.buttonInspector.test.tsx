// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeRenderer } from './RuntimeRenderer';
import type { PageComponentTree } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('button inspector values on the connected canvas', () => {
  it('renders edited button properties and updates them when the tree changes', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const button = {
      id: 'action', type: 'button', label: 'Contact action',
      props: {
        locales: { en: { label: 'Contact us' } },
        url: 'hello@example.com', linkType: 'email', variant: 'outline',
        size: 'lg', color: '#e11d48', width: '180', height: '48',
        offsetX: 12, offsetY: 7, radius: 16, icon: 'arrow-right',
        iconSize: 42, iconPosition: 'right', alignment: 'right', shadow: 'large',
      },
    };
    const tree = { id: 'page', type: 'page', version: 2, children: [button] } as PageComponentTree;
    act(() => root.render(<RuntimeRenderer tree={tree} locale="en" mode="runtime" />));

    const frame = host.querySelector<HTMLElement>('[data-rcms-node="action"]')!;
    const link = frame.querySelector<HTMLAnchorElement>('a')!;
    const icon = link.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    expect(frame.style.marginLeft).toBe('auto');
    expect(frame.style.marginTop).toBe('7px');
    expect(link.href).toBe('mailto:hello@example.com');
    expect(link.textContent).toContain('Contact us');
    expect(link.style.width).toBe('180px');
    expect(link.style.height).toBe('48px');
    expect(link.style.borderRadius).toBe('16px');
    expect(link.style.color).toBe('rgb(225, 29, 72)');
    expect(link.style.boxShadow).not.toBe('');
    expect(icon.style.width).toBe('42px');
    expect(link.lastElementChild).toBe(icon);

    const changed = { ...button, props: { ...button.props, iconSize: 190, height: '12px', iconPosition: 'left', alignment: 'left', shadow: 'none' } };
    act(() => root.render(<RuntimeRenderer tree={{ ...tree, children: [changed] } as PageComponentTree} locale="en" mode="runtime" />));
    const updatedFrame = host.querySelector<HTMLElement>('[data-rcms-node="action"]')!;
    const updatedLink = updatedFrame.querySelector<HTMLAnchorElement>('a')!;
    expect(updatedFrame.style.marginRight).toBe('auto');
    expect(updatedLink.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(updatedLink.querySelector<HTMLElement>('[aria-hidden="true"]')?.style.width).toBe('190px');
    expect(updatedLink.style.height).toBe('12px');
    expect(updatedLink.style.minHeight).toBe('');
    expect(updatedLink.style.boxShadow).toBe('none');
    const iconOnly = { ...changed, props: { ...changed.props, iconOnly: true } };
    act(() => root.render(<RuntimeRenderer tree={{ ...tree, children: [iconOnly] } as PageComponentTree} locale="en" mode="runtime" />));
    const iconLink = host.querySelector<HTMLAnchorElement>('[data-rcms-node="action"] a')!;
    expect(iconLink.querySelector('[data-rcms-field="label"]')).toBeNull();
    expect(iconLink.style.background).toBe('transparent');
    expect(iconLink.style.height).toBe('auto');
    expect(iconLink.style.padding).toBe('0px');
    expect(iconLink.getAttribute('aria-label')).toBe('Contact us');
    act(() => root.unmount());
  });
});
