import './style.css';
import { CanvasSurface, freehandOptsFor, type BBox } from './render/canvas.ts';
import { PointerInput } from './input/pointer.ts';
import { GestureRecognizer, GesturePointerAdapter } from './input/gestures.ts';
import { createStroke, type InkPoint, type Stroke } from './ink/stroke.ts';
import { resolveSize, HIGHLIGHTER_DEFAULT, type BrushId } from './ink/brushes.ts';
import { strokeOutline, outlineToPath, outlineBBox } from './ink/outline.ts';
import { strokeHit } from './ink/hittest.ts';
import { createPage, isInsidePage, PAGE_FORMATS, type PageFormat } from './store/note.ts';
import { StrokeStore } from './store/strokes.ts';
import { History } from './store/history.ts';
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

// Trazos SIEMPRE en unidades de documento, con historial de comandos.
const strokes = new StrokeStore();
const history = new History(strokes, () => {
  redrawStatic();
  syncHistoryUi();
});

/** Trazos ocultados en vivo durante un arrastre de borrador. */
const hiddenIds = new Set<string>();

function visibleStrokes(): readonly Stroke[] {
  if (hiddenIds.size === 0) return strokes.all;
  return strokes.all.filter((s) => !hiddenIds.has(s.id));
}

function redrawStatic(): void {
  staticSurface.renderScene(page, viewport, visibleStrokes());
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

// ---- Borrador --------------------------------------------------------------------

let erasing = false;

/** Radio del borrador: ~12 px constantes en pantalla, con suelo en doc. */
function eraserRadius(): number {
  return Math.max(6, 12 / viewport.scale);
}

function eraseAt(docPoint: InkPoint): void {
  const radius = eraserRadius();
  let hitSomething = false;
  for (const stroke of strokes.all) {
    if (hiddenIds.has(stroke.id)) continue;
    if (strokeHit(stroke, docPoint, radius)) {
      hiddenIds.add(stroke.id);
      hitSomething = true;
    }
  }
  if (hitSomething) scheduleStaticRedraw();
  liveSurface.renderEraserCursor(docPoint, radius, viewport, lastLiveBBox);
  const r = radius + 4;
  lastLiveBBox = { x: docPoint.x - r, y: docPoint.y - r, w: r * 2, h: r * 2 };
}

function endErase(): void {
  erasing = false;
  liveSurface.clear();
  lastLiveBBox = null;
  if (hiddenIds.size > 0) {
    // Un único comando por arrastre: deshacerlo restaura todos los trazos.
    history.pushErase([...hiddenIds]);
    hiddenIds.clear();
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
    const docPoint = toDoc(point);
    if (s.tool === 'eraser') {
      erasing = true;
      lastLiveBBox = null;
      eraseAt(docPoint);
      return;
    }
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
    if (erasing) {
      for (const p of points) eraseAt(toDoc(p));
      return;
    }
    if (!current) return;
    for (const p of points) current.points.push(toDoc(p));
    predictedTail = predicted.map(toDoc);
    dirty = true;
  },

  onStrokeEnd() {
    if (erasing) {
      endErase();
      return;
    }
    stopRaf();
    if (!current) return;
    // Trazo final SIN predichos: entra al documento vía historial (con su
    // estilo real, p.ej. multiply del subrayador, y a las cachés).
    history.pushAdd(current);
    liveSurface.clear();
    current = null;
    predictedTail = [];
    lastLiveBBox = null;
    debug?.setStrokePoints(0);
  },
});

// ---- Gestos: pinch = zoom, pan de 2 dedos, tap 2 dedos = undo, 3 = redo -----------

const gestures = new GestureRecognizer({
  onPinchPan(centroid, dx, dy, scaleFactor) {
    if (current || erasing) return; // el pen tiene prioridad
    viewport = panBy(
      zoomAt(viewport, centroid, scaleFactor, fitScale * MIN_ZOOM_FACTOR, fitScale * MAX_ZOOM_FACTOR),
      dx,
      dy,
    );
    scheduleStaticRedraw();
  },
  onTap(fingers) {
    if (fingers === 2) history.undo();
    else if (fingers >= 3) history.redo();
  },
});
new GesturePointerAdapter(liveSurface.canvas, gestures);

// ---- Toolbar ----------------------------------------------------------------------

const toolbar = createToolbar(tools, {
  onUndo: () => history.undo(),
  onRedo: () => history.redo(),
});

function syncHistoryUi(): void {
  toolbar.setHistoryState(history.canUndo(), history.canRedo());
}

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
