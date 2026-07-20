export interface PluginConfig {
  id: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  settingsFields?: Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select';
    options?: string[];
    defaultValue?: unknown;
  }>;
}
