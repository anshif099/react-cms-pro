// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditableText } from './EditableText';
import { CMSContext } from '../context/CMSContext';

const { update, send } = vi.hoisted(() => ({ update: vi.fn(), send: vi.fn() }));
vi.mock('../hooks/useEditable', () => ({ useEditable: (_id: string, value: unknown) => [value, update] }));
vi.mock('../messaging/MessageBus', () => ({ MessageBus: { send } }));

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('footer text positioning', () => {
  it.each(['footer', 'div'])('keeps %s footer text fixed while allowing selection', (tag) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement(tag);
    if (tag === 'div') host.setAttribute('role', 'contentinfo');
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(
      <CMSContext.Provider value={{ websiteId: 'site', apiKey: '', environment: '', editMode: true, isConnected: true, setEditMode: vi.fn() }}>
        <EditableText regionId="address" defaultValue={{ text: 'Address', offsetX: 80, offsetY: 40 }} />
      </CMSContext.Provider>,
    ));
    const text = host.querySelector<HTMLElement>('[data-rcms-region="address"]')!;
    expect(text.style.transform).toBe('');
    act(() => text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })));
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 })));
    act(() => window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100 })));
    expect(text.style.transform).toBe('');
    expect(update).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('rcms/v1/region-selected', 'site', expect.objectContaining({ regionId: 'address' }));
    act(() => root.unmount());
  });

  it('still allows dragging text outside the footer', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('main');
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(
      <CMSContext.Provider value={{ websiteId: 'site', apiKey: '', environment: '', editMode: true, isConnected: true, setEditMode: vi.fn() }}>
        <EditableText regionId="heading" defaultValue="Heading" />
      </CMSContext.Provider>,
    ));
    const text = host.querySelector<HTMLElement>('[data-rcms-region]')!;
    act(() => text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })));
    act(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40 })));
    expect(text.style.transform).toBe('translate(20px, 30px)');
    act(() => window.dispatchEvent(new MouseEvent('mouseup', { clientX: 30, clientY: 40 })));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ offsetX: 20, offsetY: 30 }));
    act(() => root.unmount());
  });
});
