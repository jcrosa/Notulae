import { describe, it, expect } from 'vitest';
import { createStroke } from './stroke.ts';

describe('createStroke', () => {
  it('crea un trazo vacío con pincel, color y grosor resueltos', () => {
    const s = createStroke('pen', '#1a1a1a', 3.5, true);
    expect(s.points).toEqual([]);
    expect(s.brush).toBe('pen');
    expect(s.color).toBe('#1a1a1a');
    expect(s.size).toBe(3.5);
    expect(s.fromPen).toBe(true);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('cada trazo recibe un id distinto', () => {
    const a = createStroke('pen', '#1a1a1a', 2, true);
    const b = createStroke('pen', '#1a1a1a', 2, true);
    expect(a.id).not.toBe(b.id);
  });
});
