import { EVENT_TYPES } from "@anshif.rainhopes/shared";

function createThemeMessage(websiteId, themeTokens) {
  return {
    rcms: true,
    version: "v1",
    type: EVENT_TYPES["theme-update"],
    websiteId: websiteId || "",
    payload: themeTokens || {},
    timestamp: Date.now()
  };
}

export const themePreviewService = {
  sendThemeUpdate(iframe, websiteId, themeTokens) {
    if (!iframe) return;

    try {
      const message = createThemeMessage(websiteId, themeTokens);
      iframe.contentWindow.postMessage(message, "*");
    } catch (error) {
      console.warn("Failed to dispatch live theme update to preview frame:", error);
    }
  }
};

export default themePreviewService;
