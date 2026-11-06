"""Transforma o texto dos resumos baixados em JSON estruturado por sessao."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from .nomes import Registro
from .parser_resumo import parse_resumo

_DATA_TITULO = re.compile(r"(\d{2})/(\d{2})/(\d{4})")


def _ordem(meta: dict):
    m = _DATA_TITULO.search(meta.get("titulo", ""))
    return (m.group(3), m.group(2), m.group(1), "EXTRA" in meta.get("titulo", "").upper()) if m else ("9999",)


def processar(pasta_dados: Path) -> dict:
    dados = Path(pasta_dados)
    indice = json.loads((dados / "indice.json").read_text("utf-8"))
    saida = dados / "sessoes"
    saida.mkdir(exist_ok=True)

    reg = Registro()
    resumos = sorted((m for m in indice.values() if m["secao"] == "resumo"), key=_ordem)
    relatorio = {"sessoes": 0, "itens": 0, "votos": 0, "avisos": [], "precisa_ocr": [], "via_ocr": []}
    partidos: dict[str, Counter] = defaultdict(Counter)
    presencas: dict[str, Counter] = defaultdict(Counter)

    for meta in resumos:
        via_ocr = False
        if meta.get("precisa_ocr"):
            # Transcricao de PDF escaneado (python -m camara ocr-resumos) so vale depois de conferida por pessoa
            # e commitada; sem ela o resumo fica de fora e aparece em precisa_ocr.
            arq_ocr = dados / "texto" / f"{meta['sha256']}.ocr.txt"
            if not arq_ocr.exists():
                relatorio["precisa_ocr"].append(meta["titulo"])
                continue
            texto, via_ocr = arq_ocr.read_text("utf-8"), True
        else:
            texto = (dados / "texto" / f"{meta['sha256']}.txt").read_text("utf-8")
        r = parse_resumo(texto, reg, fonte=meta["url"], titulo=meta["titulo"])
        r["sha256_pdf"] = meta["sha256"]
        if via_ocr:
            r["transcrito_por_ocr"] = True  # transcricao de PDF escaneado, conferida por pessoa
            relatorio["via_ocr"].append(meta["titulo"])
        s = r["sessao"]
        if not (s["data"] and s["numero"] and s["tipo"]):
            relatorio["avisos"].append(f"{meta['titulo']}: cabecalho incompleto, ignorado")
            continue
        nome = f"{s['data']}_{s['tipo'][:5]}_{s['numero']:02d}.json"
        (saida / nome).write_text(json.dumps(r, ensure_ascii=False, indent=1), "utf-8")

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
