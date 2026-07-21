export type EditableType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'video'
  | 'button'
  | 'repeater'
  | 'section';

export interface EditableRegion {
  id: string;
  type: EditableType;
  label: string;
  editable?: boolean;
  defaultValue?: unknown;
  registeredAt?: number;
}
