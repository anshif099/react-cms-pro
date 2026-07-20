import { database } from "../lib/firebase";
import { ref, get, update, serverTimestamp } from "firebase/database";
import activityLogService from "./activityLogService";

export const settingsService = {
  async getSettings(uid) {
    try {
      const settingsRef = ref(database, `settings/${uid}`);
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          timezone: data.timezone || "IST",
          language: data.language || "en",
          tokens: data.tokens || []
        };
      }
      return {
        timezone: "IST",
        language: "en",
        tokens: []
      };
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      throw error;
    }
  },

  async updateSettings(uid, data) {
    try {
      const settingsRef = ref(database, `settings/${uid}`);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      await update(settingsRef, updateData);

      await activityLogService.logActivity(
        "settings_updated",
        "Settings updated",
        "CMS general settings updated successfully"
      );
      
      return updateData;
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  },

  async createToken(uid, name) {
    try {
      const settings = await this.getSettings(uid);
      const randomHex = Math.random().toString(36).substring(2, 22);
      const newToken = {
        id: Date.now().toString(),
        name,
        token: `rcms_pat_${randomHex}`,
        created: new Date().toISOString().split("T")[0],
        lastUsed: "Never"
      };

      const updatedTokens = [newToken, ...(settings.tokens || [])];
      await this.updateSettings(uid, { tokens: updatedTokens });

      await activityLogService.logActivity(
        "settings_updated",
        "API Token generated",
        `Generated new API token: ${name}`
      );

      return newToken;
    } catch (error) {
      console.error("Failed to generate API token:", error);
      throw error;
    }
  },

  async deleteToken(uid, tokenId) {
    try {
      const settings = await this.getSettings(uid);
      const tokenToDelete = (settings.tokens || []).find(t => t.id === tokenId);
      const updatedTokens = (settings.tokens || []).filter(t => t.id !== tokenId);
      await this.updateSettings(uid, { tokens: updatedTokens });

      if (tokenToDelete) {
        await activityLogService.logActivity(
          "settings_updated",
          "API Token revoked",
          `Revoked API token: ${tokenToDelete.name}`
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to revoke API token:", error);
      throw error;
    }
  },

  async getCMSSettings(websiteId) {
    try {
      const settingsRef = ref(database, `settings/${websiteId}`);
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          defaultLocale: data.defaultLocale || "en",
          activeLocales: data.activeLocales || ["en"],
          timezone: data.timezone || "UTC"
        };
      }
      return {
        defaultLocale: "en",
        activeLocales: ["en"],
        timezone: "UTC"
      };
    } catch (error) {
      console.error(`Failed to fetch CMS settings for website ${websiteId}:`, error);
      throw error;
    }
  },

  async updateCMSSettings(websiteId, data) {
    try {
      const settingsRef = ref(database, `settings/${websiteId}`);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      await update(settingsRef, updateData);

      await activityLogService.logActivity(
        "cms_settings_updated",
        "CMS Settings updated",
        `Updated CMS settings for website`,
        websiteId
      );

      return updateData;
    } catch (error) {
      console.error(`Failed to update CMS settings for website ${websiteId}:`, error);
      throw error;
    }
  }
};

export default settingsService;
