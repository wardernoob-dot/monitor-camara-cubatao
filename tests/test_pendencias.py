from camara import pendencias as P

LEI = ("CAPÍTULO I DA INSTITUIÇÃO Art. 1° Fica instituído o sistema. Art. 2º As vias sujeitas ao sistema serão definidas por ato "
       "da Companhia Municipal de Trânsito. Art. 3º O Poder Executivo regulamentará esta lei no prazo de 90 (noventa) dias. "
       "Art. 4º O valor será fixado por decreto do Poder Executivo. Art. 15. Esta Lei entra em vigor em 1º de janeiro de 2027.")


def test_vigencia_por_data_dias_e_publicacao():
    assert P.vigencia(LEI, "2026-03-27")["data"] == "2027-01-01"
    assert P.vigencia("Esta lei entra em vigor após decorridos 60 (sessenta) dias de sua publicação.", "2026-07-06")["data"] == "2026-09-04"
    v = P.vigencia("Esta Lei entra em vigor na data de sua publicação.", "2026-10-06")
    assert v["data"] == "2026-10-06" and v["regra"] == "publicacao"


def test_dependencias_trazem_trecho_literal_e_prazo():
    d = P.dependencias(LEI, "2026-03-27")
    assert len(d) == 3 and all(x["trecho"] in LEI for x in d)
    com_prazo = [x for x in d if "vence" in x]
    assert com_prazo == [{"trecho": "Art. 3º O Poder Executivo regulamentará esta lei no prazo de 90 (noventa) dias.",
                          "prazo_dias": 90, "vence": "2026-06-25"}]
    assert P.dependencias("Art. 1º Fica denominada Rua Tal a via que especifica.", "2026-01-01") == []


def test_lei_sem_texto_no_diario_nao_inventa(tmp_path):
    assert P.da_lei(tmp_path, {"numero": "1", "data": "2026-01-01", "url": "https://x/imprimir.php?acao=materia&id=999"}) is None
    assert P.da_lei(tmp_path, None) is None
