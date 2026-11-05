"""Processa as transmissoes da TV Camara: le o painel de votacao nas miniaturas do YouTube.

Entrada: data/storyboard_specs.json (atualizado pelo script do PC, que tem IP residencial).
Saida:   data/painel/<video_id>.json  +  data/painel/img/<video_id>_NN.jpg (print do painel)
"""
from __future__ import annotations

import json
import re
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from . import cabecalho as C
from . import painel as P
from . import youtube as yt
from .parser_resumo import MESES
from .nomes import chave as chave_nome

RE_DATA_TITULO = re.compile(r"DIA\s+(\d{1,2})\s+DE\s+([A-ZÇa-zç]+)\s+DE\s+(\d{4})", re.I)
RE_NUM = re.compile(r"(\d+)\s*[ªa]\s*SESS[ÃA]O\s+(ORDIN|EXTRAORDIN)", re.I)


def sessao_do_titulo(titulo: str) -> dict:
    s = {"numero": None, "tipo": None, "data": None}
    if m := RE_NUM.search(titulo or ""):
        s["numero"] = int(m.group(1))
        s["tipo"] = "ordinaria" if m.group(2).upper().startswith("ORD") else "extraordinaria"
    if m := RE_DATA_TITULO.search(titulo or ""):
        mes = MESES.get(chave_nome(m.group(2)))
        if mes:
            s["data"] = date(int(m.group(3)), mes, int(m.group(1))).isoformat()
    return s


def _hms(seg: int) -> str:
    return f"{seg // 3600}:{seg % 3600 // 60:02d}:{seg % 60:02d}"


def ler_video(vid: str, meta: dict, pasta_folhas: Path, rostos: P.Rostos, dados: Path) -> dict:
    img_dir = dados / "painel" / "img"
    img_dir.mkdir(parents=True, exist_ok=True)
    evs = P.eventos(pasta_folhas)
    votacoes = []
    for n, e in enumerate(evs, 1):
        r = P.resumo_evento(e, rostos)
        if r["confianca_rostos"] < 0.8:
            # tela diferente do painel padrao (ex.: votacao secreta/eleicao): registra sem atribuir votos
            r["votos"] = {}
            r["aviso"] = "layout do painel nao reconhecido; votos nao atribuidos"
        # evidencia: o quadro final da votacao
        for idx, _, t in P.miniaturas(pasta_folhas):
            if idx == e.final.indice:
                Image.fromarray(t.astype(np.uint8)).save(img_dir / f"{vid}_{n:02d}.jpg", quality=90)
                break
        votacoes.append({
            "n": n, **r,
            "horario_video": _hms(r["inicio_s"]),
            "link": f"https://youtu.be/{vid}?t={max(r['fim_s'] - 30, 0)}",
            "evidencia": f"painel/img/{vid}_{n:02d}.jpg",
        })
    titulo = meta.get("titulo") or meta.get("nome", "")
    return {
        "video_id": vid, "titulo": titulo, "sessao": sessao_do_titulo(titulo),
        "url": f"https://www.youtube.com/watch?v={vid}",
        "fonte": "painel eletronico exibido na transmissao oficial da TV Camara (miniaturas do YouTube)",
        "processado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "votacoes": votacoes,
    }


def processar_videos(dados: Path, http=None) -> dict:
    dados = Path(dados)
    arq = dados / "storyboard_specs.json"
    if not arq.exists():
        return {"processados": 0, "erros": []}
    specs = json.loads(arq.read_text("utf-8"))
    rostos = P.Rostos.carregar(dados / "rostos_2026.npz")
    (dados / "painel").mkdir(exist_ok=True)
    rel = {"processados": 0, "erros": []}
    for vid, meta in specs.items():
        saida = dados / "painel" / f"{vid}.json"
        if saida.exists():
            continue
        try:
            urls, _ = yt.urls_do_spec(meta["spec"])
            with tempfile.TemporaryDirectory() as tmp:
                yt.baixar_urls(urls, Path(tmp), http)
                res = ler_video(vid, meta, Path(tmp), rostos, dados)
            saida.write_text(json.dumps(res, ensure_ascii=False, indent=1), "utf-8")
            rel["processados"] += 1
            print(f"  painel: {res['titulo'][:60]} -> {len(res['votacoes'])} votacoes")
        except Exception as e:  # noqa: BLE001  (spec expirado, video ainda processando etc.)
            rel["erros"].append(f"{vid}: {e!r}"[:200])
            print(f"  ! painel {vid}: {e!r}"[:200])
    return rel


def identificar_pendentes(dados: Path) -> dict:
    """Preenche 'materia' (o que estava em votacao) nas votacoes ja lidas, usando os prints salvos."""
    dados = Path(dados)
    rel = {"sessoes": 0, "votacoes": 0, "identificadas": 0, "erros": []}
    for arq in sorted((dados / "painel").glob("*.json")):
        d = json.loads(arq.read_text("utf-8"))
        pend = [v for v in d["votacoes"] if "materia" not in v]
        if not pend:
            continue
        try:
            cortes = [C.corte_cabecalho(np.asarray(Image.open(dados / v["evidencia"]).convert("RGB")).astype(np.int16))
                      for v in pend]
            ids = C.identificar(cortes)
        except Exception as e:  # noqa: BLE001  (sem token, 403, limite do plano gratuito...)
            rel["erros"].append(f"{arq.name}: {e!r}"[:200])
            print(f"  ! cabecalho {arq.name}: {e!r}"[:200])
            if len(rel["erros"]) == 1:
                C.diagnostico()
            continue
        for v, m in zip(pend, ids):
            if m["situacao_lida"] and v.get("resultado") and m["situacao_lida"] != v["resultado"]:
                m["aviso"] = f"resultado lido no texto ({m['situacao_lida']}) diferente do lido pela cor ({v['resultado']})"
            v["materia"] = m
            rel["votacoes"] += 1
            rel["identificadas"] += m["identificado"]
        arq.write_text(json.dumps(d, ensure_ascii=False, indent=1), "utf-8")
        rel["sessoes"] += 1
        print(f"  cabecalhos: {d['titulo'][:50]} -> " + "; ".join(
            (f"{v['materia']['tipo']} {v['materia']['numero']}" if v['materia']['identificado'] else "?") for v in pend))
    return rel
