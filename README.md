# Notulae

App de notas — una pequeña app de notas por línea de comandos.

## Uso

```bash
python3 notes.py add "comprar pan"   # agrega una nota
python3 notes.py list                # lista todas las notas
python3 notes.py search pan          # busca notas por texto
python3 notes.py delete 1            # elimina la nota con id 1
```

Las notas se guardan en `notes.json` en el directorio del proyecto.

## Pruebas

```bash
python3 test_notes.py
```

## Pendiente

- [ ] Editar el texto de una nota existente (ver `TODO` en `notes.py`).
