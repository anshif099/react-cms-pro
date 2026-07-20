export interface RouteEntry {
  id: string;
  path: string;
  title: string;
  layout?: string;
  contentModel?: string;
  source: 'registered' | 'cms-generated';
  published: boolean;
  createdAt?: number;
}
