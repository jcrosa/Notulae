import { describe, it, expect, vi } from 'vitest';
import { StrokeStore } from './strokes.ts';
import { History } from './history.ts';
import type { Stroke } from '../ink/stroke.ts';

let n = 0;
function stroke(): Stroke {
  return {
    id: `s${n++}`,
    points: [{ x: 0, y: 0, pressure: 0.5 }],
    brush: 'pen',
    color: '#000',
    size: 2,
    fromPen: true,
  };
}

const ids = (store: StrokeStore) => store.all.map((s) => s.id);

describe('History', () => {
  it('pushAdd añade y undo lo quita; redo lo devuelve', () => {
    const store = new StrokeStore();
    const h = new History(store);
    const a = stroke();
    h.pushAdd(a);
    expect(ids(store)).toEqual([a.id]);
    expect(h.canUndo()).toBe(true);

    expect(h.undo()).toBe(true);
    expect(ids(store)).toEqual([]);
    expect(h.canRedo()).toBe(true);

    expect(h.redo()).toBe(true);
    expect(ids(store)).toEqual([a.id]);
  });

  it('undo/redo sin nada que hacer devuelven false', () => {
    const h = new History(new StrokeStore());
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
  });

  it('una acción nueva invalida la pila de redo', () => {
    const store = new StrokeStore();
    const h = new History(store);
    h.pushAdd(stroke());
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.pushAdd(stroke());
    expect(h.canRedo()).toBe(false);
  });

  it('deshacer un borrado múltiple restaura el orden (z-order) exacto', () => {
    const store = new StrokeStore();
    const h = new History(store);
    const [a, b, c, d] = [stroke(), stroke(), stroke(), stroke()];
    for (const s of [a, b, c, d]) h.pushAdd(s);

    h.pushErase([b.id, d.id]); // un solo comando por arrastre
    expect(ids(store)).toEqual([a.id, c.id]);

    h.undo();
    expect(ids(store)).toEqual([a.id, b.id, c.id, d.id]); // orden exacto

    h.redo();
    expect(ids(store)).toEqual([a.id, c.id]);
  });

  it('borrar ids inexistentes no registra comando', () => {
    const store = new StrokeStore();
    const h = new History(store);
    h.pushErase(['nope']);
    expect(h.canUndo()).toBe(false);
  });

  it('notifica onChange en cada cambio', () => {
    const store = new StrokeStore();
    const onChange = vi.fn();
    const h = new History(store, onChange);
    h.pushAdd(stroke());
    h.undo();
    h.redo();
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
