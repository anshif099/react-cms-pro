import { editableSync } from '../firebase/editableSync';
import { MessageBus } from './MessageBus';

export function setupFirebaseBridge(apiKey: string, websiteId: string, pageId: string) {
  if (!apiKey || !websiteId || !pageId) return () => {};

  // Subscribe to Firebase Realtime Database draft changes and dispatch to MessageBus
  const unsubscribe = editableSync.subscribeToDraftRegions(apiKey, websiteId, pageId, (values) => {
    Object.entries(values).forEach(([regionId, val]) => {
      MessageBus.send('rcms/v1/field-update', websiteId, {
        regionId,
        value: val,
      });
    });
  });

  return unsubscribe;
}
