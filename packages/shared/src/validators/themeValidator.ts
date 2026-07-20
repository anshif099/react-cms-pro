import { ThemeTokens } from '../types/theme';

export function validateTheme(theme: unknown): theme is ThemeTokens {
  if (!theme || typeof theme !== 'object') return false;
  const t = theme as Record<string, unknown>;
  return (
    t.branding !== undefined &&
    t.colors !== undefined &&
    t.typography !== undefined &&
    t.spacing !== undefined &&
    t.borderRadius !== undefined &&
    t.containerWidth !== undefined &&
    t.breakpoints !== undefined &&
    t.buttons !== undefined &&
    t.darkMode !== undefined
  );
}
