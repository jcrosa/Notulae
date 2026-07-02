# Notulae

App web de notas manuscritas para **iPad + Apple Pencil** (Safari/WebKit).

Estado actual: **Fase 0 — Esqueleto y despliegue**. Lienzo a pantalla completa
que pinta trazos crudos (sin suavizado) con el Pencil, desplegable en GitHub Pages.

## Requisitos

- Node 20+

## Desarrollo

```bash
npm install
npm run dev      # servidor local en http://localhost:5173
npm run build    # type-check + build de producción en dist/
npm run lint     # eslint + tsc --noEmit
npm test         # tests unitarios (vitest)
```

## Estructura (ver CLAUDE.md §6)

```
src/
  input/   captura de Pointer Events + rechazo de palma
  ink/     modelo de stroke (perfect-freehand en Fase 1)
  render/  lienzo, render incremental
  store/   modelo de nota, undo/redo, IndexedDB (Fase 2/3)
  ui/      toolbar, lista de notas (Fase 2/3)
  debug/   overlay de métricas (?debug=1)
```

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` construye y publica en cada push a la
rama de trabajo. **Una sola vez**, activarlo en el repo:

1. Settings → Pages → **Source = "GitHub Actions"**.
2. Hacer push a la rama de trabajo; el job `Deploy a GitHub Pages` publica en
   `https://<usuario>.github.io/notulae/`.

## Cómo probar en el iPad (Fase 0)

1. Abrir en Safari (iPadOS 18.2+) la URL de Pages: `https://<usuario>.github.io/notulae/`.
2. Escribir con el Apple Pencil: debe pintar una línea negra fina siguiendo el trazo.
3. **Rechazo de palma**: apoyar la mano/dedos sobre el lienzo no debe pintar ni
   mover la vista; solo el Pencil pinta.
4. **Sin scroll/zoom accidental**: gestos y pellizcos no deben desplazar ni ampliar
   la página.
5. Añadir `?debug=1` a la URL para ver el contador de eventos/s.

> Nota de fase: el suavizado, la presión→grosor (perfect-freehand) y los gestos
> multitáctiles llegan en la Fase 1 y 2. Aquí el trazo es crudo a propósito.
