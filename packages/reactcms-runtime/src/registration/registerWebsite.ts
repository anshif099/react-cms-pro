import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths, CURRENT_SDK_VERSION, CURRENT_RUNTIME_VERSION } from '@anshif.rainhopes/shared';

export async function registerWebsite(websiteId: string, apiKey: string) {
  try {
    const db = getFirebaseDatabase(apiKey);
    const runtimeRef = ref(db, paths.registryRuntime(websiteId));

    await update(runtimeRef, {
      status: 'online',
      heartbeat: new Date().toISOString(),
      sdkVersion: CURRENT_SDK_VERSION,
      runtimeVersion: CURRENT_RUNTIME_VERSION,
      compatibility: 'ok',
    });
  } catch (error) {
    console.error('[ReactCMS Runtime] Failed to register website runtime status:', error);
  }
}
