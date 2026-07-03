import type { BrushId, SizeKey } from '../ink/brushes.ts';
import type { PageFormat } from './note.ts';

export type Tool = BrushId | 'eraser';

export interface ToolState {
  tool: Tool;
  color: string;
  sizeKey: SizeKey;
  pageFormat: PageFormat;
}

type Listener = (state: ToolState) => void;

/**
 * Estado de herramienta con suscripción simple. La toolbar escribe aquí;
 * el trazo lo lee UNA vez en onStrokeStart — nada de UI en el hot path.
 */
export class ToolStore {
  private current: ToolState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: ToolState) {
    this.current = initial;
  }

  get state(): Readonly<ToolState> {
    return this.current;
  }

  set(partial: Partial<ToolState>): void {
    this.current = { ...this.current, ...partial };
    for (const fn of this.listeners) fn(this.current);
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
