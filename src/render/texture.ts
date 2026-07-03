import type { Stroke } from '../ink/stroke.ts';
import type { BBox } from './canvas.ts';

/**
 * Textura del lápiz: grano por sustracción de ruido (destination-out con un
 * CanvasPattern pregenerado). Coste O(área del bbox) en GPU, independiente
 * del número de puntos — los stamps por punto reventarían los 8 ms/frame.
 */

const TILE_SIZE = 128;
/** Fracción de píxeles del tile que "arrancan" tinta. */
const NOISE_DENSITY = 0.35;
/** Lado máximo del bitmap cacheado por trazo de lápiz (unidades de documento). */
const MAX_BITMAP_DIM = 2048;

let noiseTile: HTMLCanvasElement | null = null;

/** Tile de ruido binario, generado una única vez. */
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const tile = document.createElement('canvas');
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const ctx = tile.getContext('2d')!;
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    // Píxel negro opaco (arranca tinta) o transparente (la deja).
    img.data[i + 3] = Math.random() < NOISE_DENSITY ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = tile;
  return tile;
}

/** Alpha del grano modulado por presión: más presión = grano menos agresivo. */
export function grainAlpha(avgPressure: number): number {
  return Math.min(0.5, Math.max(0.1, 0.55 - 0.4 * avgPressure));
}

export function avgPressure(stroke: Stroke): number {
  if (stroke.points.length === 0) return 0.5;
  let sum = 0;
  for (const p of stroke.points) sum += p.pressure;
  return sum / stroke.points.length;
}

/**
 * Aplica el grano sobre un contexto YA relleno con el color del trazo:
 * recorta al path y sustrae el patrón de ruido. `box` en las unidades del
 * contexto actual (el patrón hereda el transform: el grano escala con él).
 */
export function subtractGrain(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  box: BBox,
  alpha: number,
): void {
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat')!;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

/**
 * Compone un trazo de lápiz (color + grano) en un bitmap propio en espacio
 * de documento. Necesario para la capa estática: un destination-out directo
 * agujerearía los trazos anteriores. El bitmap se cachea por trazo (WeakMap
 * en el llamante) y el grano queda estable en el papel al hacer zoom.
 */
export function composePencilBitmap(
  path: Path2D,
  color: string,
  boxDoc: BBox,
  alpha: number,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_BITMAP_DIM / Math.max(boxDoc.w, boxDoc.h, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(boxDoc.w * scale));
  canvas.height = Math.max(1, Math.ceil(boxDoc.h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -boxDoc.x * scale, -boxDoc.y * scale);
  ctx.fillStyle = color;
  ctx.fill(path);
  subtractGrain(ctx, path, boxDoc, alpha);
  return canvas;
}
