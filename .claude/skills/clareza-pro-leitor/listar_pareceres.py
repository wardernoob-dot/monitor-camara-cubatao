"""Lista as etapas de parecer (contrario e favoravel) do dados.json, para conferir como a tela as mostra.

Uso: python .claude/skills/clareza-pro-leitor/listar_pareceres.py [caminho/dados.json]
So le; nao altera nada.
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # console do Windows nao e UTF-8 por padrao
RAIZ = Path(__file__).resolve().parents[3]
caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "docs" / "data" / "dados.json"
d = json.loads(caminho.read_text("utf-8"))

linhas = [v for v in d["votacoes"] if v["etapa"] in ("parecer", "parecer_emenda")]
linhas.sort(key=lambda v: (v["data"], v["materia"]))
n_contrario = 0
for v in linhas:
    contrario = "contr" in v["etapa_txt"].lower()
    n_contrario += contrario
    marca = "INVERTE " if contrario else "        "
    print(f"{marca}{v['data']}  {v['materia']:<12} {v['etapa_txt']:<34} {v['resultado'] or '-':<10} "
          f"{v['sim']}x{v['nao']}  fonte={v['fonte']}")
print(f"\n{len(linhas)} etapa(s) de parecer; {n_contrario} contrario(s) (o SIM delas e contra o projeto).")
