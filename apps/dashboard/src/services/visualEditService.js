export const visualEditService = {
  enableEditMode(iframe, targetDomain) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      iframe.contentWindow.postMessage(
        { type: "RCMS_ENTER_EDIT_MODE" },
        origin
      );
    } catch (err) {
      console.warn("Failed to enable Visual Edit Mode in frame:", err);
    }
  },

  disableEditMode(iframe, targetDomain) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      iframe.contentWindow.postMessage(
        { type: "RCMS_EXIT_EDIT_MODE" },
        origin
      );
    } catch (err) {
      console.warn("Failed to disable Visual Edit Mode in frame:", err);
    }
  },

  sendFieldUpdate(iframe, targetDomain, blockId, fieldKey, value) {
    if (!iframe || !targetDomain) return;
    try {
      const origin = new URL(targetDomain).origin;
      iframe.contentWindow.postMessage(
        {
          type: "RCMS_FIELD_UPDATE",
          blockId,
          fieldKey,
          value
        },
        origin
      );
    } catch (err) {
      console.warn("Failed to dispatch visual field update message to frame:", err);
    }
  }
};

export default visualEditService;
