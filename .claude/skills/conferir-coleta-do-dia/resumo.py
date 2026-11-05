"""Resume o que a ultima rodada do robo trouxe e o que merece olho humano.

Uso: python .claude/skills/conferir-coleta-do-dia/resumo.py [--dias 3]
Le data/relatorio_processamento.json e os consolidados mais recentes. Nao altera nada.
"""
import argparse
import collections
import json
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # console do Windows nao e UTF-8 por padrao
RAIZ = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument("--dias", type=int, default=3, help="quantos consolidados recentes mostrar")
a = ap.parse_args()

rel = json.loads((RAIZ / "data" / "relatorio_processamento.json").read_text("utf-8"))
print(f"RELATORIO: {rel['sessoes']} sessoes | {rel['itens']} itens | {rel['votos']} votos individuais")
print(f"  avisos do parser: {len(rel['avisos'])}")
for av in rel["avisos"][:20]:
    print("   -", av)
print(f"  PDFs que precisam de OCR: {len(rel['precisa_ocr'])}")
for o in rel["precisa_ocr"]:
    print("   -", o)

cons = sorted((RAIZ / "data" / "consolidado").glob("*.json"))
st = collections.Counter(json.loads(f.read_text("utf-8"))["status"] for f in cons)
print(f"\nCONSOLIDADOS: {len(cons)} dias, por status: {dict(st)}")
for f in cons[-a.dias:]:
    d = json.loads(f.read_text("utf-8"))
    divs = d["divergencias"]
    print(f"  {d['data']} [{d['status']}] materias={len(d['materias'])} transmissoes={len(d['transmissoes'])} "
          f"noticias={len(d['noticias'])} votacoes_nao_identificadas={len(d['votacoes_nao_identificadas'])} "
          f"divergencias={len(divs)}")
    # Esperado: o resumo oficial lista como SIM quem o painel mostra sem voto; isso faz o placar divergir em 1 por nao votante.
    com_nao_votante = {(x.get("materia"), x.get("etapa")) for x in divs if x.get("tipo") == "resumo_inclui_nao_votante"}
    for x in divs:
        esperada = x.get("tipo") == "resumo_inclui_nao_votante" or (
            x.get("tipo") == "placar_divergente" and (x.get("materia"), x.get("etapa")) in com_nao_votante)
        if not esperada:
            print("      ! INCOMUM:", json.dumps(x, ensure_ascii=False)[:220])
    esp = sum(1 for x in divs if x.get("tipo") == "resumo_inclui_nao_votante")
    if esp:
        print(f"      ({esp} caso(s) esperado(s) de resumo que conta como SIM quem o painel mostra sem voto)")
    if d["votacoes_nao_identificadas"]:
        print("      ! votacoes do painel nao identificadas:", len(d["votacoes_nao_identificadas"]))

log = subprocess.run(["git", "log", "-3", "--author=monitor-camara-bot", "--format=%h %ad %s", "--date=short"],
                     cwd=RAIZ, capture_output=True, text=True).stdout.strip()
print("\nULTIMOS COMMITS DO ROBO:\n" + log)
