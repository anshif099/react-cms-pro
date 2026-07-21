import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, LayoutDefinition } from '@anshif.rainhopes/shared';

export async function registerLayouts(
  websiteId: string,
  apiKey: string,
  layouts: Record<string, LayoutDefinition>
) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const layoutsRef = ref(db, paths.registryLayouts(websiteId));

    const updates: Record<string, any> = {};
    Object.entries(layouts).forEach(([id, layout]) => {
      updates[id] = JSON.parse(JSON.stringify(layout));
    });

    if (Object.keys(updates).length > 0) {
      await update(layoutsRef, updates);
    }
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to register layouts:', error);
  }
}
