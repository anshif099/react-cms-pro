export interface RouteEntry {
  id: string;
  path: string;
  title: string;
  layout?: string;
  contentModel?: string;
  source: 'registered' | 'cms-generated' | 'cms' | 'generated' | 'imported';
  published: boolean;
  createdAt?: number;
  slug?: string;
}
