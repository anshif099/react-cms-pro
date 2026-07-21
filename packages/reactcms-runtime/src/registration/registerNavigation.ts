import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, NavMenu } from '@anshif.rainhopes/shared';

export async function registerNavigation(
  websiteId: string,
  apiKey: string,
  navigations: Record<string, NavMenu>
) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const navRef = ref(db, paths.registryNav(websiteId));

    const updates: Record<string, any> = {};
    Object.entries(navigations).forEach(([id, nav]) => {
      updates[id] = JSON.parse(JSON.stringify(nav));
    });

    if (Object.keys(updates).length > 0) {
      await update(navRef, updates);
    }
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to register navigation menus:', error);
  }
}
