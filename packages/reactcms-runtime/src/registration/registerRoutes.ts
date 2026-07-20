import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths } from '@anshif.rainhopes/shared';
import { discoverRoutes } from '../routing/routeDiscovery';

export async function registerRoutes(
  websiteId: string,
  apiKey: string,
  routesConfig: any[]
) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const discovered = discoverRoutes(routesConfig);

    const routesRef = ref(db, paths.registryRoutes(websiteId));
    const updates: Record<string, any> = {};

    discovered.forEach((route) => {
      updates[route.id] = route;
    });

    if (Object.keys(updates).length > 0) {
      await update(routesRef, updates);
    }
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to register website routes:', error);
  }
}
