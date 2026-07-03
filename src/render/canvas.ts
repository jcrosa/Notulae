import type { Stroke } from '../ink/stroke.ts';
import { strokeOutline, outlineToPath, type FreehandOptions } from '../ink/outline.ts';
import type { Page } from '../store/note.ts';
import type { Viewport } from './viewport.ts';

/** Caja en unidades de documento. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Color del escritorio (fuera de la página). */
const DESK_COLOR = '#e5e5e0';
/** Color del papel. */
const PAPER_COLOR = '#ffffff';

/**
 * Superficie de dibujo sobre <canvas>. Encapsula DPR/resize y el transform
 * documento→pantalla del viewport. Hay dos instancias en la app:
 *
 *  - capa estática (#ink-canvas): escritorio + página + trazos terminados;
 *    se repinta al terminar un trazo, en resize, pan/zoom o undo/redo.
 *  - capa viva (#live-canvas): el trazo en curso, repintado por frame (rAF),
 *    porque perfect-freehand recalcula el outline completo cada vez.
 *
 * Todo el dibujo de tinta ocurre en unidades de documento; el transform del
 * contexto (DPR × viewport) hace el resto.
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
  }

  /** Borra todo el lienzo. */
  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /** Aplica DPR × viewport: a partir de aquí se dibuja en unidades de documento. */
  private applyViewport(v: Viewport): void {
    this.ctx.setTransform(
      this.dpr * v.scale,
      0,
      0,
      this.dpr * v.scale,
      this.dpr * v.tx,
      this.dpr * v.ty,
    );
  }

  private clipToPage(page: Page): void {
    this.ctx.beginPath();
    this.ctx.rect(0, 0, page.width, page.height);
    this.ctx.clip();
  }

  /** Path2D cacheado de un trazo terminado (calcula el outline solo una vez). */
  private pathFor(stroke: Stroke, opts: FreehandOptions): Path2D {
    let path = this.pathCache.get(stroke);
    if (!path) {
      path = outlineToPath(strokeOutline(stroke.points, opts));
      this.pathCache.set(stroke, path);
    }
    return path;
  }

  /**
   * Repinta la escena completa de la capa estática: escritorio, página con
   * sombra y todos los trazos (recortados a la página).
   */
  renderScene(
    page: Page,
    viewport: Viewport,
    strokes: readonly Stroke[],
    optsFor: (s: Stroke) => FreehandOptions,
  ): void {
    const { ctx } = this;
    ctx.save();
    // Escritorio a pantalla completa (espacio de pantalla, solo DPR).
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = DESK_COLOR;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    // Página con sombra (la sombra no se ve afectada por el transform:
    // queda constante en pantalla, que es lo deseado).
    this.applyViewport(viewport);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.shadowColor = 'transparent';

    // Tinta, recortada al papel.
    this.clipToPage(page);
    for (const stroke of strokes) {
      ctx.fillStyle = stroke.color;
      ctx.fill(this.pathFor(stroke, optsFor(stroke)));
    }
    ctx.restore();
  }

  /**
   * Frame del trazo vivo: borra la zona del frame anterior (bbox en unidades
   * de documento) y rellena el path actual, recortado a la página.
   * Es el hot path: un clearRect parcial + un fill por frame.
   */
  renderLiveStroke(
    path: Path2D,
    color: string,
    page: Page,
    viewport: Viewport,
    clearBox: BBox | null,
  ): void {
    const { ctx } = this;
    ctx.save();
    this.applyViewport(viewport);
    if (clearBox) ctx.clearRect(clearBox.x, clearBox.y, clearBox.w, clearBox.h);
    this.clipToPage(page);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
  }
}
