"""Transforma o texto dos resumos baixados em JSON estruturado por sessao."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from .nomes import Registro
from .parser_resumo import parse_resumo

_DATA_TITULO = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
_RE_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_RE_DATA_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _ordem(meta: dict):
    m = _DATA_TITULO.search(meta.get("titulo", ""))
    return (m.group(3), m.group(2), m.group(1), "EXTRA" in meta.get("titulo", "").upper()) if m else ("9999",)


def processar(pasta_dados: Path) -> dict:
    dados = Path(pasta_dados)
    indice = json.loads((dados / "indice.json").read_text("utf-8"))
    saida = (dados / "sessoes").resolve()
    saida.mkdir(exist_ok=True)
    texto_dir = (dados / "texto").resolve()

    reg = Registro()
    resumos = sorted((m for m in indice.values() if m["secao"] == "resumo"), key=_ordem)
    relatorio = {"sessoes": 0, "itens": 0, "votos": 0, "avisos": [], "precisa_ocr": []}
    partidos: dict[str, Counter] = defaultdict(Counter)
    presencas: dict[str, Counter] = defaultdict(Counter)

    for meta in resumos:
        if meta.get("precisa_ocr"):
            relatorio["precisa_ocr"].append(meta["titulo"])
            continue
        sha = str(meta.get("sha256") or "")
        if not _RE_SHA256.match(sha):
            relatorio["avisos"].append(f"{meta.get('titulo')}: sha256 invalido, ignorado")
            continue
        arq_txt = (texto_dir / f"{sha}.txt").resolve()
        if not arq_txt.is_relative_to(texto_dir):
            continue
        texto = arq_txt.read_text("utf-8")
        r = parse_resumo(texto, reg, fonte=meta["url"], titulo=meta["titulo"])
        r["sha256_pdf"] = sha
        s = r["sessao"]
        tipo_limpo = re.sub(r"[^a-z0-9]", "", str(s.get("tipo") or "")[:5].lower())
        if not (s.get("data") and _RE_DATA_ISO.match(str(s["data"])) and s.get("numero") and tipo_limpo):
            relatorio["avisos"].append(f"{meta['titulo']}: cabecalho incompleto, ignorado")
            continue
        nome = f"{s['data']}_{tipo_limpo}_{int(s['numero']):02d}.json"
        destino = (saida / nome).resolve()
        if not destino.is_relative_to(saida):
            continue
        destino.write_text(json.dumps(r, ensure_ascii=False, indent=1), "utf-8")

        relatorio["sessoes"] += 1
        relatorio["itens"] += len(r["itens"])
        relatorio["votos"] += sum(len(v["por_vereador"]) for i in r["itens"] for v in i["votacoes"])
        relatorio["avisos"] += [f"{meta['titulo']}: {a}" for a in r["avisos"]]
        for o in r["obstrucoes"]:
            partidos[o["vereador"]][o["bancada"]] += 1
        for k, st in r["presenca"].items():
            presencas[k][st] += 1

    vereadores = {
        k: {
            "nome": nome,
            "bancada_declarada": partidos[k].most_common(1)[0][0] if partidos[k] else None,
            "presenca": dict(presencas[k]),
        }
        for k, nome in sorted(reg.todos().items())
    }
    (dados / "vereadores.json").write_text(json.dumps(vereadores, ensure_ascii=False, indent=1), "utf-8")
    (dados / "relatorio_processamento.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=1), "utf-8")
    return relatorio
