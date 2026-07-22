import { useState, useEffect, useContext } from 'react';
import { EditableType } from '@anshif.rainhopes/shared';
import { EditableRegistryContext } from '../context/EditableRegistryContext';
import { PageContext } from '../context/PageContext';
import { CMSContext } from '../context/CMSContext';
import { MessageBus } from '../messaging/MessageBus';

import { editableSync } from '../firebase/editableSync';

function resolvePageId(pageContext: any): string {
  if (pageContext?.currentPage) {
    if (pageContext.currentPage.id) return pageContext.currentPage.id;
    if (pageContext.currentPage.slug) return pageContext.currentPage.slug;
    if (pageContext.currentPage.route) {
      const clean = pageContext.currentPage.route.replace(/^\/+|\/+$/g, '');
      return clean || 'home';
    }
  }

  // Fallback to active browser URL pathname if available (e.g. /about -> about, / -> home)
  if (typeof window !== 'undefined' && window.location && window.location.pathname) {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (rawPath) return rawPath;
    return 'home';
  }

  return 'global';
}

export function useEditable<T>(
  regionId: string,
  defaultValue: T,
  type: EditableType,
  label: string
): [T, (value: T) => void] {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);
  const registry = useContext(EditableRegistryContext);

  const pageId = resolvePageId(page);

  const [value, setLocalValue] = useState<T>(defaultValue);

  // Register region with Runtime Context on mount
  useEffect(() => {
    if (pageId === 'global') {
      console.warn(`[ReactCMS SDK] Warning: Region "${regionId}" registered under fallback "global" because no page context was resolved.`);
    }

    if (registry) {
      registry.registerRegion(pageId, regionId, type, label, defaultValue);
    }
    return () => {
      if (registry) {
        registry.unregisterRegion(pageId, regionId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, pageId, regionId, type, label]);

  // Subscribe to live preview updates for this region
  useEffect(() => {
    if (!cms?.websiteId) return;

    const unsubscribe = MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/field-update') {
        const payload = msg.payload as { regionId: string; value: unknown };
        if (payload.regionId === regionId) {
          setLocalValue(payload.value as T);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [cms?.websiteId, regionId]);

  const setValue = (newValue: T) => {
    setLocalValue(newValue);

    if (cms?.websiteId) {
      // Broadcast update to parent dashboard
      MessageBus.send('rcms/v1/field-update', cms.websiteId, {
        regionId,
        value: newValue,
      });

      // Write to contentDraft path directly in Firebase
      if (cms.apiKey) {
        editableSync.saveDraftRegion(cms.apiKey, cms.websiteId, pageId, regionId, newValue);
      }
    }
  };

  return [value, setValue];
}
