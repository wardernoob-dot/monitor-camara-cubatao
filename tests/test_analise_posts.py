import json

from PIL import Image

from camara import analise as A
from camara import posts as P

DOC = {"texto": "Art. 1º Fica instituído o Programa de Apoio. Art. 5º O Poder Executivo regulamentará esta Lei "
                "no prazo de 90 (noventa) dias.", "so_ementa": False, "fonte": "texto", "url": None}


def test_trecho_inexistente_derruba_o_ponto():
    saida = {"resumo": "Cria um programa.", "o_que_muda": ["a", "b"], "natureza": "politica_publica",
             "pontos_de_atencao": [
                 {"ponto": "Depende de regulamento em 90 dias.", "trecho": "o Poder Executivo regulamentará esta lei"},
                 {"ponto": "Custa R$ 2 milhões.", "trecho": "custo estimado de R$ 2.000.000,00"},
                 {"ponto": "O texto não indica fonte de recursos.", "trecho": ""}]}
    r = A.conferir(saida, DOC)
    assert [p["ponto"] for p in r["pontos_de_atencao"]] == ["Depende de regulamento em 90 dias.",
                                                           "O texto não indica fonte de recursos."]
    assert r["pontos_descartados"][0]["ponto"] == "Custa R$ 2 milhões."


def test_so_ementa_nao_aceita_ausencia_nem_justificativa():
    r = A.conferir({"resumo": "x", "justificativa_do_autor": "Segundo o autor...", "natureza": "inventada",
                    "pontos_de_atencao": [{"ponto": "O texto não traz custo.", "trecho": ""}]},
                   {**DOC, "so_ementa": True})
    assert r["pontos_de_atencao"] == [] and r["justificativa_do_autor"] == "" and r["natureza"] == "outro"
    assert "ementa" in r["limitacoes"]


def test_prompt_publico_tem_os_campos():
    corpo, versao = A._prompt()
    assert "{documento}" in corpo and "{fonte}" in corpo and len(versao) == 10


def _dia():
    votos = {k: "SIM" for k in list(P.APELIDO)[:11]}
    votos.update({"marcio silva nascimento": "NAO", "jose elan dos santos gomes": "BRANCO"})
    return {"data": "2026-10-29", "status": "oficial_conferido",
            "sessoes": [{"numero": 29, "tipo": "extraordinaria", "data": "2026-10-29"}],
            "materias": [{
                "tipo": "PL", "numero": "92", "ano": "2026", "autoria": "PREFEITO MUNICIPAL",
                "assunto": "ALTERA A REDAÇÃO DO INCISO II DO ART. 6º DA LEI", "na_pauta": True,
                "resultado_oficial": "aprovado",
                "diario_oficial": [{"tipo": "lei", "numero": "4487", "data": "2026-10-29"}],
                "votacoes": [{"etapa": "2a_discussao", "painel": {
                    "resultado": "APROVADO", "votos": votos, "completo": True, "link": "https://youtu.be/x?t=1",
                    "lido": "PL nº 92/2026 - 2ª Discussão", "validacao": "confirmado_pauta"},
                    "resumo": None, "conferencia": {"status": "diverge", "divergencias": [
                        {"tipo": "resumo_inclui_nao_votante", "vereador": "jose elan dos santos gomes",
                         "painel": "nao votou", "resumo": "SIM"}]}}]}]}


def test_post_do_dia(tmp_path):
    (tmp_path / "consolidado").mkdir()
    (tmp_path / "consolidado" / "2026-10-29.json").write_text(json.dumps(_dia(), ensure_ascii=False), "utf-8")
    (tmp_path / "indice.json").write_text("{}", "utf-8")
    r = P.gerar_dia(tmp_path, "2026-10-29")
    assert r == {"data": "2026-10-29", "slides": 2}
    pasta = tmp_path / "posts" / "2026-10-29"
    assert Image.open(pasta / "02.png").size == (1080, 1350)
    leg = (pasta / "legenda.txt").read_text("utf-8")
    assert "Contra: Marcinho." in leg and "Não votaram: Batoré." in leg
    assert "Lei nº 4.487" in leg and "não registrou voto no painel e consta como favorável" in leg
    assert len(leg) <= 2200
    assert P.gerar_dia(tmp_path, "2026-10-29") is None  # nada mudou: nao regrava


def test_frase_mantem_numeral_romano():
    assert P.frase("ALTERA A REDAÇÃO DO INCISO II DO ART. 6º") == "Altera a redação do inciso II do art. 6º"


def test_carregar_tipo_sem_analise_devolve_none(tmp_path):
    """RQ (requerimento) aparece no site mas nao tem analise: nao pode estourar ValueError."""
    import pytest

    from camara import analise as AN

    assert AN.carregar(tmp_path, "RQ", "2", "2026") is None
    with pytest.raises(ValueError):
        AN.chave_materia("../x", "1", "2026")


def test_analise_de_projeto_que_virou_lei_usa_o_texto_da_lei_primeiro():
    from camara import analise as A2
    doc = {"texto": "PROJETO: efeitos a partir de 2026. JUSTIFICATIVA: organizar as vagas.", "fonte": "texto integral", "url": "u", "so_ementa": False}
    r = A2.com_lei(doc, {"numero": "4.451", "texto": "LEI 4.451. Art. 15. Esta Lei entra em vigor em 1 de janeiro de 2027."})
    assert r["texto"].index("2027") < r["texto"].index("efeitos a partir de 2026") and "lei publicada" in r["fonte"]
    assert A2.com_lei(doc, None) is doc
    so_lei = A2.com_lei({**doc, "so_ementa": True}, {"numero": "1", "texto": "Art. 1 cria o programa."})
    assert so_lei["so_ementa"] is False and "cria o programa" in so_lei["texto"] and "PROJETO" not in so_lei["texto"]
    assert A2.com_lei({}, {"numero": "1", "texto": "Art. 1"})["fonte"].startswith("texto da lei")


def test_pdf_sem_artigo_nao_vale_como_texto_do_projeto(tmp_path):
    """PR 3/2026: o PDF publicado era a planta de uma reforma. Sem 'Art. 1' nao e texto de projeto: cai pra ementa."""
    import json
    from camara import analise as A
    sha = "a" * 64
    (tmp_path / "texto").mkdir()
    (tmp_path / "indice.json").write_text(json.dumps({"u": {
        "url": "https://www.cubatao.sp.leg.br/processo-legislativo/projetos-de-lei/arquivos/copy3_of_2025/PR%2003.2026.pdf",
        "secao": "projetos", "sha256": sha, "paginas": 2, "precisa_ocr": False, "titulo": "x"}}), "utf-8")
    (tmp_path / "texto" / f"{sha}.txt").write_text("PROJETO PARA REFORMA DO EDIFICIO SEDE " * 30, "utf-8")
    d = A.documento(tmp_path, "PR", "3", "2026", "Denomina a sala de exposicoes")
    assert d["so_ementa"] is True
    (tmp_path / "texto" / f"{sha}.txt").write_text("Art. 1º Fica denominada a sala de exposicoes. " * 20, "utf-8")
    assert A.documento(tmp_path, "PR", "3", "2026", "x")["so_ementa"] is False
