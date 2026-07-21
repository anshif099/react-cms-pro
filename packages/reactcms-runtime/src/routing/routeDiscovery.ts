import { RouteEntry } from '@anshif.rainhopes/shared';

interface ReactRouteObject {
  path?: string;
  index?: boolean;
  children?: ReactRouteObject[];
  [key: string]: any;
}

function normalizePathToId(path: string): string {
  if (!path || path === '/') return 'home';
  return path
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '') // remove leading/trailing slashes
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

export function discoverRoutes(
  routes: ReactRouteObject[],
  parentPath = ''
): RouteEntry[] {
  const result: RouteEntry[] = [];

  for (const route of routes) {
    // Determine path
    let currentPath = route.path || '';
    if (route.index) {
      currentPath = '';
    }

    // Join with parent path
    let fullPath = '';
    if (currentPath === '') {
      fullPath = parentPath || '/';
    } else {
      fullPath = `${parentPath.replace(/\/$/, '')}/${currentPath.replace(/^\//, '')}`;
      if (!fullPath.startsWith('/')) {
        fullPath = `/${fullPath}`;
      }
    }

    const routeId = normalizePathToId(fullPath);

    // If it's a renderable route
    if (route.path !== undefined || route.index) {
      const entry: RouteEntry = {
        id: routeId,
        path: fullPath,
        title: route.title || route.id || routeId.charAt(0).toUpperCase() + routeId.slice(1),
        layout: route.layout || 'default',
        source: 'registered',
        published: true,
      };

      if (route.contentModel) {
        entry.contentModel = route.contentModel;
      }
      if (route.createdAt) {
        entry.createdAt = route.createdAt;
      }

      result.push(entry);
    }

    // Recurse children
    if (route.children && Array.isArray(route.children)) {
      result.push(...discoverRoutes(route.children, fullPath));
    }
  }

  // Deduplicate by path
  const seen = new Set<string>();
  return result.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}
