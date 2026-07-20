import { PluginManifest } from '@anshif.rainhopes/shared';

export interface UsePluginsResult {
  plugins: PluginManifest[];
  invoke: (pluginId: string, method: string, args: unknown[]) => Promise<unknown>;
}

export function usePlugins(): UsePluginsResult {
  // Stub for v1 plugin boundaries
  return {
    plugins: [],
    invoke: async () => {
      throw new Error('Plugins are not supported in ReactCMS Platform v1. Upgrading to v2 is required.');
    }
  };
}
