import { websiteService } from "./websiteService";
import { registryService } from "./registryService";
import { database } from "../lib/firebase";
import { ref, get } from "firebase/database";

export const sdkService = {
  getInstallCommand() {
    return 'npm install "@anshif.rainhopes/reactcms-sdk" "@anshif.rainhopes/reactcms-runtime"';
  },

  getProviderSnippet(website) {
    if (!website) return "";
    return `import { RuntimeProvider, CMSLayout, CMSNavigation } from '@anshif.rainhopes/reactcms-runtime';
import { RouteRegistry } from '@anshif.rainhopes/reactcms-runtime';
import { routes } from './routes'; // Your React Router routes array

function App() {
  return (
    <RuntimeProvider
      websiteId="${website.id}"
      apiKey="${website.apiKey}"
      routes={routes}
    >
      {/* Declare layout templates */}
      <CMSLayout id="default" label="Default Layout" component={DefaultLayout} isDefault />

      {/* Render CMS dynamic pages */}
      <RouteRegistry websiteId="${website.id}" apiKey="${website.apiKey}" />
      <MyWebsiteContent />
    </RuntimeProvider>
  );
}`;
  },

  async testConnection(id) {
    // Check real Firestore/Firebase status
    const website = await websiteService.getById(id);
    if (!website) {
      throw new Error("Website not found.");
    }
    
    // Check if website has heartbeat or runtime registered in Firebase Realtime Database
    const runtimeStatus = await registryService.getRuntimeStatus(id);

    if (runtimeStatus && (runtimeStatus.status === "online" || runtimeStatus.heartbeat)) {
      const updated = await websiteService.update(id, {
        sdkInstalled: true,
        status: "connected",
        sdkVersion: runtimeStatus.sdkVersion || "1.0.0",
        connectionHealth: "healthy"
      });
      return { success: true, website: updated };
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
