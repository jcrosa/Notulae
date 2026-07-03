/**
 * Reconocedor de gestos multitáctiles (solo dedos; el pen nunca llega aquí).
 *
 * Máquina de estados:
 *
 *   IDLE ──touch down──▶ PENDING (aún no se sabe si tap o pinch; no emite nada)
 *   PENDING:
 *     · todos los dedos levantados antes de TAP_MS y desplazamiento < TAP_SLOP
 *         → emite tap(maxFingers) → IDLE
 *     · ≥2 dedos y (desplazamiento > PAN_SLOP o transcurre TAP_MS)
 *         → PINCH_PAN
 *     · 1 solo dedo que se desplaza o agota el tiempo → DEAD
 *   PINCH_PAN: emite pinchPan por move con los 2 primeros dedos activos;
 *     al bajar de 2 dedos → DEAD (sin inercia)
 *   DEAD: gesto consumido/inválido; ignora todo hasta quedar 0 dedos → IDLE
 *   penDown() en cualquier estado → DEAD (el pen tiene prioridad absoluta)
 *
 * Los primeros ~10 px / 300 ms de un pinch no mueven el lienzo: es el coste
 * de desambiguar tap vs pinch, el mismo truco que usan las apps nativas.
 *
 * Clase pura: recibe eventos sintéticos {type,id,x,y,t} con reloj inyectado
 * por el llamante — testeable sin DOM. `GesturePointerAdapter` la conecta a
 * Pointer Events reales.
 */

export const TAP_MS = 300;
export const TAP_SLOP = 10;
export const PAN_SLOP = 10;

export interface GesturePoint {
  x: number;
  y: number;
}

export interface GestureEvent {
  type: 'down' | 'move' | 'up' | 'cancel';
  id: number;
  x: number;
  y: number;
  /** Timestamp en ms (performance.now() en producción; inyectable en tests). */
  t: number;
}

export interface GestureCallbacks {
  /** Pinch/pan en curso: centroide actual, delta del centroide y factor de escala. */
  onPinchPan?(centroid: GesturePoint, dx: number, dy: number, scaleFactor: number): void;
  /** Fin del pinch/pan (los dedos bajaron de 2). */
  onPinchEnd?(): void;
  /** Tap rápido con N dedos (2 = undo, 3 = redo; decide el llamante). */
  onTap?(fingers: number): void;
}

interface Finger {
  startX: number;
  startY: number;
  x: number;
  y: number;
}

type State = 'idle' | 'pending' | 'pinch' | 'dead';

export class GestureRecognizer {
  private state: State = 'idle';
  private readonly fingers = new Map<number, Finger>();
  private startT = 0;
  private maxFingers = 0;
  private maxDisplacement = 0;
  private prevCentroid: GesturePoint | null = null;
  private prevDist = 0;

  constructor(private readonly cb: GestureCallbacks) {}

  /** El pen tiene prioridad: cancela cualquier gesto en curso. */
  penDown(): void {
    if (this.state === 'pinch') this.cb.onPinchEnd?.();
    this.state = this.fingers.size > 0 ? 'dead' : 'idle';
    this.prevCentroid = null;
  }

  handle(e: GestureEvent): void {
    switch (e.type) {
      case 'down':
        this.onDown(e);
        break;
      case 'move':
        this.onMove(e);
        break;
      case 'up':
      case 'cancel':
        this.onUp(e);
        break;
    }
  }

  private onDown(e: GestureEvent): void {
    this.fingers.set(e.id, { startX: e.x, startY: e.y, x: e.x, y: e.y });
    if (this.state === 'idle') {
      this.state = 'pending';
      this.startT = e.t;
      this.maxFingers = 1;
      this.maxDisplacement = 0;
    } else if (this.state === 'pending') {
      this.maxFingers = Math.max(this.maxFingers, this.fingers.size);
    }
    // En 'pinch' un tercer dedo se ignora (seguimos con los 2 primeros);
    // en 'dead' solo registramos el dedo para saber cuándo quedan 0.
  }

  private onMove(e: GestureEvent): void {
    const f = this.fingers.get(e.id);
    if (!f) return;
    f.x = e.x;
    f.y = e.y;

    if (this.state === 'pending') {
      const d = Math.hypot(e.x - f.startX, e.y - f.startY);
      this.maxDisplacement = Math.max(this.maxDisplacement, d);
      const timedOut = e.t - this.startT > TAP_MS;
      if (this.maxDisplacement > PAN_SLOP || timedOut) {
        if (this.fingers.size >= 2) this.enterPinch();
        else this.state = 'dead';
      }
      return;
    }

    if (this.state === 'pinch') this.emitPinch();
  }

  private onUp(e: GestureEvent): void {
    const existed = this.fingers.delete(e.id);
    if (!existed) return;

    if (this.state === 'pending' && this.fingers.size === 0) {
      const isTap = e.t - this.startT <= TAP_MS && this.maxDisplacement < TAP_SLOP;
      if (isTap && this.maxFingers >= 2) this.cb.onTap?.(this.maxFingers);
      this.state = 'idle';
      return;
    }

    if (this.state === 'pinch' && this.fingers.size < 2) {
      this.cb.onPinchEnd?.();
      this.state = this.fingers.size === 0 ? 'idle' : 'dead';
      this.prevCentroid = null;
      return;
    }

    if (this.state === 'dead' && this.fingers.size === 0) {
      this.state = 'idle';
    }
  }

  /** Los 2 primeros dedos activos (orden de inserción del Map). */
  private firstTwo(): [Finger, Finger] | null {
    const it = this.fingers.values();
    const a = it.next();
    const b = it.next();
    if (a.done || b.done) return null;
    return [a.value, b.value];
  }

  private enterPinch(): void {
    const pair = this.firstTwo();
    if (!pair) {
      this.state = 'dead';
      return;
    }
    this.state = 'pinch';
    // El rastreo empieza desde la posición ACTUAL: el desplazamiento del
    // slop se descarta a propósito para que el lienzo no dé un salto.
    this.prevCentroid = this.centroid(pair);
    this.prevDist = this.dist(pair);
  }

  private emitPinch(): void {
    const pair = this.firstTwo();
    if (!pair || !this.prevCentroid) return;
    const c = this.centroid(pair);
    const d = this.dist(pair);
    const factor = this.prevDist > 0 ? d / this.prevDist : 1;
    this.cb.onPinchPan?.(c, c.x - this.prevCentroid.x, c.y - this.prevCentroid.y, factor);
    this.prevCentroid = c;
    this.prevDist = d;
  }

  private centroid([a, b]: [Finger, Finger]): GesturePoint {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private dist([a, b]: [Finger, Finger]): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}

/**
 * Adaptador DOM: filtra Pointer Events de tipo 'touch' hacia el reconocedor
 * y le notifica los pointerdown de pen (prioridad del Pencil).
 */
export class GesturePointerAdapter {
  constructor(target: HTMLElement, recognizer: GestureRecognizer) {
    const toEvent = (e: PointerEvent, type: GestureEvent['type']): GestureEvent => ({
      type,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
    });

    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen') recognizer.penDown();
      if (e.pointerType === 'touch') recognizer.handle(toEvent(e, 'down'));
    });
    target.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') recognizer.handle(toEvent(e, 'move'));
    });
    target.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') recognizer.handle(toEvent(e, 'up'));
    });
    target.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch') recognizer.handle(toEvent(e, 'cancel'));
    });
  }
}
