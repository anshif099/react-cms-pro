import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CMSContext,
  CMSProvider,
  CMSSEOProvider,
  EditableRegistryContext,
  MessageBus,
  SEOContext,
  editableSync,
  getFirebaseDatabase,
} from '@anshif.rainhopes/reactcms-sdk';
import {
  EditableRegion,
  EditableType,
  NavMenu,
  PageSEO,
  ThemeTokens,
  paths,
} from '@anshif.rainhopes/shared';
import { onValue, ref } from 'firebase/database';
import { RuntimeContext } from './RuntimeContext';
import type { RuntimeLayoutDefinition } from './RuntimeContext';
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
  preserveApplicationPage?: boolean;
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

export function runtimeRegionContentSource(editMode: boolean): 'draft' | 'published' {
  return editMode ? 'draft' : 'published';
}

export function pageSEOFromContent(value: unknown): PageSEO | null {
  if (!value || typeof value !== 'object') return null;
  const seo = (value as { seo?: unknown }).seo;
  return seo && typeof seo === 'object' && !Array.isArray(seo)
    ? seo as PageSEO
    : null;
}

type EditableRegionRegistry = Record<string, Record<string, EditableRegion>>;

export function registerEditableRegionState(
  current: EditableRegionRegistry,
  pageId: string,
  regionId: string,
  type: EditableType,
  label: string,
  defaultValue?: unknown,
): EditableRegionRegistry {
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
}

export function unregisterEditableRegionState(
  current: EditableRegionRegistry,
  pageId: string,
  regionId: string,
): EditableRegionRegistry {
  const currentPageRegions = current[pageId];
  if (!currentPageRegions || !Object.prototype.hasOwnProperty.call(currentPageRegions, regionId)) {
    return current;
  }

  const pageRegions = { ...currentPageRegions };
  delete pageRegions[regionId];
  return { ...current, [pageId]: pageRegions };
}

function RegionContentHydrator({
  websiteId,
  apiKey,
}: {
  websiteId: string;
  apiKey: string;
}) {
  const cms = useContext(CMSContext);
  const pageId = useMemo(resolveCurrentPageId, []);
  const source = runtimeRegionContentSource(Boolean(cms?.editMode));

  useEffect(() => {
    let active = true;
    const hydrate = source === 'draft'
      ? editableSync.getDraftRegions(apiKey, websiteId, pageId)
      : editableSync.getPublishedRegions(apiKey, websiteId, pageId);

    void hydrate.then((regions) => {
      if (!active) return;
      Object.entries(regions).forEach(([regionId, value]) => {
        dispatchRegionValue(websiteId, pageId, regionId, value);
      });
    });

    const subscribe = source === 'draft'
      ? editableSync.subscribeToDraftRegions
      : editableSync.subscribeToPublishedRegions;
    const unsubscribe = subscribe(
      apiKey,
      websiteId,
      pageId,
      (regions: Record<string, any>) => {
        if (!active) return;
        Object.entries(regions).forEach(([regionId, value]) => {
          dispatchRegionValue(websiteId, pageId, regionId, value);
        });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [apiKey, pageId, source, websiteId]);

  return null;
}

function SEOContentHydrator({
  websiteId,
  apiKey,
}: {
  websiteId: string;
  apiKey: string;
}) {
  const cms = useContext(CMSContext);
  const setSEO = useContext(SEOContext)?.setSEO;
  const pageId = useMemo(resolveCurrentPageId, []);
  const source = runtimeRegionContentSource(Boolean(cms?.editMode));

  useEffect(() => {
    if (!setSEO) return () => {};
    const db = getFirebaseDatabase(apiKey);
    return onValue(ref(db, source === 'draft'
      ? paths.contentDraft(websiteId, pageId)
      : paths.contentPublished(websiteId, pageId)), (snapshot) => {
      setSEO(snapshot.exists() ? pageSEOFromContent(snapshot.val()) || {} as PageSEO : {} as PageSEO);
    });
  }, [apiKey, pageId, setSEO, source, websiteId]);

  return null;
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
  preserveApplicationPage = false,
  children,
}: RuntimeProviderProps) {
  const [layouts, setLayouts] = useState<Record<string, RuntimeLayoutDefinition>>({});
  const [navigations, setNavigations] = useState<Record<string, NavMenu>>({});
  const [regions, setRegions] = useState<EditableRegionRegistry>({});

  const registerLayout = useCallback((layout: RuntimeLayoutDefinition) => {
    setLayouts((current) => ({ ...current, [layout.id]: layout }));
  }, []);

  const unregisterLayout = useCallback((id: string) => {
    setLayouts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const registerNavigation = useCallback((navigation: NavMenu) => {
    setNavigations((current) => ({ ...current, [navigation.id]: navigation }));
  }, []);

  const unregisterNavigation = useCallback((id: string) => {
    setNavigations((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const defaultLayout = useMemo(() => (
    Object.values(layouts).find((layout) => layout.isDefault)
      || layouts.default
      || Object.values(layouts)[0]
      || null
  ), [layouts]);

  const runtimeContextValue = useMemo(() => ({
    layouts,
    navigations,
    registerLayout,
    unregisterLayout,
    registerNavigation,
    unregisterNavigation,
  }), [
    layouts,
    navigations,
    registerLayout,
    registerNavigation,
    unregisterLayout,
    unregisterNavigation,
  ]);

  const registerRegion = useCallback((
    pageId: string,
    regionId: string,
    type: EditableType,
    label: string,
    defaultValue?: unknown,
  ) => {
    setRegions((current) => registerEditableRegionState(
      current,
      pageId,
      regionId,
      type,
      label,
      defaultValue,
    ));
  }, []);

  const unregisterRegion = useCallback((pageId: string, regionId: string) => {
    setRegions((current) => unregisterEditableRegionState(current, pageId, regionId));
  }, []);

  const editableRegistryValue = useMemo(() => ({
    registerRegion,
    unregisterRegion,
  }), [registerRegion, unregisterRegion]);

  useEffect(() => {
    const start = async () => {
      await registerWebsite(websiteId, apiKey);
      await reportVersions(websiteId, apiKey);
      await registerRoutes(websiteId, apiKey, routes);
      if (theme) await registerTheme(websiteId, apiKey, theme);
      HeartbeatService.start(websiteId, apiKey);
    };

    void start();

    return () => {
      HeartbeatService.stop();
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
    <RuntimeContext.Provider value={runtimeContextValue}>
      <EditableRegistryContext.Provider value={editableRegistryValue}>
        <CMSProvider websiteId={websiteId} apiKey={apiKey} environment="production">
          <RegionContentHydrator websiteId={websiteId} apiKey={apiKey} />
          <SEOContentHydrator websiteId={websiteId} apiKey={apiKey} />
          <CMSSEOProvider>
            <BuilderSections
              websiteId={websiteId}
              apiKey={apiKey}
              fallback={children}
              layout={defaultLayout?.component}
              preserveApplicationPage={preserveApplicationPage}
            />
          </CMSSEOProvider>
        </CMSProvider>
      </EditableRegistryContext.Provider>
    </RuntimeContext.Provider>
  );
}
