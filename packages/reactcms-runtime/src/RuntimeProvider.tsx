import React, { useEffect, useState } from 'react';
import {
  CMSProvider,
  EditableRegistryContext,
  MessageBus,
  editableSync,
} from '@anshif.rainhopes/reactcms-sdk';
import {
  EditableRegion,
  EditableType,
  LayoutDefinition,
  NavMenu,
  ThemeTokens,
} from '@anshif.rainhopes/shared';
import { RuntimeContext } from './RuntimeContext';
import { BuilderSections } from './BuilderSections';
import type { PageComponentTree } from '@anshif.rainhopes/reactcms-renderer';
import { HeartbeatService } from './heartbeat/heartbeatService';
import { registerEditableRegions } from './registration/registerEditableRegions';
import { registerLayouts as dbRegisterLayouts } from './registration/registerLayouts';
import { registerNavigation as dbRegisterNavigation } from './registration/registerNavigation';
import { registerPageTrees } from './registration/registerPageTrees';
import { registerRoutes } from './registration/registerRoutes';
import { registerTheme } from './registration/registerTheme';
import { registerWebsite } from './registration/registerWebsite';
import { reportVersions } from './version/versionReporter';

export interface RuntimeProviderProps {
  websiteId: string;
  apiKey: string;
  routes: any[];
  theme?: ThemeTokens | null;
  pageTrees?: Record<string, PageComponentTree>;
  children: React.ReactNode;
}

function resolveCurrentPageId(): string {
  if (typeof window === 'undefined') return 'global';

  const pageOverride = new URLSearchParams(window.location.search).get('page');
  if (pageOverride) return pageOverride;

  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return pathname || 'home';
}

function dispatchRegionValue(
  websiteId: string,
  pageId: string,
  regionId: string,
  value: unknown,
) {
  MessageBus.setStoredRegionValue(pageId, regionId, value);
  MessageBus.dispatchLocal({
    rcms: true,
    version: 'v1',
    type: 'rcms/v1/field-update',
    websiteId,
    payload: { pageId, regionId, value },
    timestamp: Date.now(),
  });
}

/**
 * Registers the connected application and renders a published ReactCMS page
 * through the native runtime renderer. The application children remain the
 * fallback for routes that do not yet have a published component tree.
 */
export function RuntimeProvider({
  websiteId,
  apiKey,
  routes,
  theme = null,
  pageTrees,
  children,
}: RuntimeProviderProps) {
  const [layouts, setLayouts] = useState<Record<string, LayoutDefinition>>({});
  const [navigations, setNavigations] = useState<Record<string, NavMenu>>({});
  const [regions, setRegions] = useState<Record<string, Record<string, EditableRegion>>>({});

  const registerLayout = (layout: LayoutDefinition) => {
    setLayouts((current) => ({ ...current, [layout.id]: layout }));
  };

  const unregisterLayout = (id: string) => {
    setLayouts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const registerNavigation = (navigation: NavMenu) => {
    setNavigations((current) => ({ ...current, [navigation.id]: navigation }));
  };

  const unregisterNavigation = (id: string) => {
    setNavigations((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const registerRegion = (
    pageId: string,
    regionId: string,
    type: EditableType,
    label: string,
    defaultValue?: unknown,
  ) => {
    setRegions((current) => {
      const pageRegions = current[pageId] || {};
      const existing = pageRegions[regionId];
      if (
        existing?.type === type
        && existing.label === label
        && JSON.stringify(existing.defaultValue) === JSON.stringify(defaultValue)
      ) {
        return current;
      }

      return {
        ...current,
        [pageId]: {
          ...pageRegions,
          [regionId]: {
            id: regionId,
            type,
            label,
            editable: true,
            ...(defaultValue !== undefined ? { defaultValue } : {}),
            registeredAt: existing?.registeredAt || Date.now(),
          },
        },
      };
    });
  };

  const unregisterRegion = (pageId: string, regionId: string) => {
    setRegions((current) => {
      const pageRegions = { ...(current[pageId] || {}) };
      delete pageRegions[regionId];
      return { ...current, [pageId]: pageRegions };
    });
  };

  useEffect(() => {
    const pageId = resolveCurrentPageId();

    const start = async () => {
      await registerWebsite(websiteId, apiKey);
      await reportVersions(websiteId, apiKey);
      await registerRoutes(websiteId, apiKey, routes);
      if (theme) await registerTheme(websiteId, apiKey, theme);
      HeartbeatService.start(websiteId, apiKey);

      try {
        const published = await editableSync.getPublishedRegions(apiKey, websiteId, pageId);
        Object.entries(published).forEach(([regionId, value]) => {
          dispatchRegionValue(websiteId, pageId, regionId, value);
        });
      } catch (error) {
        console.warn('[ReactCMS Runtime] Failed to hydrate published regions:', error);
      }
    };

    void start();

    const unsubscribe = editableSync.subscribeToPublishedRegions(
      apiKey,
      websiteId,
      pageId,
      (published) => {
        Object.entries(published).forEach(([regionId, value]) => {
          dispatchRegionValue(websiteId, pageId, regionId, value);
        });
      },
    );

    return () => {
      HeartbeatService.stop();
      unsubscribe();
    };
  }, [websiteId, apiKey, routes, theme]);

  useEffect(() => {
    if (Object.keys(layouts).length > 0) {
      void dbRegisterLayouts(websiteId, apiKey, layouts);
    }
  }, [layouts, websiteId, apiKey]);

  useEffect(() => {
    if (Object.keys(navigations).length > 0) {
      void dbRegisterNavigation(websiteId, apiKey, navigations);
    }
  }, [navigations, websiteId, apiKey]);

  useEffect(() => {
    if (pageTrees && Object.keys(pageTrees).length > 0) {
      void registerPageTrees(websiteId, apiKey, pageTrees);
    }
  }, [apiKey, pageTrees, websiteId]);

  useEffect(() => {
    Object.entries(regions).forEach(([pageId, pageRegions]) => {
      void registerEditableRegions(websiteId, apiKey, pageId, pageRegions);
    });
  }, [regions, websiteId, apiKey]);

  return (
    <RuntimeContext.Provider
      value={{
        layouts,
        navigations,
        registerLayout,
        unregisterLayout,
        registerNavigation,
        unregisterNavigation,
      }}
    >
      <EditableRegistryContext.Provider value={{ registerRegion, unregisterRegion }}>
        <CMSProvider websiteId={websiteId} apiKey={apiKey} environment="production">
          <BuilderSections websiteId={websiteId} apiKey={apiKey} fallback={children} />
        </CMSProvider>
      </EditableRegistryContext.Provider>
    </RuntimeContext.Provider>
  );
}
