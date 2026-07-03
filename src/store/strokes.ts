import type { Stroke } from '../ink/stroke.ts';

/**
 * Lista ordenada de trazos del documento. El orden importa: es el z-order
 * de pintado (y la composición multiply del subrayador depende de él).
 */
export class StrokeStore {
  private list: Stroke[] = [];

  get all(): readonly Stroke[] {
    return this.list;
  }

  add(stroke: Stroke): void {
    this.list.push(stroke);
  }

  /** Elimina por id y devuelve el trazo con el índice que ocupaba. */
  removeById(id: string): { stroke: Stroke; index: number } | null {
    const index = this.list.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const [stroke] = this.list.splice(index, 1);
    return { stroke, index };
  }

  /** Reinserta un trazo en su posición original (para deshacer un borrado). */
  insertAt(index: number, stroke: Stroke): void {
    this.list.splice(Math.min(index, this.list.length), 0, stroke);
  }
}
