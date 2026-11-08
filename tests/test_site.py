import json
from pathlib import Path

import numpy as np
import pytest

from camara import analise as A
from camara import coletor as C
from camara import noticias as N
from camara import painel as P
from camara import site as S
from camara import videos as V
from camara import youtube as YT

RAIZ = Path(__file__).resolve().parent.parent


def test_assinaturas_e_destinatario():
    t = ("Art. 3 Revoga.\n__________\nGuilherme dos Santos Malaquias\nVereador PSB– Cubatão\n"
         "A Vossa Excelência o Senhor\nVereador ALEXANDRE MENDES DA SILVA\nPresidente da Câmara Municipal\n"
         "Vereador Edson Mota - União Brasil\n")
    assert S._assinaturas(t) == [("Guilherme dos Santos Malaquias", "PSB"), ("Edson Mota", "UNIÃO BRASIL")]


def test_descricao_de_requerimento():
    assert S._desc_curta("Aprovado o Requerimento nº 52, de autoria do Vereador Márcio Silva Nascimento, "
                         "solicitando a formação de comissão") == "Solicitando a formação de comissão"


def test_exporta_json_do_app(tmp_path):
    S.exportar(RAIZ / "data", tmp_path)
    d = json.loads((tmp_path / "dados.json").read_text("utf-8"))
    assert set(d) == {"meta", "vereadores", "materias", "votacoes", "dias", "partidos", "reportagens", "executivo"}
    slugs = {v["slug"] for v in d["vereadores"]}
    assert {"xuxa", "topete", "marcinho"} <= slugs
    materias = {m["slug"]: m for m in d["materias"]}
    pl92 = materias["pl-92-2026"]
    assert pl92["lei"]["numero"] == "4.487" and pl92["situacao_cls"] == "lei"
    # toda referencia do app aponta pra algo que existe
    for m in d["materias"]:
        assert all(0 <= i < len(d["votacoes"]) for i in m["eventos"])
        assert set(m["autores"]) <= slugs
    for ev in d["votacoes"]:
        assert ev["materia"] in materias and set(ev["votos"]) <= slugs
    assert [e["data"] for e in d["votacoes"]] == sorted(e["data"] for e in d["votacoes"])
    for s in (tmp_path / "analises").glob("*.json"):
        assert s.stem in materias and materias[s.stem]["analise"]


def _m(tipo="PL", assunto="", eventos=(), veto=None):
    return {"tipo": tipo, "assunto": assunto, "eventos": list(eventos), "veto": veto}


def test_tema_e_relevancia():
    m = _m(assunto="AUTORIZA O PODER EXECUTIVO A CONTRATAR OPERAÇÃO DE CRÉDITO COM A CAIXA")
    m["tema"] = S.tema(m)
    assert m["tema"] == "Orçamento, impostos e finanças"
    assert S.relevancia(m)["nivel"] == "alta"
    h = _m(assunto="DENOMINA RUA JOSÉ DA SILVA O LOGRADOURO PÚBLICO")
    h["tema"] = S.tema(h)
    assert h["tema"].startswith("Homenagens") and S.relevancia(h)["nivel"] == "baixa"
    ev = {"etapa": "2a_discussao", "etapa_txt": "2ª discussão", "sim": 8, "nao": 6, "resultado": "APROVADO"}
    d = _m(assunto="INSTITUI PROGRAMA DE SAÚDE", eventos=[ev])
    d["tema"] = S.tema(d)
    assert "Votação dividida (8 a 6)" in S.relevancia(d)["motivos"]


def test_sentido_do_voto():
    base = {"materia": {"tipo": "PL"}}
    assert S.sentido({**base, "etapa": "parecer", "etapa_txt": "Parecer contrário em separado"}) == "inverso"
    assert S.sentido({**base, "etapa": "parecer", "etapa_txt": "Parecer favorável"}) == "direto"
    assert S.sentido({**base, "etapa": "emenda", "etapa_txt": "Emenda"}) == "emenda"
    assert S.sentido({**base, "etapa": "1a_discussao", "etapa_txt": "1ª discussão"}) == "direto"


def test_hardening_url_slug_e_npz(tmp_path):
    assert S.url_segura("https://www.cubatao.sp.leg.br/doc.pdf") == "https://www.cubatao.sp.leg.br/doc.pdf"
    assert S.url_segura("javascript:alert(1)") is None
    assert S.url_segura("data:text/html,<script>alert(1)</script>") is None
    assert N._slug_seguro("https://www.cubatao.sp.leg.br/noticias/sessao-de-hoje/") == "sessao-de-hoje"
    with pytest.raises(ValueError):
        N._caminho_seguro(tmp_path, "../fora.json")
    malicioso = tmp_path / "pickle.npz"
    np.savez(malicioso, chaves=np.array([{"cmd": "evil"}], dtype=object), mat=np.zeros((1, 4)))
    with pytest.raises(ValueError):
        P.Rostos.carregar(malicioso)


def test_hardening_ssrf_e_citacao_curta():
    # Substring de dominio falso bloqueada em coletor.extrair_links
    html = '<div id="content"><a href="https://www.cubatao.sp.leg.br.evil.com/processo-legislativo/resumo-das-sessoes/2026">2026</a></div>'
    assert C.extrair_links(html, C.BASE + "/processo-legislativo/resumo-das-sessoes", "/processo-legislativo/resumo-das-sessoes") == []
    # SSRF bloqueado no storyboard do YouTube
    with pytest.raises(ValueError):
        YT.urls_do_spec("http://169.254.169.254/latest/meta-data|160#90#10#5#5#2000#M$M.jpg#sig")
    # Trecho de 1 palavra nao passa na conferencia anti-alucinacao
    doc = {"texto": "Art. 1 Fica instituido o programa municipal de saude.", "so_ementa": False}
    res = A.conferir({"resumo": "Cria programa.", "pontos_de_atencao": [{"ponto": "Ponto falso", "trecho": "de"}]}, doc)
    assert res["pontos_de_atencao"] == [] and len(res["pontos_descartados"]) == 1


def test_hardening_xml_bomb_ssrf_rss_e_path_traversal(tmp_path):
    class HttpXmlBomb:
        def get(self, url, timeout=None):
            class R:
                content = b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><rss/>'
                text = content.decode()
                url = "https://www.cubatao.sp.leg.br/feed/"

                def raise_for_status(self):
                    pass

            return R()

    with pytest.raises(ValueError, match="DTD/ENTITY"):
        N.ler_rss(b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><rss/>')
    with pytest.raises(ValueError, match="DTD/ENTITY"):
        YT.listar_videos(http=HttpXmlBomb())

    # SSRF via link externo injetado no RSS de noticias
    assert N._url_noticia_segura("https://www.cubatao.sp.leg.br/sessao-ordinaria/") == "https://www.cubatao.sp.leg.br/sessao-ordinaria/"
    with pytest.raises(ValueError):
        N._url_noticia_segura("http://169.254.169.254/latest/meta-data")
    with pytest.raises(ValueError):
        N._url_noticia_segura("https://evil.com/sessao-ordinaria/")

    # Path traversal em caminho de miniatura de video (camara/videos.py)
    assert V._caminho_img_seguro(tmp_path, "painel/img/abc12345678/00010.jpg") is not None
    with pytest.raises(ValueError):
        V._caminho_img_seguro(tmp_path, "painel/img/../../../etc/passwd")
    with pytest.raises(ValueError):
        V._caminho_img_seguro(tmp_path, "painel/img/abc12345678/evil.py")

    # Integridade SHA-256 obrigatoria quando o arquivo se chama rostos_2026.npz
    falso_rostos = tmp_path / "rostos_2026.npz"
    np.savez(falso_rostos, chaves=np.array(["xuxa"]), mat=np.zeros((1, 4800), dtype=np.float32))
    with pytest.raises(ValueError, match="Integridade violada em rostos_2026.npz"):
        P.Rostos.carregar(falso_rostos)
