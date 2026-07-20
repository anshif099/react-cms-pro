import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '@anshif.rainhopes/reactcms-sdk';
import { paths } from '@anshif.rainhopes/shared';

export class HeartbeatService {
  private static intervalId: any = null;

  public static start(websiteId: string, apiKey: string) {
    this.stop();

    const ping = async () => {
      try {
        const db = getFirebaseDatabase(apiKey);
        const runtimeRef = ref(db, paths.registryRuntime(websiteId));
        await update(runtimeRef, {
          heartbeat: new Date().toISOString(),
          status: 'online',
        });
      } catch (error) {
        console.error('[ReactCMS Runtime] Heartbeat ping failed:', error);
      }
    };

    // Ping immediately
    ping();

    // 30s interval
    this.intervalId = setInterval(ping, 30000);
  }

  public static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
