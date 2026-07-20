import { useState, useCallback } from "react";
import seoService from "../services/seoService";
import { useToast } from "./useToast";

export function useSEO(websiteId) {
  const [loading, setLoading] = useState(false);
  const [seoConfig, setSeoConfig] = useState({
    robotsTxt: "User-agent: *\nAllow: /",
    redirects: [],
    sitemap: ""
  });
  const toast = useToast();

  const fetchSEOConfig = useCallback(async () => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const data = await seoService.getSEOConfig(websiteId);
      setSeoConfig(data);
      return data;
    } catch (err) {
      console.error(err);
      toast.error("Failed to load website SEO configurations.");
    } finally {
      setLoading(false);
    }
  }, [websiteId, toast]);

  const saveRobotsTxt = useCallback(async (text) => {
    if (!websiteId) return;
    setLoading(true);
    try {
      await seoService.saveRobotsTxt(websiteId, text);
      setSeoConfig(prev => ({ ...prev, robotsTxt: text }));
      toast.success("Robots.txt updated successfully.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to update robots.txt.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [websiteId, toast]);

  const saveRedirects = useCallback(async (rules) => {
    if (!websiteId) return;
    setLoading(true);
    try {
      await seoService.saveRedirects(websiteId, rules);
      setSeoConfig(prev => ({ ...prev, redirects: rules }));
      toast.success("Redirect rules saved successfully.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to save redirect rules.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [websiteId, toast]);

  const generateSitemap = useCallback(async (domain, pages) => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const xml = await seoService.generateSitemap(websiteId, domain, pages);
      setSeoConfig(prev => ({ ...prev, sitemap: xml }));
      toast.success("Sitemap XML generated successfully.");
      return xml;
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate sitemap.");
    } finally {
      setLoading(false);
    }
  }, [websiteId, toast]);

  const analyzeWebsite = useCallback(async () => {
    if (!websiteId) return { score: 100, issues: [], pagesAnalyzedCount: 0 };
    setLoading(true);
    try {
      const result = await seoService.analyzeWebsite(websiteId);
      return result;
    } catch (err) {
      console.error(err);
      toast.error("Failed to run website SEO scan.");
      return { score: 0, issues: [], pagesAnalyzedCount: 0 };
    } finally {
      setLoading(false);
    }
  }, [websiteId, toast]);

  return {
    loading,
    seoConfig,
    fetchSEOConfig,
    saveRobotsTxt,
    saveRedirects,
    generateSitemap,
    analyzeWebsite
  };
}

export default useSEO;
