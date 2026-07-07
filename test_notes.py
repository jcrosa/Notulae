"""Pruebas básicas para notes.py."""

import os
import tempfile


def _fresh_module(tmp_path):
    import notes

    notes.DATA_FILE = os.path.join(tmp_path, "notes.json")
    return notes


def test_add_and_list():
    with tempfile.TemporaryDirectory() as tmp:
        notes = _fresh_module(tmp)
        notes.add_note("comprar pan")
        notes.add_note("llamar a Ana")
        items = notes.list_notes()
        assert [n["text"] for n in items] == ["comprar pan", "llamar a Ana"]
        assert [n["id"] for n in items] == [1, 2]


def test_delete():
    with tempfile.TemporaryDirectory() as tmp:
        notes = _fresh_module(tmp)
        notes.add_note("una")
        notes.add_note("dos")
        assert notes.delete_note(1) is True
        assert notes.delete_note(99) is False
        assert [n["text"] for n in notes.list_notes()] == ["dos"]


def test_search():
    with tempfile.TemporaryDirectory() as tmp:
        notes = _fresh_module(tmp)
        notes.add_note("Comprar Pan")
        notes.add_note("llamar a Ana")
        notes.add_note("pan integral")
        results = notes.search_notes("pan")
        assert {n["text"] for n in results} == {"Comprar Pan", "pan integral"}


if __name__ == "__main__":
    test_add_and_list()
    test_delete()
    test_search()
    print("OK")
