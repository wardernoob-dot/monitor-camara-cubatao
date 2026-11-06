"""Invariantes do que o site publica (dados.json gerado offline a partir de data/).

Complementa test_site.py::test_exporta_json_do_app (que confere as referencias do app) com regras
sobre o conteudo: placar bate com os votos, todo voto tem fonte, parecer vem rotulado, e dois casos
de referencia (PL 75/2026 e PL 92/2026) que ja foram conferidos contra o resumo e o painel.

Cada teste usa os dados commitados: se o robo ou o parser mudar um desses numeros, o teste falha e
alguem precisa olhar antes de publicar.
"""
import json
import re
from pathlib import Path

import pytest

from camara import site as S

RAIZ = Path(__file__).resolve().parent.parent
VALORES_DE_VOTO = {"SIM", "NAO", "BRANCO", "AUSENTE"}


@pytest.fixture(scope="module")
def dados(tmp_path_factory):
    saida = tmp_path_factory.mktemp("site")
    S.exportar(RAIZ / "data", saida)
    return json.loads((saida / "dados.json").read_text("utf-8"))


def _rotulo(v):
    return f"{v['data']} {v['materia']} ({v['etapa']})"


def test_votos_so_tem_valores_conhecidos(dados):
    for v in dados["votacoes"]:
        assert set(v["votos"].values()) <= VALORES_DE_VOTO, _rotulo(v)


def test_placar_bate_com_os_votos(dados):
    """Presente sem voto e ausente nunca entram em sim nem em nao."""
    for v in dados["votacoes"]:
        if not v["votos"]:
            continue
        sim = sum(1 for x in v["votos"].values() if x == "SIM")
        nao = sum(1 for x in v["votos"].values() if x == "NAO")
        assert (v["sim"], v["nao"]) == (sim, nao), _rotulo(v)


def test_aprovado_tem_mais_sim_que_nao(dados):
    """So o sentido seguro: aprovado exige mais sim que nao. (Rejeitado com mais sim pode ser quorum.)"""
    for v in dados["votacoes"]:
        if v["resultado"] == "APROVADO" and v["sim"] is not None:
            assert v["sim"] > v["nao"], _rotulo(v)


def test_todo_voto_tem_fonte(dados):
    """Regra do projeto: todo voto mostra de onde veio, com link."""
    for v in dados["votacoes"]:
        if not v["votos"]:
            continue
        assert v["fonte"] in ("painel", "resumo"), _rotulo(v)
        if v["fonte"] == "painel":
            assert v["link"], f"painel sem link do video: {_rotulo(v)}"
        else:
            assert v["resumo_url"], f"resumo sem url do documento: {_rotulo(v)}"


def test_etapa_de_parecer_diz_se_e_favoravel_ou_contrario(dados):
    """Sem o rotulo o leitor nao sabe o que o SIM significa (num parecer contrario, SIM e contra o projeto)."""
    pareceres = [v for v in dados["votacoes"] if v["etapa"] == "parecer"]
    assert pareceres, "nenhum parecer nos dados: o teste perdeu o sentido"
    for v in pareceres:
        assert re.search(r"favor|contr", v["etapa_txt"], re.I), f"{_rotulo(v)}: '{v['etapa_txt']}'"


def _votacao(dados, data, materia, etapa):
    achadas = [v for v in dados["votacoes"] if (v["data"], v["materia"], v["etapa"]) == (data, materia, etapa)]
    assert len(achadas) == 1, f"esperava 1 votacao de {materia} {etapa} em {data}, achei {len(achadas)}"
    return achadas[0]


def test_pl75_parecer_contrario_aprovado(dados):
    """Sessao de 20/10/2026: aprovar o parecer contrario = votar contra o projeto. Placar e do parecer."""
    v = _votacao(dados, "2026-10-20", "pl-75-2026", "parecer")
    assert "contr" in v["etapa_txt"].lower()
    assert v["resultado"] == "APROVADO" and (v["sim"], v["nao"]) == (8, 6)
    assert v["fonte"] == "painel" and v["link"]
    assert v["sentido"] == "inverso"


def test_pl92_parecer_contrario_rejeitado(dados):
    """Sessao de 29/10/2026: parecer contrario rejeitado; quem votou NAO foi a favor do projeto."""
    v = _votacao(dados, "2026-10-29", "pl-92-2026", "parecer")
    assert "contr" in v["etapa_txt"].lower()
    assert v["resultado"] == "REJEITADO" and (v["sim"], v["nao"]) == (3, 11)
    assert v["votos"]["xuxa"] == "NAO"
    assert v["sentido"] == "inverso"


def test_sentido_do_parecer_acompanha_o_rotulo(dados):
    """O front explica o SIM pelo campo `sentido`: parecer contrario inverte, favoravel nao."""
    for v in dados["votacoes"]:
        if v["etapa"] == "parecer":
            esperado = "inverso" if "contr" in v["etapa_txt"].lower() else "direto"
            assert v["sentido"] == esperado, f"{_rotulo(v)}: '{v['etapa_txt']}' -> {v['sentido']}"


@pytest.mark.xfail(strict=True, reason=(
    "Aberto, aguardando decisao do dono do projeto: etapas sem votacao (projeto voltou as comissoes, "
    "retirado de pauta) saem com sim=0 e nao=0 e a tela mostra 'Sem resultado registrado 0 a 0', "
    "como se fosse uma votacao com zero votos. Com sim/nao = None o front nao mostra placar. "
    "Quando for corrigido este teste passa e o xfail estrito avisa para remover a marca."))
def test_etapa_sem_votacao_nao_tem_placar_zero(dados):
    for v in dados["votacoes"]:
        if not v["votos"] and not v["resultado"]:
            assert v["sim"] is None and v["nao"] is None, _rotulo(v)
