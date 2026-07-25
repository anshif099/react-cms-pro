import { RCMSMessage } from '@anshif.rainhopes/shared';

type MessageListener = (message: RCMSMessage) => void;

export class MessageBus {
  private static listeners = new Set<MessageListener>();
  private static isListening = false;
  private static regionValuesStore = new Map<string, unknown>();

  public static start(websiteId: string) {
    if (this.isListening) return;
    this.isListening = true;

    window.addEventListener('message', (event) => {
      const data = event.data;
      // Fast guard check to skip all non-RCMS events without overhead
      if (!data || typeof data !== 'object' || (data as any).rcms !== true || (data as any).version !== 'v1') {
        return;
      }

      if (data.websiteId === websiteId) {
        if (data.type === 'rcms/v1/field-update' && data.payload && typeof data.payload === 'object') {
          const p = data.payload as { pageId?: string; regionId?: string; value?: unknown };
          if (p.regionId && p.value !== undefined) {
            MessageBus.setStoredRegionValue(p.pageId || 'global', p.regionId, p.value);
          }
        }
        this.listeners.forEach((listener) => listener(data as RCMSMessage));
      }
    });
  }

  public static setStoredRegionValue(pageId: string, regionId: string, value: unknown) {
    this.regionValuesStore.set(`${pageId}:${regionId}`, value);
    this.regionValuesStore.set(regionId, value);
  }

  public static getStoredRegionValue(pageId: string, regionId: string): unknown | undefined {
    if (this.regionValuesStore.has(`${pageId}:${regionId}`)) {
      return this.regionValuesStore.get(`${pageId}:${regionId}`);
    }
    return this.regionValuesStore.get(regionId);
  }

  public static dispatchLocal(message: RCMSMessage) {
    if (message.type === 'rcms/v1/field-update' && message.payload && typeof message.payload === 'object') {
      const p = message.payload as { pageId?: string; regionId?: string; value?: unknown };
      if (p.regionId && p.value !== undefined) {
        this.setStoredRegionValue(p.pageId || 'global', p.regionId, p.value);
      }
    }
    this.listeners.forEach((listener) => listener(message));
  }

  public static send<T>(type: string, websiteId: string, payload: T) {
    const message: RCMSMessage<T> = {
      rcms: true,
      version: 'v1',
      type,
      websiteId,
      payload,
      timestamp: Date.now(),
    };
    
    // Store region value if this is a field update
    if (type === 'rcms/v1/field-update' && payload && typeof payload === 'object') {
      const p = payload as { pageId?: string; regionId?: string; value?: unknown };
      if (p.regionId && p.value !== undefined) {
        this.setStoredRegionValue(p.pageId || 'global', p.regionId, p.value);
      }
    }

    // Notify in-window subscribers
    this.listeners.forEach((listener) => listener(message as RCMSMessage));

    // Send to parent iframe (visual editing mode)
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  }

  public static subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public static isValidRCMSMessage(data: unknown): data is RCMSMessage {
    if (!data || typeof data !== 'object') return false;
    const msg = data as Record<string, unknown>;
    return msg.rcms === true && msg.version === 'v1' && typeof msg.type === 'string' && typeof msg.websiteId === 'string';
  }
}

