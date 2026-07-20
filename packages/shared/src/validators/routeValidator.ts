import { RouteEntry } from '../types/route';

export function validateRoute(route: unknown): route is RouteEntry {
  if (!route || typeof route !== 'object') return false;
  const r = route as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.path === 'string' &&
    typeof r.title === 'string' &&
    (r.source === 'registered' || r.source === 'cms-generated') &&
    typeof r.published === 'boolean'
  );
}
