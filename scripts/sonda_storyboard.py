"""Sonda: o GitHub Actions consegue ler o canal e baixar storyboards?

Baixa as folhas L3 das sessoes listadas no RSS (e de IDs extras passados por argumento)
para data/storyboard/<video_id>/.
"""
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from camara import youtube as yt  # noqa: E402

DEST = Path(__file__).resolve().parent.parent / "data" / "storyboard"
extras = sys.argv[1:]

http = yt._http()
relatorio = {"rss": None, "videos": []}
try:
    vids = yt.listar_videos(http)
    relatorio["rss"] = f"ok, {len(vids)} videos"
except Exception as e:  # noqa: BLE001
    vids = []
    relatorio["rss"] = f"FALHOU: {e!r}"

alvos = [(v.id, v.titulo) for v in vids if yt.eh_sessao(v.titulo)]
alvos += [(x, "extra") for x in extras if x not in {a for a, _ in alvos}]
print("RSS:", relatorio["rss"])
print(f"{len(alvos)} sessoes alvo")

for vid, titulo in alvos[:12]:
    try:
        info = yt.baixar_folhas(vid, DEST / vid, nivel=3, http=http)
        msg = f"ok {info['folhas']} folhas, {info['bytes'] // 1024} KB, dur={info['duracao_s']}s"
    except Exception as e:  # noqa: BLE001
        msg = f"FALHOU: {e!r}"
        traceback.print_exc()
    print(f"- {vid} | {titulo[:60]} | {msg}")
    relatorio["videos"].append({"id": vid, "titulo": titulo, "resultado": msg})

DEST.mkdir(parents=True, exist_ok=True)
(DEST / "sonda.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=1), "utf-8")
