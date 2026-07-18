import { websiteService } from "./websiteService";

export const sdkService = {
  getInstallCommand() {
    return "npm install @anshif.rainhopes/reactcms-sdk";
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
    
    // TODO: A real backend API/endpoint will handle pings from the @anshif.rainhopes/reactcms-sdk,
    // verify the API key, and set sdkInstalled = true in the Firestore document.
    // For now, we only query the status from Firestore.
    if (website.sdkInstalled) {
      return { success: true, website };
    } else {
      throw new Error("SDK not detected on your website yet. Check configuration and refresh.");
    }
  }
};

export default sdkService;
