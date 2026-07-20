import { ThemeTokens } from '@anshif.rainhopes/shared';

export function themeTokensToCssVars(theme: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  // Colors
  vars['--rcms-color-primary'] = theme.colors.primary;
  vars['--rcms-color-secondary'] = theme.colors.secondary;
  vars['--rcms-color-accent'] = theme.colors.accent;
  vars['--rcms-color-background'] = theme.colors.background;
  vars['--rcms-color-text'] = theme.colors.text;
  vars['--rcms-color-dark-background'] = theme.colors.darkBackground;
  vars['--rcms-color-dark-text'] = theme.colors.darkText;

  // Typography
  vars['--rcms-font-heading'] = theme.typography.headingFont;
  vars['--rcms-font-body'] = theme.typography.bodyFont;
  vars['--rcms-font-size-base'] = theme.typography.baseSize;
  vars['--rcms-line-height'] = theme.typography.lineHeight;
  vars['--rcms-letter-spacing'] = theme.typography.letterSpacing;

  // Spacing
  vars['--rcms-spacing-xs'] = theme.spacing.xs;
  vars['--rcms-spacing-sm'] = theme.spacing.sm;
  vars['--rcms-spacing-md'] = theme.spacing.md;
  vars['--rcms-spacing-lg'] = theme.spacing.lg;
  vars['--rcms-spacing-xl'] = theme.spacing.xl;
  vars['--rcms-spacing-xxl'] = theme.spacing.xxl;

  // Border Radius
  vars['--rcms-radius-sm'] = theme.borderRadius.sm;
  vars['--rcms-radius-md'] = theme.borderRadius.md;
  vars['--rcms-radius-lg'] = theme.borderRadius.lg;
  vars['--rcms-radius-full'] = theme.borderRadius.full;

  // Container Width
  vars['--rcms-container-sm'] = theme.containerWidth.sm;
  vars['--rcms-container-md'] = theme.containerWidth.md;
  vars['--rcms-container-lg'] = theme.containerWidth.lg;
  vars['--rcms-container-xl'] = theme.containerWidth.xl;
  vars['--rcms-container-full'] = theme.containerWidth.full;

  // Buttons
  vars['--rcms-button-radius'] = theme.buttons.borderRadius;
  vars['--rcms-button-weight'] = theme.buttons.fontWeight;
  vars['--rcms-button-px'] = theme.buttons.paddingX;
  vars['--rcms-button-py'] = theme.buttons.paddingY;

  return vars;
}
