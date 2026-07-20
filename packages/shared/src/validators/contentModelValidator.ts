import { ContentModel } from '../types/contentModel';

export function validateContentModel(model: unknown): model is ContentModel {
  if (!model || typeof model !== 'object') return false;
  const m = model as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.label === 'string' &&
    Array.isArray(m.fields) &&
    (m.slugRule === 'title' || m.slugRule === 'date-title' || m.slugRule === 'id' || m.slugRule === 'custom')
  );
}
