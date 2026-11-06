"""Sonda: o painel eletronico aparece nas transmissoes antigas (2025, inicio de 2026)?

Le sonda/specs.json (specs de storyboard obtidos no PC), baixa as folhas L3 de cada video,
conta quantos quadros parecem painel, salva amostras e roda a leitura completa (ler_video).
Saida em sonda/saida/ (so no branch sondagem-2025).
"""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
from camara import painel as P  # noqa: E402
from camara import videos as V  # noqa: E402
from camara import youtube as yt  # noqa: E402

SAIDA = RAIZ / "sonda" / "saida"
(SAIDA / "img").mkdir(parents=True, exist_ok=True)
specs = json.loads((RAIZ / "sonda" / "specs.json").read_text("utf-8-sig"))
rostos = P.Rostos.carregar(RAIZ / "data" / "rostos_2026.npz")
rel = {}
for vid, meta in specs.items():
    try:
        urls, n = yt.urls_do_spec(meta["spec"])
        with tempfile.TemporaryDirectory() as tmp:
            yt.baixar_urls(urls, Path(tmp))
            total, painel, amostras = 0, [], []
            for idx, seg, t in P.miniaturas(Path(tmp)):
                total += 1
                if P.eh_painel(t):
                    painel.append(idx)
                if idx % 120 == 60 and len(amostras) < 4:
                    amostras.append((idx, t))
            # amostras: 2 quadros de painel (se houver) e 4 quadros quaisquer
            for k, idx in enumerate(painel[:: max(1, len(painel) // 3)][:3]):
                for i2, _, t in P.miniaturas(Path(tmp)):
                    if i2 == idx:
                        Image.fromarray(t.astype(np.uint8)).save(SAIDA / "img" / f"{vid}_painel{k}.jpg", quality=90)
                        break
            for idx, t in amostras:
                Image.fromarray(t.astype(np.uint8)).save(SAIDA / "img" / f"{vid}_qualquer_{idx}.jpg", quality=85)
            dados_tmp = Path(tempfile.mkdtemp())
            leitura = V.ler_video(vid, meta, Path(tmp), rostos, dados_tmp)
        rel[vid] = {"titulo": meta.get("titulo"), "quadros": total, "quadros_painel": len(painel),
                    "votacoes_lidas": len(leitura["votacoes"]),
                    "votacoes_com_votos": sum(1 for v in leitura["votacoes"] if v.get("votos")),
                    "confiancas": [round(v.get("confianca_rostos", 0), 2) for v in leitura["votacoes"]][:30]}
    except Exception as e:  # noqa: BLE001
        rel[vid] = {"titulo": meta.get("titulo"), "erro": repr(e)[:300]}
    print(vid, rel[vid])
(SAIDA / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), "utf-8")
