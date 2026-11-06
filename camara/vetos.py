"""Oficios de veto do prefeito: acha no indice, liga ao projeto vetado e extrai numero e data do oficio.

Ligacao, em ordem:
  1. numero do projeto no titulo ("VETO PARCIAL AO PROJETO DE LEI Nº 04/2026 QUE ...")
  2. numero do projeto dentro do texto do oficio (texto extraido ou transcricao do PDF escaneado)
  3. ementa citada no titulo x assunto dos projetos conhecidos (similaridade >= 0.75)
O que nao casar fica de fora (e aparece no log), nunca e ligado no chute.
"""
from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

from .textclean import strip_accents

RE_TIT = re.compile(r"VETO\s+(INTEGRAL|PARCIAL|TOTAL)\b", re.I)
RE_PL_NUM = re.compile(r"PROJETO\s+DE\s+LEI(?:\s+COMPLEMENTAR)?\s*N\S{0,2}\s*0*(\d{1,4})\s*[/.-]\s*(\d{4})", re.I)
RE_OFICIO = re.compile(r"Of[íi]cio\s*n?[º°o.]?\s*(\d{1,4})\s*[/.-]\s*(\d{4})(?:\s*[/-]\s*(SEJUR|SEGOV|GP))?", re.I)
RE_OF_URL = re.compile(r"(?i)of\.?[_ -]*(?:n[ºo°]?[_ -]*)?0*(\d{1,4})[_.-](\d{4})")
MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
RE_DATA = re.compile(r"Cubat[aã]o,?\s+(\d{1,2})\s*(?:º)?\s+de\s+([a-zç]+)\s+de\s+(\d{4})", re.I)


def _n(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", strip_accents(t or "").lower()).split("que ", 1)[-1].strip()


def texto_doc(dados: Path, meta: dict) -> str:
    for nome in (f"{meta['sha256']}.ocr.txt", f"{meta['sha256']}.txt"):
        p = Path(dados) / "texto" / nome
        if p.exists():
            t = p.read_text("utf-8")
            if len(t.strip()) > 200 or nome.endswith(".ocr.txt"):
                return t
    return ""


def oficio_e_data(texto: str, url: str) -> tuple[str | None, str | None]:
    of = None
    if m := RE_OFICIO.search(texto[:3000]):
        of = f"Ofício nº {int(m.group(1)):03d}/{m.group(2)}" + (f"/{m.group(3).upper()}" if m.group(3) else "")
    elif m := RE_OF_URL.search(url):
        of = f"Ofício nº {int(m.group(1)):03d}/{m.group(2)}"
    data = None
    if m := RE_DATA.search(texto[:4000]):
        mes = strip_accents(m.group(2).lower())
        if mes in MESES:
            data = f"{m.group(3)}-{MESES.index(mes) + 1:02d}-{int(m.group(1)):02d}"
    return of, data


def oficios(dados: Path, assuntos: dict[tuple[str, str, str], str]) -> list[dict]:
    """assuntos: {(tipo, numero, ano): assunto} dos projetos conhecidos.
    Devolve [{tipo, numero, ano, alcance, url, sha256, precisa_ocr, oficio, data_oficio, ligacao}]."""
    dados = Path(dados)
    idx = json.loads((dados / "indice.json").read_text("utf-8"))
    norm = {k: _n(v) for k, v in assuntos.items() if v}
    out = []
    for meta in idx.values():
        if meta["secao"] != "projetos":
            continue
        tit = meta.get("titulo") or ""
        malc = RE_TIT.search(tit)
        if not malc and "veto" not in meta["url"].lower():
            continue
        txt = texto_doc(dados, meta)
        alvo, como = None, None
        if m := RE_PL_NUM.search(strip_accents(tit)):
            alvo, como = ("PL", m.group(1), m.group(2)), "numero no titulo"
        elif txt and (m := RE_PL_NUM.search(strip_accents(txt[:6000]))):
            alvo, como = ("PL", m.group(1), m.group(2)), "numero no texto do oficio"
        else:
            ementa = _n(tit)
            melhor, sim = None, 0.0
            for k, a in norm.items():
                n = min(len(a), len(ementa), 200)
                s = difflib.SequenceMatcher(None, a[:n], ementa[:n]).ratio() if n > 20 else 0
                if s > sim:
                    melhor, sim = k, s
            if melhor and sim >= 0.75:
                alvo, como = melhor, f"ementa do titulo (similaridade {sim:.2f})"
        if not alvo:
            print(f"  ! oficio de veto sem projeto correspondente: {tit[:80]}")
            continue
        of, dt = oficio_e_data(txt, meta["url"])
        out.append({"tipo": alvo[0], "numero": alvo[1], "ano": alvo[2],
                    "alcance": (malc.group(1).lower() if malc else ("parcial" if "parcial" in txt.lower()[:3000] else "integral")),
                    "url": meta["url"], "sha256": meta["sha256"], "precisa_ocr": meta.get("precisa_ocr"),
                    "oficio": of, "data_oficio": dt, "ligacao": como})
    return out
