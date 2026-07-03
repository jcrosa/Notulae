import './style.css';
import { CanvasSurface, freehandOptsFor, type BBox } from './render/canvas.ts';
import { PointerInput } from './input/pointer.ts';
import { GestureRecognizer, GesturePointerAdapter } from './input/gestures.ts';
import { createStroke, type InkPoint, type Stroke } from './ink/stroke.ts';
import { resolveSize, HIGHLIGHTER_DEFAULT, type BrushId } from './ink/brushes.ts';
import { strokeOutline, outlineToPath, outlineBBox } from './ink/outline.ts';
import { createPage, isInsidePage, PAGE_FORMATS, type PageFormat } from './store/note.ts';
import { ToolStore } from './store/toolState.ts';
import { createToolbar } from './ui/toolbar.ts';
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

// ---- Estado de herramienta y documento ----------------------------------------

// Formato inicial por query string (?page=square) como atajo de pruebas.
function initialFormat(): PageFormat {
  const q = new URLSearchParams(window.location.search).get('page');
  return PAGE_FORMATS.includes(q as PageFormat) ? (q as PageFormat) : 'a4-portrait';
}

function screenRatio(): number {
  return window.innerWidth / window.innerHeight;
}

const tools = new ToolStore({
  tool: 'pen',
  color: '#1a1a1a',
  sizeKey: 'medium',
  pageFormat: initialFormat(),
});

let page = createPage(tools.state.pageFormat, screenRatio());
let viewport: Viewport = fitToScreen(page, window.innerWidth, window.innerHeight);
/** Escala de referencia para los límites de zoom (se recalcula al re-encuadrar). */
let fitScale = viewport.scale;

// Trazos SIEMPRE en unidades de documento.
const strokes: Stroke[] = [];

function redrawStatic(): void {
  staticSurface.renderScene(page, viewport, strokes);
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

// Cambio de formato de página desde la toolbar: re-encuadre, trazos intactos.
tools.onChange((s) => {
  if (s.pageFormat !== page.format) {
    page = createPage(s.pageFormat, screenRatio());
    refit();
  }
});

// ---- Estado del trazo vivo -----------------------------------------------------

let current: Stroke | null = null;
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
  const outline = strokeOutline(pts, freehandOptsFor(current));
  const box = outlineBBox(outline, 4);
  if (box) {
    liveSurface.renderLiveStroke(outlineToPath(outline), current, box, page, viewport, lastLiveBBox);
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

/** Color efectivo: el subrayador negro no tiene sentido → amarillo. */
function inkColorFor(brush: BrushId, color: string): string {
  if (brush === 'highlighter' && color === '#1a1a1a') return HIGHLIGHTER_DEFAULT;
  return color;
}

const input = new PointerInput(liveSurface.canvas, {
  onStrokeStart(point, isPen) {
    debug?.countEvent(1);
    const s = tools.state;
    if (s.tool === 'eraser') return; // el borrador llega en el Bloque 4
    const docPoint = toDoc(point);
    if (!isInsidePage(page, docPoint)) return; // no se escribe fuera del papel
    current = createStroke(
      s.tool,
      inkColorFor(s.tool, s.color),
      resolveSize(s.tool, s.sizeKey),
      isPen,
    );
    current.points.push(docPoint);
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
    // Trazo final SIN predichos: pasa a la capa estática (con su estilo real,
    // p.ej. multiply del subrayador, y a las cachés de path/bitmap).
    strokes.push(current);
    redrawStatic();
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

// ---- Toolbar ----------------------------------------------------------------------

createToolbar(tools);

// ---- Resize / rotación -------------------------------------------------------------

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
