export interface FieldUpdatePayload {
  regionId: string;
  fieldKey?: string;
  value: unknown;
}

export interface RegionSelectedPayload {
  regionId: string;
  type: string;
  pageId: string;
  label?: string;
  value?: unknown;
  blockId?: string;
  computedStyle?: Record<string, string>;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OpenInspectorPayload {
  regionId: string;
}

export interface BuilderStructureUpdatePayload {
  pageId: string;
  blocks: unknown[];
}

export interface BuilderInsertRequestPayload {
  index: number;
}

export interface BuilderCommandPayload {
  command: 'duplicate' | 'delete' | 'move-up' | 'move-down';
  blockId: string;
}
