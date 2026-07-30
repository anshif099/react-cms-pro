export const EVENT_TYPES = {
  'enter-edit-mode': 'rcms/v1/enter-edit-mode',
  'exit-edit-mode': 'rcms/v1/exit-edit-mode',
  'field-update': 'rcms/v1/field-update',
  'region-selected': 'rcms/v1/region-selected',
  'open-inspector': 'rcms/v1/open-inspector',
  'theme-update': 'rcms/v1/theme-update',
  'navigation-update': 'rcms/v1/navigation-update',
  'publish-page': 'rcms/v1/publish-page',
  'heartbeat': 'rcms/v1/heartbeat',
  'runtime-ready': 'rcms/v1/runtime-ready',
  'regions-registered': 'rcms/v1/regions-registered',
  'builder-structure-update': 'rcms/v1/builder-structure-update',
  'builder-insert-request': 'rcms/v1/builder-insert-request',
  'builder-command': 'rcms/v1/builder-command',
  'select-region': 'rcms/v1/select-region'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
