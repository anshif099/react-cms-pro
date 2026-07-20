export interface PageBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

export interface PageSEO {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  focusKeyword?: string;
  robots?: string;
  jsonLd?: string;
}

export interface PageLocale {
  title: string;
  slug: string;
  seo: PageSEO;
  blocks: PageBlock[];
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  source: 'cms' | 'imported' | 'generated';
  isImported: boolean;
  routeId?: string;
  route?: string;
  locales: Record<string, PageLocale>;
  contentTypeRefs?: string[];
  lastSynced?: number;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}
