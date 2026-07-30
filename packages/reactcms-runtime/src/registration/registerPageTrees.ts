import { ref, set } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths } from '@anshif.rainhopes/shared';
import type { PageComponentTree } from '@anshif.rainhopes/reactcms-renderer';

function normalizePageKey(value: string) {
  return value.split('?')[0].replace(/^\/+|\/+$/g, '') || 'home';
}

/**
 * Publishes serializable component-tree manifests for the dashboard's native
 * canvas. Implementations stay in the runtime component registry; the
 * manifest contains only component IDs, props, styles, and hierarchy.
 */
export async function registerPageTrees(
  websiteId: string,
  apiKey: string,
  pageTrees: Record<string, PageComponentTree>,
) {
  const database = getFirebaseDatabase(apiKey);
  await Promise.all(Object.entries(pageTrees).map(([pageKey, tree]) => (
    set(ref(database, paths.registryPageTree(websiteId, normalizePageKey(pageKey))), tree)
  )));
}
