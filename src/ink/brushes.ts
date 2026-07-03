/**
 * Definición declarativa de los pinceles: un pincel = parámetros de
 * perfect-freehand + estilo de composición. Nada de lógica de render aquí.
 * Grosores en unidades de documento (ver store/note.ts).
 */

export type BrushId = 'pen' | 'marker' | 'highlighter' | 'pencil';
export type SizeKey = 'fine' | 'medium' | 'thick';

export interface BrushDef {
  id: BrushId;
  /** Nombre para la UI. */
  label: string;
  freehand: {
    /** 0 = la presión no afecta al grosor; >0 = sí. */
    thinning: number;
    smoothing: number;
    streamline: number;
  };
  sizes: Record<SizeKey, number>;
  /** Alpha global del trazo (1 = opaco). */
  opacity: number;
  /** Composición al consolidar en la capa estática. */
  composite: GlobalCompositeOperation;
  /** Textura granulada (solo lápiz). */
  textured: boolean;
}

export const BRUSHES: Record<BrushId, BrushDef> = {
  pen: {
    id: 'pen',
    label: 'Pluma',
    freehand: { thinning: 0.6, smoothing: 0.5, streamline: 0.5 },
    sizes: { fine: 2, medium: 3.5, thick: 6 },
    opacity: 1,
    composite: 'source-over',
    textured: false,
  },
  marker: {
    id: 'marker',
    label: 'Rotulador',
    freehand: { thinning: 0, smoothing: 0.5, streamline: 0.4 },
    sizes: { fine: 4, medium: 7, thick: 12 },
    opacity: 0.85,
    composite: 'source-over',
    textured: false,
  },
  highlighter: {
    id: 'highlighter',
    label: 'Subrayador',
    freehand: { thinning: 0, smoothing: 0.6, streamline: 0.5 },
    sizes: { fine: 18, medium: 28, thick: 40 },
    opacity: 1,
    // multiply: amarillo×blanco = amarillo, amarillo×negro = negro.
    // La tinta bajo el subrayado no se tapa, como en un subrayador real.
    composite: 'multiply',
    textured: false,
  },
  pencil: {
    id: 'pencil',
    label: 'Lápiz',
    freehand: { thinning: 0.5, smoothing: 0.4, streamline: 0.35 },
    sizes: { fine: 2, medium: 3.5, thick: 6 },
    opacity: 1,
    composite: 'source-over',
    textured: true,
  },
};

export const BRUSH_IDS: readonly BrushId[] = ['pen', 'marker', 'highlighter', 'pencil'];

/** Colores de tinta disponibles (Fase 2: 4 colores). */
export const INK_COLORS: readonly { value: string; label: string }[] = [
  { value: '#1a1a1a', label: 'Negro' },
  { value: '#1d4ed8', label: 'Azul' },
  { value: '#dc2626', label: 'Rojo' },
  { value: '#15803d', label: 'Verde' },
];

/** Color especial del subrayador cuando el color activo es negro (poco útil). */
export const HIGHLIGHTER_DEFAULT = '#facc15';

/** Grosor resuelto en unidades de documento. */
export function resolveSize(brush: BrushId, key: SizeKey): number {
  return BRUSHES[brush].sizes[key];
}
