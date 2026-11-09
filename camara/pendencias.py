"""O que a lei publicada deixa em aberto e quando ela passa a valer, lido do TEXTO DA LEI no Diario Oficial.

Regra fixa, sem IA: cada item traz o trecho literal da lei. Serve as paginas "Leis" (linha do tempo) e
"Em aberto" (o que ainda depende de decreto, regulamento ou ato) do site.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from pathlib import Path

MESES = {"janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
         "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
POR_EXTENSO = {"trinta": 30, "quarenta e cinco": 45, "sessenta": 60, "noventa": 90, "cento e vinte": 120,
               "cento e oitenta": 180}

RE_DEPENDE = re.compile(
    r"(?i)\b(regulamentar[áa]|ser[áa]o? (?:definid|fixad|estabelecid|regulamentad|disciplinad)[oa]s? "
    r"(?:por|em|mediante) (?:ato|decreto|regulamento|portaria|resolu[çc][ãa]o)|"
    r"(?:definid|fixad|estabelecid)[oa]s? (?:por|em|mediante) (?:ato|decreto|regulamento)|"
    r"nos termos (?:de|do) regulamento|na forma (?:de|do) regulamento|mediante regulamenta[çc][ãa]o)")
RE_PRAZO = re.compile(r"(?i)prazo (?:m[áa]ximo )?de (?:at[ée] )?(\d{1,3})\s*(?:\(([^)]+)\)\s*)?dias")
RE_VIGOR_DATA = re.compile(r"(?i)(?:entra(?:r[áa])? em vigor|produzindo efeitos|produzir[áa] efeitos)[^.;]{0,60}?"
                           r"(?:em|a partir de)\s+(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})")
RE_VIGOR_DIAS = re.compile(r"(?i)entra(?:r[áa])? em vigor[^.;]{0,40}?(\d{1,3})\s*(?:\([^)]+\)\s*)?dias")
RE_VIGOR_PUB = re.compile(r"(?i)entra(?:r[áa])? em vigor na data d[ae] sua publica")


def texto_da_lei(dados: Path, lei: dict | None) -> str:
    mid = re.search(r"[?&]id=(\d+)", (lei or {}).get("url") or "")
    if not mid:
        return ""
    pasta = (Path(dados) / "diario").resolve()
    arq = (pasta / f"{mid.group(1)}.json").resolve()
    if not arq.is_relative_to(pasta) or not arq.exists():
        return ""
    return re.sub(r"[ \t\r]+", " ", json.loads(arq.read_text("utf-8")).get("texto") or "")


def _frases(texto: str) -> list[str]:
    # um dispositivo por frase: quebra em "Art.", "§", "Parágrafo" e incisos
    t = re.sub(r"\s*\n\s*", " ", texto)
    t = re.sub(r"\b(CAP[ÍI]TULO|SE[ÇC][ÃA]O) [IVXL]+\b[^a-z]*?(?=Art\.)", "", t)
    partes = re.split(r"(?=\bArt\. ?\d)|(?=§ ?\d)|(?=\bPar[áa]grafo [úu]nico)|(?<=;)\s+(?=[IVXL]+ ?[-–])", t)
    return [p.strip() for p in partes if len(p.strip()) > 25]


def vigencia(texto: str, publicada: str) -> dict:
    """{"data": AAAA-MM-DD, "trecho": ...}: quando a lei passa a valer. Sem regra reconhecida, a data da publicacao."""
    if m := RE_VIGOR_DATA.search(texto):
        mes = MESES.get(m.group(2).lower())
        if mes:
            return {"data": date(int(m.group(3)), mes, int(m.group(1))).isoformat(), "trecho": m.group(0).strip(),
                    "regra": "data"}
    if m := RE_VIGOR_DIAS.search(texto):
        d = date.fromisoformat(publicada) + timedelta(days=int(m.group(1)))
        return {"data": d.isoformat(), "trecho": m.group(0).strip(), "regra": "dias"}
    m = RE_VIGOR_PUB.search(texto)
    return {"data": publicada, "trecho": m.group(0).strip() if m else "", "regra": "publicacao"}


def dependencias(texto: str, publicada: str) -> list[dict]:
    """Dispositivos da lei que mandam alguem regulamentar, definir ou fixar algo depois. Trecho literal, ate 6."""
    out = []
    for f in _frases(texto):
        if not RE_DEPENDE.search(f):
            continue
        item = {"trecho": f[:320].rstrip() + ("…" if len(f) > 320 else "")}
        if (p := RE_PRAZO.search(f)) and re.search(r"(?i)regulament", f):
            item["prazo_dias"] = int(p.group(1))
            item["vence"] = (date.fromisoformat(publicada) + timedelta(days=int(p.group(1)))).isoformat()
        out.append(item)
    return out[:6]


def da_lei(dados: Path, lei: dict | None) -> dict | None:
    if not lei or not lei.get("data"):
        return None
    t = texto_da_lei(dados, lei)
    if len(t) < 200:
        return None
    return {"vigencia": vigencia(t, lei["data"]), "depende": dependencias(t, lei["data"])}
