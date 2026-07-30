import { database, storage } from "../lib/firebase";
import { ref, get, set, push, update, serverTimestamp } from "firebase/database";
import {
  deleteObject,
  ref as storageRef
} from "firebase/storage";
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

function collectArtifactPaths(value, paths = new Set()) {
  if (!value || typeof value !== "object") return paths;
  if (typeof value.storagePath === "string") paths.add(value.storagePath);
  if (typeof value.artifactPath === "string") paths.add(value.artifactPath);
  Object.values(value).forEach((child) => collectArtifactPaths(child, paths));
  return paths;
}

async function deleteWebsiteArtifacts(id) {
  const [mediaSnapshot, codebaseSnapshot, importsSnapshot] = await Promise.all([
    get(ref(database, `media/${id}`)),
    get(ref(database, `codebases/${id}`)),
    get(ref(database, `imports/${id}`))
  ]);
  const paths = new Set();
  [mediaSnapshot, codebaseSnapshot, importsSnapshot].forEach((snapshot) => {
    if (snapshot.exists()) collectArtifactPaths(snapshot.val(), paths);
  });

  await Promise.all(Array.from(paths).map(async (path) => {
    try {
      await deleteObject(storageRef(storage, path));
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }));
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
      const usesSdk = !data.connectionProvider || data.connectionProvider === "sdk";
      const rawSecretKey = usesSdk ? generateSecretKey() : "";
      const secretKeyHash = usesSdk ? await hashSecretKey(rawSecretKey) : "";
      const verificationCode = generateVerificationCode();

      const websiteData = {
        websiteId,
        name: data.name,
        domain: data.domain,
        framework: data.framework,
        hosting: data.hosting,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        apiKey: usesSdk ? apiKey : "",
        secretKeyHash,
        verificationCode,
        status: data.status || (usesSdk ? "pending" : "importing"),
        verificationStatus: data.verificationStatus || "unverified",
        sdkInstalled: false,
        sdkVersion: "",
        sourceConnected: false,
        connectionProvider: data.connectionProvider || "sdk",
        connection: data.connection || {
          provider: "sdk",
          status: "pending"
        },
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
      if (!website) return true;

      // Remove binary artifacts before deleting metadata. If Storage rejects
      // cleanup, keep the website record so the user can retry safely.
      await deleteWebsiteArtifacts(id);

      // Firebase multi-path updates are atomic. This prevents deleted websites
      // from leaving pages, drafts, registries, revisions, or source manifests.
      await update(ref(database), {
        [`websites/${id}`]: null,
        [`pages/${id}`]: null,
        [`content/${id}`]: null,
        [`registry/${id}`]: null,
        [`revisions/${id}`]: null,
        [`media/${id}`]: null,
        [`searchIndex/${id}`]: null,
        [`contentTypes/${id}`]: null,
        [`global/${id}`]: null,
        [`settings/${id}`]: null,
        [`codebases/${id}`]: null,
        [`imports/${id}`]: null
      });

      await activityLogService.logActivity(
        "website_deleted",
        "Website deleted",
        `Permanently deleted website and scoped data: ${website.name}`,
        id
      );
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

  async updateDomain(id, domain) {
    const updated = await this.update(id, { domain });
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
