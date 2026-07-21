import React, { useState, useEffect } from 'react';
import { CMSProvider, EditableRegistryContext } from '@anshif.rainhopes/reactcms-sdk';
import { LayoutDefinition, NavMenu, EditableRegion, EditableType, ThemeTokens } from '@anshif.rainhopes/shared';
import { RuntimeContext } from './RuntimeContext';
import { registerWebsite } from './registration/registerWebsite';
import { registerRoutes } from './registration/registerRoutes';
import { registerLayouts as dbRegisterLayouts } from './registration/registerLayouts';
import { registerNavigation as dbRegisterNavigation } from './registration/registerNavigation';
import { registerTheme } from './registration/registerTheme';
import { registerEditableRegions } from './registration/registerEditableRegions';
import { HeartbeatService } from './heartbeat/heartbeatService';
import { reportVersions } from './version/versionReporter';
import { setupRuntimeMessageHandler } from './messaging/runtimeMessageHandler';

export interface RuntimeProviderProps {
  websiteId: string;
  apiKey: string;
  routes: any[];
  theme?: ThemeTokens | null;
  children: React.ReactNode;
}

export function RuntimeProvider({
  websiteId,
  apiKey,
  routes,
  theme = null,
  children,
}: RuntimeProviderProps) {
  const [layouts, setLayouts] = useState<Record<string, LayoutDefinition>>({});
  const [navigations, setNavigations] = useState<Record<string, NavMenu>>({});
  const [regions, setRegions] = useState<Record<string, Record<string, EditableRegion>>>({});

  // Layout Registry Handlers
  const registerLayout = (layout: LayoutDefinition) => {
    setLayouts((prev) => ({ ...prev, [layout.id]: layout }));
  };

  const unregisterLayout = (id: string) => {
    setLayouts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Navigation Registry Handlers
  const registerNavigation = (nav: NavMenu) => {
    setNavigations((prev) => ({ ...prev, [nav.id]: nav }));
  };

  const unregisterNavigation = (id: string) => {
    setNavigations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // SDK Editable Region Registry Handlers
  const registerRegion = (
    pageId: string,
    regionId: string,
    type: EditableType,
    label: string,
    defaultValue?: unknown
  ) => {
    setRegions((prev) => {
      const pageRegions = prev[pageId] || {};
      const existing = pageRegions[regionId];

      // Fast check: If region already exists with identical props, preserve state reference to prevent infinite render loop
      if (
        existing &&
        existing.type === type &&
        existing.label === label &&
        JSON.stringify(existing.defaultValue) === JSON.stringify(defaultValue)
      ) {
        return prev;
      }

      return {
        ...prev,
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
    setRegions((prev) => {
      const pageRegions = prev[pageId] ? { ...prev[pageId] } : {};
      delete pageRegions[regionId];
      return {
        ...prev,
        [pageId]: pageRegions,
      };
    });
  };

  // Startup Sequence
  useEffect(() => {
    const runStartup = async () => {
      // 1. Register Website online status
      await registerWebsite(websiteId, apiKey);
      // 2. Report Package Versions
      await reportVersions(websiteId, apiKey);
      // 3. Register Discovered Router Routes
      await registerRoutes(websiteId, apiKey, routes);
      // 4. Register initial Theme if provided
      if (theme) {
        await registerTheme(websiteId, apiKey, theme);
      }
      // 5. Start Heartbeat Ping (every 30s)
      HeartbeatService.start(websiteId, apiKey);
    };

    runStartup();

    // Subscribe to namespaced versioned messages
    const unsubscribeMessages = setupRuntimeMessageHandler(websiteId, {
      onThemeUpdate: (updatedTheme) => {
        // Handle theme update pushed from dashboard
        registerTheme(websiteId, apiKey, updatedTheme);
      },
      onNavigationUpdate: (updatedNavs) => {
        // Handle navigation update pushed from dashboard
        const navMap: Record<string, NavMenu> = {};
        updatedNavs.forEach((n) => { navMap[n.id] = n; });
        dbRegisterNavigation(websiteId, apiKey, navMap);
      }
    });

    return () => {
      HeartbeatService.stop();
      unsubscribeMessages();
    };
  }, [websiteId, apiKey, routes]);

  // Sync Layouts when they change
  useEffect(() => {
    if (Object.keys(layouts).length > 0) {
      dbRegisterLayouts(websiteId, apiKey, layouts);
    }
  }, [layouts, websiteId, apiKey]);

  // Sync Navigation when it changes
  useEffect(() => {
    if (Object.keys(navigations).length > 0) {
      dbRegisterNavigation(websiteId, apiKey, navigations);
    }
  }, [navigations, websiteId, apiKey]);

  // Sync Editable Regions per page
  useEffect(() => {
    Object.entries(regions).forEach(([pageId, pageRegions]) => {
      registerEditableRegions(websiteId, apiKey, pageId, pageRegions);
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
      <EditableRegistryContext.Provider
        value={{
          registerRegion,
          unregisterRegion,
        }}
      >
        <CMSProvider websiteId={websiteId} apiKey={apiKey} environment="production">
          {children}
        </CMSProvider>
      </EditableRegistryContext.Provider>
    </RuntimeContext.Provider>
  );
}
