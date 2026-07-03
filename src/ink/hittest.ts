import type { Stroke } from './stroke.ts';

/**
 * Geometría del borrador: distancia punto-segmento y hit-test contra el
 * esqueleto del trazo (sus puntos), con pre-filtro por caja envolvente.
 * Todo en unidades de documento. Funciones puras, testeables.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function distPointToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y); // segmento degenerado
  // Proyección de p sobre la recta AB, acotada al segmento.
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

const bboxCache = new WeakMap<Stroke, Box>();

/** Caja envolvente del esqueleto del trazo (sin inflar), cacheada. */
export function strokeBBox(stroke: Stroke): Box {
  let box = bboxCache.get(stroke);
  if (box) return box;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  box = { minX, minY, maxX, maxY };
  bboxCache.set(stroke, box);
  return box;
}

/**
 * ¿El círculo de borrado (centro p, radio radius) toca el trazo?
 * El radio efectivo incluye el semigrosor del trazo.
 */
export function strokeHit(stroke: Stroke, p: Pt, radius: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  const r = radius + stroke.size / 2;

  // Pre-filtro barato por bbox inflada.
  const box = strokeBBox(stroke);
  if (p.x < box.minX - r || p.x > box.maxX + r || p.y < box.minY - r || p.y > box.maxY + r) {
    return false;
  }

  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= r;
  for (let i = 1; i < pts.length; i++) {
    if (distPointToSegment(p, pts[i - 1], pts[i]) <= r) return true;
  }
  return false;
}
