import type { InkPoint } from '../ink/stroke.ts';

/** Callbacks que consume el pipeline superior (ink + render). */
export interface PointerHandlers {
  onStrokeStart(point: InkPoint): void;
  onStrokeMove(point: InkPoint): void;
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
 * En Fase 0 tomamos únicamente el evento principal de cada `pointermove`.
 * El consumo de `getCoalescedEvents()` para no perder puntos a alta
 * velocidad es trabajo de Fase 1.
 */
export class PointerInput {
  private readonly canvas: HTMLCanvasElement;
  private readonly handlers: PointerHandlers;
  private activePointerId: number | null = null;

  constructor(canvas: HTMLCanvasElement, handlers: PointerHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.attach();
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
    const rect = this.canvas.getBoundingClientRect();
    // pressure es 0 para el ratón; usamos 0.5 como valor neutro por defecto.
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure,
    };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return; // ya hay un trazo en curso
    if (!this.canPaint(e.pointerType)) return; // rechazo de palma / dedo
    e.preventDefault();
    this.activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.handlers.onStrokeStart(this.toInkPoint(e));
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.handlers.onStrokeMove(this.toInkPoint(e));
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
