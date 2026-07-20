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
    // We simulate a short network latency for UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const website = await websiteService.getById(id);
    if (!website) {
      throw new Error("Website not found.");
    }
    
    // Set status to verified instantly as requested by user
    const updated = await websiteService.update(id, {
      verificationStatus: "verified",
      status: "connected",
      connectionHealth: "healthy"
    });

    await activityLogService.logActivity(
      "website_verified",
      "Domain verified",
      `Website ${website.name} verified successfully via ${method}`,
      id
    );
    
    return { success: true, website: updated };
  }
};

export default verificationService;
