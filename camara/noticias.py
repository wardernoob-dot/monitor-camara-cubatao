"""Noticias do site da Camara (RSS + pagina da noticia).

Sai no mesmo dia ou em D+1 e cobre todo item da ordem do dia. Nas votacoes divididas a
noticia traz os nomes ("Votaram a favor do parecer ... os vereadores A, B e C. Ja D e E
votaram contra"). Usa apelido; o mapa apelido -> nome civil vem de validacao.apelidos().

Grava data/noticias/<slug>.json com o texto cru e, separado, o que foi extraido.
"""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path

from bs4 import BeautifulSoup

from .nomes import chave

RSS = "https://www.cubatao.sp.leg.br/institucional/noticias/ultimas-noticias/RSS"
NS = {"rss": "http://purl.org/rss/1.0/", "dc": "http://purl.org/dc/elements/1.1/",
      "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"}
UA = {"User-Agent": "monitor-camara-cubatao (transparencia; github.com/wardernoob-dot/monitor-camara-cubatao)"}

RE_MAT = re.compile(
    r"(Projeto de Lei Complementar|Projeto de Lei|Projeto de Resolu[çc][ãa]o|Projeto de Decreto Legislativo|"
    r"Projeto de Emenda [àa] Lei Org[âa]nica|Requerimento|Mo[çc][ãa]o)\s+N?[º°o]?\.?\s*(\d{1,4})(?:/(\d{4}))?", re.I)
TIPO = {"projeto de lei complementar": "PLC", "projeto de lei": "PL", "projeto de resolucao": "PR",
        "projeto de decreto legislativo": "PDL", "projeto de emenda a lei organica": "PELOM",
        "requerimento": "RQ", "mocao": "MOCAO"}
RE_VETO = re.compile(r"veto\s+(?:total|parcial|integral)?\s*(?:ao|do)\s+Projeto de Lei\s+N?[º°o]?\.?\s*(\d{1,4})(?:/(\d{4}))?", re.I)
RE_SESSAO = re.compile(r"(\d{1,3})\s*[ªa]\s+Sess[ãa]o\s+(Ordin[áa]ria|Extraordin[áa]ria)", re.I)
RE_DDMM = re.compile(r"\((\d{1,2})/(\d{1,2})\)")
RESULTADOS = [
    (re.compile(r"\bderrub\w*\b.{0,40}\bveto|\bveto\b.{0,40}\bderrubad", re.I | re.S), "veto_derrubado"),
    (re.compile(r"\bmantiv\w*\b.{0,40}\bveto|\bveto\b.{0,40}\bmantid", re.I | re.S), "veto_mantido"),
    (re.compile(r"\bretirad[oa]\b", re.I), "retirado"),
    (re.compile(r"\bretorn\w+ [àa]s? comiss", re.I), "retornou_comissoes"),
    (re.compile(r"\brejeit\w+", re.I), "rejeitado"),
    (re.compile(r"\baprov\w+", re.I), "aprovado"),
]
# "Votaram a favor do parecer desfavoravel os vereadores A, B e C."  /  "Ja D, E e F votaram contra."
RE_VOTO_1 = re.compile(r"Votaram\s+(a favor|contra)(\s+d[oa]\s+[^.]{0,60}?)?\s+(?:os|as)\s+vereador\w*\s+([^.]+)\.", re.I)
RE_VOTO_2 = re.compile(r"(?:J[áa]\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.]{3,400}?)\s+votaram\s+(a favor|contra)(\s+d[oa]\s+[^.]{0,60}?)?\s*\.", re.I)


def _slug_seguro(url: str) -> str:
    """Extrai o slug final da URL permitindo apenas [a-z0-9_-] para impedir Path Traversal."""
    bruto = (url or "").rstrip("/").rsplit("/", 1)[-1]
    limpo = re.sub(r"[^a-zA-Z0-9_-]+", "-", bruto).strip("-_").lower()[:120]
    if not limpo:
        raise ValueError(f"slug invalido para URL: {url!r}")
    return limpo


def _caminho_seguro(pasta: Path, nome_arquivo: str) -> Path:
    base = pasta.resolve()
    alvo = (base / nome_arquivo).resolve()
    if not alvo.is_relative_to(base):
        raise ValueError(f"caminho fora de {base}: {alvo}")
    return alvo


def _nomes(lista: str, apel: dict[str, str]) -> tuple[list[str], list[str]]:
    lista = re.sub(r"\([^)]*\)", "", lista)
    partes = [p.strip() for p in re.split(r",|\s+e\s+", lista) if p.strip()]
    ok, nao = [], []
    for p in partes:
        k = chave(re.sub(r"(?i)^(?:os|as|o|a)?\s*vereador\w*\s+", "", p))
        if k in apel:
            ok.append(apel[k])
        elif k in apel.values():
            ok.append(k)
        else:
            nao.append(p)
    return ok, nao


def _alvo(trecho: str | None) -> str:
    t = chave(trecho or "")
    if "parecer" in t:
        return "parecer_contrario" if ("desfavoravel" in t or "contrario" in t) else "parecer_favoravel"
    if "veto" in t:
        return "veto"
    if "emenda" in t:
        return "emenda"
    return "materia"


def extrair(texto: str, publicado: str, apel: dict[str, str]) -> dict:
    """Materias citadas, resultado de cada uma, sessao/data e votos nominais (quando houver)."""
    pub = date.fromisoformat(publicado[:10])
    sessao = None
    if m := RE_SESSAO.search(texto):
        sessao = {"numero": int(m.group(1)), "tipo": "ordinaria" if chave(m.group(2)).startswith("ord") else "extraordinaria"}
    data = None
    if m := RE_DDMM.search(texto):
        try:
            d = date(pub.year, int(m.group(2)), int(m.group(1)))
            data = (d if d <= pub + timedelta(days=1) else d.replace(year=pub.year - 1)).isoformat()
        except ValueError:
            pass

    # trechos: cada materia "manda" do ponto em que e citada ate a proxima materia diferente
    marcas = []
    for m in RE_MAT.finditer(texto):
        k = (TIPO[chave(m.group(1))], m.group(2).lstrip("0"))
        if m.start() > 0 and RE_VETO.search(texto[max(0, m.start() - 40):m.end()]):
            k = ("VETO", m.group(2).lstrip("0"))
        marcas.append((m.start(), k, m.group(3)))
    trechos: list[tuple[tuple, str | None, str]] = []
    for i, (ini, k, ano) in enumerate(marcas):
        if trechos and trechos[-1][0] == k:
            continue
        fim = next((p for p, k2, _ in marcas[i + 1:] if k2 != k), len(texto))
        # o paragrafo inteiro em que a materia e citada (o verbo costuma vir antes do numero)
        ini_par = texto.rfind("\n", 0, ini) + 1
        trechos.append((k, ano, texto[ini_par:fim]))

    materias = {}
    for k, ano, tr in trechos:
        mat = materias.setdefault(k, {"tipo": k[0], "numero": k[1], "ano": ano, "resultado": None,
                                      "votos": [], "nomes_nao_reconhecidos": []})
        if not mat["resultado"]:
            mat["resultado"] = next((r for rx, r in RESULTADOS if rx.search(tr)), None)
        vistos = set()
        for rx, g_sent, g_alvo, g_nomes in ((RE_VOTO_1, 1, 2, 3), (RE_VOTO_2, 2, 3, 1)):
            for m in rx.finditer(tr):
                if m.start() in vistos:
                    continue
                vistos.add(m.start())
                nomes, nao = _nomes(m.group(g_nomes), apel)
                if not nomes:
                    continue
                alvo = _alvo(m.group(g_alvo))
                if alvo == "materia" and mat["votos"]:
                    alvo = mat["votos"][-1]["alvo"]  # "Votaram a favor A, B. Ja C votaram contra": mesmo alvo
                grupo = next((g for g in mat["votos"] if g["alvo"] == alvo), None)
                if not grupo:
                    grupo = {"alvo": alvo, "SIM": [], "NAO": []}
                    mat["votos"].append(grupo)
                grupo["SIM" if chave(m.group(g_sent)).startswith("a favor") else "NAO"] += nomes
                mat["nomes_nao_reconhecidos"] += nao
    return {"sessao": sessao, "data_sessao": data, "materias": list(materias.values())}


def texto_da_pagina(html: str) -> tuple[str, str]:
    s = BeautifulSoup(html, "html.parser")
    h1 = s.find(id="parent-fieldname-title")
    corpo = s.find(id="parent-fieldname-text")
    titulo = h1.get_text(" ", strip=True) if h1 else ""
    if not corpo:
        return titulo, ""
    pars = [p.get_text(" ", strip=True) for p in corpo.find_all(["p", "h2", "h3", "li"])]
    return titulo, "\n".join(p for p in pars if p)


def ler_rss(xml: bytes) -> list[dict]:
    raiz = ET.fromstring(xml)
    out = []
    for it in raiz.findall("rss:item", NS):
        out.append({"url": it.findtext("rss:link", "", NS).strip(), "titulo": it.findtext("rss:title", "", NS).strip(),
                    "publicado": it.findtext("dc:date", "", NS).strip()})
    return out


def coletar(dados: Path, http=None, apel: dict | None = None) -> dict:
    """Baixa as noticias novas do RSS e (re)extrai todas. Barato: ~5 noticias por dia."""
    import requests

    from . import validacao as V

    http = http or requests.Session()
    dados = Path(dados)
    pasta = dados / "noticias"
    pasta.mkdir(exist_ok=True)
    apel = apel or V.apelidos(dados)
    rel = {"novas": 0, "erros": []}
    try:
        r = http.get(RSS, headers=UA, timeout=60)
        r.raise_for_status()
        itens = ler_rss(r.content)
    except Exception as e:  # noqa: BLE001
        rel["erros"].append(f"RSS: {e!r}"[:200])
        itens = []
    for it in itens:
        try:
            slug = _slug_seguro(it["url"])
            arq = _caminho_seguro(pasta, f"{slug}.json")
        except ValueError as e:
            rel["erros"].append(f"slug: {e!r}"[:200])
            continue
        if arq.exists():
            continue
        try:
            p = http.get(it["url"], headers=UA, timeout=60)
            p.raise_for_status()
            titulo, texto = texto_da_pagina(p.text)
        except Exception as e:  # noqa: BLE001
            rel["erros"].append(f"{slug}: {e!r}"[:200])
            continue
        arq.write_text(json.dumps({**it, "titulo": titulo or it["titulo"], "texto": texto,
                                   "coletado_em": datetime.now().isoformat(timespec="seconds")},
                                  ensure_ascii=False, indent=1), "utf-8")
        rel["novas"] += 1
    # extracao refeita sempre (o mapa de apelidos melhora com o tempo)
    for arq in pasta.glob("*.json"):
        n = json.loads(arq.read_text("utf-8"))
        n["extraido"] = extrair(n["texto"], n["publicado"], apel)
        arq.write_text(json.dumps(n, ensure_ascii=False, indent=1), "utf-8")
    print(f"  noticias: {rel['novas']} nova(s); {len(rel['erros'])} erro(s)")
    return rel
