import { useState, useEffect, useCallback } from "react";
import settingsService from "../services/settingsService";
import useToast from "./useToast";

export function useLocale(websiteId) {
  const [activeLocale, setActiveLocale] = useState("en");
  const [activeLocales, setActiveLocales] = useState(["en"]);
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadLocaleSettings = useCallback(async () => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const data = await settingsService.getCMSSettings(websiteId);
      setActiveLocales(data.activeLocales || ["en"]);
      setDefaultLocale(data.defaultLocale || "en");
      // Initially, active locale defaults to the default locale
      setActiveLocale(data.defaultLocale || "en");
    } catch (err) {
      console.error("Failed to load locale settings:", err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    loadLocaleSettings();
  }, [loadLocaleSettings]);

  const changeLocale = useCallback((localeCode) => {
    if (activeLocales.includes(localeCode)) {
      setActiveLocale(localeCode);
    } else {
      console.warn(`Locale ${localeCode} is not active for this website.`);
    }
  }, [activeLocales]);

  const updateLocales = useCallback(async (newDefault, newActiveList) => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const payload = {
        defaultLocale: newDefault,
        activeLocales: newActiveList
      };
      await settingsService.updateCMSSettings(websiteId, payload);
      setDefaultLocale(newDefault);
      setActiveLocales(newActiveList);
      if (!newActiveList.includes(activeLocale)) {
        setActiveLocale(newDefault);
      }
      toast.success("Locale settings updated successfully.");
    } catch (err) {
      toast.error("Failed to update locale settings.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, activeLocale, toast]);

  return {
    activeLocale,
    activeLocales,
    defaultLocale,
    setLocale: changeLocale,
    updateLocales,
    loading
  };
}

export default useLocale;
