import type { InkPoint } from '../ink/stroke.ts';

/** Callbacks que consume el pipeline superior (ink + render). */
export interface PointerHandlers {
  onStrokeStart(point: InkPoint, isPen: boolean): void;
  /**
   * Puntos nuevos de este pointermove. `points` son los eventos coalescidos
   * (van al stroke); `predicted` son los predichos por el sistema y solo
   * sirven para el render del frame actual — NUNCA se almacenan.
   */
  onStrokeMove(points: InkPoint[], predicted: InkPoint[]): void;
  onStrokeEnd(): void;
}

/**
 * Captura de Pointer Events sobre el lienzo con rechazo de palma.
 *
 * Reglas (§7 del CLAUDE.md):
 *  - El Pencil (`pointerType === 'pen'`) siempre pinta.
 *  - El dedo (`pointerType === 'touch'`) nunca pinta.
 *  - El ratón se acepta solo como comodidad para probar en escritorio.
 *  - Mientras un trazo está activo, se ignora cualquier otro puntero.
 *
 * Consume `getCoalescedEvents()` en cada `pointermove` para no perder puntos
 * a alta velocidad (~240 Hz en iPad) y `getPredictedEvents()` para reducir la
 * latencia percibida del tramo final del trazo vivo.
 */
export class PointerInput {
  private readonly canvas: HTMLCanvasElement;
  private readonly handlers: PointerHandlers;
  private activePointerId: number | null = null;
  /** Rect cacheado del lienzo: getBoundingClientRect por evento fuerza layout. */
  private rect: DOMRect;

  constructor(canvas: HTMLCanvasElement, handlers: PointerHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.rect = canvas.getBoundingClientRect();
    this.attach();
  }

  /** Debe llamarse tras un resize/rotación para refrescar el rect cacheado. */
  refreshRect(): void {
    this.rect = this.canvas.getBoundingClientRect();
  }

  private attach(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.onPointerUp, { passive: false });
    this.canvas.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    this.canvas.addEventListener('pointerleave', this.onPointerUp, { passive: false });

    // Anula el zoom por gesto de Safari en iPad mientras se escribe.
    const preventGesture = (e: Event) => e.preventDefault();
    this.canvas.addEventListener('gesturestart', preventGesture);
    this.canvas.addEventListener('gesturechange', preventGesture);
    this.canvas.addEventListener('gestureend', preventGesture);
  }

  /** ¿Este tipo de puntero puede pintar? Pen siempre; ratón para pruebas. */
  private canPaint(type: string): boolean {
    return type === 'pen' || type === 'mouse';
  }

  /** Convierte un PointerEvent a un punto normalizado en píxeles CSS del lienzo. */
  private toInkPoint(e: PointerEvent): InkPoint {
    // pressure es 0 para el ratón; usamos 0.5 como valor neutro por defecto.
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: e.clientX - this.rect.left,
      y: e.clientY - this.rect.top,
      pressure,
    };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return; // ya hay un trazo en curso
    if (!this.canPaint(e.pointerType)) return; // rechazo de palma / dedo
    e.preventDefault();
    this.refreshRect();
    this.activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.handlers.onStrokeStart(this.toInkPoint(e), e.pointerType === 'pen');
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    const coalesced = e.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [e];
    const points = events.map((ev) => this.toInkPoint(ev));
    const predicted = (e.getPredictedEvents?.() ?? []).map((ev) => this.toInkPoint(ev));
    this.handlers.onStrokeMove(points, predicted);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.activePointerId = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this.handlers.onStrokeEnd();
  };
}
