# Notulae

App web de notas manuscritas para **iPad + Apple Pencil** (Safari/WebKit).

Estado actual: **Fases 1 y 2 completadas** — motor de tinta con perfect-freehand
(presión real + coalesced events), página con formatos y zoom/pan, 4 pinceles
(pluma, rotulador, subrayador, lápiz), 4 colores, 3 grosores, borrador por trazo
y undo/redo con gestos (tap 2 dedos = deshacer, 3 = rehacer).

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
   `https://<usuario>.github.io/Notulae/`.

## Cómo probar en el iPad

1. Abrir en Safari (iPadOS 18.2+) la URL de Pages: `https://<usuario>.github.io/Notulae/`.
2. **Trazo**: escribir con el Pencil; el grosor responde a la presión (pluma/lápiz),
   curvas rápidas salen suaves y no se pierden puntos.
3. **Rechazo de palma**: la mano apoyada no pinta ni mueve la vista.
4. **Pinceles**: elegir pincel/color/grosor con el dedo en la toolbar. El
   subrayador no tapa la tinta (multiply); el lápiz tiene grano.
5. **Página**: pinch de 2 dedos = zoom; arrastre de 2 dedos = pan; el desplegable
   cambia el formato (A4 V/H, cuadrada, pantalla) conservando los trazos; girar
   el iPad re-encuadra.
6. **Historial**: tap de 2 dedos = deshacer; tap de 3 = rehacer (también botones).
7. **Borrador**: borra trazos completos al pasar por encima; un arrastre = un
   comando de deshacer.
8. `?debug=1` muestra eventos/s, coalescidos/evento, ms de frame y puntos del trazo.
