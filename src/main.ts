import './style.css';
import { CanvasSurface } from './render/canvas.ts';
import { PointerInput } from './input/pointer.ts';
import { createStroke, type InkPoint, type Stroke } from './ink/stroke.ts';
import { DebugOverlay, isDebugEnabled } from './debug/overlay.ts';

// Estilo de tinta fijo en Fase 0 (configurable en Fase 2).
const INK_COLOR = '#1a1a1a';
const INK_SIZE = 2.4;

const canvasEl = document.getElementById('ink-canvas');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('No se encontró el elemento <canvas id="ink-canvas">.');
}

const surface = new CanvasSurface(canvasEl);
const debug = isDebugEnabled() ? new DebugOverlay() : null;

// Historial simple de trazos: necesario para repintar tras un resize.
// La estructura definitiva de undo/redo llega en Fase 2.
const strokes: Stroke[] = [];
let current: Stroke | null = null;

new PointerInput(canvasEl, {
  onStrokeStart(point: InkPoint) {
    debug?.countEvent();
    current = createStroke(INK_COLOR, INK_SIZE);
    current.points.push(point);
    strokes.push(current);
  },

  onStrokeMove(point: InkPoint) {
    debug?.countEvent();
    if (!current) return;
    const prev = current.points[current.points.length - 1];
    current.points.push(point);
    surface.drawSegment(prev, point, current);
  },

  onStrokeEnd() {
    if (current && current.points.length === 1) {
      // Un toque sin desplazamiento: pinta un punto.
      surface.drawDot(current.points[0], current);
    }
    current = null;
  },
});

// Redibujado tras cambios de tamaño/orientación del iPad.
window.addEventListener('resize', () => {
  surface.resize();
  surface.redrawAll(strokes);
});
