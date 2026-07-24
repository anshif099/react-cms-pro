import { MessageBus, getElementComputedStyle } from '@anshif.rainhopes/reactcms-sdk';

export function setupRuntimeMessageHandler(
  websiteId: string,
  callbacks: {
    onEnterEditMode?: () => void;
    onExitEditMode?: () => void;
    onThemeUpdate?: (theme: any) => void;
    onNavigationUpdate?: (menus: any[]) => void;
    onFieldUpdate?: (payload: any) => void;
    onRegionSelected?: (payload: any) => void;
    onOpenInspector?: (payload: any) => void;
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
      case 'rcms/v1/field-update':
        if (callbacks.onFieldUpdate) callbacks.onFieldUpdate(msg.payload);
        break;
      case 'rcms/v1/region-selected':
        if (callbacks.onRegionSelected) callbacks.onRegionSelected(msg.payload);
        break;
      case 'rcms/v1/open-inspector': {
        const payload = (msg.payload || {}) as { regionId?: string };
        if (payload.regionId && typeof document !== 'undefined') {
          const el = document.querySelector(`[data-rcms-region="${payload.regionId}"]`) as HTMLElement | null;
          if (el) {
            const computedStyle = getElementComputedStyle(el);
            MessageBus.send('rcms/v1/region-selected', websiteId, {
              regionId: payload.regionId,
              computedStyle,
            });
          }
        }
        if (callbacks.onOpenInspector) callbacks.onOpenInspector(msg.payload);
        break;
      }
    }
  });
}
