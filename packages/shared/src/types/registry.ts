import { RouteEntry } from './route';
import { LayoutDefinition } from './layout';
import { NavMenu } from './navigation';
import { ThemeTokens } from './theme';
import { ContentModel } from './contentModel';
import { EditableRegion } from './editable';

export interface RuntimeStatus {
  status: 'online' | 'offline' | 'degraded';
  heartbeat: string;
  sdkVersion: string;
  runtimeVersion: string;
  compatibility: 'ok' | 'warn' | 'breaking';
}

export interface ProjectRegistry {
  meta: {
    name: string;
    domain: string;
    framework: string;
    createdAt: number;
  };
  runtime: RuntimeStatus;
  routes: Record<string, RouteEntry>;
  layouts: Record<string, LayoutDefinition>;
  navigation: Record<string, NavMenu>;
  theme: ThemeTokens;
  contentModels: Record<string, ContentModel>;
  components: Record<string, { id: string; type: string; pageId: string; registeredAt: number }>;
  editableRegions: Record<string, Record<string, EditableRegion>>; // pageId -> regionId -> region
  plugins: Record<string, { id: string; enabled: boolean; version?: string }>;
}
