import React, { createContext, useState, useContext, useCallback, useMemo } from "react";
import globalService from "../services/globalService";
import useToast from "../hooks/useToast";

const GlobalContext = createContext(null);

export function GlobalProvider({ children }) {
  const [globalContent, setGlobalContent] = useState({
    logo: "",
    phone: "",
    email: "",
    address: "",
    footer: "",
    socialLinks: [],
    settings: {}
  });
  const [globalLoading, setGlobalLoading] = useState(false);
  const toast = useToast();

  const fetchGlobal = useCallback(async (websiteId, locale = "en") => {
    setGlobalLoading(true);
    try {
      const data = await globalService.get(websiteId, locale);
      setGlobalContent(data);
      return data;
    } catch (error) {
      toast.error("Failed to load global content.");
      console.error(error);
      return null;
    } finally {
      setGlobalLoading(false);
    }
  }, [toast]);

  const updateGlobal = useCallback(async (websiteId, locale, data, publish = false) => {
    setGlobalLoading(true);
    try {
      const updated = await globalService.update(websiteId, locale, data, publish);
      setGlobalContent(updated);
      toast.success(publish ? "Global content published successfully." : "Global content saved as draft.");
      return updated;
    } catch (error) {
      toast.error("Failed to update global content.");
      console.error(error);
      throw error;
    } finally {
      setGlobalLoading(false);
    }
  }, [toast]);

  const value = useMemo(() => ({
    globalContent,
    globalLoading,
    fetchGlobal,
    updateGlobal,
    setGlobalContent
  }), [
    globalContent,
    globalLoading,
    fetchGlobal,
    updateGlobal
  ]);

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalProvider");
  }
  return context;
}
