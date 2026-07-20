export interface FieldUpdatePayload {
  regionId: string;
  fieldKey?: string;
  value: unknown;
}

export interface RegionSelectedPayload {
  regionId: string;
  type: string;
  pageId: string;
}

export interface OpenInspectorPayload {
  regionId: string;
}
