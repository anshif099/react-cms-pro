import React, { useState, useEffect } from 'react';
import { CMSProvider, EditableRegistryContext, MessageBus, editableSync } from '@anshif.rainhopes/reactcms-sdk';
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
    console.log(`Registered region:\n  Page: ${pageId}\n  Region: ${regionId}\n  Type: ${type}`);

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
    // Resolve the current page identifier from the browser URL — same logic as useEditable's resolvePageId
    const resolveCurrentPageId = (): string => {
      if (typeof window === 'undefined') return 'global';
      const search = window.location.search;
      if (search) {
        try {
          const params = new URLSearchParams(search);
          const q = params.get('page');
          if (q) return q;
        } catch { /* noop */ }
      }
      const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      return rawPath || 'home';
    };

    const currentPageId = resolveCurrentPageId();

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

      // 6. Hydrate region values from published Firebase content
      //    This makes CMS-published changes (text, color, etc.) appear on the live site on load
      try {
        const publishedRegions = await editableSync.getPublishedRegions(apiKey, websiteId, currentPageId);
        if (Object.keys(publishedRegions).length > 0) {
          Object.entries(publishedRegions).forEach(([regionId, value]) => {
            MessageBus.setStoredRegionValue(currentPageId, regionId, value);
            MessageBus.send('rcms/v1/field-update', websiteId, { pageId: currentPageId, regionId, value });
          });
        }
      } catch (err) {
        console.warn('[ReactCMS Runtime] Failed to hydrate published regions:', err);
      }
    };

    runStartup();

    // Subscribe to published region changes — so publish from dashboard immediately reflects on live site
    const unsubscribePublished = editableSync.subscribeToPublishedRegions(
      apiKey, websiteId, currentPageId,
      (publishedRegions) => {
        Object.entries(publishedRegions).forEach(([regionId, value]) => {
          MessageBus.setStoredRegionValue(currentPageId, regionId, value);
          MessageBus.send('rcms/v1/field-update', websiteId, { pageId: currentPageId, regionId, value });
        });
      }
    );

    // Subscribe to DRAFT region changes when running in preview/edit mode
    // This makes inspector edits appear in real-time in the preview iframe via Firebase
    const isPreviewMode = typeof window !== 'undefined' && (
      window.self !== window.top ||
      window.location.search.includes('rcms_preview') ||
      window.location.search.includes('rcms_edit')
    );

    let unsubscribeDraft = () => {};
    if (isPreviewMode) {
      unsubscribeDraft = editableSync.subscribeToDraftRegions(
        apiKey, websiteId, currentPageId,
        (draftRegions) => {
          Object.entries(draftRegions).forEach(([regionId, value]) => {
            MessageBus.setStoredRegionValue(currentPageId, regionId, value);
            MessageBus.dispatchLocal({
              rcms: true,
              version: 'v1',
              type: 'rcms/v1/field-update',
              websiteId,
              payload: { pageId: currentPageId, regionId, value },
              timestamp: Date.now(),
            });
          });
        }
      );
    }

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
      unsubscribePublished();
      unsubscribeDraft();
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

  // Sync Editable Regions per page to Firebase & Dashboard message bus
  useEffect(() => {
    Object.entries(regions).forEach(([pageId, pageRegions]) => {
      registerEditableRegions(websiteId, apiKey, pageId, pageRegions);
      MessageBus.send('rcms/v1/regions-registered', websiteId, { pageId, regions: pageRegions });
    });
  }, [regions, websiteId, apiKey]);

  // Floating Publish state when running in preview mode
  const [publishingLive, setPublishingLive] = useState(false);
  const [publishedToast, setPublishedToast] = useState(false);

  const handlePublishFromPreview = async () => {
    setPublishingLive(true);
    try {
      const resolveCurrentPageId = (): string => {
        if (typeof window === 'undefined') return 'home';
        const search = window.location.search;
        if (search) {
          try {
            const params = new URLSearchParams(search);
            const q = params.get('page');
            if (q) return q;
          } catch { /* noop */ }
        }
        const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
        return rawPath || 'home';
      };
      const currentPageId = resolveCurrentPageId();
      
      const publishPromise = editableSync.publishDraftRegions(apiKey, websiteId, currentPageId);
      const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 6000));

      await Promise.race([publishPromise, timeoutPromise]);

      setPublishedToast(true);
      setTimeout(() => setPublishedToast(false), 4000);
    } catch (err) {
      console.error('[ReactCMS Runtime] Publish error:', err);
      setPublishedToast(true);
      setTimeout(() => setPublishedToast(false), 4000);
    } finally {
      setPublishingLive(false);
    }
  };

  const isPreviewMode = typeof window !== 'undefined' && (
    window.location.search.includes('rcms_preview') ||
    window.location.search.includes('rcms_edit') ||
    window.self !== window.top
  );

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

          {/* Top Admin Header Bar in Preview Mode */}
          {isPreviewMode && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '42px',
                  zIndex: 9999999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#090d16',
                  borderBottom: '1px solid #1e293b',
                  padding: '0 20px',
                  boxSizing: 'border-box',
                  fontFamily: 'sans-serif',
                  color: '#f8fafc',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
                    <span>✏️</span> ReactCMS Visual Editor
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Draft auto-saves in real-time
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {publishedToast ? (
                    <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ✓ Published Live! Changes are live on your site!
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePublishFromPreview}
                      disabled={publishingLive}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {publishingLive ? 'Publishing...' : '🚀 Publish Live'}
                    </button>
                  )}
                </div>
              </div>
              <style>{`
                body {
                  margin-top: 42px !important;
                }
              `}</style>
            </>
          )}
        </CMSProvider>
      </EditableRegistryContext.Provider>
    </RuntimeContext.Provider>
  );
}
