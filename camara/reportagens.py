"""Reportagens: textos editoriais sobre projetos que mexem com a cidade (carrossel da pagina inicial).

Cada reportagem e um arquivo reportagens/<id>.md com cabecalho "chave: valor" entre linhas "---" e
corpo em markdown simples (## titulo, paragrafo, "- " item, **negrito**, [texto](link)). A foto fica em
reportagens/fotos/<id>.jpg e vira docs/fotos/reportagens/<id>-g.webp (1600 px) e <id>-p.webp (800 px).

Os fatos que mudam (situacao, autor, placar, voto de cada vereador) NAO ficam no texto: o site le do
proprio projeto. O texto e escrito por gente e so aparece com "status: publicado" (o dono do site aprova).
Rascunho aparece so quando a variavel de ambiente VAV_RASCUNHOS=1 (previa local).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "reportagens"
DESTINO_FOTOS = RAIZ / "docs" / "fotos" / "reportagens"

OBRIGATORIOS = ("id", "status", "data", "manchete", "linha_fina", "projetos",
                "foto_alt", "foto_credito", "foto_licenca", "foto_link")
STATUS = ("rascunho", "publicado")
RE_ID = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
RE_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RE_LINK_MD = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
TAMANHOS = {"g": 1600, "p": 800}


class ReportagemInvalida(ValueError):
    pass


def ler(arq: Path) -> dict:
    """Le um .md e devolve {campos..., "corpo": [blocos]}. Levanta ReportagemInvalida se faltar algo."""
    t = arq.read_text("utf-8").replace("\r\n", "\n")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", t, re.S)
    if not m:
        raise ReportagemInvalida(f"{arq.name}: falta o cabecalho entre linhas ---")
    cab = {}
    for linha in m.group(1).splitlines():
        if not linha.strip() or linha.lstrip().startswith("#"):
            continue
        if ":" not in linha:
            raise ReportagemInvalida(f"{arq.name}: linha do cabecalho sem ':' -> {linha!r}")
        k, v = linha.split(":", 1)
        cab[k.strip()] = v.strip()
    faltam = [k for k in OBRIGATORIOS if not cab.get(k)]
    if faltam:
        raise ReportagemInvalida(f"{arq.name}: faltam {', '.join(faltam)}")
    if not RE_ID.match(cab["id"]) or cab["id"] != arq.stem:
        raise ReportagemInvalida(f"{arq.name}: id deve ser igual ao nome do arquivo, so letras minusculas, numeros e '-'")
    if cab["status"] not in STATUS:
        raise ReportagemInvalida(f"{arq.name}: status deve ser rascunho ou publicado")
    if not RE_DATA.match(cab["data"]):
        raise ReportagemInvalida(f"{arq.name}: data no formato AAAA-MM-DD")
    if not cab["foto_link"].startswith("https://"):
        raise ReportagemInvalida(f"{arq.name}: foto_link precisa ser https")
    cab["projetos"] = [p.strip() for p in cab["projetos"].split(",") if p.strip()]
    corpo = blocos(m.group(2))
    if not corpo:
        raise ReportagemInvalida(f"{arq.name}: corpo vazio")
    for b in corpo:
        for txt in (b["x"] if isinstance(b["x"], list) else [b["x"]]):
            for _, url in RE_LINK_MD.findall(txt):
                if not (url.startswith("https://") or url.startswith("#/")):
                    raise ReportagemInvalida(f"{arq.name}: link nao permitido {url!r} (use https:// ou #/)")
    cab["corpo"] = corpo
    return cab


def blocos(md: str) -> list[dict]:
    """Markdown simples -> [{"t": "h"|"p"|"ul", "x": texto ou [itens]}]. Formatacao inline fica no texto."""
    out: list[dict] = []
    par: list[str] = []

    def fecha():
        if par:
            out.append({"t": "p", "x": " ".join(par)})
            par.clear()

    for linha in md.splitlines():
        s = linha.strip()
        if not s:
            fecha()
        elif s.startswith("## "):
            fecha()
            out.append({"t": "h", "x": s[3:].strip()})
        elif s.startswith("- "):
            fecha()
            if out and out[-1]["t"] == "ul":
                out[-1]["x"].append(s[2:].strip())
            else:
                out.append({"t": "ul", "x": [s[2:].strip()]})
        else:
            par.append(s)
    fecha()
    return out


def _foto(id_: str) -> dict[str, str]:
    from PIL import Image, ImageOps

    orig = next((p for p in (PASTA / "fotos").glob(f"{id_}.*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")), None)
    if not orig:
        raise ReportagemInvalida(f"{id_}: falta a foto em reportagens/fotos/{id_}.jpg")
    DESTINO_FOTOS.mkdir(parents=True, exist_ok=True)
    out = {}
    im = None
    for k, px in TAMANHOS.items():
        final = DESTINO_FOTOS / f"{id_}-{k}.webp"
        if not final.exists() or final.stat().st_mtime < orig.stat().st_mtime:
            if im is None:
                im = ImageOps.exif_transpose(Image.open(orig)).convert("RGB")
            c = im.copy()
            c.thumbnail((px, px), Image.LANCZOS)
            c.save(final, "WEBP", quality=74 if k == "g" else 78)
        out[k] = f"fotos/reportagens/{final.name}"
    return out


def exportar(materias: dict[str, dict], votacoes: list[dict], rascunhos: bool | None = None) -> list[dict]:
    """materias: {slug: materia exportada}; votacoes: eventos exportados (com id, materia, data, etapa).
    Devolve a lista pronta para o dados.json, mais recente primeiro."""
    if rascunhos is None:
        rascunhos = os.environ.get("VAV_RASCUNHOS") == "1"
    if not PASTA.exists():
        return []
    out = []
    for arq in sorted(PASTA.glob("*.md")):
        if arq.name.upper().startswith("LEIA"):
            continue
        r = ler(arq)
        if r["status"] != "publicado" and not rascunhos:
            continue
        for p in r["projetos"]:
            if p not in materias:
                raise ReportagemInvalida(f"{arq.name}: projeto {p!r} nao existe no site")
        vot = None
        if r.get("votacao"):
            # "pl-92-2026 2026-10-29 1a_discussao": o id numerico muda a cada exportacao, a chave nao
            partes = r["votacao"].split()
            if len(partes) != 3:
                raise ReportagemInvalida(f"{arq.name}: votacao no formato '<projeto> <AAAA-MM-DD> <etapa>'")
            achou = [e for e in votacoes if (e["materia"], e["data"], e["etapa"]) == tuple(partes)]
            if not achou:
                raise ReportagemInvalida(f"{arq.name}: votacao {r['votacao']!r} nao encontrada")
            vot = achou[-1]["id"]
        out.append({
            "id": r["id"], "status": r["status"], "data": r["data"], "chapeu": r.get("chapeu") or None,
            "manchete": r["manchete"], "linha_fina": r["linha_fina"], "projetos": r["projetos"], "votacao": vot,
            "foto": {**_foto(r["id"]), "alt": r["foto_alt"], "legenda": r.get("foto_legenda") or None,
                     "credito": r["foto_credito"], "licenca": r["foto_licenca"], "link": r["foto_link"],
                     "ilustrativa": r.get("foto_ilustrativa", "").lower() in ("sim", "s", "true", "1")},
            "corpo": r["corpo"], "aprovado_por": r.get("aprovado_por") or None,
            "ordem": int(r["ordem"]) if r.get("ordem", "").isdigit() else 99,
        })
    out.sort(key=lambda r: (r["ordem"], r["id"]))
    out.sort(key=lambda r: r["data"], reverse=True)  # mais recente primeiro; no mesmo dia, pela ordem
    return out
