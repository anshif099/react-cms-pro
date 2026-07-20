import React, { createContext, useState, useContext, useCallback, useMemo } from "react";
import pageService from "../services/pageService";
import useToast from "../hooks/useToast";

const PageContext = createContext(null);

export function PageProvider({ children }) {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const toast = useToast();

  const fetchPages = useCallback(async (websiteId) => {
    setPageLoading(true);
    try {
      const list = await pageService.getAll(websiteId);
      setPages(list);
      return list;
    } catch (error) {
      toast.error("Failed to load pages.");
      console.error(error);
      return [];
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const fetchPageById = useCallback(async (websiteId, pageId) => {
    setPageLoading(true);
    try {
      const page = await pageService.getById(websiteId, pageId);
      setSelectedPage(page);
      return page;
    } catch (error) {
      toast.error("Failed to load page details.");
      console.error(error);
      return null;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const createPage = useCallback(async (websiteId, data) => {
    setPageLoading(true);
    try {
      const newPage = await pageService.create(websiteId, data);
      setPages((prev) => [newPage, ...prev]);
      toast.success(`Page "${newPage.title}" created successfully.`);
      return newPage;
    } catch (error) {
      toast.error("Failed to create page.");
      console.error(error);
      throw error;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const updatePage = useCallback(async (websiteId, pageId, locale, data) => {
    setPageLoading(true);
    try {
      const updated = await pageService.update(websiteId, pageId, locale, data);
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
      setSelectedPage((prev) => (prev && prev.id === pageId ? updated : prev));
      toast.success("Page updated successfully.");
      return updated;
    } catch (error) {
      toast.error("Failed to update page.");
      console.error(error);
      throw error;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const deletePage = useCallback(async (websiteId, pageId) => {
    setPageLoading(true);
    try {
      await pageService.delete(websiteId, pageId);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      setSelectedPage((prev) => (prev && prev.id === pageId ? null : prev));
      toast.success("Page deleted successfully.");
    } catch (error) {
      toast.error("Failed to delete page.");
      console.error(error);
      throw error;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const publishPage = useCallback(async (websiteId, pageId, userId) => {
    setPageLoading(true);
    try {
      const updated = await pageService.publish(websiteId, pageId, userId);
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
      setSelectedPage((prev) => (prev && prev.id === pageId ? updated : prev));
      toast.success("Page published successfully.");
      return updated;
    } catch (error) {
      toast.error("Failed to publish page.");
      console.error(error);
      throw error;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const unpublishPage = useCallback(async (websiteId, pageId) => {
    setPageLoading(true);
    try {
      const updated = await pageService.unpublish(websiteId, pageId);
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
      setSelectedPage((prev) => (prev && prev.id === pageId ? updated : prev));
      toast.success("Page unpublished successfully.");
      return updated;
    } catch (error) {
      toast.error("Failed to unpublish page.");
      console.error(error);
      throw error;
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const value = useMemo(() => ({
    pages,
    selectedPage,
    pageLoading,
    fetchPages,
    fetchPageById,
    createPage,
    updatePage,
    deletePage,
    publishPage,
    unpublishPage,
    setSelectedPage
  }), [
    pages,
    selectedPage,
    pageLoading,
    fetchPages,
    fetchPageById,
    createPage,
    updatePage,
    deletePage,
    publishPage,
    unpublishPage
  ]);

  return (
    <PageContext.Provider value={value}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("usePageContext must be used within a PageProvider");
  }
  return context;
}
