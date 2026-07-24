import { describe, it, expect } from 'vitest';
import {
  encodeFirebaseKey,
  decodeFirebaseKey,
  encodeFirebaseObject,
  decodeFirebaseObject,
} from './keyUtils';

describe('keyUtils', () => {
  it('should encode keys with invalid Firebase RTDB characters', () => {
    expect(encodeFirebaseKey('hero.title')).toBe('hero~2Etitle');
    expect(encodeFirebaseKey('hero.subtitle#1')).toBe('hero~2Esubtitle~231');
    expect(encodeFirebaseKey('price$')).toBe('price~24');
    expect(encodeFirebaseKey('path/to/key')).toBe('path~2Fto~2Fkey');
    expect(encodeFirebaseKey('arr[0]')).toBe('arr~5B0~5D');
    expect(encodeFirebaseKey('tilde~key')).toBe('tilde~7Ekey');
  });

  it('should decode encoded Firebase RTDB keys', () => {
    expect(decodeFirebaseKey('hero~2Etitle')).toBe('hero.title');
    expect(decodeFirebaseKey('hero~2Esubtitle~231')).toBe('hero.subtitle#1');
    expect(decodeFirebaseKey('price~24')).toBe('price$');
    expect(decodeFirebaseKey('path~2Fto~2Fkey')).toBe('path/to/key');
    expect(decodeFirebaseKey('arr~5B0~5D')).toBe('arr[0]');
    expect(decodeFirebaseKey('tilde~7Ekey')).toBe('tilde~key');
  });

  it('should recursively encode and decode objects', () => {
    const raw = {
      'hero.title': 'Welcome',
      'hero.subtitle': 'To the platform',
      nested: {
        'item.key': 'val',
      },
    };

    const encoded = encodeFirebaseObject(raw);
    expect(encoded).toEqual({
      'hero~2Etitle': 'Welcome',
      'hero~2Esubtitle': 'To the platform',
      nested: {
        'item~2Ekey': 'val',
      },
    });

    const decoded = decodeFirebaseObject(encoded);
    expect(decoded).toEqual(raw);
  });
});
