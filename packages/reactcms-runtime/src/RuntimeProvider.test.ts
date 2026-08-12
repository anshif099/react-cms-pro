import { describe, expect, it } from 'vitest';
import {
  pageSEOFromContent,
  registerEditableRegionState,
  runtimeRegionContentSource,
  unregisterEditableRegionState,
} from './RuntimeProvider';

describe('runtimeRegionContentSource', () => {
  it('hydrates saved draft fields while editing', () => {
    expect(runtimeRegionContentSource(true)).toBe('draft');
  });

  it('hydrates published fields on the public site', () => {
    expect(runtimeRegionContentSource(false)).toBe('published');
  });
});

describe('pageSEOFromContent', () => {
  it('reads SEO metadata from a synchronized page document', () => {
    expect(pageSEOFromContent({
      regions: {},
      seo: { metaTitle: 'API Advertising', jsonLd: '{"@type":"WebPage"}' },
    })).toEqual({
      metaTitle: 'API Advertising',
      jsonLd: '{"@type":"WebPage"}',
    });
  });

  it('ignores missing or invalid SEO values', () => {
    expect(pageSEOFromContent({ regions: {} })).toBeNull();
    expect(pageSEOFromContent({ seo: 'not-an-object' })).toBeNull();
  });
});

describe('editable region registry state', () => {
  it('keeps the same state identity when an existing region registers again', () => {
    const initial = registerEditableRegionState(
      {},
      'ad',
      'ad.heading',
      'text',
      'Heading',
      'API KEY',
    );

    expect(registerEditableRegionState(
      initial,
      'ad',
      'ad.heading',
      'text',
      'Heading',
      'API KEY',
    )).toBe(initial);
  });

  it('keeps the same state identity when an absent region unregisters', () => {
    const initial = registerEditableRegionState(
      {},
      'ad',
      'ad.heading',
      'text',
      'Heading',
      'API KEY',
    );

    expect(unregisterEditableRegionState(initial, 'ad', 'missing')).toBe(initial);
  });
});
