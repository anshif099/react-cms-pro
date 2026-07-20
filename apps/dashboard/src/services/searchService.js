import { database } from "../lib/firebase";
import { ref, set, remove, get } from "firebase/database";

// v2.0: RTDBSearchProvider — writes flat search indexes to RTDB
// and performs in-memory client-side searches.
const RTDBSearchProvider = {
  async index(websiteId, docId, doc) {
    const docRef = ref(database, `searchIndex/${websiteId}/${docId}`);
    await set(docRef, {
      id: docId,
      type: doc.type, // 'page' | 'media'
      title: doc.title || "",
      slug: doc.slug || "",
      excerpt: doc.excerpt || "",
      locales: doc.locales || {}, // Store searchable locale content: { en: { title, description }, ... }
      updatedAt: Date.now()
    });
  },

  async removeFromIndex(websiteId, docId) {
    const docRef = ref(database, `searchIndex/${websiteId}/${docId}`);
    await remove(docRef);
  },

  async search(websiteId, searchQuery, locale = "en") {
    const indexRef = ref(database, `searchIndex/${websiteId}`);
    const snapshot = await get(indexRef);
    if (!snapshot.exists()) return [];

    const val = snapshot.val();
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return [];

    const results = [];
    for (const key of Object.keys(val)) {
      const item = val[key];
      let matches = false;

      // Check top-level (neutral) fields
      if (
        (item.title && item.title.toLowerCase().includes(queryLower)) ||
        (item.slug && item.slug.toLowerCase().includes(queryLower)) ||
        (item.excerpt && item.excerpt.toLowerCase().includes(queryLower))
      ) {
        matches = true;
      }

      // Check locale-specific fields
      if (item.locales && item.locales[locale]) {
        const loc = item.locales[locale];
        if (
          (loc.title && loc.title.toLowerCase().includes(queryLower)) ||
          (loc.description && loc.description.toLowerCase().includes(queryLower)) ||
          (loc.excerpt && loc.excerpt.toLowerCase().includes(queryLower))
        ) {
          matches = true;
        }
      }

      if (matches) {
        results.push({
          id: item.id,
          type: item.type,
          title: item.locales?.[locale]?.title || item.title || item.slug || "Untitled",
          slug: item.locales?.[locale]?.slug || item.slug || "",
          excerpt: item.locales?.[locale]?.excerpt || item.excerpt || "",
          updatedAt: item.updatedAt
        });
      }
    }

    return results;
  }
};

// Active provider in v2.0
const activeProvider = RTDBSearchProvider;

export const searchService = {
  async index(websiteId, docId, doc) {
    try {
      await activeProvider.index(websiteId, docId, doc);
      return true;
    } catch (error) {
      console.error(`Failed to index document ${docId}:`, error);
      return false;
    }
  },

  async removeFromIndex(websiteId, docId) {
    try {
      await activeProvider.removeFromIndex(websiteId, docId);
      return true;
    } catch (error) {
      console.error(`Failed to remove document ${docId} from index:`, error);
      return false;
    }
  },

  async search(websiteId, query, locale = "en") {
    try {
      return await activeProvider.search(websiteId, query, locale);
    } catch (error) {
      console.error(`Search failed for query "${query}":`, error);
      return [];
    }
  }
};

export default searchService;
