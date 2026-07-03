/**
 * Modelo de página de la nota. Unidades de documento: 1 ud = 1 px CSS a
 * escala 1. A4 a ~150 dpi da sobra de resolución y deja los grosores de
 * pincel en rangos cómodos (2–40 ud).
 */

export type PageFormat = 'a4-portrait' | 'a4-landscape' | 'square' | 'screen';

export interface Page {
  format: PageFormat;
  /** Ancho en unidades de documento. */
  width: number;
  /** Alto en unidades de documento. */
  height: number;
}

export const PAGE_FORMATS: readonly PageFormat[] = [
  'a4-portrait',
  'a4-landscape',
  'square',
  'screen',
];

const A4_SHORT = 1240;
const A4_LONG = 1754;

/**
 * Crea una página del formato dado. `screenRatio` (ancho/alto del área
 * visible) solo se usa para el formato 'screen'.
 */
export function createPage(format: PageFormat, screenRatio = 4 / 3): Page {
  switch (format) {
    case 'a4-portrait':
      return { format, width: A4_SHORT, height: A4_LONG };
    case 'a4-landscape':
      return { format, width: A4_LONG, height: A4_SHORT };
    case 'square':
      return { format, width: 1400, height: 1400 };
    case 'screen': {
      const width = A4_SHORT;
      const height = Math.round(width / screenRatio);
      return { format, width, height };
    }
  }
}

/** ¿Cae el punto (en unidades de documento) dentro de la página? */
export function isInsidePage(page: Page, p: { x: number; y: number }): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= page.width && p.y <= page.height;
}
