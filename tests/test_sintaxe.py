"""Todo modulo do pacote precisa compilar: os outros testes nao importam __main__,
e um erro de sintaxe ali so aparecia na hora da coleta (falhou em 06/11/2026)."""
import importlib
import pkgutil

import camara


def test_todos_os_modulos_importam():
    for m in pkgutil.iter_modules(camara.__path__):
        importlib.import_module(f"camara.{m.name}")
