"""Normalizacao de nomes de vereadores.

Os resumos escrevem o mesmo nome de jeitos diferentes ("Barbosa"/"Barboza",
com e sem acento, caixa alta na lista de presenca). Tudo vira uma chave unica.
"""
import difflib
import re

from .textclean import strip_accents

_PARTICLES = {"de", "da", "das", "do", "dos", "e"}


def chave(nome: str) -> str:
    s = strip_accents(nome).lower()
    s = re.sub(r"[^a-z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def display(nome: str) -> str:
    """'JOSÉ ELAN DOS SANTOS GOMES' -> 'José Elan dos Santos Gomes'."""
    parts = re.sub(r"\s+", " ", nome).strip().split(" ")
    out = []
    for i, p in enumerate(parts):
        low = p.lower()
        out.append(low if (i > 0 and low in _PARTICLES) else low[:1].upper() + low[1:])
    return " ".join(out)


def split_lista(nomes: str) -> list[str]:
    """'A, B, C e D' -> ['A', 'B', 'C', 'D']."""
    s = re.sub(r"\s+", " ", nomes).strip(" :,.")
    s = re.sub(r"^(?:Os|As|O|A)\s+Vereador(?:es|as|a)?\s*:?\s*", "", s, flags=re.I)
    partes = re.split(r",\s*|\s+e\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])", s)
    return [p.strip(" .") for p in partes if p.strip(" .")]


class Registro:
    """Catalogo de vereadores conhecidos; resolve variacoes de grafia."""

    def __init__(self):
        self._por_chave: dict[str, str] = {}  # chave -> nome de exibicao

    def adicionar(self, nome: str) -> str:
        k = chave(nome)
        if k and k not in self._por_chave:
            self._por_chave[k] = display(nome)
        return k

    def resolver(self, nome: str, cutoff: float = 0.86):
        """Retorna (chave_canonica, exato:bool) ou (None, False)."""
        k = chave(nome)
        if k in self._por_chave:
            return k, True
        hit = difflib.get_close_matches(k, list(self._por_chave), n=1, cutoff=cutoff)
        if hit:
            return hit[0], False
        return None, False

    def nome(self, k: str) -> str:
        return self._por_chave.get(k, k)

    def todos(self) -> dict[str, str]:
        return dict(self._por_chave)
