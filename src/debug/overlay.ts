/**
 * Overlay de depuración, activable con `?debug=1` (§5 del CLAUDE.md:
 * "instrumentación antes que suposición"). Métricas del hot path:
 * eventos/s, puntos coalescidos por evento, tiempo de frame y puntos
 * del trazo en curso.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private events = 0;
  private coalescedTotal = 0;
  private frameCount = 0;
  private frameMsTotal = 0;
  private frameMsMax = 0;
  private strokePoints = 0;
  // Acumulados desde la carga (no se resetean): diagnóstico de trazos cortados.
  private endsUp = 0;
  private endsCancel = 0;
  /** Máximo hueco entre lotes de entrada consecutivos dentro de un trazo. */
  private inputGapMax = 0;
  /** Máximo hueco entre frames renderizados consecutivos durante un trazo. */
  private frameGapMax = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.setAttribute('data-debug-overlay', '');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      padding: '4px 8px',
      font: '12px ui-monospace, monospace',
      color: '#0a0',
      background: 'rgba(255,255,255,0.85)',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: '9999',
      whiteSpace: 'pre',
    });
    document.body.appendChild(this.el);
    this.tick();
  }

  /** Cuenta un pointermove procesado y cuántos puntos coalescidos traía. */
  countEvent(coalesced: number): void {
    this.events++;
    this.coalescedTotal += coalesced;
  }

  /** Registra el coste en ms del render de un frame del trazo vivo. */
  frameTime(ms: number): void {
    this.frameCount++;
    this.frameMsTotal += ms;
    if (ms > this.frameMsMax) this.frameMsMax = ms;
  }

  /** Número de puntos acumulados del trazo en curso (0 si no hay trazo). */
  setStrokePoints(n: number): void {
    this.strokePoints = n;
  }

  /** Cuenta cómo terminó un trazo: up normal o cancelación del sistema. */
  strokeEnd(reason: 'up' | 'cancel'): void {
    if (reason === 'up') this.endsUp++;
    else this.endsCancel++;
  }

  /** Hueco en ms entre este lote de entrada y el anterior del mismo trazo. */
  inputGap(ms: number): void {
    if (ms > this.inputGapMax) this.inputGapMax = ms;
  }

  /** Hueco en ms entre este frame renderizado y el anterior del mismo trazo. */
  frameGap(ms: number): void {
    if (ms > this.frameGapMax) this.frameGapMax = ms;
  }

  private tick = (): void => {
    const coalPerEvent = this.events > 0 ? (this.coalescedTotal / this.events).toFixed(1) : '–';
    const frameAvg = this.frameCount > 0 ? (this.frameMsTotal / this.frameCount).toFixed(2) : '–';
    const frameMax = this.frameCount > 0 ? this.frameMsMax.toFixed(2) : '–';
    this.el.textContent =
      `eventos/s: ${this.events}\n` +
      `coalescidos/evento: ${coalPerEvent}\n` +
      `frame ms (med/máx): ${frameAvg} / ${frameMax}\n` +
      `puntos trazo: ${this.strokePoints}\n` +
      `fin trazo up/cancel: ${this.endsUp} / ${this.endsCancel}\n` +
      `hueco máx entrada/frame: ${this.inputGapMax.toFixed(0)} / ${this.frameGapMax.toFixed(0)} ms`;
    this.events = 0;
    this.coalescedTotal = 0;
    this.frameCount = 0;
    this.frameMsTotal = 0;
    this.frameMsMax = 0;
    window.setTimeout(this.tick, 1000);
  };
}

/** ¿Está activado el modo debug por query string? */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('debug');
}
