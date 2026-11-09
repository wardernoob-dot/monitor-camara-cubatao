"""Todo modulo do pacote precisa compilar: os outros testes nao importam __main__,
e um erro de sintaxe ali so aparecia na hora da coleta (falhou em 06/11/2026)."""
import importlib
import pkgutil

import camara


def test_todos_os_modulos_importam():
    for m in pkgutil.iter_modules(camara.__path__):
        importlib.import_module(f"camara.{m.name}")


def test_css_sem_classe_morta_nem_branco_preto_solto():
    """Classe do CSS que nenhum componente usa e #fff/#000 fora de variavel (regra do CLAUDE.md) nao voltam."""
    import re
    from pathlib import Path
    raiz = Path(__file__).resolve().parent.parent / "frontend" / "src"
    css = re.sub(r"/\*.*?\*/", "", (raiz / "estilo.css").read_text("utf-8"), flags=re.S)
    css_sem_url = re.sub(r"url\([^)]*\)", "", css)
    fonte = "".join(p.read_text("utf-8") for p in raiz.rglob("*.ts*"))
    classes = set(re.findall(r"\.([a-zA-Z][\w-]*)", css_sem_url))
    mortas = sorted(c for c in classes if c.split("--")[0].split("__")[0] not in fonte and c not in fonte)
    assert mortas == [], f"classes sem uso: {mortas}"
    assert not re.findall(r"#(?:fff|000)\b(?![0-9a-fA-F])", css), "use var(--branco) / var(--preto)"
