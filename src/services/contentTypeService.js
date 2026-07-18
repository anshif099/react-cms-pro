import { database } from "../lib/firebase";
import { ref, get, set, push, remove } from "firebase/database";
import activityLogService from "./activityLogService";

export const contentTypeService = {
  async getAll(websiteId) {
    try {
      const typesRef = ref(database, `contentTypes/${websiteId}`);
      const snapshot = await get(typesRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        return Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch content types for website ${websiteId}:`, error);
      throw error;
    }
  },

  async getById(websiteId, typeId) {
    try {
      const typeRef = ref(database, `contentTypes/${websiteId}/${typeId}`);
      const snapshot = await get(typeRef);
      if (snapshot.exists()) {
        return {
          id: typeId,
          ...snapshot.val()
        };
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch content type ${typeId}:`, error);
      throw error;
    }
  },

  async create(websiteId, data) {
    try {
      const typesRef = ref(database, `contentTypes/${websiteId}`);
      const newTypeRef = push(typesRef);
      const typeId = newTypeRef.key;

      const typeData = {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        fields: data.fields || [],
        locales: data.locales || {},
        createdAt: Date.now()
      };

      await set(newTypeRef, typeData);

      await activityLogService.logActivity(
        "content_type_created",
        "Content Type created",
        `Created reusable content type "${data.name}"`,
        websiteId
      );

      return {
        id: typeId,
        ...typeData
      };
    } catch (error) {
      console.error("Failed to create content type:", error);
      throw error;
    }
  },

  async update(websiteId, typeId, data) {
    try {
      const typeRef = ref(database, `contentTypes/${websiteId}/${typeId}`);
      const snapshot = await get(typeRef);
      if (!snapshot.exists()) {
        throw new Error("Content type not found");
      }

      const existingType = snapshot.val();
      const updatedType = {
        ...existingType,
        name: data.name || existingType.name,
        slug: data.slug || existingType.slug,
        fields: data.fields || existingType.fields,
        locales: data.locales || existingType.locales,
        updatedAt: Date.now()
      };

      await set(typeRef, updatedType);

      await activityLogService.logActivity(
        "content_type_updated",
        "Content Type updated",
        `Updated content type "${updatedType.name}"`,
        websiteId
      );

      return {
        id: typeId,
        ...updatedType
      };
    } catch (error) {
      console.error(`Failed to update content type ${typeId}:`, error);
      throw error;
    }
  },

  async delete(websiteId, typeId) {
    try {
      const typeRef = ref(database, `contentTypes/${websiteId}/${typeId}`);
      const snapshot = await get(typeRef);
      const type = snapshot.val();

      await remove(typeRef);

      if (type) {
        await activityLogService.logActivity(
          "content_type_deleted",
          "Content Type deleted",
          `Deleted content type "${type.name}"`,
          websiteId
        );
      }
      return true;
    } catch (error) {
      console.error(`Failed to delete content type ${typeId}:`, error);
      throw error;
    }
  }
};

export default contentTypeService;
