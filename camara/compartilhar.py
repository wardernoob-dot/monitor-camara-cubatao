"""Paginas de previa para link compartilhado (WhatsApp, Facebook, X) e feed RSS das reportagens.

O site e um app de pagina unica com rotas depois do '#'. Quem monta a previa do link nao executa JavaScript
nem ve o que vem depois do '#', entao todo link compartilhado apareceria igual. Por isso cada reportagem,
vereador e projeto ganha um HTML estatico pequeno so com as tags de previa, que redireciona para o app:

    docs/r/<id>/index.html    -> #/reportagens/<id>   imagem: a foto da reportagem
    docs/v/<slug>/index.html  -> #/vereadores/<slug>  imagem: cartao com a foto e os numeros do vereador
    docs/p/<slug>/index.html  -> #/projetos/<slug>    imagem: cartao padrao do site
    docs/fotos/previa/*.jpg   -> imagens 1200x630 em JPEG (WebP nem todo app aceita)
    docs/reportagens.xml      -> RSS das reportagens

As tags og: exigem endereco absoluto; SITE_URL e o endereco oficial (Surge). O redirecionamento e relativo,
entao as mesmas paginas funcionam no GitHub Pages.
"""

from __future__ import annotations

import html
import shutil
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
FONTES = RAIZ / "assets" / "fonts"
SITE_URL = "https://votoavoto.surge.sh"
NOME = "Voto a voto"
L, A = 1200, 630
COR = {"fundo": "#fafafa", "tinta": "#171717", "cinza": "#666666", "azul": "#1f6a96", "guara": "#ee4b36"}

MODELO = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo} | {nome}</title>
<meta name="description" content="{descricao}">
<meta property="og:type" content="{tipo}">
<meta property="og:site_name" content="{nome}">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descricao}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{imagem}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url}">
<meta http-equiv="refresh" content="0; url={destino}">
</head>
<body>
<p><a href="{destino}">{titulo}</a></p>
</body>
</html>
"""


def _e(t) -> str:
    return html.escape(" ".join(str(t or "").split()), quote=True)


def _corta(t: str, n: int) -> str:
    t = " ".join(str(t or "").split())
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def _pagina(pasta: Path, **k) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "index.html").write_text(MODELO.format(nome=NOME, **{a: _e(b) for a, b in k.items()}), "utf-8")


def _f(peso: str, tam: int):
    from PIL import ImageFont
    return ImageFont.truetype(str(FONTES / f"Inter-{peso}.otf"), tam)


def _base():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (L, A), COR["fundo"])
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, L, 10), fill=COR["azul"])
    d.ellipse((60, 55, 84, 79), fill=COR["guara"])
    d.text((96, 50), NOME, font=_f("Bold", 28), fill=COR["tinta"])
    d.text((96 + d.textlength(NOME, font=_f("Bold", 28)) + 14, 55), "Câmara de Cubatão", font=_f("Regular", 22), fill=COR["cinza"])
    return im, d


def _cartao_site(destino: Path) -> None:
    im, d = _base()
    d.text((60, 210), "Como cada vereador", font=_f("ExtraBold", 84), fill=COR["tinta"])
    d.text((60, 305), "de Cubatão votou", font=_f("ExtraBold", 84), fill=COR["azul"])
    d.text((62, 430), "Votos, projetos e leis em linguagem simples, com a fonte.", font=_f("Regular", 34), fill=COR["cinza"])
    im.save(destino, "JPEG", quality=88, optimize=True)


def _cartao_vereador(v: dict, docs: Path, destino: Path) -> None:
    from PIL import Image, ImageDraw, ImageOps
    im, d = _base()
    x = 60
    foto = docs / v["foto"] if v.get("foto") else None
    if foto and foto.exists():
        lado = 300
        f = ImageOps.fit(Image.open(foto).convert("RGB"), (lado, lado), Image.LANCZOS, centering=(0.5, 0.3))
        masc = Image.new("L", (lado, lado), 0)
        ImageDraw.Draw(masc).ellipse((0, 0, lado, lado), fill=255)
        d.ellipse((56, 186, 56 + lado + 8, 186 + lado + 8), fill=COR["azul"])
        im.paste(f, (60, 190), masc)
        x = 410
    cargo = ("VEREADOR" if v.get("em_exercicio") else "SUPLENTE") + (f" · {v['partido']}" if v.get("partido") else "")
    d.text((x, 182), cargo, font=_f("SemiBold", 26), fill=COR["azul"])
    nome, tam = v["exibicao"], 84
    while d.textlength(nome, font=_f("ExtraBold", tam)) > L - x - 50 and tam > 44:
        tam -= 4
    d.text((x, 222), nome, font=_f("ExtraBold", tam), fill=COR["tinta"])
    for i, linha in enumerate(_linhas_vereador(v) + ["Veja como votou em cada projeto, com a fonte."]):
        d.text((x, 318 + i * 44), linha, font=_f("Regular", 32), fill=COR["cinza"])
    im.save(destino, "JPEG", quality=86, optimize=True)


def _linhas_vereador(v: dict) -> list[str]:
    out = []
    if v.get("sessoes_total"):
        out.append(f"{round(100 * (v['presenca'].get('sim') or 0) / v['sessoes_total'])}% de presença nas sessões de 2026")
    n, leis = len(v.get("projetos") or []), v.get("leis") or 0
    out.append(f"{n} {'projeto apresentado' if n == 1 else 'projetos apresentados'}, "
               f"{leis} {'virou lei' if leis == 1 else 'viraram lei'}")
    return out


def _og_da_foto(orig: Path, destino: Path) -> None:
    from PIL import Image, ImageOps
    if destino.exists() and destino.stat().st_mtime >= orig.stat().st_mtime:
        return
    im = ImageOps.exif_transpose(Image.open(orig)).convert("RGB")
    ImageOps.fit(im, (L, A), Image.LANCZOS, centering=(0.5, 0.45)).save(destino, "JPEG", quality=82, optimize=True)


def gerar(pacote: dict, docs: Path | None = None) -> dict:
    """pacote: o mesmo dicionario gravado em dados.json. Regrava docs/r, docs/v, docs/p, docs/fotos/previa e o RSS."""
    docs = Path(docs or DOCS)
    previa = docs / "fotos" / "previa"
    previa.mkdir(parents=True, exist_ok=True)
    _cartao_site(previa / "site.jpg")
    padrao = f"{SITE_URL}/fotos/previa/site.jpg"
    for sub in ("r", "v", "p"):
        if (docs / sub).exists():
            shutil.rmtree(docs / sub)  # reportagem despublicada ou pagina que deixou de existir nao deixa link orfao
    publicadas = [r for r in pacote.get("reportagens") or [] if r["status"] == "publicado"]
    for r in publicadas:
        orig = next(iter((RAIZ / "reportagens" / "fotos").glob(f"{r['id']}.*")), None)
        img = padrao
        if orig:
            _og_da_foto(orig, previa / f"r-{r['id']}.jpg")
            img = f"{SITE_URL}/fotos/previa/r-{r['id']}.jpg"
        _pagina(docs / "r" / r["id"], tipo="article", titulo=r["manchete"], descricao=r["linha_fina"],
                url=f"{SITE_URL}/r/{r['id']}/", imagem=img, destino=f"../../#/o-que-muda/{r['id']}")
    for v in pacote["vereadores"]:
        _cartao_vereador(v, docs, previa / f"v-{v['slug']}.jpg")
        _pagina(docs / "v" / v["slug"], tipo="profile", titulo=f"{v['exibicao']}: como votou na Câmara de Cubatão",
                descricao=" · ".join(_linhas_vereador(v)), url=f"{SITE_URL}/v/{v['slug']}/",
                imagem=f"{SITE_URL}/fotos/previa/v-{v['slug']}.jpg", destino=f"../../#/vereadores/{v['slug']}")
    n_p = 0
    for m in pacote["materias"]:
        if not m.get("lista"):
            continue
        n_p += 1
        desc = (m.get("explicacao") or {}).get("texto") or m.get("assunto") or ""
        _pagina(docs / "p" / m["slug"], tipo="article", titulo=f"{m['titulo']}: {m['situacao']}", descricao=_corta(desc, 220),
                url=f"{SITE_URL}/p/{m['slug']}/", imagem=padrao, destino=f"../../#/projetos/{m['slug']}")
    itens = "".join(
        f"<item><title>{_e(r['manchete'])}</title><link>{SITE_URL}/r/{r['id']}/</link>"
        f"<guid>{SITE_URL}/r/{r['id']}/</guid><description>{_e(r['linha_fina'])}</description>"
        f"<pubDate>{format_datetime(datetime.fromisoformat(r['data']).replace(tzinfo=timezone.utc))}</pubDate></item>\n"
        for r in publicadas)
    (docs / "reportagens.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
        f"<title>{NOME}: o que muda</title><link>{SITE_URL}/</link>"
        "<description>Projetos e leis que mexem com o dia a dia de Cubatão, em linguagem simples.</description>"
        f"<language>pt-BR</language>\n{itens}</channel></rss>\n", "utf-8")
    return {"reportagens": len(publicadas), "vereadores": len(pacote["vereadores"]), "projetos": n_p}
