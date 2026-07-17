import { websiteService } from "./websiteService";
import activityLogService from "./activityLogService";

export const verificationService = {
  async getVerificationCode(id) {
    const website = await websiteService.getById(id);
    return website ? website.verificationCode : null;
  },

  generateMetaTag(code) {
    return `<meta name="reactcms-verification" content="${code}">`;
  },

  generateDNSRecord(code) {
    return `reactcms-verification=${code}`;
  },

  generateFileContent(code) {
    return `reactcms-verification=${code}`;
  },

  async verifyDomain(id, method) {
    // We simulate a short network latency for UX, but do NOT automatically verify the domain.
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const website = await websiteService.getById(id);
    if (!website) {
      throw new Error("Website not found.");
    }
    
    // Set status to pending verification
    // TODO: Real domain verification must be performed by a backend service that fetches
    // the target domain's meta tag / DNS record and compares it to the verificationCode in Firestore.
    // Once the backend verifies the domain, it should set verificationStatus to 'verified',
    // status to 'connected', and connectionHealth to 'healthy'.
    const updated = await websiteService.update(id, {
      verificationStatus: "pending",
      status: "pending",
      connectionHealth: "unknown"
    });

    await activityLogService.logActivity(
      "website_verified",
      "Domain verification requested",
      `Verification attempt initiated via ${method} for ${website.name}`,
      id
    );
    
    return { success: true, website: updated };
  }
};

export default verificationService;
