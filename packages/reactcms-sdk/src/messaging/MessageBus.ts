import { RCMSMessage } from '@anshif.rainhopes/shared';

type MessageListener = (message: RCMSMessage) => void;

export class MessageBus {
  private static listeners = new Set<MessageListener>();
  private static isListening = false;

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
        this.listeners.forEach((listener) => listener(data as RCMSMessage));
      }
    });
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
    
    // Send to parent iframe (visual editing mode)
    if (window.parent && window.parent !== window) {
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
