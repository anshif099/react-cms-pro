import React, { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import {
  blocksToPageTree,
  isPageComponentTree,
  RuntimeRenderer,
} from '@anshif.rainhopes/reactcms-renderer';
import {
  decodeFirebaseObject,
  paths,
} from '@anshif.rainhopes/shared';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import type { PageComponentTree } from '@anshif.rainhopes/reactcms-renderer';

export const BUILDER_BLOCKS_REGION = '__rcms_builder_blocks__';
export const NATIVE_PAGE_TREE_FIELD = 'tree';

function resolvePageId(): string {
  if (typeof window === 'undefined') return 'home';
  try {
    const queryPage = new URLSearchParams(window.location.search).get('page');
    if (queryPage) return queryPage;
  } catch {
    // Continue to pathname resolution.
  }
  return window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
}

function resolveLocale(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    return new URLSearchParams(window.location.search).get('rcms_locale')
      || document.documentElement.lang
      || 'en';
  } catch {
    return 'en';
  }
}

function decodePublishedTree(
  raw: unknown,
  pageId: string,
  locale: string,
): PageComponentTree | null {
  if (!raw || typeof raw !== 'object') return null;
  const decoded = decodeFirebaseObject(raw as Record<string, any>);
  if (isPageComponentTree(decoded[NATIVE_PAGE_TREE_FIELD])) {
    return decoded[NATIVE_PAGE_TREE_FIELD];
  }

  const regions = decoded.regions && typeof decoded.regions === 'object'
    ? decoded.regions
    : {};
  const blocks = Array.isArray(regions[BUILDER_BLOCKS_REGION])
    ? regions[BUILDER_BLOCKS_REGION]
    : [];
  return blocks.length
    ? blocksToPageTree(blocks, {
      id: pageId,
      title: decoded.title,
      locale,
    })
    : null;
}

export interface BuilderSectionsProps {
  websiteId: string;
  apiKey: string;
  pageId?: string;
  fallback?: React.ReactNode;
  layout?: React.ComponentType<any> | null;
}

export function BuilderSections({
  websiteId,
  apiKey,
  pageId: pageIdOverride,
  fallback = null,
  layout: Layout = null,
}: BuilderSectionsProps) {
  const pageId = useMemo(
    () => pageIdOverride?.replace(/^\/+|\/+$/g, '') || resolvePageId(),
    [pageIdOverride],
  );
  const locale = useMemo(resolveLocale, []);
  const [tree, setTree] = useState<PageComponentTree | null>(null);
  const [theme, setTheme] = useState<Record<string, any> | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const database = getFirebaseDatabase(apiKey);
    const publishedRef = ref(database, paths.contentPublished(websiteId, pageId));
    const themeRef = ref(database, paths.contentTheme(websiteId));
    const unsubscribePage = onValue(
      publishedRef,
      (snapshot) => {
        setTree(snapshot.exists()
          ? decodePublishedTree(snapshot.val(), pageId, locale)
          : null);
        setResolved(true);
      },
      (error) => {
        console.error('[ReactCMS Runtime] Native page subscription failed:', error);
        setResolved(true);
      },
    );
    const unsubscribeTheme = onValue(themeRef, (snapshot) => {
      setTheme(snapshot.exists()
        ? decodeFirebaseObject(snapshot.val())
        : null);
    });
    return () => {
      unsubscribePage();
      unsubscribeTheme();
    };
  }, [apiKey, locale, pageId, websiteId]);

  if (!resolved || !tree) return <>{fallback}</>;
  const page = (
    <RuntimeRenderer
      tree={tree}
      locale={locale}
      responsiveMode="desktop"
      mode="runtime"
      theme={theme}
    />
  );
  return Layout ? <Layout>{page}</Layout> : page;
}

export default BuilderSections;
