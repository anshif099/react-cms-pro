import { websiteService } from "./websiteService";
import { database } from "../lib/firebase";
import { ref, get } from "firebase/database";

export const sdkService = {
  getInstallCommand() {
    return 'npm install "@anshif.rainhopes/reactcms-sdk"';
  },

  getProviderSnippet(website) {
    if (!website) return "";
    return `import { CMSProvider } from '@anshif.rainhopes/reactcms-sdk';

function App() {
  return (
    <CMSProvider
      websiteId="${website.id}"
      apiKey="${website.apiKey}"
      environment="production"
    >
      <MyWebsiteContent />
    </CMSProvider>
  );
}`;
  },

  async testConnection(id) {
    // Check real Firestore status
    const website = await websiteService.getById(id);
    if (!website) {
      throw new Error("Website not found.");
    }
    
    if (website.sdkInstalled) {
      return { success: true, website };
    } else {
      throw new Error("SDK not detected on your website yet. Check configuration and refresh.");
    }
  },

  async getThemeSettings(websiteId) {
    const themeRef = ref(database, `content/${websiteId}/theme`);
    const snapshot = await get(themeRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  async getRedirectRules(websiteId) {
    const redirectsRef = ref(database, `content/${websiteId}/seo/redirects`);
    const snapshot = await get(redirectsRef);
    return snapshot.exists() ? snapshot.val() : [];
  },

  async getActivePlugins(websiteId) {
    const pluginsRef = ref(database, `content/${websiteId}/plugins`);
    const snapshot = await get(pluginsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Filter out only active enabled plugins
      const active = {};
      Object.keys(data).forEach(key => {
        if (data[key]?.enabled) {
          active[key] = data[key];
        }
      });
      return active;
    }
    return {};
  }
};

export default sdkService;
