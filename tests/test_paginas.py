import json
from pathlib import Path

from camara import paginas as PG

RAIZ = Path(__file__).resolve().parent.parent


def _pacote():
    v = {"slug": "fulano", "exibicao": "Fulano <b>", "nome": "Fulano de Tal", "partido": "PSX", "partido_fonte": "resumo oficial",
         "partido_url": "javascript:alert(1)", "em_exercicio": True, "presenca": {"sim": 9}, "sessoes_total": 10, "leis": 0,
         "projetos": ["pl-1-2026"], "foto": None, "foto_p": None}
    evs = [
        {"id": 0, "data": "2026-09-15", "materia": "pl-1-2026", "etapa": "parecer", "etapa_txt": "Parecer contrário",
         "resultado": "REJEITADO", "sim": 1, "nao": 0, "fonte": "painel", "link": "https://youtu.be/x?t=1", "resumo_url": None,
         "sentido": "inverso", "votos": {"fulano": "SIM"}},
        {"id": 1, "data": "2026-03-10", "materia": "pl-1-2026", "etapa": "unica", "etapa_txt": "Discussão única",
         "resultado": "APROVADO", "sim": 1, "nao": 0, "fonte": "resumo", "link": None, "resumo_url": "https://camara/x.pdf",
         "sentido": "direto", "votos": {"fulano": "SIM"}},
    ]
    m = {"slug": "pl-1-2026", "titulo": "PL 1/2026", "tipo": "PL", "tipo_nome": "Projeto de Lei", "situacao": "Aprovado pela Câmara",
         "autoria": "Fulano", "autores": ["fulano"], "assunto": "Cria <script>alert(1)</script> o programa", "eventos": [0, 1],
         "lista": True, "documento": "https://camara/pl1.pdf", "documento_arquivo": None, "explicacao": None, "lei": None,
         "ultima_data": "2026-09-15"}
    r = {"id": "teste", "status": "publicado", "data": "2026-11-20", "chapeu": "Saúde", "manchete": "Manchete", "linha_fina": "Fina",
         "projetos": ["pl-1-2026"], "corpo": [{"t": "p", "x": "Veja o [projeto](#/projetos/pl-1-2026) e [isto](javascript:x)."}],
         "foto": {"credito": "Fulano/Agência", "licenca": "CC BY", "ilustrativa": True}}
    return {"meta": {"atualizado": "2026-11-24T10:00+00:00"}, "vereadores": [v], "materias": [m], "votacoes": evs, "reportagens": [r]}


def test_gera_paginas_sitemap_e_escapa(tmp_path):
    assert PG.gerar(_pacote(), tmp_path)["paginas"] == 6  # home, 2 listas, vereador, projeto, reportagem
    ver = (tmp_path / "vereadores" / "fulano" / "index.html").read_text("utf-8")
    proj = (tmp_path / "projetos" / "pl-1-2026" / "index.html").read_text("utf-8")
    rep = (tmp_path / "o-que-muda" / "teste" / "index.html").read_text("utf-8")
    # nada de HTML nem javascript: vindo do dado
    assert "<script>alert" not in proj and "Fulano &lt;b&gt;" in ver and "javascript:" not in ver + rep
    # canonical no endereco indexavel e link pra versao completa
    assert f'href="{PG.SITE_INDEXAVEL}/vereadores/fulano/"' in ver and 'href="../../#/vereadores/fulano"' in ver
    # regras de voto: fonte em todo voto, Sim do parecer contrario explicado, nota do resumo
    assert "painel na transmissão" in proj and "resumo oficial da sessão" in proj
    assert "votar Sim era ser contra o projeto" in proj and "nunca como voto contrário" in proj
    assert "Sim (contra o projeto)" in ver
    # link interno da reportagem vira pagina estatica
    assert 'href="../../projetos/pl-1-2026/"' in rep
    sm = (tmp_path / "sitemap.xml").read_text("utf-8")
    assert sm.count("<url>") == 6 and f"{PG.SITE_INDEXAVEL}/o-que-muda/teste/" in sm


def test_jsonld_nao_fecha_a_tag_script(tmp_path):
    p = _pacote()
    p["materias"][0]["assunto"] = "texto </script><script>alert(1)</script>"
    PG.gerar(p, tmp_path)
    proj = (tmp_path / "projetos" / "pl-1-2026" / "index.html").read_text("utf-8")
    bloco = proj.split('<script type="application/ld+json">', 1)[1].split("</script>", 1)[0]
    assert "<" not in bloco
    assert "</script><script>alert(1)" in json.loads(bloco)["description"]  # o texto volta igual ao ler o JSON


def test_pagina_de_quem_saiu_some(tmp_path):
    PG.gerar(_pacote(), tmp_path)
    p = _pacote()
    p["vereadores"][0]["slug"] = "outro"
    PG.gerar(p, tmp_path)
    assert not (tmp_path / "vereadores" / "fulano").exists() and (tmp_path / "vereadores" / "outro").exists()
