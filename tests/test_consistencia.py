"""O placar e o resultado que o site resume batem com a situacao oficial da materia.

Nasceu da revisao de 21/11/2026: o resumo da sessao dizia que o veto das bets "nao foi votado (11 a 3)" e o
cartao da home mostrava o PL 58/2026 com 12 votos (votacao de parecer) quando a aprovacao foi 14 a 0.
Os dois erros eram da camada que escolhe UMA votacao para resumir a materia. Estes testes travam essa camada:
se o robo trouxer um caso novo que ela escolhe errado, a coleta para antes de publicar.
"""
import json
import re
from pathlib import Path

import pytest

from camara import site as S

RAIZ = Path(__file__).resolve().parent.parent
ACESSORIAS = {"parecer", "parecer_emenda", "emenda", "parecer_comissao"}
CIRILICO = re.compile(r"[Ѐ-ӿ]")


@pytest.fixture(scope="module")
def dados(tmp_path_factory):
    saida = tmp_path_factory.mktemp("site")
    S.exportar(RAIZ / "data", saida)
    return json.loads((saida / "dados.json").read_text("utf-8"))


@pytest.fixture(scope="module")
def votacao(dados):
    return {v["id"]: v for v in dados["votacoes"]}


def test_decisiva_e_uma_votacao_da_propria_materia(dados):
    for m in dados["materias"]:
        if m["decisiva"] is not None:
            assert m["decisiva"] in m["eventos"], m["slug"]


def test_decisiva_tem_placar_e_nao_e_emenda(dados, votacao):
    for m in dados["materias"]:
        if m["decisiva"] is None:
            continue
        v = votacao[m["decisiva"]]
        assert v["sim"] is not None, m["slug"]
        assert v["etapa"] not in ("emenda", "parecer_emenda", "parecer_comissao"), f"{m['slug']}: {v['etapa_txt']}"
        if v["etapa"] == "parecer":  # so quando o projeto caiu (ou passou) no parecer, que tem lado definido
            assert v["sentido"] in ("direto", "inverso"), m["slug"]


def test_toda_materia_com_placar_tem_decisiva(dados, votacao):
    for m in dados["materias"]:
        com_placar = [votacao[i] for i in m["eventos"] if votacao[i]["sim"] is not None
                      and votacao[i]["etapa"] not in ACESSORIAS]
        if com_placar:
            assert m["decisiva"] is not None, m["slug"]


def test_aprovado_pela_camara_tem_decisiva_aprovada(dados, votacao):
    for m in dados["materias"]:
        if m["situacao_cls"] in ("aprovado", "lei") and m["decisiva"] is not None and m["tipo"] != "VETO":
            v = votacao[m["decisiva"]]
            if v["etapa"] == "parecer":
                continue
            assert v["resultado"] == "APROVADO", f"{m['slug']}: {m['situacao']} x {v['etapa_txt']} {v['resultado']}"


def test_rejeitado_tem_decisiva_que_derruba(dados, votacao):
    for m in dados["materias"]:
        if m["situacao_cls"] == "rejeitado" and m["decisiva"] is not None:
            v = votacao[m["decisiva"]]
            derrubou = v["resultado"] == "REJEITADO" if v["sentido"] != "inverso" else v["resultado"] == "APROVADO"
            assert derrubou, f"{m['slug']}: {v['etapa_txt']} {v['resultado']}"


def test_veto_mantido_ou_derrubado_bate_com_o_detalhe_do_resumo(dados, votacao):
    """O evento de veto sai sem 'resultado'; o front le o detalhe. Os dois precisam contar a mesma historia."""
    for m in dados["materias"]:
        if m["tipo"] != "VETO" or not (m["veto"] or {}).get("resultado"):
            continue
        detalhes = " ".join((votacao[i]["detalhe"] or "").upper() for i in m["eventos"])
        if "MANTID" in detalhes:
            assert m["veto"]["resultado"] == "veto_mantido", m["slug"]
        if "REJEITAD" in detalhes or "DERRUBAD" in detalhes:
            assert m["veto"]["resultado"] == "veto_derrubado", m["slug"]


def test_votacao_de_emenda_ou_parecer_vem_com_nome(dados):
    """Votacao do painel com cabecalho 'PL n 58/2026 - Emendas' nao pode aparecer como 'Votacao' generica."""
    for v in dados["votacoes"]:
        if v["etapa"] == "unica":
            assert v["etapa_txt"] == "Votação"
        if v["etapa"] in ACESSORIAS:
            assert v["etapa_txt"] not in ("Votação", ""), v


def test_casos_de_referencia(dados, votacao):
    m = {x["slug"]: x for x in dados["materias"]}
    pl58 = votacao[m["pl-58-2026"]["decisiva"]]
    assert (pl58["etapa"], pl58["sim"], pl58["nao"], pl58["resultado"]) == ("2a_discussao", 14, 0, "APROVADO")
    veto = votacao[m["veto-178-2025"]["decisiva"]]
    assert (veto["sim"], veto["nao"]) == (11, 3) and "MANTID" in veto["detalhe"].upper()
    assert m["veto-178-2025"]["veto"]["resultado"] == "veto_mantido"


def test_veto_de_antes_da_cobertura_nao_e_dado_como_pendente(dados):
    for m in dados["materias"]:
        v = m["veto"] or {}
        if v.get("fora_da_cobertura"):
            assert "falta a Câmara votar" not in m["situacao"], m["slug"]
            assert (v.get("data_oficio") or "") < "2026-01-01", m["slug"]


def test_texto_publicado_sem_letra_cirilica(dados):
    """PDF da Camara traz 'autistа' com 'а' cirilico; sem a troca, buscar 'autista' nao acha o projeto."""
    for m in dados["materias"]:
        for campo in ("titulo", "assunto"):
            assert not CIRILICO.search(m[campo] or ""), f"{m['slug']}.{campo}: {m[campo]}"
