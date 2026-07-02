/**
 * Overlay de depuración mínimo, activable con `?debug=1` (§5 del CLAUDE.md:
 * "instrumentación antes que suposición"). En Fase 0 solo cuenta eventos de
 * puntero por segundo; en Fase 1 se ampliará con puntos coalescidos por evento
 * y tiempo de frame.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private events = 0;

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

  /** Cuenta un evento de puntero procesado en este segundo. */
  countEvent(): void {
    this.events++;
  }

  private tick = (): void => {
    this.el.textContent = `eventos/s: ${this.events}`;
    this.events = 0;
    window.setTimeout(this.tick, 1000);
  };
}

/** ¿Está activado el modo debug por query string? */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('debug');
}
