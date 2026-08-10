import { database } from "../lib/firebase";
import { ref as dbRef, get, set, remove, push } from "firebase/database";
import activityLogService from "./activityLogService";
import searchService from "./searchService";

// Vercel functions cap response bodies at roughly 4.5 MB. Keep stored files
// below that ceiling so /api/media can reliably deliver every accepted file.
export const MAX_REALTIME_MEDIA_BYTES = 4 * 1024 * 1024;
const DEFAULT_MEDIA_ORIGIN = "https://react-cms-pro.vercel.app";

export function mediaDeliveryUrl(websiteId, fileId) {
  const configuredOrigin = String(
    import.meta.env?.VITE_REACTCMS_PUBLIC_ORIGIN || DEFAULT_MEDIA_ORIGIN
  ).replace(/\/$/, "");
  const parameters = new URLSearchParams({ websiteId, fileId });
  return `${configuredOrigin}/api/media?${parameters.toString()}`;
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export const mediaService = {
  async upload(websiteId, file, folder = "root", onProgress = null) {
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("Choose a valid media file.");
    }
    if (file.size > MAX_REALTIME_MEDIA_BYTES) {
      throw new Error("Realtime Database media files must be 4 MB or smaller.");
    }

    const mediaMetaRef = push(dbRef(database, `media/${websiteId}`));
    const fileId = mediaMetaRef.key;
    const databasePath = `mediaBlobs/${websiteId}/${fileId}`;
    const blobRef = dbRef(database, databasePath);
    const contentType = file.type || "application/octet-stream";
    const createdAt = Date.now();

    try {
      onProgress?.(5);
      const buffer = await file.arrayBuffer();
      const data = bytesToBase64(buffer);
      onProgress?.(45);

      await set(blobRef, {
        data,
        contentType,
        size: file.size,
        name: file.name,
        createdAt
      });
      onProgress?.(85);

      const fileData = {
        id: fileId,
        name: file.name,
        url: mediaDeliveryUrl(websiteId, fileId),
        databasePath,
        storage: "realtime-database",
        type: contentType,
        size: file.size,
        folder: folder || "root",
        alt: file.name.split(".")[0],
        createdAt
      };

      await set(mediaMetaRef, fileData);
      onProgress?.(100);

      await searchService.index(websiteId, fileId, {
        type: "media",
        title: fileData.name,
        slug: fileData.folder,
        excerpt: fileData.type,
        locales: {
          en: {
            title: fileData.name,
            description: fileData.alt || ""
          }
        }
      });

      await activityLogService.logActivity(
        "media_uploaded",
        "Media uploaded",
        `Uploaded file "${file.name}"`,
        websiteId
      );

      return fileData;
    } catch (error) {
      // A failed upload must not leave a blob or dangling metadata record.
      try {
        await Promise.all([remove(blobRef), remove(mediaMetaRef)]);
      } catch (cleanupError) {
        console.warn("Could not clean up failed Realtime Database media upload:", cleanupError);
      }
      console.error("Realtime Database media upload error:", error);
      throw error;
    }
  },

  async getAll(websiteId) {
    try {
      const mediaRef = dbRef(database, `media/${websiteId}`);
      const snapshot = await get(mediaRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        return Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch media for website ${websiteId}:`, error);
      throw error;
    }
  },

  async getByFolder(websiteId, folder = "root") {
    try {
      const allMedia = await this.getAll(websiteId);
      return allMedia.filter(item => item.folder === folder);
    } catch (error) {
      console.error(`Failed to fetch media for folder ${folder}:`, error);
      throw error;
    }
  },

  async delete(websiteId, fileId) {
    try {
      const docRef = dbRef(database, `media/${websiteId}/${fileId}`);
      const snapshot = await get(docRef);
      if (!snapshot.exists()) {
        throw new Error("File not found in database.");
      }

      const fileData = snapshot.val();

      const databasePath = fileData.databasePath || `mediaBlobs/${websiteId}/${fileId}`;
      await remove(dbRef(database, databasePath));

      // Delete from Database
      await remove(docRef);

      // Remove from search index
      await searchService.removeFromIndex(websiteId, fileId);

      await activityLogService.logActivity(
        "media_deleted",
        "Media deleted",
        `Deleted file "${fileData.name}"`,
        websiteId
      );

      return true;
    } catch (error) {
      console.error(`Failed to delete media ${fileId}:`, error);
      throw error;
    }
  },

  async rename(websiteId, fileId, newName) {
    try {
      const docRef = dbRef(database, `media/${websiteId}/${fileId}`);
      const snapshot = await get(docRef);
      if (!snapshot.exists()) {
        throw new Error("File not found.");
      }

      const fileData = snapshot.val();
      const updatedData = {
        ...fileData,
        name: newName,
        updatedAt: Date.now()
      };

      await set(docRef, updatedData);

      // Update search index
      await searchService.index(websiteId, fileId, {
        type: "media",
        title: newName,
        slug: fileData.folder,
        excerpt: fileData.type,
        locales: {
          en: {
            title: newName,
            description: fileData.alt || ""
          }
        }
      });

      await activityLogService.logActivity(
        "media_renamed",
        "Media renamed",
        `Renamed file "${fileData.name}" to "${newName}"`,
        websiteId
      );

      return {
        id: fileId,
        ...updatedData
      };
    } catch (error) {
      console.error(`Failed to rename file ${fileId}:`, error);
      throw error;
    }
  },

  async updateAltText(websiteId, fileId, altText) {
    try {
      const docRef = dbRef(database, `media/${websiteId}/${fileId}`);
      const snapshot = await get(docRef);
      if (!snapshot.exists()) {
        throw new Error("File not found.");
      }

      const fileData = snapshot.val();
      const updatedData = {
        ...fileData,
        alt: altText,
        updatedAt: Date.now()
      };

      await set(docRef, updatedData);

      // Update search index
      await searchService.index(websiteId, fileId, {
        type: "media",
        title: fileData.name,
        slug: fileData.folder,
        excerpt: fileData.type,
        locales: {
          en: {
            title: fileData.name,
            description: altText
          }
        }
      });

      await activityLogService.logActivity(
        "media_alt_updated",
        "Media alt text updated",
        `Updated Alt text description for file "${fileData.name}"`,
        websiteId
      );

      return {
        id: fileId,
        ...updatedData
      };
    } catch (error) {
      console.error(`Failed to update alt text for file ${fileId}:`, error);
      throw error;
    }
  },

  async search(websiteId, query) {
    try {
      const allMedia = await this.getAll(websiteId);
      const queryLower = query.toLowerCase().trim();
      if (!queryLower) return allMedia;

      return allMedia.filter(
        item =>
          item.name.toLowerCase().includes(queryLower) ||
          (item.alt && item.alt.toLowerCase().includes(queryLower)) ||
          item.type.toLowerCase().includes(queryLower)
      );
    } catch (error) {
      console.error(`Failed to search media with query "${query}":`, error);
      return [];
    }
  }
};

export default mediaService;
