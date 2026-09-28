import { describe, expect, it } from 'vitest';
import { ensureArrayItemIds } from './arrayItemIdentity';

describe('repeatable field row identities', () => {
  it.each([
    [{ question: 'First' }, { question: 'Second' }],
    [{ id: 'same', question: 'First' }, { id: 'same', question: 'Second' }],
  ])('keeps edits and deletion isolated for legacy items: %j', (...rows) => {
    const items = ensureArrayItemIds(rows);
    const edited = items.map(item => item.id === items[0].id ? { ...item, question: 'Changed' } : item);
    expect(edited.map(item => item.question)).toEqual(['Changed', 'Second']);
    expect(items.filter(item => item.id !== items[0].id)).toEqual([items[1]]);
    expect(ensureArrayItemIds(edited)).toEqual(edited);
    expect(rows[0].question).toBe('First');
  });
  it('preserves valid IDs and avoids collisions with generated identities', () => {
    const rows = [{ id: 'rcms-item-1' }, {}, { id: 'stable' }];
    const items = ensureArrayItemIds(rows);
    expect(new Set(items.map(item => item.id)).size).toBe(3);
    expect(items[0]).toBe(rows[0]);
    expect(items[2]).toBe(rows[2]);
  });
});
