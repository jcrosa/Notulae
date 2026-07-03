import { describe, it, expect } from 'vitest';
import { distPointToSegment, strokeHit } from './hittest.ts';
import type { Stroke } from './stroke.ts';

function strokeWith(points: { x: number; y: number }[], size = 2): Stroke {
  return {
    id: 'x',
    points: points.map((p) => ({ ...p, pressure: 0.5 })),
    brush: 'pen',
    color: '#000',
    size,
    fromPen: true,
  };
}

describe('distPointToSegment', () => {
  it('proyección dentro del segmento', () => {
    // Punto sobre la vertical del centro de un segmento horizontal.
    expect(distPointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('proyección fuera: distancia al extremo más cercano', () => {
    expect(distPointToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
    expect(distPointToSegment({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('segmento degenerado (a === b)', () => {
    expect(distPointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('strokeHit', () => {
  const line = strokeWith(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    4,
  );

  it('acierta cerca del trazo (radio + semigrosor)', () => {
    // A 7 de distancia con radio 6 + size/2 = 8 → toca.
    expect(strokeHit(line, { x: 50, y: 7 }, 6)).toBe(true);
  });

  it('falla lejos del trazo', () => {
    expect(strokeHit(line, { x: 50, y: 30 }, 6)).toBe(false);
  });

  it('el pre-filtro por bbox no descarta puntos junto a los extremos', () => {
    expect(strokeHit(line, { x: -5, y: 0 }, 6)).toBe(true);
  });

  it('trazo de un solo punto', () => {
    const dot = strokeWith([{ x: 10, y: 10 }], 4);
    expect(strokeHit(dot, { x: 14, y: 10 }, 3)).toBe(true);
    expect(strokeHit(dot, { x: 20, y: 10 }, 3)).toBe(false);
  });

  it('trazo vacío nunca acierta', () => {
    expect(strokeHit(strokeWith([]), { x: 0, y: 0 }, 100)).toBe(false);
  });
});
