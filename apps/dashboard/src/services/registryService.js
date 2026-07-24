import { database } from "../lib/firebase";
import { ref, get, set, update, onValue } from "firebase/database";
import { paths, decodeFirebaseKey, decodeFirebaseObject } from "@anshif.rainhopes/shared";

export const registryService = {
  async getRegistry(websiteId) {
    const registryRef = ref(database, paths.registry(websiteId));
    const snapshot = await get(registryRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  async getRoutes(websiteId) {
    const routesRef = ref(database, paths.registryRoutes(websiteId));
    const snapshot = await get(routesRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  async getLayouts(websiteId) {
    const layoutsRef = ref(database, paths.registryLayouts(websiteId));
    const snapshot = await get(layoutsRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  async getNavigation(websiteId) {
    const navRef = ref(database, paths.registryNav(websiteId));
    const snapshot = await get(navRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  async getTheme(websiteId) {
    const themeRef = ref(database, paths.registryTheme(websiteId));
    const snapshot = await get(themeRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  async getRuntimeStatus(websiteId) {
    const runtimeRef = ref(database, paths.registryRuntime(websiteId));
    const snapshot = await get(runtimeRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  async getEditableRegions(websiteId) {
    const regionsRef = ref(database, `registry/${websiteId}/editableRegions`);
    const snapshot = await get(regionsRef);
    if (!snapshot.exists()) return {};
    const raw = snapshot.val();
    const decoded = {};
    Object.entries(raw).forEach(([pageKey, pageRegions]) => {
      const decodedPageKey = decodeFirebaseKey(pageKey);
      decoded[decodedPageKey] = decodeFirebaseObject(pageRegions);
    });
    return decoded;
  },

  async saveNavigation(websiteId, menus) {
    const navRef = ref(database, paths.registryNav(websiteId));
    await set(navRef, menus);
    return true;
  },

  async setDefaultLayout(websiteId, layoutId) {
    const layouts = await this.getLayouts(websiteId);
    const updates = {};
    
    Object.keys(layouts).forEach((id) => {
      updates[`${id}/isDefault`] = id === layoutId;
    });

    if (Object.keys(updates).length > 0) {
      const layoutsRef = ref(database, paths.registryLayouts(websiteId));
      await update(layoutsRef, updates);
    }
    return true;
  },

  subscribeToRuntime(websiteId, cb) {
    const runtimeRef = ref(database, paths.registryRuntime(websiteId));
    return onValue(runtimeRef, (snapshot) => {
      cb(snapshot.exists() ? snapshot.val() : null);
    });
  },

  subscribeToRoutes(websiteId, cb) {
    const routesRef = ref(database, paths.registryRoutes(websiteId));
    return onValue(routesRef, (snapshot) => {
      cb(snapshot.exists() ? snapshot.val() : {});
    });
  },

  subscribeToEditableRegions(websiteId, cb) {
    const regionsRef = ref(database, `registry/${websiteId}/editableRegions`);
    return onValue(regionsRef, (snapshot) => {
      if (!snapshot.exists()) {
        cb({});
        return;
      }
      const raw = snapshot.val();
      const decoded = {};
      Object.entries(raw).forEach(([pageKey, pageRegions]) => {
        const decodedPageKey = decodeFirebaseKey(pageKey);
        decoded[decodedPageKey] = decodeFirebaseObject(pageRegions);
      });
      cb(decoded);
    });
  }
};

export default registryService;
