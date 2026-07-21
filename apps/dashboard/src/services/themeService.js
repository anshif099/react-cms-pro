import { database } from "../lib/firebase";
import { ref, get, set } from "firebase/database";
import { paths } from "@anshif.rainhopes/shared";
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
    const themeRef = ref(database, paths.contentTheme(websiteId));
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
    // Write resolved values to content path
    const contentThemeRef = ref(database, paths.contentTheme(websiteId));
    await set(contentThemeRef, tokens);

    // Write design tokens metadata to registry path
    const registryThemeRef = ref(database, paths.registryTheme(websiteId));
    await set(registryThemeRef, tokens);

    await activityLogService.logActivity(
      "theme_update",
      "Branding & Theme Tokens Synced",
      "Global design layout styles tokens pushed to SDK client & registry successfully",
      websiteId
    );
    return true;
  }
};

export default themeService;
