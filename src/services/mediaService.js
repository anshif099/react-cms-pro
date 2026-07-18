import { database, storage } from "../lib/firebase";
import { ref as dbRef, get, set, remove, push } from "firebase/database";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import activityLogService from "./activityLogService";
import searchService from "./searchService";

export const mediaService = {
  upload(websiteId, file, folder = "root", onProgress = null) {
    return new Promise((resolve, reject) => {
      try {
        const mediaMetaRef = push(dbRef(database, `media/${websiteId}`));
        const fileId = mediaMetaRef.key;
        
        // Clean name to prevent path issues
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `media/${websiteId}/${folder}/${fileId}_${cleanName}`;
        const fileStorageRef = storageRef(storage, storagePath);

        const uploadTask = uploadBytesResumable(fileStorageRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(progress);
            }
          },
          (error) => {
            console.error("Storage upload error:", error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              const fileData = {
                id: fileId,
                name: file.name,
                url: downloadURL,
                storagePath,
                type: file.type || "application/octet-stream",
                size: file.size,
                folder: folder || "root",
                alt: file.name.split(".")[0], // Default alt to filename
                createdAt: Date.now()
              };

              await set(mediaMetaRef, fileData);

              // Index in search
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

              resolve(fileData);
            } catch (err) {
              console.error("Error finalizing media DB write:", err);
              reject(err);
            }
          }
        );
      } catch (err) {
        console.error("Upload preparation error:", err);
        reject(err);
      }
    });
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

      // Delete from Firebase Storage if path exists
      if (fileData.storagePath) {
        const fileStorageRef = storageRef(storage, fileData.storagePath);
        try {
          await deleteObject(fileStorageRef);
        } catch (storageErr) {
          // If storage object is already deleted, log and proceed to clear DB
          console.warn("File object not found in storage, clearing from DB:", storageErr);
        }
      }

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
