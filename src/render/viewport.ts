import type { Page } from '../store/note.ts';

/**
 * Viewport de la nota: transformación documento→pantalla.
 * `screen = doc * scale + t`. Matemática pura, sin DOM.
 */
export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Límites de zoom relativos a la escala de ajuste a pantalla. */
export const MIN_ZOOM_FACTOR = 0.25;
export const MAX_ZOOM_FACTOR = 8;

export function docToScreen(v: Viewport, p: Pt): Pt {
  return { x: p.x * v.scale + v.tx, y: p.y * v.scale + v.ty };
}

export function screenToDoc(v: Viewport, p: Pt): Pt {
  return { x: (p.x - v.tx) / v.scale, y: (p.y - v.ty) / v.scale };
}

/**
 * Viewport que encuadra la página completa centrada en el área visible,
 * con un margen en píxeles de pantalla.
 */
export function fitToScreen(page: Page, viewW: number, viewH: number, margin = 24): Viewport {
  const availW = Math.max(1, viewW - margin * 2);
  const availH = Math.max(1, viewH - margin * 2);
  const scale = Math.min(availW / page.width, availH / page.height);
  return {
    scale,
    tx: (viewW - page.width * scale) / 2,
    ty: (viewH - page.height * scale) / 2,
  };
}

/**
 * Zoom multiplicativo con ancla en un punto de PANTALLA: el punto del
 * documento bajo el ancla no se mueve. La escala se acota a
 * [minScale, maxScale] (normalmente fit·0.25 – fit·8).
 */
export function zoomAt(
  v: Viewport,
  anchorScreen: Pt,
  factor: number,
  minScale: number,
  maxScale: number,
): Viewport {
  const scale = Math.min(maxScale, Math.max(minScale, v.scale * factor));
  const k = scale / v.scale;
  return {
    scale,
    tx: anchorScreen.x - k * (anchorScreen.x - v.tx),
    ty: anchorScreen.y - k * (anchorScreen.y - v.ty),
  };
}

/** Desplaza el viewport en píxeles de pantalla. */
export function panBy(v: Viewport, dx: number, dy: number): Viewport {
  return { scale: v.scale, tx: v.tx + dx, ty: v.ty + dy };
}
