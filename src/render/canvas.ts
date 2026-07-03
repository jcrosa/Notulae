import type { Stroke } from '../ink/stroke.ts';
import { BRUSHES } from '../ink/brushes.ts';
import {
  strokeOutline,
  outlineToPath,
  outlineBBox,
  type FreehandOptions,
} from '../ink/outline.ts';
import type { Page } from '../store/note.ts';
import type { Viewport } from './viewport.ts';
import { composePencilBitmap, subtractGrain, grainAlpha, avgPressure } from './texture.ts';

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
/** Alpha de previsualización del subrayador en la capa viva (multiply no
 * cruza canvases DOM; el multiply real se aplica al consolidar). */
const HIGHLIGHTER_PREVIEW_ALPHA = 0.4;

/** Parámetros de perfect-freehand para un trazo según su pincel. */
export function freehandOptsFor(stroke: Stroke): FreehandOptions {
  const def = BRUSHES[stroke.brush];
  return {
    size: stroke.size,
    thinning: def.freehand.thinning,
    smoothing: def.freehand.smoothing,
    streamline: def.freehand.streamline,
    simulatePressure: !stroke.fromPen,
  };
}

interface PencilBitmap {
  canvas: HTMLCanvasElement;
  box: BBox;
}

/**
 * Superficie de dibujo sobre <canvas>. Encapsula DPR/resize y el transform
 * documento→pantalla del viewport. Hay dos instancias en la app:
 *
 *  - capa estática (#ink-canvas): escritorio + página + trazos terminados;
 *    se repinta al terminar un trazo, en resize, pan/zoom o undo/redo.
 *  - capa viva (#live-canvas): el trazo en curso, repintado por frame (rAF).
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
  /** Cache del bitmap compuesto (color+grano) de los trazos de lápiz. */
  private readonly pencilCache = new WeakMap<Stroke, PencilBitmap>();

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
  private pathFor(stroke: Stroke): Path2D {
    let path = this.pathCache.get(stroke);
    if (!path) {
      path = outlineToPath(strokeOutline(stroke.points, freehandOptsFor(stroke)));
      this.pathCache.set(stroke, path);
    }
    return path;
  }

  /** Bitmap compuesto (color + grano) de un trazo de lápiz, cacheado. */
  private pencilFor(stroke: Stroke): PencilBitmap | null {
    let bitmap = this.pencilCache.get(stroke);
    if (!bitmap) {
      const path = this.pathFor(stroke);
      const outline = strokeOutline(stroke.points, freehandOptsFor(stroke));
      const box = outlineBBox(outline, 2);
      if (!box) return null;
      bitmap = {
        canvas: composePencilBitmap(path, stroke.color, box, grainAlpha(avgPressure(stroke))),
        box,
      };
      this.pencilCache.set(stroke, bitmap);
    }
    return bitmap;
  }

  /** Pinta un trazo terminado con el estilo de su pincel (contexto ya transformado). */
  private drawStrokeStyled(stroke: Stroke): void {
    const { ctx } = this;
    const def = BRUSHES[stroke.brush];
    ctx.globalAlpha = def.opacity;
    ctx.globalCompositeOperation = def.composite;
    if (def.textured) {
      const bitmap = this.pencilFor(stroke);
      if (bitmap) {
        ctx.drawImage(bitmap.canvas, bitmap.box.x, bitmap.box.y, bitmap.box.w, bitmap.box.h);
      }
    } else {
      ctx.fillStyle = stroke.color;
      ctx.fill(this.pathFor(stroke));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Repinta la escena completa de la capa estática: escritorio, página con
   * sombra y todos los trazos (recortados a la página).
   */
  renderScene(page: Page, viewport: Viewport, strokes: readonly Stroke[]): void {
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
    for (const stroke of strokes) this.drawStrokeStyled(stroke);
    ctx.restore();
  }

  /**
   * Frame del trazo vivo: borra la zona del frame anterior y rellena el path
   * actual con el estilo del pincel, recortado a la página. Hot path.
   *
   * El subrayador se previsualiza con alpha simple (multiply no cruza
   * canvases DOM) y el lápiz aplica el grano directamente: en esta capa
   * solo vive el trazo en curso, no hay nada que agujerear.
   */
  renderLiveStroke(
    path: Path2D,
    stroke: Stroke,
    box: BBox,
    page: Page,
    viewport: Viewport,
    clearBox: BBox | null,
  ): void {
    const { ctx } = this;
    const def = BRUSHES[stroke.brush];
    ctx.save();
    this.applyViewport(viewport);
    if (clearBox) ctx.clearRect(clearBox.x, clearBox.y, clearBox.w, clearBox.h);
    this.clipToPage(page);
    ctx.globalAlpha = def.composite === 'multiply' ? HIGHLIGHTER_PREVIEW_ALPHA : def.opacity;
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
    if (def.textured) {
      subtractGrain(ctx, path, box, grainAlpha(avgPressure(stroke)));
    }
    ctx.restore();
  }

  /**
   * Cursor del borrador en la capa viva: un círculo con el radio efectivo
   * (en unidades de documento), borrando el del frame anterior.
   */
  renderEraserCursor(
    center: { x: number; y: number },
    radius: number,
    viewport: Viewport,
    clearBox: BBox | null,
  ): void {
    const { ctx } = this;
    ctx.save();
    this.applyViewport(viewport);
    if (clearBox) ctx.clearRect(clearBox.x, clearBox.y, clearBox.w, clearBox.h);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1.5 / viewport.scale; // ~1.5 px constantes en pantalla
    ctx.stroke();
    ctx.restore();
  }
}
