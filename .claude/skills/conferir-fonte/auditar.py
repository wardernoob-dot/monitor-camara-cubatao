"""Audita docs/data/dados.json: todo voto exibido precisa dizer de onde veio.

Uso: python .claude/skills/conferir-fonte/auditar.py [caminho/dados.json]
Sai com codigo 1 se achar problema.
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "docs" / "data" / "dados.json"
d = json.loads(caminho.read_text("utf-8"))

problemas = []
for i, v in enumerate(d["votacoes"]):
    votos = v.get("votos") or {}
    rotulo = f"{v.get('data')} {v.get('materia')} ({v.get('etapa')})"
    if votos and v.get("fonte") not in ("painel", "resumo"):
        problemas.append(f"voto sem fonte: {rotulo}")
    if v.get("fonte") == "painel" and not v.get("link"):
        problemas.append(f"painel sem link do video: {rotulo}")
    if v.get("fonte") == "resumo" and not v.get("resumo_url"):
        problemas.append(f"resumo sem url do documento: {rotulo}")
    if not votos and (v.get("sim") or v.get("nao")) and not (v.get("resumo_url") or v.get("link")):
        problemas.append(f"placar sem nenhuma fonte: {rotulo}")

for slug, ver in d["vereadores"].items() if isinstance(d["vereadores"], dict) else enumerate(d["vereadores"]):
    if ver.get("partido") and not ver.get("partido_fonte"):
        problemas.append(f"partido sem fonte: {ver.get('slug') or slug}")

por_fonte = {}
for v in d["votacoes"]:
    por_fonte[v.get("fonte")] = por_fonte.get(v.get("fonte"), 0) + 1
print("votacoes por fonte:", por_fonte)
print(f"{len(problemas)} problema(s)")
for p in problemas[:50]:
    print(" -", p)
sys.exit(1 if problemas else 0)
