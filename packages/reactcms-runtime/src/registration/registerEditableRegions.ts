import { ref, set } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, EditableRegion } from '@anshif.rainhopes/shared';

export async function registerEditableRegions(
  websiteId: string,
  apiKey: string,
  pageId: string,
  regions: Record<string, EditableRegion>
) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const regionsRef = ref(db, paths.registryRegions(websiteId, pageId));
    
    // Write schema metadata
    await set(regionsRef, regions);
  } catch (error) {
    console.error(`[ReactCMS Runtime] Failed to register editable regions for page ${pageId}:`, error);
  }
}
