import type { Stroke } from '../ink/stroke.ts';
import { strokeOutline, outlineToPath, type FreehandOptions } from '../ink/outline.ts';

/** Caja en píxeles CSS. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Superficie de dibujo sobre <canvas>. Encapsula DPR/resize y expone
 * operaciones de relleno de Path2D. Hay dos instancias en la app:
 *
 *  - capa estática (#ink-canvas): trazos terminados; solo se repinta al
 *    terminar un trazo, en resize o en undo/redo.
 *  - capa viva (#live-canvas): el trazo en curso, repintado por frame (rAF),
 *    porque perfect-freehand recalcula el outline completo cada vez.
 *
 * El contexto se pide con `desynchronized: true` para reducir la latencia
 * percibida en Safari.
 */
export class CanvasSurface {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** Cache de Path2D por trazo terminado (clave débil: se libera solo). */
  private readonly pathCache = new WeakMap<Stroke, Path2D>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del lienzo.');
    this.ctx = ctx;
    this.resize();
  }

  /** Ajusta el buffer del lienzo al tamaño CSS actual y al DPR del dispositivo. */
  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas;
    this.canvas.width = Math.round(clientWidth * this.dpr);
    this.canvas.height = Math.round(clientHeight * this.dpr);
    // Trabajamos siempre en píxeles CSS: escalamos el contexto por el DPR.
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Borra todo el lienzo. */
  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /** Borra solo una zona (en píxeles CSS). Hot path de la capa viva. */
  clearRect(box: BBox): void {
    this.ctx.clearRect(box.x, box.y, box.w, box.h);
  }

  /** Rellena un Path2D con un color. */
  fillPath(path: Path2D, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fill(path);
  }

  /**
   * Pinta un trazo terminado usando (y alimentando) la caché de Path2D.
   * El outline solo se calcula la primera vez.
   */
  drawStroke(stroke: Stroke, opts: FreehandOptions): void {
    let path = this.pathCache.get(stroke);
    if (!path) {
      path = outlineToPath(strokeOutline(stroke.points, opts));
      this.pathCache.set(stroke, path);
    }
    this.fillPath(path, stroke.color);
  }

  /** Repinta todos los trazos desde cero (resize, undo/redo). */
  redrawAll(strokes: readonly Stroke[], optsFor: (s: Stroke) => FreehandOptions): void {
    this.clear();
    for (const stroke of strokes) this.drawStroke(stroke, optsFor(stroke));
  }
}
