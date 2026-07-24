import { ref, set } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, EditableRegion, encodeFirebaseKey } from '@anshif.rainhopes/shared';

export async function registerEditableRegions(
  websiteId: string,
  apiKey: string,
  pageId: string,
  regions: Record<string, EditableRegion>
) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const regionsRef = ref(db, paths.registryRegions(websiteId, pageId));

    // Construct clean editable region schema metadata dictionary
    const cleanRegions: Record<string, any> = {};

    Object.entries(regions || {}).forEach(([regionId, reg]) => {
      if (reg && reg.id && reg.type) {
        const encodedKey = encodeFirebaseKey(regionId);
        cleanRegions[encodedKey] = {
          id: reg.id,
          type: reg.type,
          label: reg.label || reg.id,
          editable: reg.editable !== undefined ? reg.editable : true,
          ...(reg.defaultValue !== undefined ? { defaultValue: reg.defaultValue } : {}),
          registeredAt: reg.registeredAt || Date.now(),
        };
      }
    });

    await set(regionsRef, cleanRegions);
  } catch (error) {
    console.error(`[ReactCMS Runtime] Failed to register editable regions for page ${pageId}:`, error);
  }
}
