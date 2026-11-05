"""Acesso ao canal da TV Camara Cubatao no YouTube sem baixar video.

Usa so:
- o feed RSS publico do canal (lista os ultimos 15 videos);
- a pagina do video, pra pegar o 'spec' do storyboard;
- as folhas de storyboard (miniaturas da barra de progresso, JPEG estatico no i.ytimg.com).
"""
from __future__ import annotations

import json
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

CANAL_ID = "UCSZ2lKO87tFkPxvHuvk5C7A"
RSS = f"https://www.youtube.com/feeds/videos.xml?channel_id={CANAL_ID}"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
RE_SESSAO = re.compile(r"(\d+)\s*[ªa]\s*SESS[ÃA]O\s+(ORDIN[ÁA]RIA|EXTRAORDIN[ÁA]RIA)", re.I)


@dataclass
class Video:
    id: str
    titulo: str
    publicado: str


@dataclass
class Nivel:
    L: int
    w: int
    h: int
    total: int
    cols: int
    rows: int
    intervalo_ms: int
    nome: str
    sigh: str

    @property
    def por_folha(self) -> int:
        return self.cols * self.rows

    @property
    def folhas(self) -> int:
        return -(-self.total // self.por_folha)


def _http():
    import requests

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
    s.cookies.set("CONSENT", "YES+1", domain=".youtube.com")
    return s


def listar_videos(http=None) -> list[Video]:
    http = http or _http()
    r = http.get(RSS, timeout=30)
    r.raise_for_status()
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    root = ET.fromstring(r.content)
    return [
        Video(e.find("yt:videoId", ns).text, e.find("a:title", ns).text, e.find("a:published", ns).text)
        for e in root.findall("a:entry", ns)
    ]


def eh_sessao(titulo: str) -> bool:
    return bool(RE_SESSAO.search(titulo or ""))


def spec_storyboard(video_id: str, http=None) -> tuple[str, list[Nivel], dict]:
    """Retorna (url_base, niveis, meta) lendo a pagina do video."""
    http = http or _http()
    r = http.get(f"https://www.youtube.com/watch?v={video_id}", timeout=30)
    r.raise_for_status()
    html = r.text
    m = re.search(r'"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"', html)
    if not m:
        bot = "confirm you" in html.lower() or "not a bot" in html.lower()
        raise RuntimeError(f"spec de storyboard nao encontrado (bloqueio de bot: {bot})")
    spec = json.loads(f'"{m.group(1)}"')  # desfaz & etc.
    partes = spec.split("|")
    niveis = []
    for i, p in enumerate(partes[1:]):
        w, h, total, cols, rows, intervalo, nome, sigh = p.split("#")
        niveis.append(Nivel(i, int(w), int(h), int(total), int(cols), int(rows), int(intervalo), nome, sigh))
    dur = re.search(r'"lengthSeconds":"(\d+)"', html)
    titulo = re.search(r'"title":"((?:[^"\\]|\\.)*)","lengthSeconds"', html)
    meta = {"duracao_s": int(dur.group(1)) if dur else None,
            "titulo": json.loads(f'"{titulo.group(1)}"') if titulo else None}
    return partes[0], niveis, meta


def url_folha(base: str, n: Nivel, indice: int) -> str:
    nome = n.nome.replace("$M", str(indice)) if "$M" in n.nome else f"M{indice}"
    return base.replace("$L", str(n.L)).replace("$N", nome) + f"&sigh={n.sigh}"


def baixar_folhas(video_id: str, destino: Path, nivel: int = 3, http=None, pausa=0.2) -> dict:
    http = http or _http()
    base, niveis, meta = spec_storyboard(video_id, http)
    n = niveis[min(nivel, len(niveis) - 1)]
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    for i in range(n.folhas):
        alvo = destino / f"L{n.L}_M{i:03d}.jpg"
        if alvo.exists():
            continue
        r = http.get(url_folha(base, n, i), timeout=30)
        r.raise_for_status()
        alvo.write_bytes(r.content)
        total_bytes += len(r.content)
        time.sleep(pausa)
    info = {"video_id": video_id, **meta, "nivel": n.__dict__, "folhas": n.folhas, "bytes": total_bytes}
    (destino / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), "utf-8")
    return info
