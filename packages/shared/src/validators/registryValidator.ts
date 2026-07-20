import { ProjectRegistry } from '../types/registry';

export function validateRegistry(registry: unknown): registry is ProjectRegistry {
  if (!registry || typeof registry !== 'object') return false;
  const r = registry as Record<string, unknown>;
  return (
    r.meta !== undefined &&
    r.runtime !== undefined &&
    r.routes !== undefined &&
    r.layouts !== undefined &&
    r.navigation !== undefined &&
    r.theme !== undefined &&
    r.contentModels !== undefined
  );
}
