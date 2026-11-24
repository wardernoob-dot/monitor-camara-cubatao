"""Paginas em HTML pronto para buscadores (Google, Bing) e para quem abre sem JavaScript.

O app (docs/index.html) monta tudo no navegador e as rotas ficam depois do '#', que buscador nao
indexa. Estas paginas repetem o essencial em HTML estatico, cada uma no seu endereco:

    docs/vereadores/index.html            lista dos vereadores
    docs/vereadores/<slug>/index.html     presenca, partido (com fonte), projetos e os ultimos votos
    docs/projetos/index.html              lista dos projetos com pagina
    docs/projetos/<slug>/index.html       situacao, autoria, ementa, cada votacao com placar e fonte
    docs/o-que-muda/<id>/index.html       texto completo da reportagem
    docs/sitemap.xml                      todos esses enderecos

Mesmas regras do site (CLAUDE.md): todo voto mostra a fonte; quem nao aparece no resumo "nao consta",
nunca e contra; em parecer contrario e veto o texto explica o que Sim quer dizer; nada de ranking por voto;
resumo de IA rotulado como IA. Cada pagina tem link para a versao completa no app.

SITE_INDEXAVEL e o endereco que buscador pode indexar. O *.surge.sh tem robots.txt fixo que bloqueia
buscador (nao da pra trocar), entao por ora vale o GitHub Pages. Com dominio proprio, troque aqui.
"""
from __future__ import annotations

import html
import re
import shutil
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
SITE_INDEXAVEL = "https://wardernoob-dot.github.io/monitor-camara-cubatao"
NOME = "Voto a voto"
ULTIMOS_VOTOS = 30

ROTULO_VOTO = {"SIM": "Sim", "NAO": "Não", "BRANCO": "Presente, não votou", "AUSENTE": "Ausente", "?": "Ilegível"}
ORDEM_VOTO = ["SIM", "NAO", "BRANCO", "AUSENTE", "?"]
RESULTADO = {"APROVADO": "Aprovado", "REJEITADO": "Rejeitado"}

CSS = """body{margin:0;background:#fafafa;color:#171717;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main,header,footer{max-width:46rem;margin:0 auto;padding:0 1.25rem}
header{padding-top:1.25rem}header a{color:#171717;text-decoration:none;font-weight:600}
h1{font-size:2rem;line-height:1.15;letter-spacing:-.03em;margin:1.5rem 0 .5rem}
h2{font-size:1.3rem;margin:2.25rem 0 .6rem;letter-spacing:-.02em}
a{color:#1f6a96}a:hover{color:#154e70}
.sub{color:#4d4d4d;margin:0 0 1rem}.nota{color:#4d4d4d;font-size:.9rem}
.aviso{background:#fff4cf;color:#6b4e00;border-radius:8px;padding:.6rem .8rem;font-size:.92rem}
.app{display:inline-block;margin:.5rem 0 1rem;padding:.65rem 1.1rem;border-radius:999px;background:#1f6a96;color:#fff;text-decoration:none;font-weight:500}
.app:hover{color:#fff;background:#154e70}
table{width:100%;border-collapse:collapse;font-size:.92rem}th,td{text-align:left;padding:.45rem .4rem;border-bottom:1px solid #ebebeb;vertical-align:top}
th{font-weight:600;color:#4d4d4d}ul.lista{padding-left:1.1rem}ul.lista li{margin:.3rem 0}
dl.ficha{display:grid;grid-template-columns:max-content 1fr;gap:.3rem 1rem}dl.ficha dt{color:#4d4d4d}dl.ficha dd{margin:0}
.votacao{border-top:1px solid #ebebeb;padding:.8rem 0}.votacao h3{font-size:1.05rem;margin:0 0 .3rem}
img.foto{width:96px;height:96px;border-radius:12px;object-fit:cover;float:right;margin:0 0 1rem 1rem}
footer{padding:2rem 1.25rem 3rem;color:#666;font-size:.85rem}
@media (prefers-color-scheme:dark){body{background:#0f1012;color:#ececee}header a{color:#ececee}a{color:#7cb6da}a:hover{color:#9fd0e8}
.sub,.nota,th,dl.ficha dt{color:#b9bac0}th,td,.votacao{border-color:#26282c}.aviso{background:#2d2610;color:#f2d98a}footer{color:#9b9da4}
.app{background:#2f7aa5}}
"""

MODELO = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
<title>{titulo} | {nome}</title>
<meta name="description" content="{descricao}">
<link rel="canonical" href="{canonico}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{nome}">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descricao}">
<meta property="og:url" content="{canonico}">
<link rel="stylesheet" href="{raiz}estatico.css">
<link rel="icon" href="{raiz}favicon.svg" type="image/svg+xml">
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<header><a href="{raiz}">{nome} · Câmara de Cubatão</a></header>
<main>
{corpo}
</main>
<footer>
<p>{nome}: o voto de cada vereador de Cubatão, sempre com a fonte. Dados de {atualizado}.
Esta é a versão em texto simples; a versão completa, com gráficos e filtros, abre no <a href="{app}">site interativo</a>.
Veja também a <a href="{raiz}vereadores/">lista dos vereadores</a> e a <a href="{raiz}projetos/">lista dos projetos</a>.</p>
</footer>
</body>
</html>
"""


def _e(t) -> str:
    return html.escape(" ".join(str(t or "").split()), quote=True)


def _data(iso: str | None, curta: bool = False) -> str:
    if not iso:
        return ""
    a, m, d = iso[:10].split("-")
    return f"{d}/{m}" if curta else f"{d}/{m}/{a}"


def _corta(t: str, n: int) -> str:
    t = " ".join(str(t or "").split())
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def _url_ok(u: str | None) -> str | None:
    return u if isinstance(u, str) and u.startswith(("https://", "http://")) else None


def _ld(obj: dict) -> str:
    import json
    # "<" vindo do dado poderia fechar a tag <script>; < e o mesmo caractere em JSON e nao fecha nada
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def _escreve(pasta: Path, profundidade: int, caminho: str, titulo: str, descricao: str, corpo: str, app: str,
             atualizado: str, jsonld: dict) -> None:
    raiz = "../" * profundidade
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "index.html").write_text(MODELO.format(
        nome=NOME, titulo=_e(titulo), descricao=_e(_corta(descricao, 160)), canonico=f"{SITE_INDEXAVEL}/{caminho}",
        raiz=raiz, corpo=corpo, app=f"{raiz}#{app}", atualizado=_data(atualizado), jsonld=_ld(jsonld)), "utf-8")


# ---------------------------------------------------------------- pedacos

def _fonte(ev: dict) -> str:
    if ev.get("fonte") == "painel":
        u = _url_ok(ev.get("link"))
        return f'<a href="{_e(u)}" rel="noopener">painel na transmissão</a>' if u else "painel na transmissão"
    if ev.get("fonte") == "resumo":
        u = _url_ok(ev.get("resumo_url"))
        return f'<a href="{_e(u)}" rel="noopener">resumo oficial da sessão</a>' if u else "resumo oficial da sessão"
    return "sem registro de votos"


def _aviso_sentido(ev: dict, m: dict) -> str:
    if m.get("tipo") == "VETO":
        return '<p class="aviso">Votação de veto: votar Sim é manter o veto do prefeito, e votar Não é derrubar.</p>'
    if ev.get("sentido") == "inverso":
        return '<p class="aviso">Nesta votação, votar Sim era ser contra o projeto seguir, e votar Não era ser a favor.</p>'
    if ev.get("sentido") == "emenda":
        return '<p class="aviso">Esta votação é sobre uma mudança no texto (emenda), não sobre o projeto inteiro.</p>'
    return ""


def _na_pratica(ev: dict, m: dict, voto: str) -> str:
    if voto not in ("SIM", "NAO"):
        return ""
    if m.get("tipo") == "VETO":
        return " (manter o veto)" if voto == "SIM" else " (derrubar o veto)"
    if ev.get("sentido") == "inverso":
        return " (contra o projeto)" if voto == "SIM" else " (a favor do projeto)"
    return ""


def _votacao(ev: dict, m: dict, nomes: dict) -> str:
    placar = f", {ev['sim']} a {ev['nao']}" if ev.get("sim") is not None and ev.get("nao") is not None and ev.get("votos") else ""
    res = RESULTADO.get(ev.get("resultado"), "Sem resultado registrado")
    partes = [f'<div class="votacao"><h3>{_e(_data(ev["data"]))} · {_e(ev.get("etapa_txt") or ev.get("etapa"))}</h3>',
              f"<p>{_e(res)}{_e(placar)}. Fonte: {_fonte(ev)}.</p>", _aviso_sentido(ev, m)]
    grupos = {k: sorted((nomes.get(s, s) for s, v in ev.get("votos", {}).items() if v == k), key=str.casefold) for k in ORDEM_VOTO}
    itens = [f"<li><strong>{_e(ROTULO_VOTO[k])} ({len(g)}):</strong> {_e(', '.join(g))}</li>" for k, g in grupos.items() if g]
    if itens:
        partes.append('<ul class="lista">' + "".join(itens) + "</ul>")
    if ev.get("fonte") == "resumo":
        partes.append('<p class="nota">O resumo oficial só lista quem votou: quem não aparece fica como “não consta”, nunca como voto contrário.</p>')
    return "".join(partes) + "</div>"


# ---------------------------------------------------------------- paginas

def _vereador(v: dict, pk: dict, nomes: dict, atualizado: str, docs: Path) -> None:
    mats = {m["slug"]: m for m in pk["materias"]}
    votos = [(ev, ev["votos"][v["slug"]]) for ev in pk["votacoes"] if v["slug"] in ev.get("votos", {})]
    votos.sort(key=lambda x: (x[0]["data"], x[0]["id"]), reverse=True)
    pres = v.get("presenca") or {}
    total = v.get("sessoes_total") or 0
    pct = round(100 * (pres.get("sim") or 0) / total) if total else None
    cargo = "Vereador" if v.get("em_exercicio") else "Suplente (já exerceu o mandato em 2026)"
    foto = f'<img class="foto" src="../../{_e(v["foto_p"] or v["foto"])}" alt="Foto de {_e(v["exibicao"])}">' if v.get("foto") else ""
    partido = ""
    if v.get("partido"):
        fonte = _e(v.get("partido_fonte") or "documento oficial")
        u = _url_ok(v.get("partido_url"))
        partido = f"{_e(v['partido'])} (fonte: " + (f'<a href="{_e(u)}" rel="noopener">{fonte}</a>' if u else fonte) + ")"
    ficha = [("Nome", _e(v["nome"])), ("Cargo", _e(cargo))]
    if partido:
        ficha.append(("Partido", partido))
    if pct is not None:
        ficha.append(("Presença", f"{pct}% das {total} sessões registradas em 2026"))
    n = len(v.get("projetos") or [])
    ficha.append(("Projetos de lei", f"{n} apresentado{'s' if n != 1 else ''}, {v.get('leis') or 0} {'virou' if (v.get('leis') or 0) == 1 else 'viraram'} lei"))
    corpo = [foto, f"<h1>{_e(v['exibicao'])}</h1>",
             f'<p class="sub">{_e(cargo)} da Câmara Municipal de Cubatão. Como votou em 2026, com a fonte de cada voto.</p>',
             f'<a class="app" href="../../#/vereadores/{_e(v["slug"])}">Ver a página completa</a>',
             '<dl class="ficha">' + "".join(f"<dt>{a}</dt><dd>{b}</dd>" for a, b in ficha) + "</dl>"]
    projs = [mats[s] for s in (v.get("projetos") or []) if s in mats]
    if projs:
        corpo.append("<h2>Projetos de lei que apresentou</h2><ul class=\"lista\">" + "".join(
            f'<li><a href="../../projetos/{_e(m["slug"])}/">{_e(m["titulo"])}</a>: {_e(_corta(m.get("assunto") or "", 140))} '
            f'<span class="nota">({_e(m["situacao"])})</span></li>' for m in projs) + "</ul>")
    if votos:
        linhas = []
        for ev, voto in votos[:ULTIMOS_VOTOS]:
            m = mats.get(ev["materia"], {"titulo": ev["materia"], "slug": ev["materia"]})
            linhas.append(f'<tr><td>{_e(_data(ev["data"]))}</td><td><a href="../../projetos/{_e(m["slug"])}/">{_e(m["titulo"])}</a>'
                          f'<br><span class="nota">{_e(ev.get("etapa_txt") or "")}</span></td>'
                          f'<td>{_e(ROTULO_VOTO.get(voto, voto) + _na_pratica(ev, m, voto))}</td><td>{_fonte(ev)}</td></tr>')
        corpo.append(f"<h2>Últimos votos</h2><p class=\"nota\">Os {min(len(votos), ULTIMOS_VOTOS)} mais recentes de {len(votos)}. "
                     "A lista inteira, com filtros, está na página completa.</p>"
                     "<table><thead><tr><th scope=\"col\">Data</th><th scope=\"col\">Projeto</th><th scope=\"col\">Voto</th>"
                     "<th scope=\"col\">Fonte</th></tr></thead><tbody>" + "".join(linhas) + "</tbody></table>")
    desc = f"{cargo} da Câmara de Cubatão" + (f" ({v['partido']})" if v.get("partido") else "") + \
        (f": {pct}% de presença em 2026" if pct is not None else "") + f", {n} projeto{'s' if n != 1 else ''} apresentado{'s' if n != 1 else ''} e como votou em cada votação, com a fonte."
    ld = {"@context": "https://schema.org", "@type": "Person", "name": v["nome"], "alternateName": v["exibicao"],
          "jobTitle": cargo.split(" (")[0], "worksFor": {"@type": "GovernmentOrganization", "name": "Câmara Municipal de Cubatão"},
          "url": f"{SITE_INDEXAVEL}/vereadores/{v['slug']}/"}
    if v.get("partido"):
        ld["affiliation"] = {"@type": "Organization", "name": v["partido"]}
    _escreve(docs / "vereadores" / v["slug"], 2, f"vereadores/{v['slug']}/", f"{v['exibicao']}: como votou na Câmara de Cubatão",
             desc, "\n".join(c for c in corpo if c), f"/vereadores/{v['slug']}", atualizado, ld)


def _projeto(m: dict, pk: dict, nomes: dict, atualizado: str, docs: Path) -> None:
    eventos = [pk["votacoes"][i] for i in m.get("eventos", []) if 0 <= i < len(pk["votacoes"])]
    autores = [f'<a href="../../vereadores/{_e(s)}/">{_e(nomes.get(s, s))}</a>' for s in m.get("autores", [])]
    ficha = [("Tipo", _e(m.get("tipo_nome") or m.get("tipo"))), ("Situação", _e(m["situacao"])),
             ("Autoria", ", ".join(autores) if autores else _e(m.get("autoria")))]
    if m.get("lei"):
        lei = m["lei"]
        u = _url_ok(lei.get("url"))
        txt = _e(f"Lei {lei.get('numero')}" + (f", de {_data(lei.get('data'))}" if lei.get("data") else ""))
        ficha.append(("Lei", f'<a href="{_e(u)}" rel="noopener">{txt}</a>' if u else txt))
    doc = _url_ok(m.get("documento"))
    if doc:
        arq = _url_ok(m.get("documento_arquivo"))
        ficha.append(("Texto original", f'<a href="{_e(doc)}" rel="noopener">PDF no site da Câmara</a>'
                      + (f' · <a href="{_e(arq)}" rel="noopener">cópia guardada no archive.org</a>' if arq else "")))
    corpo = [f"<h1>{_e(m['titulo'])}</h1>", f'<p class="sub">{_e(m.get("tipo_nome") or "")} da Câmara Municipal de Cubatão.</p>',
             f'<a class="app" href="../../#/projetos/{_e(m["slug"])}">Ver a página completa</a>',
             '<dl class="ficha">' + "".join(f"<dt>{a}</dt><dd>{b}</dd>" for a, b in ficha) + "</dl>"]
    if m.get("assunto"):
        corpo.append(f"<h2>Ementa (texto oficial)</h2><p>{_e(m['assunto'])}</p>")
    ex = m.get("explicacao")
    if ex and ex.get("texto"):
        corpo.append(f"<h2>Em linguagem simples</h2><p>{_e(ex['texto'])}</p>"
                     f'<p class="nota">Resumo feito por inteligência artificial ({_e(ex.get("modelo"))}) só com {_e(ex.get("base"))}. '
                     "Pode simplificar demais: o texto oficial vale.</p>")
    if eventos:
        corpo.append("<h2>Votações</h2>" + "".join(_votacao(ev, m, nomes) for ev in sorted(eventos, key=lambda e: (e["data"], e["id"]))))
    desc = f"{m['titulo']}: {m.get('assunto') or m['situacao']}"
    ld = {"@context": "https://schema.org", "@type": "Legislation", "name": m["titulo"], "legislationIdentifier": m["titulo"],
          "description": _corta(m.get("assunto") or "", 300), "legislationJurisdiction": "Cubatão, SP, Brasil",
          "legislationPassedBy": {"@type": "GovernmentOrganization", "name": "Câmara Municipal de Cubatão"},
          "url": f"{SITE_INDEXAVEL}/projetos/{m['slug']}/"}
    _escreve(docs / "projetos" / m["slug"], 2, f"projetos/{m['slug']}/", f"{m['titulo']}: o que é e como votaram",
             desc, "\n".join(corpo), f"/projetos/{m['slug']}", atualizado, ld)


def _inline(t: str) -> str:
    """**negrito** e [texto](url) do .md da reportagem; link #/... vira a pagina estatica quando existe."""
    out, i = [], 0
    for mm in re.finditer(r"\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)", t):
        out.append(_e(t[i:mm.start()]))
        if mm.group(1):
            out.append(f"<strong>{_e(mm.group(1))}</strong>")
        else:
            alvo = mm.group(3)
            if alvo.startswith("#/projetos/") or alvo.startswith("#/vereadores/"):
                alvo = "../../" + alvo[2:].rstrip("/") + "/"
            elif alvo.startswith("#/"):
                alvo = "../../" + alvo
            elif not alvo.startswith("https://"):
                out.append(_e(mm.group(2)))
                i = mm.end()
                continue
            out.append(f'<a href="{_e(alvo)}">{_e(mm.group(2))}</a>')
        i = mm.end()
    out.append(_e(t[i:]))
    return "".join(out)


def _reportagem(r: dict, pk: dict, atualizado: str, docs: Path) -> None:
    mats = {m["slug"]: m for m in pk["materias"]}
    corpo = [f"<h1>{_e(r['manchete'])}</h1>", f'<p class="sub">{_e(r["linha_fina"])}</p>',
             f'<p class="nota">{_e(r.get("chapeu") or "O que muda")} · {_e(_data(r["data"]))} · texto da equipe Voto a voto</p>',
             f'<a class="app" href="../../#/o-que-muda/{_e(r["id"])}">Ver a página completa</a>']
    for bl in r.get("corpo") or []:
        if bl["t"] == "h":
            corpo.append(f"<h2>{_e(bl['x'])}</h2>")
        elif bl["t"] == "p":
            corpo.append(f"<p>{_inline(bl['x'])}</p>")
        elif bl["t"] == "ul":
            corpo.append('<ul class="lista">' + "".join(f"<li>{_inline(x)}</li>" for x in bl["x"]) + "</ul>")
    projs = [mats[s] for s in r.get("projetos", []) if s in mats]
    if projs:
        corpo.append("<h2>Os projetos, a situação e os votos</h2><ul class=\"lista\">" + "".join(
            f'<li><a href="../../projetos/{_e(m["slug"])}/">{_e(m["titulo"])}</a>: {_e(m["situacao"])}</li>' for m in projs) + "</ul>")
    foto = r.get("foto") or {}
    if foto.get("credito"):
        corpo.append(f'<p class="nota">Foto{" ilustrativa" if foto.get("ilustrativa") else ""}: {_e(foto["credito"])} ({_e(foto.get("licenca"))}).</p>')
    ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": r["manchete"], "description": r["linha_fina"],
          "datePublished": r["data"], "author": {"@type": "Organization", "name": "Equipe Voto a voto"},
          "url": f"{SITE_INDEXAVEL}/o-que-muda/{r['id']}/"}
    _escreve(docs / "o-que-muda" / r["id"], 2, f"o-que-muda/{r['id']}/", r["manchete"], r["linha_fina"],
             "\n".join(corpo), f"/o-que-muda/{r['id']}", atualizado, ld)


def _lista_vereadores(pk: dict, atualizado: str, docs: Path) -> None:
    def li(v):
        p = f" ({_e(v['partido'])})" if v.get("partido") else ""
        return f'<li><a href="{_e(v["slug"])}/">{_e(v["exibicao"])}</a>{p} <span class="nota">{_e(v["nome"])}</span></li>'
    atuais = [v for v in pk["vereadores"] if v.get("em_exercicio")]
    supl = [v for v in pk["vereadores"] if not v.get("em_exercicio")]
    corpo = ["<h1>Vereadores de Cubatão</h1>",
             f'<p class="sub">Os {len(atuais)} vereadores em exercício na Câmara Municipal de Cubatão em 2026. Em ordem alfabética.</p>',
             '<a class="app" href="../#/vereadores">Ver a página completa</a>', '<ul class="lista">' + "".join(li(v) for v in atuais) + "</ul>"]
    if supl:
        corpo.append("<h2>Suplentes que exerceram o mandato em 2026</h2><ul class=\"lista\">" + "".join(li(v) for v in supl) + "</ul>")
    _escreve(docs / "vereadores", 1, "vereadores/", "Vereadores de Cubatão: como cada um votou",
             f"Os {len(atuais)} vereadores da Câmara Municipal de Cubatão: presença, projetos e o voto de cada um, com a fonte.",
             "\n".join(corpo), "/vereadores", atualizado, {"@context": "https://schema.org", "@type": "CollectionPage",
                                                           "name": "Vereadores de Cubatão", "url": f"{SITE_INDEXAVEL}/vereadores/"})


def _lista_projetos(pk: dict, atualizado: str, docs: Path) -> None:
    linhas = "".join(f'<li><a href="{_e(m["slug"])}/">{_e(m["titulo"])}</a>: {_e(_corta(m.get("assunto") or "", 150))} '
                     f'<span class="nota">({_e(m["situacao"])})</span></li>' for m in pk["materias"])
    corpo = ["<h1>Projetos da Câmara de Cubatão</h1>",
             f'<p class="sub">{len(pk["materias"])} projetos, requerimentos e moções de 2026, do mais recente ao mais antigo.</p>',
             '<a class="app" href="../#/projetos">Ver a página completa, com busca e filtros</a>', f'<ul class="lista">{linhas}</ul>']
    _escreve(docs / "projetos", 1, "projetos/", "Projetos da Câmara de Cubatão: situação e votos",
             "Projetos de lei, requerimentos e moções da Câmara Municipal de Cubatão em 2026: o que diz cada um, a situação e como cada vereador votou.",
             "\n".join(corpo), "/projetos", atualizado, {"@context": "https://schema.org", "@type": "CollectionPage",
                                                         "name": "Projetos da Câmara de Cubatão", "url": f"{SITE_INDEXAVEL}/projetos/"})


def _sitemap(pk: dict, atualizado: str, docs: Path) -> int:
    hoje = (atualizado or date.today().isoformat())[:10]
    urls = [("", hoje), ("vereadores/", hoje), ("projetos/", hoje)]
    urls += [(f"vereadores/{v['slug']}/", hoje) for v in pk["vereadores"]]
    urls += [(f"projetos/{m['slug']}/", (m.get("ultima_data") or hoje)[:10]) for m in pk["materias"]]
    urls += [(f"o-que-muda/{r['id']}/", r["data"][:10]) for r in pk.get("reportagens") or [] if r.get("status") == "publicado"]
    corpo = "".join(f"<url><loc>{html.escape(SITE_INDEXAVEL + '/' + u)}</loc><lastmod>{d}</lastmod></url>\n" for u, d in urls)
    (docs / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + corpo + "</urlset>\n", "utf-8")
    return len(urls)


def gerar(pacote: dict, docs: Path | None = None) -> dict:
    """Regrava as paginas estaticas a partir do mesmo pacote gravado em dados.json."""
    docs = Path(docs or DOCS)
    atualizado = pacote["meta"]["atualizado"]
    nomes = {v["slug"]: v["exibicao"] for v in pacote["vereadores"]}
    for pasta in ("vereadores", "projetos", "o-que-muda"):  # pagina de quem saiu (slug mudou) nao fica orfa
        if (docs / pasta).exists():
            shutil.rmtree(docs / pasta)
    (docs / "estatico.css").write_text(CSS, "utf-8")
    for v in pacote["vereadores"]:
        _vereador(v, pacote, nomes, atualizado, docs)
    materias = [m for m in pacote["materias"] if m.get("lista") or m.get("eventos")]  # as que tem pagina no app
    for m in materias:
        _projeto(m, pacote, nomes, atualizado, docs)
    for r in pacote.get("reportagens") or []:
        if r.get("status") == "publicado":
            _reportagem(r, pacote, atualizado, docs)
    _lista_vereadores(pacote, atualizado, docs)
    _lista_projetos({**pacote, "materias": materias}, atualizado, docs)
    n = _sitemap({**pacote, "materias": materias}, atualizado, docs)
    return {"paginas": n}
