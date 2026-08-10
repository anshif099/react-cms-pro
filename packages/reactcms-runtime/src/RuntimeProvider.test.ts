import { describe, expect, it } from 'vitest';
import { runtimeRegionContentSource } from './RuntimeProvider';

describe('runtimeRegionContentSource', () => {
  it('hydrates saved draft fields while editing', () => {
    expect(runtimeRegionContentSource(true)).toBe('draft');
  });

  it('hydrates published fields on the public site', () => {
    expect(runtimeRegionContentSource(false)).toBe('published');
  });
});
