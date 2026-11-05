"""Carrossel do Instagram por dia de sessao: data/posts/AAAA-MM-DD/NN.png + legenda.txt

Ordem dos slides:
  01 capa: o que foi votado no dia e o resultado
  por projeto: card da votacao (placar + voto de cada vereador) e, se houver analise, card "Entenda"
  ultimo: requerimentos, mocoes e relatorios do dia

Regras:
  - so entra materia identificada (confirmada pela pauta ou registrada no resumo oficial)
  - voto nominal vem do painel eletronico da transmissao; sem painel, do resumo oficial (dito no card)
  - quando o resumo oficial registra algo diferente do painel, isso vai na legenda, em tom neutro
  - a analise e so do texto do projeto, com o modelo que gerou identificado
  - so regrava o dia quando o conteudo muda (manifest.json com hash)
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from . import analise as AN
from .nomes import display

RAIZ = Path(__file__).resolve().parent.parent
FONTES = RAIZ / "assets" / "fonts"
W, H = 1080, 1350
M = 72  # margem
REPO = "github.com/wardernoob-dot/monitor-camara-cubatao"

COR = {
    "fundo": (246, 244, 239), "tinta": (22, 27, 38), "suave": (96, 104, 118), "linha": (222, 218, 210),
    "topo": (20, 33, 61), "topo_txt": (236, 240, 248), "destaque": (245, 166, 35),
    "SIM": (30, 132, 73), "NAO": (192, 57, 43), "BRANCO": (120, 126, 138), "AUSENTE": (178, 182, 190),
    "?": (178, 182, 190), "cartao": (255, 255, 255),
}
ROTULO_VOTO = {"SIM": "SIM", "NAO": "NÃO", "BRANCO": "NÃO VOTOU", "AUSENTE": "AUSENTE", "?": "?"}
ORDEM_VOTO = ["SIM", "NAO", "BRANCO", "AUSENTE", "?"]
APELIDO = {
    "alessandro donizete de oliveira": "Alessandro Oliveira", "alexandre mendes da silva": "Topete",
    "allan matias barboza de souza": "Allan Matias", "anderson de lana andrade": "Dr. Anderson de Lana",
    "daniel barbosa de assis silva": "Xuxa", "edson menezes mota": "Edson Mota",
    "guilherme dos santos malaquias": "Guilherme do Salão", "ivan da silva": "Ivan Hildebrando",
    "jair ferreira lucas": "Jair do Bar", "joemerson alves de souza": "Cléber do Cavaco",
    "jose afonso": "Afonsinho", "jose elan dos santos gomes": "Batoré", "marcio silva nascimento": "Marcinho",
    "marcos roberto silva": "Tinho", "ronaldo araujo queiroz": "Ronaldo da Comissão",
    "roniele martins da silva": "Rony Martins",
}
ETAPA = {"1a_discussao": "1ª discussão", "2a_discussao": "2ª discussão", "discussao_unica": "Discussão única",
         "redacao_final": "Redação final", "parecer": "Parecer", "parecer_emenda": "Parecer da emenda",
         "emenda": "Emenda", "unica": "Votação"}
NOME_TIPO = {"PL": "Projeto de Lei", "PLC": "Projeto de Lei Complementar", "PR": "Projeto de Resolução",
             "PDL": "Projeto de Decreto Legislativo", "PELOM": "Emenda à Lei Orgânica", "VETO": "Veto do Prefeito",
             "RQ": "Requerimento", "MOCAO": "Moção", "RELATORIO": "Relatório"}
PRINCIPAIS = ("VETO", "PELOM", "PLC", "PL", "PR", "PDL")
DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def nome(chave: str) -> str:
    return APELIDO.get(chave) or display(chave)


def fonte(peso: str, tam: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTES / f"Inter-{peso}.otf"), tam)


def quebra(d: ImageDraw.ImageDraw, texto: str, f, largura: int) -> list[str]:
    linhas, atual = [], ""
    for p in (texto or "").split():
        teste = f"{atual} {p}".strip()
        if d.textlength(teste, font=f) <= largura or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


def escreve(d, x, y, texto, f, largura, cor, entre=1.3, max_linhas=None) -> int:
    linhas = quebra(d, texto, f, largura)
    if max_linhas and len(linhas) > max_linhas:
        linhas = linhas[:max_linhas]
        while linhas[-1] and d.textlength(linhas[-1] + "…", font=f) > largura:
            linhas[-1] = linhas[-1].rsplit(" ", 1)[0]
        linhas[-1] += "…"
    for ln in linhas:
        d.text((x, y), ln, font=f, fill=cor)
        y += int(f.size * entre)
    return y


def frase(t: str | None) -> str:
    """CAIXA ALTA da pauta -> frase normal."""
    t = re.sub(r"\s+", " ", t or "").strip()
    if t and sum(c.isupper() for c in t) > 0.6 * sum(c.isalpha() for c in t):
        t = t.lower()
        t = t[:1].upper() + t[1:]
        t = re.sub(r"\bcubatão\b", "Cubatão", t)
        t = re.sub(r"\b(ii|iii|iv|vi|vii|viii|ix|xi|xii)\b", lambda m: m.group(1).upper(), t)
        t = re.sub(r"\b(tea|sabesp|cev|cei|lom|sus|cras|creas|ipva|iptu|iss)\b", lambda m: m.group(1).upper(), t)
    return t


def lei_num(n: str) -> str:
    n = str(n).replace(".", "")
    return f"{int(n):,}".replace(",", ".") if n.isdigit() else n


def data_br(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d:%d/%m/%Y}"


def titulo(m: dict) -> str:
    n = f"{m['numero']}/{m['ano']}" if m.get("ano") else (m.get("numero") or "")
    if m["tipo"] == "VETO":
        return f"Veto ao PL {n}"
    return f"{m['tipo'] if m['tipo'] not in ('MOCAO', 'RELATORIO') else NOME_TIPO[m['tipo']]} {n}".strip()


def autoria(m: dict) -> str:
    a = (m.get("autoria") or "").strip()
    if not a:
        return ""
    from .nomes import chave
    k = chave(a)
    if k in APELIDO:
        return f"{APELIDO[k]} ({display(a)})" if APELIDO[k].lower() != display(a).lower() else display(a)
    return display(a) if a.isupper() else a


# ------------------------------------------------------------------ escolha da votacao mostrada

def votacao_principal(m: dict) -> dict | None:
    """A votacao decisiva do dia: ultima que nao e parecer/emenda; com painel completo de preferencia."""
    vs = [x for x in m["votacoes"] if x["etapa"] not in ("parecer", "parecer_emenda", "emenda")] or m["votacoes"]
    com_painel = [x for x in vs if x.get("painel") and x["painel"].get("completo") and x["painel"].get("votos")]
    if com_painel:
        return com_painel[-1]
    return vs[-1] if vs else None


def votos(x: dict) -> tuple[dict, str]:
    """{chave_vereador: SIM/NAO/BRANCO/AUSENTE}, fonte."""
    p = x.get("painel") or {}
    if p.get("votos") and p.get("completo"):
        return p["votos"], "painel"
    r = x.get("resumo") or {}
    out = {}
    for acao, lista in (r.get("por_acao") or {}).items():
        s = "SIM" if acao.lower().startswith(("aprova", "manuten")) else "NAO"
        for v in lista:
            out[v] = s
    return out, "resumo" if out else ""


def resultado(x: dict) -> str:
    p = x.get("painel") or {}
    if p.get("resultado"):
        return p["resultado"]
    r = (x.get("resumo") or {}).get("resultado") or ""
    return "APROVADO" if r.startswith("aprovado") else ("REJEITADO" if r.startswith("rejeitado") else r.upper())


def placar(x: dict) -> tuple[int, int] | None:
    v, _ = votos(x)
    if v:
        return sum(1 for s in v.values() if s == "SIM"), sum(1 for s in v.values() if s == "NAO")
    pl = (x.get("resumo") or {}).get("placar") or {}
    return (pl.get("favor"), pl.get("contra")) if pl else None


def rotulo_etapa(x: dict) -> str:
    e = ETAPA.get(x["etapa"], x["etapa"])
    lido = ((x.get("painel") or {}).get("lido") or "")
    if x["etapa"] == "parecer" and (mm := re.search(
            r"Parecer(?:\s+em\s+(?:separado|conjunto))?\s+(?:favor\S*|contr\S*)(?:\s+em\s+separado)?", lido, re.I)):
        e = re.sub(r"\s+", " ", mm.group(0)).strip()
        e = e[:1].upper() + e[1:].lower()
    return e


def veto_do_prefeito(dados: Path, m: dict) -> str | None:
    """Veto (integral/parcial) publicado na secao de projetos do site para este PL."""
    if m["tipo"] not in ("PL", "PLC") or not m.get("numero"):
        return None
    idx = json.loads((Path(dados) / "indice.json").read_text("utf-8"))
    for d in idx.values():
        mv = AN.RE_VETO_TIT.search(d.get("titulo") or "") if d["secao"] == "projetos" else None
        if mv and mv.group(2) == m["numero"] and mv.group(3) == (m.get("ano") or mv.group(3)):
            return mv.group(1).lower()
    return None


def identificada(m: dict) -> bool:
    if m.get("resultado_oficial") or m.get("na_pauta"):
        return True
    return any((x.get("painel") or {}).get("validacao") in ("confirmado_pauta", "corrigido_pauta") for x in m["votacoes"])


# ------------------------------------------------------------------ slides

def _base(rodape: str, topo: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGB", (W, H), COR["fundo"])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 112], fill=COR["topo"])
    d.text((M, 38), "CÂMARA DE CUBATÃO", font=fonte("ExtraBold", 30), fill=COR["topo_txt"])
    f = fonte("SemiBold", 26)
    d.text((W - M - d.textlength(topo, font=f), 42), topo, font=f, fill=COR["destaque"])
    d.line([M, H - 92, W - M, H - 92], fill=COR["linha"], width=2)
    escreve(d, M, H - 74, rodape, fonte("Regular", 20), W - 2 * M, COR["suave"], entre=1.35, max_linhas=2)
    return im, d


def _pill(d, x, y, texto, cor, tam=34) -> int:
    f = fonte("ExtraBold", tam)
    w = d.textlength(texto, font=f)
    d.rounded_rectangle([x, y, x + w + 44, y + tam + 30], radius=(tam + 30) // 2, fill=cor)
    d.text((x + 22, y + 13), texto, font=f, fill=(255, 255, 255))
    return int(x + w + 44)


def slide_capa(c: dict, principais: list[dict], outros: list[dict]) -> Image.Image:
    sess = ", ".join(f"{s['numero']}ª {'ordinária' if s['tipo'].startswith('ord') else 'extraordinária'}"
                     for s in c["sessoes"]) or "sessão"
    d0 = date.fromisoformat(c["data"])
    im, d = _base("Votos: painel eletrônico da transmissão oficial (TV Câmara). Projetos e resultados: documentos "
                  "oficiais da Câmara. Método aberto no link da bio.", data_br(c["data"]))
    y = 170
    d.text((M, y), f"{DIAS[d0.weekday()].capitalize()}, {d0.day:02d}/{d0.month:02d}", font=fonte("SemiBold", 34), fill=COR["suave"])
    y += 58
    y = escreve(d, M, y, "O que a Câmara votou", fonte("ExtraBold", 74), W - 2 * M, COR["tinta"], entre=1.1)
    d.text((M, y + 10), f"{'Sessões' if len(c['sessoes']) > 1 else 'Sessão'}: {sess}", font=fonte("Regular", 30), fill=COR["suave"])
    y += 90
    for m in principais[:6]:
        x = votacao_principal(m)
        res = resultado(x) if x else ""
        pl = placar(x) if x else None
        d.rounded_rectangle([M, y, W - M, y + 150], radius=22, fill=COR["cartao"])
        cor = COR["SIM"] if res == "APROVADO" else COR["NAO"] if res == "REJEITADO" else COR["BRANCO"]
        d.rectangle([M, y + 22, M + 8, y + 128], fill=cor)
        d.text((M + 32, y + 22), titulo(m), font=fonte("ExtraBold", 34), fill=COR["tinta"])
        lab = f"{res.capitalize()}" + (f"  {pl[0]} × {pl[1]}" if pl and pl[0] is not None else "")
        f = fonte("Bold", 30)
        d.text((W - M - 28 - d.textlength(lab, font=f), y + 24), lab, font=f, fill=cor)
        escreve(d, M + 32, y + 72, frase(m.get("assunto")), fonte("Regular", 26), W - 2 * M - 64, COR["suave"],
                entre=1.25, max_linhas=2)
        y += 170
    if outros:
        d.text((M, y + 6), f"+ {len(outros)} requerimento(s)/moção(ões) — no último card",
               font=fonte("SemiBold", 28), fill=COR["suave"])
    if len(principais) > 6:
        d.text((M, y + 46), f"+ {len(principais) - 6} projeto(s) nos próximos cards", font=fonte("SemiBold", 28), fill=COR["suave"])
    return im


def slide_votacao(c: dict, m: dict) -> Image.Image:
    x = votacao_principal(m)
    vt, origem = votos(x)
    p = x.get("painel") or {}
    rod = ("Votos: painel eletrônico da transmissão oficial" + (f" — {p['link']}" if p.get("link") else "")
           if origem == "painel" else "Votos: resumo oficial da sessão (sem registro do painel)")
    im, d = _base(rod, data_br(c["data"]))
    y = 160
    d.text((M, y), NOME_TIPO.get(m["tipo"], m["tipo"]).upper(), font=fonte("Bold", 26), fill=COR["destaque"])
    y += 40
    d.text((M, y), titulo(m), font=fonte("ExtraBold", 68), fill=COR["tinta"])
    y += 88
    if a := autoria(m):
        d.text((M, y), f"Autoria: {a}", font=fonte("SemiBold", 28), fill=COR["suave"])
        y += 46
    y = escreve(d, M, y + 4, frase(m.get("assunto")), fonte("Regular", 30), W - 2 * M, COR["tinta"], entre=1.3, max_linhas=4)
    y += 22
    res = resultado(x)
    pl = placar(x)
    cor = COR["SIM"] if res == "APROVADO" else COR["NAO"] if res == "REJEITADO" else COR["BRANCO"]
    fim = _pill(d, M, y, res or "SEM RESULTADO", cor)
    if pl and pl[0] is not None:
        d.text((fim + 24, y + 6), f"{pl[0]} a {pl[1]}", font=fonte("ExtraBold", 44), fill=COR["tinta"])
    d.text((M, y + 82), rotulo_etapa(x), font=fonte("SemiBold", 26), fill=COR["suave"])
    y += 132
    # grade de vereadores agrupada por voto
    if vt:
        cols, gw, gh = 3, (W - 2 * M - 2 * 16) // 3, 74
        itens = sorted(vt.items(), key=lambda kv: (ORDEM_VOTO.index(kv[1]) if kv[1] in ORDEM_VOTO else 9, nome(kv[0])))
        for i, (ver, v) in enumerate(itens):
            cx, cy = M + (i % cols) * (gw + 16), y + (i // cols) * (gh + 12)
            d.rounded_rectangle([cx, cy, cx + gw, cy + gh], radius=14, fill=COR["cartao"])
            d.rounded_rectangle([cx, cy, cx + 10, cy + gh], radius=5, fill=COR.get(v, COR["?"]))
            escreve(d, cx + 26, cy + 10, nome(ver), fonte("Bold", 23), gw - 36, COR["tinta"], max_linhas=1)
            d.text((cx + 26, cy + 42), ROTULO_VOTO.get(v, v), font=fonte("ExtraBold", 20), fill=COR.get(v, COR["?"]))
        y += ((len(itens) + cols - 1) // cols) * (gh + 12) + 8
    else:
        y = escreve(d, M, y, "Votação simbólica: não há registro nominal de votos.", fonte("SemiBold", 28),
                    W - 2 * M, COR["suave"])
    # outras etapas do dia
    outras = [o for o in m["votacoes"] if o is not x]
    for o in outras[:3]:
        po = placar(o)
        txt = f"{rotulo_etapa(o)}: {resultado(o).lower() or '—'}" + (f" ({po[0]} a {po[1]})" if po and po[0] is not None else "")
        y = escreve(d, M, y + 6, txt, fonte("Regular", 24), W - 2 * M, COR["suave"], max_linhas=1)
    if any(dv for o in m["votacoes"] for dv in (o.get("conferencia") or {}).get("divergencias", [])
           if dv["tipo"] in ("voto_divergente", "resumo_inclui_nao_votante", "resumo_inclui_ausente")):
        escreve(d, M, min(y + 8, H - 130), "O resumo oficial registra esta votação de forma diferente: detalhes na legenda.",
                fonte("SemiBold", 22), W - 2 * M, COR["NAO"], max_linhas=1)
    if m.get("_veto"):
        escreve(d, M, H - 132, f"Depois de aprovado, o Prefeito vetou o projeto (veto {m['_veto']}).",
                fonte("Bold", 24), W - 2 * M, COR["NAO"], max_linhas=1)
    for pub in (m.get("diario_oficial") or [])[:1]:
        if pub.get("tipo") == "lei":
            escreve(d, M, H - 132, f"Virou a Lei nº {lei_num(pub['numero'])} (Diário Oficial de {data_br(pub['data'])})",
                    fonte("Bold", 24), W - 2 * M, COR["SIM"], max_linhas=1)
    return im


def slide_analise(c: dict, m: dict, an: dict) -> Image.Image:
    a = an["analise"]
    modelo = re.sub(r"^\w+ \((.+)\)$", r"\1", an["modelo"])
    im, d = _base(f"Análise gerada por IA ({modelo}) só com o {an['documento']['fonte'].split(' (')[0]}. "
                  "Não avalia vereadores nem recomenda voto. Prompt público no link da bio.", titulo(m))
    y = 160
    d.text((M, y), "ENTENDA O PROJETO", font=fonte("Bold", 26), fill=COR["destaque"])
    y += 46
    y = escreve(d, M, y, a["resumo"], fonte("Bold", 38), W - 2 * M, COR["tinta"], entre=1.25, max_linhas=5) + 18
    if a["o_que_muda"]:
        d.text((M, y), "O que muda", font=fonte("ExtraBold", 28), fill=COR["tinta"])
        y += 44
        for it in a["o_que_muda"][:3]:
            d.ellipse([M + 4, y + 12, M + 14, y + 22], fill=COR["destaque"])
            y = escreve(d, M + 32, y, it, fonte("Regular", 27), W - 2 * M - 32, COR["tinta"], max_linhas=3) + 6
        y += 12
    if a["pontos_de_atencao"] and y < H - 300:
        d.text((M, y), "Pontos de atenção", font=fonte("ExtraBold", 28), fill=COR["tinta"])
        y += 44
        for p in a["pontos_de_atencao"][:3]:
            if y > H - 220:
                break
            d.ellipse([M + 4, y + 12, M + 14, y + 22], fill=COR["NAO"])
            y = escreve(d, M + 32, y, p["ponto"], fonte("Regular", 26), W - 2 * M - 32, COR["tinta"], max_linhas=3) + 6
    if a.get("justificativa_do_autor") and y < H - 330:
        y += 14
        d.text((M, y), "O que diz o autor", font=fonte("ExtraBold", 28), fill=COR["tinta"])
        y = escreve(d, M, y + 44, a["justificativa_do_autor"], fonte("Regular", 26), W - 2 * M, COR["suave"],
                    max_linhas=max(1, (H - 200 - y - 44) // 34)) + 6
    if a.get("limitacoes") and y < H - 170:
        escreve(d, M, max(y + 10, H - 170), a["limitacoes"], fonte("Regular", 22), W - 2 * M, COR["suave"], max_linhas=2)
    return im


def slide_outros(c: dict, outros: list[dict]) -> Image.Image:
    im, d = _base("Fonte: painel eletrônico da transmissão oficial e resumo oficial da sessão.", data_br(c["data"]))
    y = 160
    d.text((M, y), "TAMBÉM VOTADOS", font=fonte("Bold", 26), fill=COR["destaque"])
    y += 46
    d.text((M, y), "Requerimentos e moções", font=fonte("ExtraBold", 56), fill=COR["tinta"])
    y += 96
    for m in outros:
        if y > H - 220:
            d.text((M, y), f"+ {len(outros) - outros.index(m)} na legenda", font=fonte("SemiBold", 26), fill=COR["suave"])
            break
        x = votacao_principal(m)
        res, pl = resultado(x), placar(x)
        cor = COR["SIM"] if res == "APROVADO" else COR["NAO"] if res == "REJEITADO" else COR["BRANCO"]
        lab = res.capitalize() + (f" {pl[0]} a {pl[1]}" if pl and pl[0] is not None else "")
        d.text((M, y), titulo(m), font=fonte("ExtraBold", 30), fill=COR["tinta"])
        f = fonte("Bold", 26)
        d.text((W - M - d.textlength(lab, font=f), y + 4), lab, font=f, fill=cor)
        desc = _desc_outro(m, x)
        y = escreve(d, M, y + 44, desc, fonte("Regular", 24), W - 2 * M, COR["suave"], max_linhas=2) + 22
    return im


def _desc_outro(m: dict, x: dict) -> str:
    """'Aprovado o Requerimento n 52, de autoria do Vereador Fulano, solicitando X' -> 'Marcinho: pede X'."""
    t = re.sub(r"\s+", " ", m.get("assunto") or "").strip()
    if not t:
        return _desc_lida(x)
    from .nomes import chave
    if mm := re.search(r"autoria d[oa]s?\s+Vereador(?:a|es)?\s+(.+?),\s*(.*)", t, re.I):
        autor, resto = mm.group(1), mm.group(2)
        resto = re.sub(r"^solicitando\b", "pede", resto, flags=re.I)
        return f"{APELIDO.get(chave(autor), display(autor))}: {resto}"
    return frase(re.sub(r"^Aprovad[oa]s?\s+", "", t))


def _desc_lida(x: dict) -> str:
    t = (x.get("painel") or {}).get("lido") or ""
    return re.sub(r"^(RQ|Mo[çc][ãa]o)\.?\s*(n[º°o]?\s*)?[\d/]+\s*[-–]?\s*", "", t, flags=re.I)


# ------------------------------------------------------------------ legenda

def _lista(ks) -> str:
    ns = [nome(k) for k in ks]
    return ", ".join(ns[:-1]) + (" e " if len(ns) > 1 else "") + ns[-1] if ns else ""


def legenda(c: dict, principais: list[dict], outros: list[dict], analises: dict) -> str:
    partes = [f"🏛️ Câmara de Cubatão — votações de {data_br(c['data'])}"]
    for m in principais:
        x = votacao_principal(m)
        vt, origem = votos(x)
        pl = placar(x)
        ln = f"▪️ {titulo(m)}" + (f" ({autoria(m).split(' (')[0]})" if autoria(m) else "") + f": {resultado(x).lower()}"
        ln += f" em {rotulo_etapa(x).lower()}" if x["etapa"] not in ("unica",) else ""
        ln += f", {pl[0]} a {pl[1]}." if pl and pl[0] is not None else "."
        if vt:
            contra = [k for k, v in vt.items() if v == "NAO"]
            nv = [k for k, v in vt.items() if v == "BRANCO"]
            aus = [k for k, v in vt.items() if v == "AUSENTE"]
            if contra:
                ln += f" Contra: {_lista(contra)}."
            if nv:
                ln += f" Não votaram: {_lista(nv)}."
            if aus:
                ln += f" Ausentes: {_lista(aus)}."
        an = analises.get((m["tipo"], m["numero"]))
        if an:
            ln += f"\n{an['analise']['resumo']}"
        if m.get("_veto"):
            ln += f"\n⛔ Depois de aprovado, o Prefeito vetou o projeto (veto {m['_veto']}). O veto volta para a Câmara votar."
        for pub in m.get("diario_oficial") or []:
            if pub.get("tipo") == "lei":
                ln += f"\n✅ Sancionado: Lei nº {lei_num(pub['numero'])} (DO de {data_br(pub['data'])})."
        notas = []
        for o in m["votacoes"]:
            et = rotulo_etapa(o)
            for dv in (o.get("conferencia") or {}).get("divergencias", []):
                sentido = "favorável" if dv.get("resumo") == "SIM" else "contrário"
                if dv["tipo"] == "voto_divergente":
                    notas.append(f"{et}: {nome(dv['vereador'])} aparece com {ROTULO_VOTO.get(dv['painel'], dv['painel'])} "
                                 f"no painel e como {sentido} no resumo")
                elif dv["tipo"] == "resumo_inclui_nao_votante":
                    notas.append(f"{et}: {nome(dv['vereador'])} não registrou voto no painel e consta como {sentido} no resumo")
                elif dv["tipo"] == "resumo_inclui_ausente":
                    notas.append(f"{et}: {nome(dv['vereador'])} aparece ausente no painel e consta como {sentido} no resumo")
        if notas:
            ln += "\nℹ️ Painel x resumo oficial da sessão: " + "; ".join(dict.fromkeys(notas)) + "."
        partes.append(ln)
    if outros:
        partes.append("Também aprovados/votados: " + "; ".join(
            f"{titulo(m)} ({resultado(votacao_principal(m)).lower()})" for m in outros) + ".")
    partes.append("Os votos individuais vêm do painel eletrônico exibido na transmissão oficial da TV Câmara. "
                  "Os resumos de projeto são gerados por IA só com o texto oficial; o prompt e o código são públicos "
                  f"({REPO}).")
    partes.append("#Cubatão #CâmaraDeCubatão #Transparência")
    txt = "\n\n".join(partes)
    if len(txt) > 2150:  # limite do Instagram: 2.200
        corpo = "\n\n".join(partes[:-2])[: 2150 - len("\n\n".join(partes[-2:])) - 40].rsplit("\n", 1)[0]
        txt = corpo + "\n\n(continua nos cards)\n\n" + "\n\n".join(partes[-2:])
    return txt


# ------------------------------------------------------------------ orquestracao

def gerar_dia(dados: Path, data: str, forcar: bool = False) -> dict | None:
    dados = Path(dados)
    c = json.loads((dados / "consolidado" / f"{data}.json").read_text("utf-8"))
    mats = [m for m in c["materias"] if m["votacoes"] and identificada(m)]
    principais = [m for m in mats if m["tipo"] in PRINCIPAIS]
    outros = [m for m in mats if m["tipo"] not in PRINCIPAIS]
    if not mats:
        return None
    for m in principais:
        m["_veto"] = veto_do_prefeito(dados, m)
    analises = {}
    for m in principais:
        if (an := AN.carregar(dados, m["tipo"], m["numero"], m.get("ano"))) and not an["documento"]["so_ementa"]:
            analises[(m["tipo"], m["numero"])] = an
    pasta = dados / "posts" / data
    h = hashlib.sha256(json.dumps([c, sorted((k, v["hash_documento"], v["analise"]["resumo"]) for k, v in analises.items())],
                                  ensure_ascii=False, sort_keys=True, default=str).encode()
                       + (Path(__file__).read_bytes())).hexdigest()[:16]
    man = pasta / "manifest.json"
    if not forcar and man.exists() and json.loads(man.read_text("utf-8")).get("hash") == h:
        return None
    pasta.mkdir(parents=True, exist_ok=True)
    for velho in pasta.glob("*.png"):
        velho.unlink()
    slides = [slide_capa(c, principais, outros)]
    for m in principais:
        slides.append(slide_votacao(c, m))
        if an := analises.get((m["tipo"], m["numero"])):
            slides.append(slide_analise(c, m, an))
    if outros:
        slides.append(slide_outros(c, outros))
    slides = slides[:20]  # limite do carrossel
    for i, s in enumerate(slides, 1):
        s.save(pasta / f"{i:02d}.png", optimize=True)
    (pasta / "legenda.txt").write_text(legenda(c, principais, outros, analises), "utf-8")
    man.write_text(json.dumps({"hash": h, "slides": len(slides), "status_dia": c["status"],
                               "sem_analise": [titulo(m) for m in principais if (m["tipo"], m["numero"]) not in analises]},
                              ensure_ascii=False, indent=1), "utf-8")
    return {"data": data, "slides": len(slides)}


def gerar_tudo(dados: Path, desde: str = "2026-09-01") -> list:
    dados = Path(dados)
    feitos = []
    for arq in sorted((dados / "consolidado").glob("*.json")):
        if arq.stem >= desde and (r := gerar_dia(dados, arq.stem)):
            feitos.append(r)
    print(f"  posts: {len(feitos)} dia(s) (re)gerado(s)" + (": " + ", ".join(f"{r['data']} ({r['slides']} slides)" for r in feitos) if feitos else ""))
    return feitos
