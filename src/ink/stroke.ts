/**
 * Modelo de datos del trazo. Es deliberadamente mínimo en Fase 0: un trazo es
 * una lista de puntos con presión. El suavizado y la conversión a polígono de
 * tinta (perfect-freehand) llegan en Fase 1; por eso guardamos la presión ya
 * desde ahora aunque el render crudo aún no la use para el grosor.
 */

/** Un punto normalizado del pipeline de entrada, en píxeles CSS del lienzo. */
export interface InkPoint {
  /** Coordenada X en píxeles CSS relativa al lienzo. */
  x: number;
  /** Coordenada Y en píxeles CSS relativa al lienzo. */
  y: number;
  /** Presión del Pencil en [0, 1]. 0.5 si el dispositivo no la reporta. */
  pressure: number;
}

/** Un trazo completo: la secuencia de puntos entre pointerdown y pointerup. */
export interface Stroke {
  points: InkPoint[];
  /** Color de la tinta (CSS). Fijo en Fase 0; configurable en Fase 2. */
  color: string;
  /** Grosor base en píxeles CSS. */
  size: number;
}

/** Crea un trazo vacío con el estilo dado. */
export function createStroke(color: string, size: number): Stroke {
  return { points: [], color, size };
}
