import { database } from "../lib/firebase";
import { ref, get, onValue, set } from "firebase/database";
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
    text: "#0f172a",
    darkBackground: "#070b14",
    darkText: "#f8fafc"
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Roboto",
    baseSize: "16px",
    lineHeight: "1.5",
    letterSpacing: "0"
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px"
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px"
  },
  containerWidth: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    full: "100%"
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px"
  },
  buttons: {
    borderRadius: "8px",
    fontWeight: "600",
    paddingX: "16px",
    paddingY: "10px"
  },
  darkMode: {
    enabled: false,
    strategy: "class"
  }
};

const THEME_GROUPS = [
  "branding",
  "colors",
  "typography",
  "spacing",
  "borderRadius",
  "containerWidth",
  "breakpoints",
  "buttons",
  "darkMode"
];

export function normalizeThemeTokens(tokens = {}) {
  const normalized = { ...DEFAULT_THEME, ...(tokens || {}) };
  THEME_GROUPS.forEach((group) => {
    normalized[group] = {
      ...DEFAULT_THEME[group],
      ...(tokens?.[group] || {})
    };
  });
  return normalized;
}

export const themeService = {
  async getTheme(websiteId) {
    const themeRef = ref(database, paths.contentTheme(websiteId));
    const snapshot = await get(themeRef);
    if (snapshot.exists()) {
      return normalizeThemeTokens(snapshot.val());
    }
    return normalizeThemeTokens();
  },

  async saveTheme(websiteId, tokens) {
    const normalizedTokens = normalizeThemeTokens(tokens);
    // Write resolved values to content path
    const contentThemeRef = ref(database, paths.contentTheme(websiteId));
    await set(contentThemeRef, normalizedTokens);

    // Write design tokens metadata to registry path
    const registryThemeRef = ref(database, paths.registryTheme(websiteId));
    await set(registryThemeRef, normalizedTokens);

    await activityLogService.logActivity(
      "theme_update",
      "Branding & Theme Tokens Synced",
      "Global design layout styles tokens pushed to SDK client & registry successfully",
      websiteId
    );
    return true;
  },

  subscribeTheme(websiteId, callback) {
    const themeRef = ref(database, paths.contentTheme(websiteId));
    return onValue(themeRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(normalizeThemeTokens());
        return;
      }
      callback(normalizeThemeTokens(snapshot.val()));
    });
  }
};

export default themeService;
