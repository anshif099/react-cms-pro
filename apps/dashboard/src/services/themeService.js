import { database } from "../lib/firebase";
import { ref, get, set } from "firebase/database";
import activityLogService from "./activityLogService";

const DEFAULT_THEME = {
  branding: {
    siteName: "",
    logo: "",
    tagline: ""
  },
  colors: {
    primary: "#3b82f6",
    secondary: "#1e293b",
    accent: "#f59e0b",
    background: "#ffffff",
    text: "#0f172a"
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Roboto",
    baseSize: "16px"
  },
  buttons: {
    borderRadius: "8px",
    fontWeight: "600"
  }
};

export const themeService = {
  async getTheme(websiteId) {
    const themeRef = ref(database, `content/${websiteId}/theme`);
    const snapshot = await get(themeRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        branding: { ...DEFAULT_THEME.branding, ...data.branding },
        colors: { ...DEFAULT_THEME.colors, ...data.colors },
        typography: { ...DEFAULT_THEME.typography, ...data.typography },
        buttons: { ...DEFAULT_THEME.buttons, ...data.buttons }
      };
    }
    return DEFAULT_THEME;
  },

  async saveTheme(websiteId, tokens) {
    const themeRef = ref(database, `content/${websiteId}/theme`);
    await set(themeRef, tokens);

    await activityLogService.logActivity(
      "theme_update",
      "Branding & Theme Tokens Synced",
      "Global design layout styles tokens pushed to SDK client successfully",
      websiteId
    );
    return true;
  }
};

export default themeService;
