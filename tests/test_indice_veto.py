import pytest

from camara.analise import conferir_veto
from camara.site import montar
from camara.vetos import oficio_e_data

OFICIO = ("Cubatão, 22 de maio de 2026. Ofício nº 069/2026/SEJUR. Senhor Presidente, comunico o VETO TOTAL ao "
          "Projeto de Lei nº 4/2026, pois a proposta cria despesa sem indicar a fonte de custeio.")


def test_oficio_e_data():
    of, data = oficio_e_data(OFICIO, "x.pdf")
    assert of == "Ofício nº 069/2026/SEJUR" and data == "2026-05-22"


def test_conferir_veto_descarta_trecho_inventado():
    r = conferir_veto({"resumo": "Veto total.", "fundamento": "custo_ou_orcamento",
                       "razoes": [{"razao": "cria despesa", "trecho": "cria despesa sem indicar a fonte de custeio"},
                                  {"razao": "inventada", "trecho": "viola a Constituicao Federal"}]}, OFICIO)
    assert [x["razao"] for x in r["razoes"]] == ["cria despesa"]
    assert r["razoes_descartadas"][0]["razao"] == "inventada"


def test_conferir_veto_fundamento_desconhecido_vira_outro():
    assert conferir_veto({"resumo": "x", "fundamento": "politico"}, OFICIO)["fundamento"] == "outro"
    with pytest.raises(ValueError):
        conferir_veto({"resumo": ""}, OFICIO)


@pytest.fixture(scope="module")
def base():
    return montar("data")


def test_indice_coerente(base):
    for v in base.vereadores.values():
        i = v["indice"]
        assert 0 <= i["nota"] <= 10
        conta = [p for p in i["pilares"] if not p.get("nao_se_aplica")]
        assert i["pontos_validos"] == sum(p["max"] for p in conta)
        for p in i["pilares"]:
            assert 0 <= p["pontos"] <= p["max"] + 1e-6
            for it in p["itens"]:
                assert it["conta"] and 0 <= it["pontos"] <= it["max"] + 1e-6
        if v.get("cargo") == "presidente":
            assert next(p for p in i["pilares"] if p["id"] == "participacao")["nao_se_aplica"]


def test_quem_presidia():
    from camara.site import quem_presidia
    ev = lambda p, v: {"votos": {"pres": p, "vice": v}}
    assert quem_presidia(ev("BRANCO", "SIM"), "pres", "vice") == "pres"
    assert quem_presidia(ev("BRANCO", "BRANCO"), "pres", "vice") == "pres"
    assert quem_presidia(ev("AUSENTE", "BRANCO"), "pres", "vice") == "vice"
    assert quem_presidia(ev("SIM", "BRANCO"), "pres", "vice") == "vice"
    assert quem_presidia(ev("SIM", "SIM"), "pres", "vice") is None


def test_vice_nao_perde_participacao_por_presidir(base):
    vice = next(v for v in base.vereadores.values() if v.get("cargo") == "vice")
    p2 = next(p for p in vice["indice"]["pilares"] if p["id"] == "participacao")
    assert p2["presidiu"] > 0 and "presidiu outras" in p2["itens"][0]["conta"]
