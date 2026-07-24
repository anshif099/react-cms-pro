import { EVENT_TYPES, paths, encodeFirebaseKey } from "@anshif.rainhopes/shared";
import { database } from "../lib/firebase";
import { ref, set } from "firebase/database";

function createMessage(type, websiteId, payload) {
  return {
    rcms: true,
    version: "v1",
    type,
    websiteId: websiteId || "",
    payload: payload || {},
    timestamp: Date.now()
  };
}

export const visualEditService = {
  enableEditMode(iframe, targetDomain, websiteId) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      const msg = createMessage(EVENT_TYPES["enter-edit-mode"], websiteId, {});
      iframe.contentWindow.postMessage(msg, origin);
    } catch (err) {
      console.warn("Failed to enable Visual Edit Mode in frame:", err);
    }
  },

  disableEditMode(iframe, targetDomain, websiteId) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      const msg = createMessage(EVENT_TYPES["exit-edit-mode"], websiteId, {});
      iframe.contentWindow.postMessage(msg, origin);
    } catch (err) {
      console.warn("Failed to disable Visual Edit Mode in frame:", err);
    }
  },

  sendFieldUpdate(iframe, targetDomain, websiteId, regionId, fieldKey, value) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      const msg = createMessage(EVENT_TYPES["field-update"], websiteId, {
        regionId,
        fieldKey,
        value
      });
      iframe.contentWindow.postMessage(msg, origin);
    } catch (err) {
      console.warn("Failed to dispatch visual field update message to frame:", err);
    }
  },

  sendThemeUpdate(iframe, targetDomain, websiteId, themeTokens) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      const msg = createMessage(EVENT_TYPES["theme-update"], websiteId, themeTokens);
      iframe.contentWindow.postMessage(msg, origin);
    } catch (err) {
      console.warn("Failed to dispatch live theme update to preview frame:", err);
    }
  },

  async persistFieldUpdate(websiteId, pageId, regionId, value) {
    if (!websiteId || !pageId || !regionId) return;
    try {
      const encodedRegionId = encodeFirebaseKey(regionId);
      const draftPath = `${paths.contentDraft(websiteId, pageId)}/${encodedRegionId}`;
      const draftRef = ref(database, draftPath);
      await set(draftRef, value);
    } catch (err) {
      console.error(`[visualEditService] Failed to persist field update to draft path:`, err);
    }
  }
};

export default visualEditService;
