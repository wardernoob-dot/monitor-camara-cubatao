"""Teste ponta a ponta do coletor com um 'site falso' que imita a estrutura Plone da Camara."""
import io
import json
from pathlib import Path

import pytest

from camara import coletor as C
from camara.processar import processar

FX = Path(__file__).parent / "fixtures"
B = C.BASE


def _pdf(texto: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    fonte = "Helvetica"
    for cand in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"]:
        if Path(cand).exists():
            pdfmetrics.registerFont(TTFont("DV", cand))
            fonte = "DV"
            break
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for linha in texto.split("\n"):
        if y < 40:
            c.showPage()
            y = 800
        c.setFont(fonte, 9)
        c.drawString(30, y, linha)
        y -= 12
    c.save()
    return buf.getvalue()


def _pagina(links):
    itens = "".join(f'<dt><a href="{h}">{t}</a></dt><dd><a href="{h}">Leia mais…</a></dd>' for h, t in links)
    return f'<html><body><div id="portal-nav"><a href="{B}/processo-legislativo/resumo-das-sessoes/2019">2019</a></div>' \
           f'<div id="content"><dl>{itens}</dl><a href="{B}/x/RSS">RSS</a></div></body></html>'


class Resp:
    def __init__(self, status, ctype, body):
        self.status_code = status
        self.headers = {"content-type": ctype}
        self.content = body if isinstance(body, bytes) else body.encode()
        self.text = body if isinstance(body, str) else ""


class SiteFalso:
    def __init__(self):
        self.headers = {}
        self.chamadas = []
        R = "/processo-legislativo/resumo-das-sessoes"
        P = "/processo-legislativo/projetos-de-lei"
        pdf35 = _pdf((FX / "ord35_2026.txt").read_text("utf-8"))
        self.rotas = {
            B + R: _pagina([(f"{B}{R}/2026", "2026"), (f"{B}{R}/2025", "2025"), (f"{B}{R}/2017", "2017")]),
            B + R + "/2026": _pagina([(f"{B}{R}/2026/sessoes-ordinarias", "Sessões Ordinárias")]),
            B + R + "/2025": _pagina([]),
            B + R + "/2026/sessoes-ordinarias": _pagina([
                (f"{B}{R}/2026/sessoes-ordinarias/resumo-da-35a-sessao-ordinaria-20-10-2026/view",
                 "RESUMO DA 35ª SESSÃO ORDINÁRIA - 20/10/2026")]),
            B + R + "/2026/sessoes-ordinarias/resumo-da-35a-sessao-ordinaria-20-10-2026/at_download/file": pdf35,
            B + P: _pagina([(f"{B}{P}/projetos-de-lei-e-vetos-2026", "Projetos de Lei e Vetos - 2026")]),
            B + P + "/projetos-de-lei-e-vetos-2026": _pagina([
                (f"{B}{P}/arquivos/copy3_of_2025/pl-92.2026", "ALTERA A LEI ORCAMENTARIA..."),
                (f"{B}{P}/arquivos/copy3_of_2025/PL%2002.2026.pdf", "INSTITUI O PLANO MUNICIPAL...")]),
            B + P + "/arquivos/copy3_of_2025/pl-92.2026": _pdf("PROJETO DE LEI 92/2026\nTexto do projeto"),
            B + P + "/arquivos/copy3_of_2025/PL%2002.2026.pdf": _pdf("PROJETO DE LEI 02/2026\nOutro texto"),
        }

    def get(self, url, timeout=None):
        self.chamadas.append(url)
        body = self.rotas.get(url)
        if body is None:
            return Resp(404, "text/html", "nao achei")
        return Resp(200, "application/pdf" if isinstance(body, bytes) else "text/html; charset=utf-8", body)


@pytest.fixture
def site(monkeypatch):
    monkeypatch.setattr(C, "INTERVALO_S", 0)
    return SiteFalso()


def test_extrair_links_ignora_menu_rss_e_leia_mais():
    html = _pagina([(f"{B}/processo-legislativo/resumo-das-sessoes/2026", "2026")])
    links = C.extrair_links(html, B + "/processo-legislativo/resumo-das-sessoes", "/processo-legislativo/resumo-das-sessoes")
    assert [ln.titulo for ln in links] == ["2026"]


def test_coleta_e_processamento_ponta_a_ponta(tmp_path, site):
    c = C.Coletor(tmp_path, desde=2026, sessao=site)
    novos = c.coletar(("resumo", "projetos"))
    titulos = sorted(n["titulo"] for n in novos)
    assert titulos == ["ALTERA A LEI ORCAMENTARIA...", "INSTITUI O PLANO MUNICIPAL...",
                       "RESUMO DA 35ª SESSÃO ORDINÁRIA - 20/10/2026"]
    # nao entra em ano anterior ao --desde nem no menu lateral
    assert not any("/2017" in u or "/2019" in u or "/2025" in u for u in site.chamadas)

    # segunda rodada: nada novo e nenhum PDF baixado de novo
    site.chamadas.clear()
    assert C.Coletor(tmp_path, desde=2026, sessao=site).coletar(("resumo", "projetos")) == []
    assert not any(u.endswith("at_download/file") for u in site.chamadas)

    rel = processar(tmp_path)
    assert rel["sessoes"] == 1 and rel["avisos"] == []
    sessao = json.loads((tmp_path / "sessoes" / "2026-10-20_ordin_35.json").read_text("utf-8"))
    pl75 = next(i for i in sessao["itens"] if i.get("numero") == "75/2026")
    assert pl75["votacoes"][0]["placar"] == {"favor": 6, "contra": 8}
    assert sessao["titulo_site"].startswith("RESUMO DA 35ª")
