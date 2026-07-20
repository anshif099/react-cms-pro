import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, CURRENT_SDK_VERSION, CURRENT_RUNTIME_VERSION, CURRENT_DASHBOARD_VERSION } from '@anshif.rainhopes/shared';

export async function reportVersions(websiteId: string, apiKey: string) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const versionsRef = ref(db, `${paths.registry(websiteId)}/versions`);
    
    await update(versionsRef, {
      sdk: CURRENT_SDK_VERSION,
      runtime: CURRENT_RUNTIME_VERSION,
      dashboard: CURRENT_DASHBOARD_VERSION
    });
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to report versions:', error);
  }
}
