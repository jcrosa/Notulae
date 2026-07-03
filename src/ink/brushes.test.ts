import { describe, it, expect } from 'vitest';
import { BRUSHES, BRUSH_IDS, INK_COLORS, resolveSize } from './brushes.ts';

describe('BRUSHES', () => {
  it('define los 4 pinceles con sus 3 grosores', () => {
    expect(BRUSH_IDS).toHaveLength(4);
    for (const id of BRUSH_IDS) {
      const def = BRUSHES[id];
      expect(def.id).toBe(id);
      expect(def.sizes.fine).toBeGreaterThan(0);
      expect(def.sizes.medium).toBeGreaterThan(def.sizes.fine);
      expect(def.sizes.thick).toBeGreaterThan(def.sizes.medium);
      expect(def.opacity).toBeGreaterThan(0);
      expect(def.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('rotulador y subrayador ignoran la presión (thinning 0)', () => {
    expect(BRUSHES.marker.freehand.thinning).toBe(0);
    expect(BRUSHES.highlighter.freehand.thinning).toBe(0);
  });

  it('la pluma y el lápiz responden a la presión', () => {
    expect(BRUSHES.pen.freehand.thinning).toBeGreaterThan(0);
    expect(BRUSHES.pencil.freehand.thinning).toBeGreaterThan(0);
  });

  it('el subrayador compone con multiply y solo el lápiz tiene textura', () => {
    expect(BRUSHES.highlighter.composite).toBe('multiply');
    for (const id of BRUSH_IDS) {
      expect(BRUSHES[id].textured).toBe(id === 'pencil');
    }
  });
});

describe('resolveSize', () => {
  it('devuelve el grosor en unidades de documento', () => {
    expect(resolveSize('pen', 'medium')).toBe(BRUSHES.pen.sizes.medium);
    expect(resolveSize('highlighter', 'thick')).toBe(40);
  });
});

describe('INK_COLORS', () => {
  it('hay 4 colores', () => {
    expect(INK_COLORS).toHaveLength(4);
  });
});
