import type { Stroke } from '../ink/stroke.ts';
import type { StrokeStore } from './strokes.ts';

/**
 * Comando del historial. `erase` guarda los trazos CON el índice que
 * ocupaban en el momento de borrarlos, en el orden en que se borraron:
 * deshacer reinserta en orden inverso para restaurar el z-order exacto.
 */
export type Command =
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; strokes: { stroke: Stroke; index: number }[] };

/** Tope de comandos recordados (los más antiguos se descartan). */
const MAX_HISTORY = 100;

export class History {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  constructor(
    private readonly store: StrokeStore,
    /** Se llama tras cualquier cambio (para repintar y refrescar la UI). */
    private readonly onChange?: () => void,
  ) {}

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Añade un trazo nuevo (ya terminado) al documento. */
  pushAdd(stroke: Stroke): void {
    this.store.add(stroke);
    this.record({ type: 'add', stroke });
  }

  /** Borra los trazos indicados (un solo comando por arrastre de borrador). */
  pushErase(ids: readonly string[]): void {
    const removed: { stroke: Stroke; index: number }[] = [];
    for (const id of ids) {
      const entry = this.store.removeById(id);
      if (entry) removed.push(entry);
    }
    if (removed.length === 0) return;
    this.record({ type: 'erase', strokes: removed });
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    if (cmd.type === 'add') {
      this.store.removeById(cmd.stroke.id);
    } else {
      // Reinsertar en orden inverso al borrado restaura los índices exactos.
      for (let i = cmd.strokes.length - 1; i >= 0; i--) {
        this.store.insertAt(cmd.strokes[i].index, cmd.strokes[i].stroke);
      }
    }
    this.redoStack.push(cmd);
    this.onChange?.();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    if (cmd.type === 'add') {
      this.store.add(cmd.stroke);
    } else {
      for (const { stroke } of cmd.strokes) this.store.removeById(stroke.id);
    }
    this.undoStack.push(cmd);
    this.onChange?.();
    return true;
  }

  private record(cmd: Command): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0; // una acción nueva invalida el redo
    this.onChange?.();
  }
}
