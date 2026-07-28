import { ref, get, set } from "firebase/database";
import { database } from "../lib/firebase";

export const vercelDeployService = {
  // Get Vercel Deploy Hook URL for website
  async getDeployHook(websiteId) {
    try {
      const hookRef = ref(database, `websites/${websiteId}/settings/vercelDeployHook`);
      const snapshot = await get(hookRef);
      return snapshot.exists() ? snapshot.val() : "";
    } catch (err) {
      console.error("Error fetching Vercel deploy hook:", err);
      return "";
    }
  },

  // Save Vercel Deploy Hook URL
  async setDeployHook(websiteId, hookUrl) {
    try {
      const hookRef = ref(database, `websites/${websiteId}/settings/vercelDeployHook`);
      await set(hookRef, hookUrl);
      return { success: true };
    } catch (err) {
      console.error("Error saving Vercel deploy hook:", err);
      throw err;
    }
  },

  // Trigger Vercel Deployment Webhook
  async triggerDeploy(websiteId) {
    try {
      const hookUrl = await this.getDeployHook(websiteId);
      if (!hookUrl) {
        throw new Error("No Vercel Deploy Hook URL configured in CMS Settings.");
      }

      const res = await fetch(hookUrl, {
        method: "POST"
      });

      if (!res.ok) {
        throw new Error(`Vercel deployment failed with status: ${res.status}`);
      }

      return { success: true, timestamp: Date.now() };
    } catch (err) {
      console.error("Failed to trigger Vercel deployment:", err);
      throw err;
    }
  }
};

export default vercelDeployService;
