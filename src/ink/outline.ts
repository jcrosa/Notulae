import { getStroke } from 'perfect-freehand';
import type { InkPoint } from './stroke.ts';

/**
 * Envoltorio puro sobre perfect-freehand: convierte puntos+presión en el
 * polígono (outline) de la tinta. Sin DOM salvo `outlineToPath` (Path2D),
 * para que el cálculo sea testeable en vitest.
 */

export interface FreehandOptions {
  /** Grosor base del trazo. */
  size: number;
  /** Cuánto afecta la presión al grosor: 0 = nada, 1 = máximo. */
  thinning: number;
  /** Suavizado del contorno [0, 1]. */
  smoothing: number;
  /** Filtrado de la entrada [0, 1] (reduce el temblor). */
  streamline: number;
  /** true para punteros sin presión real (ratón); false para el Pencil. */
  simulatePressure: boolean;
}

/** Opciones razonables por defecto para el Pencil en esta fase. */
export const DEFAULT_FREEHAND: FreehandOptions = {
  size: 4,
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: false,
};

/** Calcula el polígono de tinta de un trazo. Puro: sin DOM. */
export function strokeOutline(
  points: readonly InkPoint[],
  opts: FreehandOptions,
): number[][] {
  return getStroke(
    points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: opts.size,
      thinning: opts.thinning,
      smoothing: opts.smoothing,
      streamline: opts.streamline,
      simulatePressure: opts.simulatePressure,
      last: true,
    },
  );
}

/** Convierte un outline en un Path2D listo para rellenar. */
export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length === 0) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

/** Caja envolvente de un outline en las mismas unidades, con margen opcional. */
export function outlineBBox(
  outline: number[][],
  margin = 0,
): { x: number; y: number; w: number; h: number } | null {
  if (outline.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outline) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2,
  };
}
