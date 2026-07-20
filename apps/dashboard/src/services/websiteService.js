import { database } from "../lib/firebase";
import { ref, get, set, push, update, remove, serverTimestamp } from "firebase/database";
import { 
  generateWebsiteId, 
  generateApiKey, 
  generateSecretKey, 
  generateVerificationCode 
} from "../utils/generators";
import activityLogService from "./activityLogService";
import { websiteSyncService } from "./websiteSyncService";

async function hashSecretKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const websiteService = {
  async getAll() {
    try {
      const websitesRef = ref(database, "websites");
      const snapshot = await get(websitesRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key],
          // Since secretKey is not stored in DB, we provide a masked version for UI display/SecretField
          secretKey: val[key].secretKey || "rcms_sk_••••••••••••••••••••"
        }));
        // Sort descending by createdAt
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return list;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch websites:", error);
      throw error;
    }
  },

  async getById(id) {
    try {
      const docRef = ref(database, `websites/${id}`);
      const snapshot = await get(docRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          id,
          ...data,
          secretKey: data.secretKey || "rcms_sk_••••••••••••••••••••"
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch website by id:", error);
      throw error;
    }
  },

  async create(data) {
    try {
      const websitesRef = ref(database, "websites");
      const newWebsiteRef = push(websitesRef);
      const newId = newWebsiteRef.key;

      const websiteId = generateWebsiteId();
      const apiKey = generateApiKey();
      const rawSecretKey = generateSecretKey();
      const secretKeyHash = await hashSecretKey(rawSecretKey);
      const verificationCode = generateVerificationCode();

      const websiteData = {
        websiteId,
        name: data.name,
        domain: data.domain,
        framework: data.framework,
        hosting: data.hosting,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        apiKey,
        secretKeyHash,
        verificationCode,
        status: "pending",
        verificationStatus: "unverified",
        sdkInstalled: false,
        sdkVersion: "",
        lastSync: null,
        connectionHealth: "unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await set(newWebsiteRef, websiteData);
      
      // Log activity
      await activityLogService.logActivity(
        "website_added",
        "Website connected",
        `Connected new website: ${data.name} (${data.domain})`,
        newId
      );

      // Return the created website *including* the raw secret key so the UI can show it initially
      return {
        id: newId,
        ...websiteData,
        secretKey: rawSecretKey
      };
    } catch (error) {
      console.error("Failed to create website:", error);
      throw error;
    }
  },

  async update(id, data) {
    try {
      const docRef = ref(database, `websites/${id}`);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      await update(docRef, updateData);

      // Fetch the updated data
      const updatedSnap = await get(docRef);
      const updatedData = updatedSnap.val();

      // Log activity
      await activityLogService.logActivity(
        "website_updated",
        "Website updated",
        `Updated settings for ${updatedData.name}`,
        id
      );

      return {
        id,
        ...updatedData,
        secretKey: updatedData.secretKey || "rcms_sk_••••••••••••••••••••"
      };
    } catch (error) {
      console.error("Failed to update website:", error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const website = await this.getById(id);
      const docRef = ref(database, `websites/${id}`);
      await remove(docRef);

      if (website) {
        await activityLogService.logActivity(
          "website_deleted",
          "Website deleted",
          `Permanently deleted website: ${website.name}`,
          id
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to delete website:", error);
      throw error;
    }
  },

  async regenerateApiKey(id) {
    const apiKey = generateApiKey();
    const updated = await this.update(id, { apiKey });
    
    await activityLogService.logActivity(
      "api_key_regenerated",
      "API Key regenerated",
      `Regenerated API public key for ${updated.name}`,
      id
    );
    return updated;
  },

  async regenerateSecretKey(id) {
    const rawSecretKey = generateSecretKey();
    const secretKeyHash = await hashSecretKey(rawSecretKey);
    
    const docRef = ref(database, `websites/${id}`);
    await update(docRef, {
      secretKeyHash,
      updatedAt: serverTimestamp()
    });

    const updatedSnap = await get(docRef);
    const updatedData = updatedSnap.val();

    await activityLogService.logActivity(
      "secret_key_regenerated",
      "Secret Key regenerated",
      `Regenerated Secret client key for ${updatedData.name}`,
      id
    );

    // Return the updated website object with the new raw secret key so the user can copy it once
    return {
      id,
      ...updatedData,
      secretKey: rawSecretKey
    };
  },

  async updateStatus(id, status) {
    const updated = await this.update(id, { status });
    return updated;
  },

  async syncWebsite(id) {
    const website = await this.getById(id);
    if (!website) throw new Error("Website not found");
    return await websiteSyncService.runSync(website);
  },

  async importRoutes(id, routes, userId) {
    return await websiteSyncService.importRouteList(id, routes, userId);
  }
};

export default websiteService;
