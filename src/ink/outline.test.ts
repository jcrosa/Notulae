import { describe, it, expect } from 'vitest';
import { strokeOutline, outlineBBox, DEFAULT_FREEHAND } from './outline.ts';
import type { InkPoint } from './stroke.ts';

function line(n: number, pressure = 0.5): InkPoint[] {
  return Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0, pressure }));
}

describe('strokeOutline', () => {
  it('devuelve un polígono no vacío para un trazo normal', () => {
    const outline = strokeOutline(line(10), DEFAULT_FREEHAND);
    expect(outline.length).toBeGreaterThan(2);
    for (const p of outline) {
      expect(p.length).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(p[0])).toBe(true);
      expect(Number.isFinite(p[1])).toBe(true);
    }
  });

  it('devuelve algo dibujable incluso con un solo punto (toque)', () => {
    const outline = strokeOutline(line(1), DEFAULT_FREEHAND);
    expect(outline.length).toBeGreaterThan(2);
  });

  it('la presión alta produce un contorno más grueso que la baja', () => {
    const opts = { ...DEFAULT_FREEHAND, thinning: 0.8 };
    const thin = outlineBBox(strokeOutline(line(20, 0.1), opts))!;
    const thick = outlineBBox(strokeOutline(line(20, 1.0), opts))!;
    // El trazo es horizontal: el grosor se refleja en la altura del bbox.
    expect(thick.h).toBeGreaterThan(thin.h);
  });

  it('con thinning 0 la presión no cambia el grosor', () => {
    const opts = { ...DEFAULT_FREEHAND, thinning: 0 };
    const a = outlineBBox(strokeOutline(line(20, 0.1), opts))!;
    const b = outlineBBox(strokeOutline(line(20, 1.0), opts))!;
    expect(a.h).toBeCloseTo(b.h, 5);
  });
});

describe('outlineBBox', () => {
  it('null para outline vacío', () => {
    expect(outlineBBox([])).toBeNull();
  });

  it('aplica el margen', () => {
    const box = outlineBBox(
      [
        [0, 0],
        [10, 20],
      ],
      4,
    )!;
    expect(box).toEqual({ x: -4, y: -4, w: 18, h: 28 });
  });
});
