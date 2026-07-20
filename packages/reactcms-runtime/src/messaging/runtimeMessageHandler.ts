import { MessageBus } from '@anshif.rainhopes/reactcms-sdk';

export function setupRuntimeMessageHandler(
  websiteId: string,
  callbacks: {
    onEnterEditMode?: () => void;
    onExitEditMode?: () => void;
    onThemeUpdate?: (theme: any) => void;
    onNavigationUpdate?: (menus: any[]) => void;
  }
) {
  return MessageBus.subscribe((msg) => {
    if (msg.websiteId !== websiteId) return;

    switch (msg.type) {
      case 'rcms/v1/enter-edit-mode':
        if (callbacks.onEnterEditMode) callbacks.onEnterEditMode();
        break;
      case 'rcms/v1/exit-edit-mode':
        if (callbacks.onExitEditMode) callbacks.onExitEditMode();
        break;
      case 'rcms/v1/theme-update':
        if (callbacks.onThemeUpdate) callbacks.onThemeUpdate(msg.payload);
        break;
      case 'rcms/v1/navigation-update':
        if (callbacks.onNavigationUpdate) callbacks.onNavigationUpdate(msg.payload as any[]);
        break;
    }
  });
}
