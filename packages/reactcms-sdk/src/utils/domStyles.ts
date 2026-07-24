export interface ElementComputedStyle {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  align?: string;
}

export function rgbToHex(colorStr: string): string | null {
  if (!colorStr) return null;
  if (colorStr.startsWith('#')) return colorStr;
  const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function getElementComputedStyle(el: HTMLElement | null): ElementComputedStyle {
  if (!el || typeof window === 'undefined') return {};
  try {
    const cs = window.getComputedStyle(el);
    const colorHex = rgbToHex(cs.color) || cs.color;
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      color: colorHex,
      align: cs.textAlign,
    };
  } catch {
    return {};
  }
}
