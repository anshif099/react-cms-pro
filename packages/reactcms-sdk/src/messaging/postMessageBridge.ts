import { MessageBus } from './MessageBus';

export const postMessageBridge = {
  enterEditMode(cb: () => void) {
    return MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/enter-edit-mode') {
        cb();
      }
    });
  },

  exitEditMode(cb: () => void) {
    return MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/exit-edit-mode') {
        cb();
      }
    });
  },

  onFieldUpdate(cb: (regionId: string, fieldKey: string | undefined, value: unknown) => void) {
    return MessageBus.subscribe((msg) => {
      if (msg.type === 'rcms/v1/field-update') {
        const payload = msg.payload as { regionId: string; fieldKey?: string; value: unknown };
        cb(payload.regionId, payload.fieldKey, payload.value);
      }
    });
  }
};
