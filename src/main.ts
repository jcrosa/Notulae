import './style.css';
import { CanvasSurface, type BBox } from './render/canvas.ts';
import { PointerInput } from './input/pointer.ts';
import { createStroke, type Stroke } from './ink/stroke.ts';
import {
  strokeOutline,
  outlineToPath,
  outlineBBox,
  DEFAULT_FREEHAND,
  type FreehandOptions,
} from './ink/outline.ts';
import { DebugOverlay, isDebugEnabled } from './debug/overlay.ts';

// Estilo de tinta fijo hasta el bloque de pinceles (Bloque 3 del plan).
const INK_COLOR = '#1a1a1a';
const INK_SIZE = 4;

function getCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`No se encontró el elemento <canvas id="${id}">.`);
  }
  return el;
}

// Capa estática: trazos terminados. Capa viva: el trazo en curso.
const staticSurface = new CanvasSurface(getCanvas('ink-canvas'));
const liveSurface = new CanvasSurface(getCanvas('live-canvas'));
const debug = isDebugEnabled() ? new DebugOverlay() : null;

// Historial simple de trazos en memoria (undo/redo llega en el Bloque 4).
const strokes: Stroke[] = [];

function freehandFor(_stroke: Stroke, isPen: boolean): FreehandOptions {
  return { ...DEFAULT_FREEHAND, size: INK_SIZE, simulatePressure: !isPen };
}

// ---- Estado del trazo vivo -------------------------------------------------

let current: Stroke | null = null;
let currentIsPen = true;
let currentOpts: FreehandOptions = DEFAULT_FREEHAND;
/** Últimos puntos predichos recibidos: solo para el render del frame. */
let predictedTail: readonly { x: number; y: number; pressure: number }[] = [];
let dirty = false;
let rafId = 0;
/** BBox pintado en el frame anterior, para borrar solo esa zona. */
let lastLiveBBox: BBox | null = null;

function renderLiveFrame(): void {
  rafId = requestAnimationFrame(renderLiveFrame);
  if (!current || !dirty) return;
  dirty = false;

  const t0 = performance.now();
  // El outline vivo incluye los predichos, que nunca se almacenan.
  const pts = predictedTail.length > 0 ? current.points.concat(predictedTail) : current.points;
  const outline = strokeOutline(pts, currentOpts);
  const box = outlineBBox(outline, 4);

  if (lastLiveBBox) liveSurface.clearRect(lastLiveBBox);
  if (box) {
    liveSurface.fillPath(outlineToPath(outline), current.color);
    // Une el bbox nuevo con el anterior por si el trazo "encoge" (predichos).
    lastLiveBBox = box;
  }
  debug?.frameTime(performance.now() - t0);
  debug?.setStrokePoints(current.points.length);
}

function startRaf(): void {
  if (rafId === 0) rafId = requestAnimationFrame(renderLiveFrame);
}

function stopRaf(): void {
  if (rafId !== 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

// ---- Cableado del input -----------------------------------------------------

const input = new PointerInput(liveSurface.canvas, {
  onStrokeStart(point, isPen) {
    debug?.countEvent(1);
    current = createStroke(INK_COLOR, INK_SIZE);
    current.points.push(point);
    currentIsPen = isPen;
    currentOpts = freehandFor(current, isPen);
    predictedTail = [];
    lastLiveBBox = null;
    dirty = true;
    startRaf();
  },

  onStrokeMove(points, predicted) {
    debug?.countEvent(points.length);
    if (!current) return;
    for (const p of points) current.points.push(p);
    predictedTail = predicted;
    dirty = true;
  },

  onStrokeEnd() {
    stopRaf();
    if (!current) return;
    // Trazo final SIN predichos: pasa a la capa estática (y a su caché).
    strokes.push(current);
    staticSurface.drawStroke(current, freehandFor(current, currentIsPen));
    liveSurface.clear();
    current = null;
    predictedTail = [];
    lastLiveBBox = null;
    debug?.setStrokePoints(0);
  },
});

// ---- Resize / rotación -------------------------------------------------------

window.addEventListener('resize', () => {
  staticSurface.resize();
  liveSurface.resize();
  input.refreshRect();
  staticSurface.redrawAll(strokes, (s) => freehandFor(s, true));
});
