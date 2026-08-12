import { describe, expect, it } from 'vitest';
import {
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
