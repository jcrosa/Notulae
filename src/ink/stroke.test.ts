import { describe, it, expect } from 'vitest';
import { createStroke } from './stroke.ts';

describe('createStroke', () => {
  it('crea un trazo vacío con el color y grosor dados', () => {
    const s = createStroke('#1a1a1a', 2.4);
    expect(s.points).toEqual([]);
    expect(s.color).toBe('#1a1a1a');
    expect(s.size).toBe(2.4);
  });
});
