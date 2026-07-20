import { database } from "../lib/firebase";
import { ref, get, set, update } from "firebase/database";
import activityLogService from "./activityLogService";

export const pluginService = {
  async getInstalledPlugins(websiteId) {
    const pluginsRef = ref(database, `content/${websiteId}/plugins`);
    const snapshot = await get(pluginsRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  },

  async installPlugin(websiteId, pluginId, initialSettings = {}) {
    const pluginRef = ref(database, `content/${websiteId}/plugins/${pluginId}`);
    const now = Date.now();
    await set(pluginRef, {
      enabled: true,
      installedAt: now,
      settings: initialSettings
    });

    await activityLogService.logActivity(
      "plugin_installed",
      "Plugin Installed",
      `Installed and activated plugin: ${pluginId}`,
      websiteId
    );
    return { enabled: true, installedAt: now, settings: initialSettings };
  },

  async uninstallPlugin(websiteId, pluginId) {
    const pluginRef = ref(database, `content/${websiteId}/plugins/${pluginId}`);
    await set(pluginRef, {
      enabled: false,
      uninstalledAt: Date.now()
    });

    await activityLogService.logActivity(
      "plugin_uninstalled",
      "Plugin Uninstalled",
      `Deactivated and uninstalled plugin: ${pluginId}`,
      websiteId
    );
    return { enabled: false };
  },

  async savePluginSettings(websiteId, pluginId, settings) {
    const settingsRef = ref(database, `content/${websiteId}/plugins/${pluginId}/settings`);
    await set(settingsRef, settings);

    await activityLogService.logActivity(
      "plugin_settings_updated",
      "Plugin Settings Configured",
      `Saved custom settings configuration parameters for plugin: ${pluginId}`,
      websiteId
    );
    return true;
  }
};

export default pluginService;
