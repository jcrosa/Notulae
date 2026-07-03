import './style.css';
import { CanvasSurface, type BBox } from './render/canvas.ts';
import { PointerInput } from './input/pointer.ts';
import { GestureRecognizer, GesturePointerAdapter } from './input/gestures.ts';
import { createStroke, type InkPoint, type Stroke } from './ink/stroke.ts';
import {
  strokeOutline,
  outlineToPath,
  outlineBBox,
  DEFAULT_FREEHAND,
  type FreehandOptions,
} from './ink/outline.ts';
import { createPage, isInsidePage, PAGE_FORMATS, type PageFormat } from './store/note.ts';
import {
  fitToScreen,
  screenToDoc,
  zoomAt,
  panBy,
  MIN_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  type Viewport,
} from './render/viewport.ts';
import { DebugOverlay, isDebugEnabled } from './debug/overlay.ts';

// Estilo de tinta fijo hasta el bloque de pinceles (Bloque 3 del plan).
// Grosor en unidades de documento.
const INK_COLOR = '#1a1a1a';
const INK_SIZE = 4;

function getCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`No se encontró el elemento <canvas id="${id}">.`);
  }
  return el;
}

// Capa estática: escritorio + página + trazos terminados. Capa viva: trazo en curso.
const staticSurface = new CanvasSurface(getCanvas('ink-canvas'));
const liveSurface = new CanvasSurface(getCanvas('live-canvas'));
const debug = isDebugEnabled() ? new DebugOverlay() : null;

// ---- Documento y viewport ----------------------------------------------------

function screenRatio(): number {
  return window.innerWidth / window.innerHeight;
}

// Formato provisional por query string (?page=square) hasta la toolbar (Bloque 3).
function initialFormat(): PageFormat {
  const q = new URLSearchParams(window.location.search).get('page');
  return PAGE_FORMATS.includes(q as PageFormat) ? (q as PageFormat) : 'a4-portrait';
}

let page = createPage(initialFormat(), screenRatio());
let viewport: Viewport = fitToScreen(page, window.innerWidth, window.innerHeight);
/** Escala de referencia para los límites de zoom (se recalcula al re-encuadrar). */
let fitScale = viewport.scale;

// Trazos SIEMPRE en unidades de documento.
const strokes: Stroke[] = [];

function freehandFor(_stroke: Stroke, isPen: boolean): FreehandOptions {
  return { ...DEFAULT_FREEHAND, size: INK_SIZE, simulatePressure: !isPen };
}

function redrawStatic(): void {
  staticSurface.renderScene(page, viewport, strokes, (s) => freehandFor(s, true));
}

/** Coalesce a un repintado de la estática por frame durante pan/zoom. */
let staticRedrawPending = false;
function scheduleStaticRedraw(): void {
  if (staticRedrawPending) return;
  staticRedrawPending = true;
  requestAnimationFrame(() => {
    staticRedrawPending = false;
    redrawStatic();
  });
}

// ---- Estado del trazo vivo -----------------------------------------------------

let current: Stroke | null = null;
let currentIsPen = true;
let currentOpts: FreehandOptions = DEFAULT_FREEHAND;
/** Últimos puntos predichos (en doc): solo para el render del frame. */
let predictedTail: readonly InkPoint[] = [];
let dirty = false;
let rafId = 0;
/** BBox (doc) pintado en el frame anterior, para borrar solo esa zona. */
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
  if (box) {
    liveSurface.renderLiveStroke(outlineToPath(outline), current.color, page, viewport, lastLiveBBox);
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

// ---- Escritura con el Pencil ----------------------------------------------------

/** Convierte un punto del input (px CSS) a unidades de documento. */
function toDoc(p: InkPoint): InkPoint {
  const d = screenToDoc(viewport, p);
  return { x: d.x, y: d.y, pressure: p.pressure };
}

const input = new PointerInput(liveSurface.canvas, {
  onStrokeStart(point, isPen) {
    debug?.countEvent(1);
    const docPoint = toDoc(point);
    if (!isInsidePage(page, docPoint)) return; // no se escribe fuera del papel
    current = createStroke(INK_COLOR, INK_SIZE);
    current.points.push(docPoint);
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
    for (const p of points) current.points.push(toDoc(p));
    predictedTail = predicted.map(toDoc);
    dirty = true;
  },

  onStrokeEnd() {
    stopRaf();
    if (!current) return;
    // Trazo final SIN predichos: pasa a la capa estática (y a su caché).
    strokes.push(current);
    staticSurface.renderScene(page, viewport, strokes, (s) => freehandFor(s, currentIsPen));
    liveSurface.clear();
    current = null;
    predictedTail = [];
    lastLiveBBox = null;
    debug?.setStrokePoints(0);
  },
});

// ---- Gestos de 2 dedos: pinch = zoom, arrastre = pan -----------------------------

const gestures = new GestureRecognizer({
  onPinchPan(centroid, dx, dy, scaleFactor) {
    if (current) return; // el pen tiene prioridad; no mover el lienzo escribiendo
    viewport = panBy(
      zoomAt(viewport, centroid, scaleFactor, fitScale * MIN_ZOOM_FACTOR, fitScale * MAX_ZOOM_FACTOR),
      dx,
      dy,
    );
    scheduleStaticRedraw();
  },
  // Los taps de 2/3 dedos se cablean a undo/redo en el Bloque 4.
});
new GesturePointerAdapter(liveSurface.canvas, gestures);

// ---- Resize / rotación ------------------------------------------------------------

function refit(): void {
  staticSurface.resize();
  liveSurface.resize();
  input.refreshRect();
  viewport = fitToScreen(page, window.innerWidth, window.innerHeight);
  fitScale = viewport.scale;
  redrawStatic();
}

window.addEventListener('resize', refit);

// Primer render.
redrawStatic();
