export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'image'
  | 'video'
  | 'file'
  | 'url'
  | 'email'
  | 'select'
  | 'multiselect'
  | 'relation'
  | 'repeater'
  | 'slug'
  | 'color'
  | 'json';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  hint?: string;
}

export interface ContentModel {
  id: string;
  label: string;
  icon?: string;
  fields: FieldDefinition[];
  seoDefaults?: {
    metaTitleTemplate: string;
    metaDescriptionField: string;
    ogImageField?: string;
  };
  slugRule: 'title' | 'date-title' | 'id' | 'custom';
  defaultTemplate?: string;
}
