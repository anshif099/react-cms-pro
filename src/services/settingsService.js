import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import activityLogService from "./activityLogService";

export const settingsService = {
  async getSettings(uid) {
    try {
      const docRef = doc(db, "settings", uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          timezone: data.timezone || "IST",
          language: data.language || "en",
          tokens: data.tokens || []
        };
      }
      // Return defaults if none exist
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
      const docRef = doc(db, "settings", uid);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, updateData, { merge: true });

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
  }
};

export default settingsService;
