import React, { createContext, useState, useContext, useCallback, useMemo } from "react";
import searchService from "../services/searchService";
import useToast from "../hooks/useToast";

const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const toast = useToast();

  const search = useCallback(async (websiteId, searchQuery, locale = "en") => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return [];
    }

    setSearching(true);
    try {
      const list = await searchService.search(websiteId, searchQuery, locale);
      setResults(list);
      return list;
    } catch (error) {
      toast.error("Failed to perform search query.");
      console.error(error);
      return [];
    } finally {
      setSearching(false);
    }
  }, [toast]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  const value = useMemo(() => ({
    results,
    query,
    searching,
    search,
    clearSearch,
    setQuery
  }), [
    results,
    query,
    searching,
    search,
    clearSearch
  ]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchContext must be used within a SearchProvider");
  }
  return context;
}
