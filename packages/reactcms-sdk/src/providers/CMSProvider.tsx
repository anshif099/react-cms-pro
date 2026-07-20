import React, { useState, useEffect } from 'react';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { ThemeContext } from '../context/ThemeContext';
import { NavigationContext } from '../context/NavigationContext';
import { SEOContext } from '../context/SEOContext';
import { Page, ThemeTokens, NavMenu, PageSEO } from '@anshif.rainhopes/shared';
import { MessageBus } from '../messaging/MessageBus';

export interface CMSProviderProps {
  websiteId: string;
  apiKey: string;
  environment?: 'development' | 'production' | 'staging';
  children: React.ReactNode;
}

export function CMSProvider({
  websiteId,
  apiKey,
  environment = 'production',
  children,
}: CMSProviderProps) {
  const [editMode, setEditMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPage] = useState<Page | null>(null);
  const [locale, setLocale] = useState('en');
  const [theme, setTheme] = useState<ThemeTokens | null>(null);
  const [menus, setMenus] = useState<Record<string, NavMenu>>({});
  const [seo, setSEO] = useState<PageSEO | null>(null);

  useEffect(() => {
    // Start message bus
    MessageBus.start(websiteId);

    // Subscribe to runtime control messages
    const unsubscribe = MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/enter-edit-mode') {
        setEditMode(true);
      } else if (msg.type === 'rcms/v1/exit-edit-mode') {
        setEditMode(false);
      } else if (msg.type === 'rcms/v1/theme-update') {
        setTheme(msg.payload as ThemeTokens);
      } else if (msg.type === 'rcms/v1/navigation-update') {
        const payload = msg.payload as NavMenu[];
        const menusRecord: Record<string, NavMenu> = {};
        payload.forEach((menu) => {
          menusRecord[menu.id] = menu;
        });
        setMenus(menusRecord);
      }
    });

    setIsConnected(true);
    return () => {
      unsubscribe();
    };
  }, [websiteId]);

  return (
    <CMSContext.Provider
      value={{
        websiteId,
        apiKey,
        environment,
        editMode,
        isConnected,
        setEditMode,
      }}
    >
      <PageContext.Provider
        value={{
          currentPage,
          locale,
          setLocale,
        }}
      >
        <ThemeContext.Provider value={{ theme, setTheme }}>
          <NavigationContext.Provider value={{ menus, setMenus }}>
            <SEOContext.Provider value={{ seo, setSEO }}>
              {children}
            </SEOContext.Provider>
          </NavigationContext.Provider>
        </ThemeContext.Provider>
      </PageContext.Provider>
    </CMSContext.Provider>
  );
}
