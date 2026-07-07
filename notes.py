"""Notulae - una pequeña app de notas por línea de comandos.

Las notas se guardan en un archivo JSON local (notes.json).
"""

import json
import os
import sys
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes.json")


def _load():
    """Carga la lista de notas desde el archivo de datos."""
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError:
            return []


def _save(notes):
    """Guarda la lista de notas en el archivo de datos."""
    with open(DATA_FILE, "w", encoding="utf-8") as fh:
        json.dump(notes, fh, ensure_ascii=False, indent=2)


def add_note(text):
    """Agrega una nota nueva y devuelve su identificador."""
    notes = _load()
    note_id = (max((n["id"] for n in notes), default=0)) + 1
    notes.append(
        {
            "id": note_id,
            "text": text,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
    )
    _save(notes)
    return note_id


def list_notes():
    """Devuelve todas las notas almacenadas."""
    return _load()


def delete_note(note_id):
    """Elimina la nota con el identificador dado. Devuelve True si existía."""
    notes = _load()
    remaining = [n for n in notes if n["id"] != note_id]
    if len(remaining) == len(notes):
        return False
    _save(remaining)
    return True


def search_notes(query):
    """Busca notas cuyo texto contenga la consulta (sin distinguir mayúsculas)."""
    query = query.casefold()
    return [n for n in _load() if query in n["text"].casefold()]


# TODO: permitir editar el texto de una nota existente (edit_note).


def _print_notes(notes):
    if not notes:
        print("No hay notas.")
        return
    for n in notes:
        print(f'[{n["id"]}] {n["text"]}  ({n["created_at"]})')


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        print("Uso: notes.py <add|list|delete|search> [args]")
        return 1

    command, rest = argv[0], argv[1:]

    if command == "add":
        if not rest:
            print("Uso: notes.py add <texto>")
            return 1
        note_id = add_note(" ".join(rest))
        print(f"Nota {note_id} agregada.")
    elif command == "list":
        _print_notes(list_notes())
    elif command == "delete":
        if len(rest) != 1 or not rest[0].isdigit():
            print("Uso: notes.py delete <id>")
            return 1
        if delete_note(int(rest[0])):
            print(f"Nota {rest[0]} eliminada.")
        else:
            print(f"No existe la nota {rest[0]}.")
            return 1
    elif command == "search":
        if not rest:
            print("Uso: notes.py search <consulta>")
            return 1
        _print_notes(search_notes(" ".join(rest)))
    else:
        print(f"Comando desconocido: {command}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
