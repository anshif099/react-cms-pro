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

  // Fallback to active browser URL query parameter (?page=home) or pathname (/about -> about, / -> home)
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryPage = params.get('page');
        if (queryPage) return queryPage;
      } catch {
        // Fallthrough
      }
    }
    if (window.location.pathname) {
      const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (rawPath) return rawPath;
      return 'home';
    }
  }

  return 'global';
}

function getGitContentValue(pageId: string, regionId: string): unknown | undefined {
  if (typeof window === 'undefined') return undefined;
  const manifest = (window as typeof window & {
    __REACTCMS_GIT_CONTENT__?: Record<string, Record<string, unknown>>;
  }).__REACTCMS_GIT_CONTENT__;
  const pageContent = manifest?.[pageId];
  if (!pageContent || !Object.prototype.hasOwnProperty.call(pageContent, regionId)) {
    return undefined;
  }
  return pageContent[regionId];
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

  // Git is the durable live source. The message store remains the edit-mode draft transport.
  const gitInitial = getGitContentValue(pageId, regionId) as T | undefined;
  const storedInitial = MessageBus.getStoredRegionValue(pageId, regionId) as T;
  const [value, setLocalValue] = useState<T>(
    gitInitial !== undefined
      ? gitInitial
      : storedInitial !== undefined
        ? storedInitial
        : defaultValue
  );
  const prefersGit = gitInitial !== undefined && !cms?.editMode;

  // Register region with Runtime Context on mount & check for stored value updates
  useEffect(() => {
    if (pageId === 'global') {
      console.warn(`[ReactCMS SDK] Warning: Region "${regionId}" registered under fallback "global" because no page context was resolved.`);
    }

    if (prefersGit) {
      setLocalValue((current) => Object.is(current, gitInitial) ? current : gitInitial);
    } else {
      const currentStored = MessageBus.getStoredRegionValue(pageId, regionId) as T;
      if (currentStored !== undefined) {
        setLocalValue((current) => Object.is(current, currentStored) ? current : currentStored);
      }
    }

    if (registry) {
      registry.registerRegion(
        pageId,
        regionId,
        type,
        label,
        gitInitial !== undefined ? gitInitial : defaultValue
      );
    }
    return () => {
      if (registry) {
        registry.unregisterRegion(pageId, regionId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, pageId, regionId, type, label, prefersGit, gitInitial]);

  // Subscribe to live preview and published region updates for this region
  useEffect(() => {
    const unsubscribe = MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/field-update') {
        const payload = msg.payload as { regionId: string; value: unknown };
        if (payload.regionId === regionId && !prefersGit) {
          setLocalValue(payload.value as T);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [regionId, prefersGit]);

  const setValue = (newValue: T) => {
    setLocalValue(newValue);
    MessageBus.setStoredRegionValue(pageId, regionId, newValue);

    if (cms?.websiteId) {
      // Broadcast update to parent dashboard & local listeners
      MessageBus.send('rcms/v1/field-update', cms.websiteId, {
        pageId,
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
