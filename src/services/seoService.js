import { database } from "../lib/firebase";
import { ref, get, set, update, serverTimestamp } from "firebase/database";
import activityLogService from "./activityLogService";

export const seoService = {
  async getSEOConfig(websiteId) {
    const configRef = ref(database, `content/${websiteId}/seo`);
    const snapshot = await get(configRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        robotsTxt: data.robotsTxt || "User-agent: *\nAllow: /",
        redirects: data.redirects || [],
        sitemap: data.sitemap || ""
      };
    }
    return {
      robotsTxt: "User-agent: *\nAllow: /",
      redirects: [],
      sitemap: ""
    };
  },

  async saveRobotsTxt(websiteId, text) {
    const robotsRef = ref(database, `content/${websiteId}/seo/robotsTxt`);
    await set(robotsRef, text);
    
    await activityLogService.logActivity(
      "seo_robots_update",
      "Robots.txt Updated",
      "Custom robots.txt crawls rules updated successfully",
      websiteId
    );
    return true;
  },

  async saveRedirects(websiteId, rules) {
    const redirectsRef = ref(database, `content/${websiteId}/seo/redirects`);
    await set(redirectsRef, rules || []);
    
    await activityLogService.logActivity(
      "seo_redirects_update",
      "Redirect Rules Updated",
      `Saved ${rules?.length || 0} URL path redirect rules`,
      websiteId
    );
    return true;
  },

  async generateSitemap(websiteId, domain, pagesList) {
    const cleanDomain = domain.replace(/\/$/, "");
    let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    sitemapXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    pagesList.forEach((page) => {
      if (page.status === "archived") return;
      const slugPath = page.slug === "home" ? "" : page.slug;
      const loc = `${cleanDomain}/${slugPath}`;
      const lastMod = page.updatedAt 
        ? new Date(page.updatedAt).toISOString().split("T")[0] 
        : new Date().toISOString().split("T")[0];
      const priority = page.slug === "home" ? "1.0" : "0.8";

      sitemapXml += `  <url>\n`;
      sitemapXml += `    <loc>${loc}</loc>\n`;
      sitemapXml += `    <lastmod>${lastMod}</lastmod>\n`;
      sitemapXml += `    <priority>${priority}</priority>\n`;
      sitemapXml += `  </url>\n`;
    });

    sitemapXml += `</urlset>`;

    const sitemapRef = ref(database, `content/${websiteId}/seo/sitemap`);
    await set(sitemapRef, sitemapXml);

    await activityLogService.logActivity(
      "seo_sitemap_generate",
      "Sitemap XML Regenerated",
      `Created sitemap mapping ${pagesList.length} pages under ${cleanDomain}`,
      websiteId
    );

    return sitemapXml;
  },

  async analyzeWebsite(websiteId) {
    // 1. Fetch pages
    const pagesRef = ref(database, `pages`);
    const snapshot = await get(pagesRef);
    
    let allPages = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      allPages = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(page => page.websiteId === websiteId);
    }

    const issues = [];
    let totalScoreSum = 0;
    const activePages = allPages.filter(p => p.status !== "archived");

    if (activePages.length === 0) {
      return { score: 100, issues: [], pageAnalyzed: 0 };
    }

    activePages.forEach((page) => {
      let pageScore = 100;
      const seo = page.seo || {};

      // 1. Title Checks
      if (!seo.metaTitle) {
        pageScore -= 20;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "high",
          type: "missing_title",
          message: `Page "${page.title}" is missing a Meta Title Tag.`
        });
      } else if (seo.metaTitle.length > 60) {
        pageScore -= 5;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "low",
          type: "long_title",
          message: `Meta Title for "${page.title}" exceeds recommended 60 characters.`
        });
      }

      // 2. Description Checks
      if (!seo.metaDescription) {
        pageScore -= 25;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "high",
          type: "missing_description",
          message: `Page "${page.title}" has no Meta Description. Search engines will fallback to scrap snippets.`
        });
      } else if (seo.metaDescription.length > 160) {
        pageScore -= 5;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "low",
          type: "long_description",
          message: `Meta Description for "${page.title}" is longer than 160 characters.`
        });
      }

      // 3. Social sharing (Open Graph Image)
      if (!seo.ogImage) {
        pageScore -= 10;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "medium",
          type: "missing_og_image",
          message: `No Open Graph (OG) Image configured for "${page.title}". Social cards will lack custom thumbnail banners.`
        });
      }

      // 4. Canonical URL Checks
      if (!seo.canonicalUrl) {
        pageScore -= 10;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "medium",
          type: "missing_canonical",
          message: `Canonical Link Tag missing on "${page.title}". High duplication risk.`
        });
      }

      // 5. Focus Keyword Check
      if (!seo.focusKeyword) {
        pageScore -= 10;
        issues.push({
          pageId: page.id,
          pageTitle: page.title,
          severity: "low",
          type: "missing_focus_keyword",
          message: `No Focus Keyword targeted on "${page.title}".`
        });
      }

      totalScoreSum += Math.max(0, pageScore);
    });

    const averageScore = Math.round(totalScoreSum / activePages.length);

    return {
      score: averageScore,
      issues: issues.sort((a, b) => {
        const severityOrder = { high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      pagesAnalyzedCount: activePages.length
    };
  }
};

export default seoService;
