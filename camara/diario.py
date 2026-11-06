"""Diario Oficial Eletronico de Cubatao: leis sancionadas e vetos.

A lei sai no DO no mesmo dia da sancao (Lei 4.487 em 29/10/2026, mesmo dia da votacao do PL 92).
O texto da lei nao cita o numero do PL; o vinculo e feito pela ementa x assunto do projeto
(similaridade), so com PL aprovado ate a data da lei. Vinculo abaixo do limiar fica de fora.

Busca: busca.php?q=<termo>&data_inicio=AAAA-MM-DD&data_fim=AAAA-MM-DD
Cada resultado e um <details> com edicao, data, orgao, titulo (h4), ementa e o texto integral.
"""
from __future__ import annotations

import difflib
import html as H
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from bs4 import BeautifulSoup

from .nomes import chave

BASE = "https://diariooficial.cubatao.sp.gov.br"
UA = {"User-Agent": "monitor-camara-cubatao (transparencia; github.com/wardernoob-dot/monitor-camara-cubatao)"}
TERMOS = ["sanciono", "promulgo", "veto"]
RE_LEI = re.compile(r"LEI(?: COMPLEMENTAR)?\s+N\S?\s*([\d\.]+),?\s+DE\s+(\d{1,2})\s+DE\s+(\w+)\s+DE\s+(\d{4})", re.I)
RE_VETO_PL = re.compile(r"VETO\s+(TOTAL|PARCIAL|INTEGRAL)?.{0,40}?PROJETO DE LEI(?: COMPLEMENTAR)?\s+N\S?\s*(\d{1,4})/(\d{4})", re.I | re.S)
LIMIAR = 0.72


def parse_busca(html: str) -> list[dict]:
    s = BeautifulSoup(html, "html.parser")
    out = []
    for d in s.find_all("details"):
        spans = [x.get_text(" ", strip=True) for x in d.find("summary").find_all("span")] if d.find("summary") else []
        ed = next((re.search(r"(\d+)", x).group(1) for x in spans if x.lower().startswith("edi")), None)
        dt = next((x for x in spans if re.fullmatch(r"\d{2}/\d{2}/\d{4}", x)), None)
        h4 = d.find("h4")
        p = d.find("summary").find("p") if d.find("summary") else None
        corpo = d.find(class_="texto-legal")
        btn = d.find(attrs={"onclick": re.compile(r"id=\d+")})
        mid = re.search(r"id=(\d+)", btn["onclick"]).group(1) if btn else None
        out.append({
            "id": mid, "edicao": ed,
            "data": datetime.strptime(dt, "%d/%m/%Y").date().isoformat() if dt else None,
            "orgao": next((x for x in spans if "secretaria" in x.lower() or "poder" in x.lower()), None),
            "titulo": h4.get_text(" ", strip=True) if h4 else "",
            "ementa": H.unescape(p.get_text(" ", strip=True)) if p else "",
            "texto": corpo.get_text("\n", strip=True) if corpo else "",
            "url": f"{BASE}/imprimir.php?acao=materia&id={mid}" if mid else None,
        })
    return out


def classificar(pub: dict) -> dict:
    t = f"{pub['titulo']} {pub['texto'][:1500]}"
    info = {"tipo": None}
    if m := RE_LEI.search(pub["titulo"]):
        info = {"tipo": "lei", "numero": m.group(1).replace(".", "")}
        if re.search(r"promulgo", t, re.I) and not re.search(r"sanciono", t, re.I):
            info["promulgada_pela_camara"] = True  # veto derrubado: promulgacao
    elif m := RE_VETO_PL.search(t):
        info = {"tipo": "veto", "alcance": (m.group(1) or "").lower() or None, "pl": m.group(2).lstrip("0"), "ano": m.group(3)}
    return info


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", chave(t or "")).strip()


def similaridade(a: str, b: str) -> float:
    a, b = _norm(a)[:300], _norm(b)[:300]
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))  # ementa da lei costuma ser o assunto do PL, as vezes cortado
    return difflib.SequenceMatcher(None, a[:n], b[:n]).ratio()


def coletar(dados: Path, http=None, dias: int = 45) -> dict:
    import requests

    http = http or requests.Session()
    dados = Path(dados)
    pasta = (dados / "diario").resolve()
    pasta.mkdir(exist_ok=True)
    fim = date.today()
    ini = fim - timedelta(days=dias)
    rel = {"novas": 0, "erros": []}
    for termo in TERMOS:
        try:
            r = http.get(f"{BASE}/busca.php", params={"q": termo, "secretaria": "", "data_inicio": ini.isoformat(),
                                                      "data_fim": fim.isoformat()}, headers=UA, timeout=60)
            r.raise_for_status()
            pubs = parse_busca(r.text)
        except Exception as e:  # noqa: BLE001
            rel["erros"].append(f"{termo}: {e!r}"[:200])
            continue
        for p in pubs:
            mid = str(p.get("id") or "")
            if not mid.isdigit():
                continue
            arq = (pasta / f"{mid}.json").resolve()
            if not arq.is_relative_to(pasta) or arq.exists():
                continue
            p["classificacao"] = classificar(p)
            if not p["classificacao"]["tipo"]:
                continue  # 'sanciono'/'veto' em outro contexto (decreto, portaria...)
            arq.write_text(json.dumps(p, ensure_ascii=False, indent=1), "utf-8")
            rel["novas"] += 1
    print(f"  diario oficial: {rel['novas']} publicacao(oes) nova(s); {len(rel['erros'])} erro(s)")
    return rel


def vincular(dados: Path, materias_aprovadas: list[dict]) -> dict[tuple, list]:
    """materias_aprovadas: [{tipo, numero, assunto, data}] -> {(tipo, numero): [publicacoes do DO]}."""
    pasta = Path(dados) / "diario"
    out: dict[tuple, list] = {}
    if not pasta.exists():
        return out
    for arq in sorted(pasta.glob("*.json")):
        p = json.loads(arq.read_text("utf-8"))
        c = p.get("classificacao") or {}
        reg = {"titulo": p["titulo"], "data": p["data"], "edicao": p["edicao"], "url": p["url"], **c}
        if c.get("tipo") == "veto":
            out.setdefault(("PL", c["pl"]), []).append(reg)
        elif c.get("tipo") == "lei":
            melhor, sim = None, 0.0
            for m in materias_aprovadas:
                if m["tipo"] not in ("PL", "PLC") or not m.get("assunto") or (p["data"] and m["data"] > p["data"]):
                    continue
                s = similaridade(p["ementa"], m["assunto"])
                if s > sim:
                    melhor, sim = m, s
            if melhor and sim >= LIMIAR:
                out.setdefault((melhor["tipo"], melhor["numero"]), []).append({**reg, "similaridade_ementa": round(sim, 2)})
    return out
