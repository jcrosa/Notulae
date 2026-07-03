import type { BrushId } from './brushes.ts';

/** Un punto normalizado del pipeline de entrada, en unidades de documento. */
export interface InkPoint {
  x: number;
  y: number;
  /** Presión del Pencil en [0, 1]. 0.5 si el dispositivo no la reporta. */
  pressure: number;
}

/** Un trazo completo: la secuencia de puntos entre pointerdown y pointerup. */
export interface Stroke {
  /** Identificador estable (necesario para borrador y undo/redo). */
  id: string;
  /** Puntos en unidades de documento. */
  points: InkPoint[];
  brush: BrushId;
  /** Color de la tinta (CSS). */
  color: string;
  /**
   * Grosor base en unidades de documento, ya RESUELTO (no 'fine'/'medium'):
   * retocar la definición de un pincel no debe alterar trazos existentes.
   */
  size: number;
  /** ¿Se capturó con presión real (Pencil)? Para simulatePressure. */
  fromPen: boolean;
}

/** Crea un trazo vacío con el estilo dado. */
export function createStroke(brush: BrushId, color: string, size: number, fromPen: boolean): Stroke {
  return { id: crypto.randomUUID(), points: [], brush, color, size, fromPen };
}
