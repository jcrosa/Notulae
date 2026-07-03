import { BRUSHES, BRUSH_IDS, INK_COLORS, type BrushId, type SizeKey } from '../ink/brushes.ts';
import { PAGE_FORMATS, type PageFormat } from '../store/note.ts';
import type { ToolStore } from '../store/toolState.ts';

const BRUSH_ICONS: Record<BrushId, string> = {
  pen: '✒️',
  marker: '🖊️',
  highlighter: '🖍️',
  pencil: '✏️',
};

const SIZE_KEYS: readonly SizeKey[] = ['fine', 'medium', 'thick'];
const SIZE_DOTS: Record<SizeKey, number> = { fine: 6, medium: 10, thick: 15 };

const FORMAT_LABELS: Record<PageFormat, string> = {
  'a4-portrait': 'A4 vertical',
  'a4-landscape': 'A4 horizontal',
  square: 'Cuadrada',
  screen: 'Pantalla',
};

/**
 * Toolbar mínima en DOM puro. Se maneja con el dedo (el dedo no pinta, así
 * que no hay conflicto con el lienzo). Escribe en ToolStore; el hot path del
 * trazo nunca toca este código.
 */
export function createToolbar(store: ToolStore): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'toolbar';

  // --- Pinceles ---
  const brushGroup = group();
  const brushButtons = new Map<BrushId, HTMLButtonElement>();
  for (const id of BRUSH_IDS) {
    const btn = button(BRUSH_ICONS[id], BRUSHES[id].label);
    btn.addEventListener('click', () => store.set({ tool: id }));
    brushButtons.set(id, btn);
    brushGroup.appendChild(btn);
  }
  bar.appendChild(brushGroup);

  // --- Colores ---
  const colorGroup = group();
  const colorButtons = new Map<string, HTMLButtonElement>();
  for (const { value, label } of INK_COLORS) {
    const btn = button('', label);
    btn.classList.add('swatch');
    btn.style.setProperty('--swatch', value);
    btn.addEventListener('click', () => store.set({ color: value }));
    colorButtons.set(value, btn);
    colorGroup.appendChild(btn);
  }
  bar.appendChild(colorGroup);

  // --- Grosores ---
  const sizeGroup = group();
  const sizeButtons = new Map<SizeKey, HTMLButtonElement>();
  for (const key of SIZE_KEYS) {
    const btn = button('', `Grosor ${key}`);
    btn.classList.add('size');
    const dot = document.createElement('span');
    dot.className = 'size-dot';
    dot.style.width = dot.style.height = `${SIZE_DOTS[key]}px`;
    btn.appendChild(dot);
    btn.addEventListener('click', () => store.set({ sizeKey: key }));
    sizeButtons.set(key, btn);
    sizeGroup.appendChild(btn);
  }
  bar.appendChild(sizeGroup);

  // --- Formato de página ---
  const select = document.createElement('select');
  select.title = 'Formato de página';
  for (const format of PAGE_FORMATS) {
    const opt = document.createElement('option');
    opt.value = format;
    opt.textContent = FORMAT_LABELS[format];
    select.appendChild(opt);
  }
  select.addEventListener('change', () => store.set({ pageFormat: select.value as PageFormat }));
  bar.appendChild(select);

  // --- Estado activo ---
  const sync = (): void => {
    const s = store.state;
    for (const [id, btn] of brushButtons) btn.setAttribute('aria-pressed', String(s.tool === id));
    for (const [c, btn] of colorButtons) btn.setAttribute('aria-pressed', String(s.color === c));
    for (const [k, btn] of sizeButtons) btn.setAttribute('aria-pressed', String(s.sizeKey === k));
    select.value = s.pageFormat;
  };
  store.onChange(sync);
  sync();

  document.body.appendChild(bar);
  return bar;
}

function group(): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'tb-group';
  return div;
}

function button(text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.title = title;
  btn.setAttribute('aria-pressed', 'false');
  return btn;
}
