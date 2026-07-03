import { describe, it, expect } from 'vitest';
import { docToScreen, screenToDoc, fitToScreen, zoomAt, panBy, type Viewport } from './viewport.ts';
import { createPage } from '../store/note.ts';

const v: Viewport = { scale: 0.5, tx: 100, ty: 50 };

describe('docToScreen / screenToDoc', () => {
  it('son inversas', () => {
    const p = { x: 123.4, y: 567.8 };
    const back = screenToDoc(v, docToScreen(v, p));
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });
});

describe('fitToScreen', () => {
  it('encuadra la página completa centrada, con margen', () => {
    const page = createPage('a4-portrait');
    const fit = fitToScreen(page, 1024, 768, 24);
    // Cabe entera:
    const topLeft = docToScreen(fit, { x: 0, y: 0 });
    const bottomRight = docToScreen(fit, { x: page.width, y: page.height });
    expect(topLeft.x).toBeGreaterThanOrEqual(24 - 1e-9);
    expect(topLeft.y).toBeGreaterThanOrEqual(24 - 1e-9);
    expect(bottomRight.x).toBeLessThanOrEqual(1024 - 24 + 1e-9);
    expect(bottomRight.y).toBeLessThanOrEqual(768 - 24 + 1e-9);
    // Centrada:
    expect(topLeft.x + bottomRight.x).toBeCloseTo(1024, 6);
    expect(topLeft.y + bottomRight.y).toBeCloseTo(768, 6);
  });

  it('funciona para los 4 formatos', () => {
    for (const format of ['a4-portrait', 'a4-landscape', 'square', 'screen'] as const) {
      const page = createPage(format, 4 / 3);
      const fit = fitToScreen(page, 800, 600);
      expect(fit.scale).toBeGreaterThan(0);
      expect(Number.isFinite(fit.tx)).toBe(true);
      expect(Number.isFinite(fit.ty)).toBe(true);
    }
  });
});

describe('zoomAt', () => {
  it('el punto del documento bajo el ancla no se mueve', () => {
    const anchor = { x: 300, y: 200 };
    const docUnderAnchor = screenToDoc(v, anchor);
    const zoomed = zoomAt(v, anchor, 2, 0.1, 10);
    const after = docToScreen(zoomed, docUnderAnchor);
    expect(after.x).toBeCloseTo(anchor.x, 8);
    expect(after.y).toBeCloseTo(anchor.y, 8);
  });

  it('acota la escala a [min, max]', () => {
    expect(zoomAt(v, { x: 0, y: 0 }, 100, 0.1, 2).scale).toBe(2);
    expect(zoomAt(v, { x: 0, y: 0 }, 0.001, 0.1, 2).scale).toBe(0.1);
  });

  it('factor 1 no cambia nada', () => {
    const z = zoomAt(v, { x: 300, y: 200 }, 1, 0.1, 10);
    expect(z).toEqual(v);
  });
});

describe('panBy', () => {
  it('desplaza en píxeles de pantalla sin tocar la escala', () => {
    const p = panBy(v, 10, -20);
    expect(p).toEqual({ scale: 0.5, tx: 110, ty: 30 });
  });
});
