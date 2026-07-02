import type { InkPoint, Stroke } from '../ink/stroke.ts';

/**
 * Superficie de dibujo sobre <canvas>. Encapsula el manejo del
 * devicePixelRatio y el redimensionado, y expone dos operaciones de render:
 *
 *  - `drawSegment`: dibujo incremental del último tramo (hot path del trazo).
 *  - `redrawAll`: repintado completo (solo tras resize/limpieza).
 *
 * En Fase 0 el render es crudo: polilínea de grosor constante, sin suavizado.
 * El contexto se pide con `desynchronized: true` para reducir la latencia
 * percibida en Safari.
 */
export class CanvasSurface {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;

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
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /** Borra todo el lienzo. */
  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Dibuja el tramo entre los dos últimos puntos de un trazo en curso.
   * Es el camino caliente: se llama en cada `pointermove`.
   */
  drawSegment(from: InkPoint, to: InkPoint, stroke: Stroke): void {
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
  }

  /** Dibuja un punto aislado (trazo de un solo toque). */
  drawDot(point: InkPoint, stroke: Stroke): void {
    this.ctx.fillStyle = stroke.color;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** Repinta un trazo completo (usado en el redibujado tras resize). */
  drawStroke(stroke: Stroke): void {
    const { points } = stroke;
    if (points.length === 0) return;
    if (points.length === 1) {
      this.drawDot(points[0], stroke);
      return;
    }
    for (let i = 1; i < points.length; i++) {
      this.drawSegment(points[i - 1], points[i], stroke);
    }
  }

  /** Repinta todos los trazos desde cero. */
  redrawAll(strokes: readonly Stroke[]): void {
    this.clear();
    for (const stroke of strokes) this.drawStroke(stroke);
  }
}
