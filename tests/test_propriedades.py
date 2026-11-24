"""Testes por propriedade (Hypothesis) do que limpa e lê o texto dos PDFs da Câmara.

Em vez de exemplos escolhidos a dedo, cada teste afirma uma regra sobre todo um domínio de entradas
e deixa o gerador caçar o contraexemplo. As palavras e os nomes vêm dos próprios documentos
(fixtures dos resumos e cadastro de vereadores), então os casos parecem PDF de verdade.

Defeitos reais dos PDFs que estes testes simulam (ver textclean.py): negrito falso (cada letra
repetida), letra cirílica/grega com cara de latina no meio da palavra, espaços e caixa diferentes
no mesmo nome.
"""
import json
import re
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from camara import nomes as N
from camara import textclean as T
from camara.parser_resumo import parse_resumo

RAIZ = Path(__file__).resolve().parent.parent
FIX = Path(__file__).parent / "fixtures"

# ---------------------------------------------------------------- vocabulário real

_VOCAB = sorted({
    w for f in ("ord35_2026.txt", "ext17_2026_ordem.txt", "ord06_2026_parcial.txt")
    for w in re.findall(r"[A-Za-zÀ-ÿ0-9º°ª/.,-]+", T.normalize((FIX / f).read_text("utf-8")))
    # palavra "ja duplicada" de verdade (ex.: "SS") confunde de proposito o desduplicador; fica fora do vocabulario
    if 2 <= len(w) <= 20 and not T._is_doubled(w) and not T._is_word_doubled(w)
})
_CADASTRO = json.loads((RAIZ / "data" / "vereadores.json").read_text("utf-8"))
_NOMES = sorted(x["nome"] for x in _CADASTRO.get("vereadores", _CADASTRO).values())

palavra = st.sampled_from(_VOCAB)
linha = st.lists(palavra, min_size=3, max_size=12).map(" ".join)
nome = st.sampled_from(_NOMES)

# letra latina -> homoglifo cirilico (o inverso do que textclean desfaz)
_PARA_CIRILICO = {"A": "А", "B": "В", "E": "Е", "O": "О", "P": "Р", "C": "С", "T": "Т", "X": "Х", "M": "М", "H": "Н",
                  "a": "а", "e": "е", "o": "о", "p": "р", "c": "с", "x": "х"}


def dobra_letras(s: str) -> str:
    """Negrito falso do PDF: 'SESSÃO DE' -> 'SSEESSSSÃÃOO DDEE'."""
    return " ".join("".join(c * 2 for c in t) for t in s.split(" "))


@st.composite
def com_homoglifos(draw, texto: str):
    """Troca algumas letras latinas pela cirilica de mesma cara."""
    posicoes = [i for i, c in enumerate(texto) if c in _PARA_CIRILICO]
    escolhidas = draw(st.sets(st.sampled_from(posicoes), max_size=len(posicoes))) if posicoes else set()
    return "".join(_PARA_CIRILICO[c] if i in escolhidas else c for i, c in enumerate(texto))


# ---------------------------------------------------------------- textclean

def test_vocabulario_carregou():
    # se as fixtures mudarem e o vocabulario ficar vazio, os testes abaixo passariam sem testar nada
    assert len(_VOCAB) > 200 and len(_NOMES) >= 15


@given(linha)
def test_desfazer_negrito_falso_devolve_a_linha(l):
    """Inverso: undouble_line(dobra_letras(l)) == l."""
    assert T.undouble_line(dobra_letras(l)) == l


@given(linha)
def test_linha_limpa_nao_muda(l):
    """Identidade: texto sem negrito falso passa intacto."""
    assert T.undouble_line(l) == l


@given(st.lists(linha, min_size=1, max_size=6).map("\n".join))
def test_normalize_idempotente(texto):
    """normalize(normalize(x)) == normalize(x): limpar de novo nao estraga."""
    uma = T.normalize(texto)
    assert T.normalize(uma) == uma


@given(st.data())
def test_homoglifos_somem(data):
    """Inverso: trocar letras por cirilicas e passar em sem_homoglifos devolve o texto original."""
    l = data.draw(linha)
    sujo = data.draw(com_homoglifos(l))
    assert T.sem_homoglifos(sujo) == l
    assert not re.search(r"[Ͱ-ϿЀ-ӿ]", T.normalize(sujo))


# ---------------------------------------------------------------- nomes

@given(nome)
def test_chave_estavel_por_grafia(n):
    """Caixa, acento e espacos sobrando nao mudam a chave do vereador."""
    k = N.chave(n)
    assert N.chave(n.upper()) == k
    assert N.chave(T.strip_accents(n)) == k
    assert N.chave("  " + n.replace(" ", "   ") + " ") == k
    assert N.chave(k) == k and re.fullmatch(r"[a-z]+( [a-z]+)*", k)


@given(nome)
def test_display_preserva_chave(n):
    assert N.chave(N.display(n.upper())) == N.chave(n)


@given(st.lists(nome, min_size=1, max_size=8, unique=True))
def test_lista_de_nomes_ida_e_volta(lista):
    """Roundtrip: 'A, B, C e D' -> [A, B, C, D], como o resumo escreve quem votou."""
    texto = lista[0] if len(lista) == 1 else ", ".join(lista[:-1]) + " e " + lista[-1]
    assert N.split_lista(texto) == lista
    assert N.split_lista("Os Vereadores: " + texto + ".") == lista


@given(st.data())
def test_registro_resolve_grafias(data):
    """Todo vereador cadastrado e achado exato, em caixa alta, sem acento ou com homoglifo."""
    reg = N.Registro()
    for n in _NOMES:
        reg.adicionar(n)
    n = data.draw(nome)
    k = N.chave(n)
    variante = data.draw(st.sampled_from([n.upper(), T.strip_accents(n), n.lower()]))
    assert reg.resolver(variante) == (k, True)
    sujo = data.draw(com_homoglifos(n))
    assert reg.resolver(T.sem_homoglifos(sujo)) == (k, True)


# ---------------------------------------------------------------- parser inteiro

_RESUMO = (FIX / "ord35_2026.txt").read_text("utf-8")


def _assinatura(r: dict):
    """O que importa do resultado: sessao, itens e cada voto."""
    return json.dumps({k: r[k] for k in r if k not in ("avisos", "notas", "fonte")}, sort_keys=True, ensure_ascii=False)


_BASE = _assinatura(parse_resumo(_RESUMO))


@settings(deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(st.data())
def test_parser_ignora_homoglifos(data):
    """Oraculo: o mesmo resumo com letras cirilicas espalhadas da exatamente os mesmos votos."""
    linhas = _RESUMO.split("\n")
    i = data.draw(st.integers(0, len(linhas) - 1))
    linhas[i] = data.draw(com_homoglifos(linhas[i]))
    assert _assinatura(parse_resumo("\n".join(linhas))) == _BASE


@settings(deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(st.data())
def test_parser_ignora_negrito_falso(data):
    """Oraculo: uma linha do resumo em negrito falso nao muda nenhum voto."""
    linhas = _RESUMO.split("\n")
    # so linha limpa: o cabecalho do fixture ja vem em negrito falso do PDF real, e o PDF nunca duplica duas vezes
    candidatas = [i for i, l in enumerate(linhas) if len(l.split()) >= 3 and T.undouble_line(l) == l]
    i = data.draw(st.sampled_from(candidatas))
    linhas[i] = dobra_letras(re.sub(r"[ \t]+", " ", linhas[i]).strip())
    assert _assinatura(parse_resumo("\n".join(linhas))) == _BASE


@pytest.mark.parametrize("corte", [0.1, 0.5, 0.9])
def test_parser_aguenta_pdf_cortado(corte):
    """PDF incompleto (download interrompido) nao derruba o parser."""
    parse_resumo(_RESUMO[: int(len(_RESUMO) * corte)])
