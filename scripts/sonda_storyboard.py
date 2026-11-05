"""Sonda: o GitHub Actions consegue ler o canal e baixar storyboards?

Tenta 3 estrategias pra obter o 'spec' do storyboard e registra o resultado de cada uma
em data/storyboard/sonda.json. Baixa as folhas L3 com a primeira que funcionar.
"""
import json
import re
import subprocess
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from camara import youtube as yt  # noqa: E402

DEST = Path(__file__).resolve().parent.parent / "data" / "storyboard"
DEST.mkdir(parents=True, exist_ok=True)
extras = sys.argv[1:]
http = yt._http()
rel = {"rss": None, "lista_canal": None, "videos": []}

# ---------- estrategias pra obter o spec ----------
CLIENTES = [
    ("WEB", "2.20241126.01.00", {}),
    ("MWEB", "2.20241126.01.00", {}),
    ("TVHTML5_SIMPLY_EMBEDDED_PLAYER", "2.0", {"thirdParty": {"embedUrl": "https://www.youtube.com/"}}),
    ("WEB_EMBEDDED_PLAYER", "1.20241126.01.00", {"thirdParty": {"embedUrl": "https://www.youtube.com/"}}),
    ("ANDROID_VR", "1.60.19", {}),
    ("IOS", "19.45.4", {}),
]


def via_pagina(vid):
    r = http.get(f"https://www.youtube.com/watch?v={vid}&hl=pt&bpctr=9999999999&has_verified=1", timeout=30)
    html = r.text
    m = re.search(r'"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"', html)
    ps = re.search(r'"playabilityStatus":\{"status":"([A-Z_]+)"(?:,"reason":"([^"]*)")?', html)
    diag = {"http": r.status_code, "len": len(html), "playability": ps.groups() if ps else None,
            "consent": "consent.youtube" in r.url or "before you continue" in html.lower(), "url_final": r.url[:80]}
    return (json.loads(f'"{m.group(1)}"') if m else None), diag


def via_innertube(vid, cliente, versao, extra_ctx):
    body = {"videoId": vid, "context": {"client": {"clientName": cliente, "clientVersion": versao,
                                                   "hl": "pt", "gl": "BR"}, **extra_ctx}}
    r = http.post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", json=body, timeout=30)
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    sb = (j.get("storyboards") or {})
    spec = (sb.get("playerStoryboardSpecRenderer") or {}).get("spec")
    ps = j.get("playabilityStatus") or {}
    return spec, {"http": r.status_code, "status": ps.get("status"), "reason": (ps.get("reason") or "")[:80],
                  "tem_storyboards": bool(sb)}


def via_ytdlp(vid):
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True, "no_warnings": True}) as y:
        info = y.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
    sbs = [f for f in info.get("formats", []) if f.get("format_note") == "storyboard"]
    melhor = max(sbs, key=lambda f: (f.get("width") or 0), default=None)
    urls = [fr["url"] for fr in (melhor or {}).get("fragments", [])]
    return urls, {"formatos_storyboard": [(f["format_id"], f.get("width"), f.get("height"),
                                           len(f.get("fragments", []))) for f in sbs],
                  "titulo": info.get("title"), "dur": info.get("duration")}


def baixar_urls(vid, urls):
    d = DEST / vid
    d.mkdir(parents=True, exist_ok=True)
    tot = 0
    for i, u in enumerate(urls):
        r = http.get(u, timeout=30)
        r.raise_for_status()
        (d / f"L3_M{i:03d}.jpg").write_bytes(r.content)
        tot += len(r.content)
    return tot


def processar(vid, titulo):
    reg = {"id": vid, "titulo": titulo, "tentativas": {}}
    # 1) pagina
    try:
        spec, diag = via_pagina(vid)
        reg["tentativas"]["pagina"] = diag | {"spec": bool(spec)}
        if spec:
            base, niveis = spec.split("|")[0], spec
    except Exception as e:  # noqa: BLE001
        spec = None
        reg["tentativas"]["pagina"] = repr(e)[:200]
    # 2) innertube
    if not spec:
        for nome, ver, ctx in CLIENTES:
            try:
                s, diag = via_innertube(vid, nome, ver, ctx)
                reg["tentativas"][f"innertube_{nome}"] = diag | {"spec": bool(s)}
                if s:
                    spec = s
                    break
            except Exception as e:  # noqa: BLE001
                reg["tentativas"][f"innertube_{nome}"] = repr(e)[:200]
    if spec:
        partes = spec.split("|")
        p = partes[-1].split("#")
        n = yt.Nivel(len(partes) - 2, int(p[0]), int(p[1]), int(p[2]), int(p[3]), int(p[4]), int(p[5]), p[6], p[7])
        urls = [yt.url_folha(partes[0], n, i) for i in range(n.folhas)]
        reg["metodo"] = "spec"
    else:
        # 3) yt-dlp
        try:
            urls, diag = via_ytdlp(vid)
            reg["tentativas"]["yt_dlp"] = diag
            reg["metodo"] = "yt_dlp" if urls else None
        except Exception as e:  # noqa: BLE001
            urls = []
            reg["tentativas"]["yt_dlp"] = repr(e)[:300]
    if urls:
        try:
            reg["kb"] = baixar_urls(vid, urls) // 1024
            reg["folhas"] = len(urls)
        except Exception as e:  # noqa: BLE001
            reg["erro_download"] = repr(e)[:200]
    return reg


# ---------- execucao ----------
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "yt-dlp"], check=False)

alvos = []
try:
    vids = yt.listar_videos(http)
    rel["rss"] = f"ok, {len(vids)} videos"
    alvos += [(v.id, v.titulo) for v in vids if yt.eh_sessao(v.titulo)]
except Exception as e:  # noqa: BLE001
    rel["rss"] = f"FALHOU: {e!r}"

# lista completa de transmissoes do canal (pra achar sessoes que ja tem resumo oficial)
try:
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "extract_flat": True, "playlistend": 40}) as y:
        info = y.extract_info(f"https://www.youtube.com/channel/{yt.CANAL_ID}/streams", download=False)
    lista = [(e["id"], e.get("title", "")) for e in info.get("entries", [])]
    rel["lista_canal"] = lista
    alvos += [(i, t) for i, t in lista if yt.eh_sessao(t) and re.search(r"(OUTUBRO|SETEMBRO|NOVEMBRO)", t, re.I)]
except Exception as e:  # noqa: BLE001
    rel["lista_canal"] = f"FALHOU: {e!r}"[:300]

alvos += [(x, "extra") for x in extras]
vistos, fila = set(), []
for i, t in alvos:
    if i not in vistos:
        vistos.add(i)
        fila.append((i, t))
print("RSS:", rel["rss"], "| canal:", "ok" if isinstance(rel["lista_canal"], list) else rel["lista_canal"])
print(f"{len(fila)} sessoes alvo")

for vid, titulo in fila[:12]:
    try:
        r = processar(vid, titulo)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        r = {"id": vid, "erro": repr(e)[:300]}
    print(f"- {vid} | {titulo[:55]} | metodo={r.get('metodo')} folhas={r.get('folhas')} kb={r.get('kb')}")
    for k, v in r.get("tentativas", {}).items():
        print(f"    {k}: {v}")
    rel["videos"].append(r)

(DEST / "sonda.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), "utf-8")
