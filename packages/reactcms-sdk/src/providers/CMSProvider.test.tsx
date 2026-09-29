// @vitest-environment jsdom
import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CMSProvider } from './CMSProvider';
import { CMSContext } from '../context/CMSContext';
import { MessageBus } from '../messaging/MessageBus';

vi.mock('../components/InsertContentOverlay', () => ({ InsertContentOverlay: () => null }));
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it.each([
  ['/', false], ['/?rcms_preview=1', false],
  ['/?rcms_edit=0', false], ['/?rcms_edit=1', true],
  ['/?rcms_edit=1&rcms_preview=1', false],
])('restricts editing and edit-mode messages on %s', (url, allowed) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState(null, '', url);
  let context: React.ContextType<typeof CMSContext> = null;
  function Probe() { context = useContext(CMSContext); return <span>{String(context?.editMode)}</span>; }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<CMSProvider websiteId="site" apiKey=""><Probe /></CMSProvider>));
  expect(host.textContent).toBe(String(allowed));
  act(() => MessageBus.dispatchLocal({ rcms: true, version: 'v1', websiteId: 'site', type: 'rcms/v1/enter-edit-mode', payload: {}, timestamp: Date.now() }));
  expect(host.textContent).toBe(String(allowed));
  act(() => context!.setEditMode(true));
  expect(host.textContent).toBe(String(allowed));
  act(() => root.unmount());
});
