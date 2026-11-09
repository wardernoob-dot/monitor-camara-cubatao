"""Conferencia automatica de tela: abre as paginas do site (docs/) num navegador de verdade e falha se achar
erro de JavaScript, texto com contraste baixo (claro e escuro), pagina estourando a largura no celular
ou imagem quebrada. Roda no Actions (conferir-tela.yml) e na mao:

    python -m http.server 8765 -d docs &   e depois   python scripts/conferir_tela.py
"""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"
CONTRASTE_MIN = 3.0  # texto abaixo disso e ilegivel na pratica (WCAG AA pede 4,5 para texto normal)

JS_CONTRASTE = r"""(fundoPadrao) => {
 // "rgb(r, g, b)" ou "color(srgb r g b / a)" (color-mix devolve este, com canais de 0 a 1)
 const canais = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; let v = m.map(Number);
   if (c.startsWith('color(')) v = [v[0]*255, v[1]*255, v[2]*255, v[3] ?? 1]; return v; };
 const lum = (c) => { const m = canais(c); if (!m) return null; const [r,g,b,a] = m; if (a === 0) return null;
   const f = (v) => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
 const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; const m = canais(c); if (m && (m.length < 4 || +m[3] > .5)) return c; el = el.parentElement; } return fundoPadrao; };
 const out = [];
 for (const el of document.querySelectorAll('main *, footer *')) {
   if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
   const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
   const st = getComputedStyle(el); if (st.visibility === 'hidden' || +st.opacity === 0) continue;
   // texto sobre foto ou paisagem (fundo e imagem, nao cor) e leitor de tela ficam fora
   if (el.closest('.rp__slide, .hero, .rp-pagina__figura, .sr, [aria-hidden="true"]')) continue;
   // texto sobre "pilula" animada (o fundo e um elemento irmao, nao ancestral): conferido a parte em estilo.css
   if (el.matches('.subnav__texto, .segmentado__texto, .nav__texto')) continue;
   if (getComputedStyle(el.parentElement).backgroundImage !== 'none' || st.backgroundImage !== 'none') continue;
   const L1 = lum(st.color), L2 = lum(bg(el)); if (L1 == null || L2 == null) continue;
   const cr = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
   if (cr < %s) out.push(`${String(el.className).slice(0,40) || el.tagName} "${el.textContent.trim().slice(0,30)}" ${cr.toFixed(2)}`);
 }
 return [...new Set(out)];
}""" % CONTRASTE_MIN


def rotas() -> list[str]:
    d = json.loads((Path(__file__).resolve().parent.parent / "docs" / "data" / "dados.json").read_text("utf-8"))
    v = next(x["slug"] for x in d["vereadores"] if x["em_exercicio"])
    com_voto = next(m["slug"] for m in d["materias"] if m["eventos"] and m["analise"])
    r = ["/", "/vereadores", f"/vereadores/{v}", "/ranking", "/partidos", "/projetos", f"/projetos/{com_voto}",
         "/sessoes", f"/sessoes/{d['dias'][0]['data']}", "/como-funciona", "/reportagens"]
    if d["partidos"]:
        r.append("/partidos/" + d["partidos"][0]["sigla"].lower())
    if d.get("reportagens"):
        r.append(f"/reportagens/{d['reportagens'][0]['id']}")
    return r


async def main() -> int:
    falhas = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for tema, fundo in (("light", "rgb(250,250,250)"), ("dark", "rgb(15,16,18)")):
            ctx = await br.new_context(viewport={"width": 1300, "height": 900}, color_scheme=tema, reduced_motion="reduce")
            pg = await ctx.new_page()
            erros = []
            pg.on("pageerror", lambda e: erros.append(str(e)))
            for rota in rotas():
                erros.clear()
                await pg.goto(f"{BASE}/#{rota}")
                await pg.wait_for_selector("main h1, main h2", timeout=15000)
                await pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await pg.wait_for_timeout(700)
                if erros:
                    falhas.append(f"[{tema}] {rota}: erro de JS: {erros[0][:150]}")
                if await pg.query_selector("text=Página não encontrada"):
                    falhas.append(f"[{tema}] {rota}: caiu em 'não encontrada'")
                for c in await pg.evaluate(JS_CONTRASTE, fundo):
                    falhas.append(f"[{tema}] {rota}: contraste baixo: {c}")
                quebradas = await pg.evaluate("[...document.images].filter(i => i.complete && !i.naturalWidth && i.loading !== 'lazy').map(i => i.src)")
                for q in quebradas:
                    falhas.append(f"[{tema}] {rota}: imagem quebrada: {q}")
            await ctx.close()
        ctx = await br.new_context(viewport={"width": 360, "height": 740}, reduced_motion="reduce")
        pg = await ctx.new_page()
        for rota in rotas():
            await pg.goto(f"{BASE}/#{rota}")
            await pg.wait_for_selector("main h1, main h2", timeout=15000)
            await pg.wait_for_timeout(400)
            sobra = await pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            if sobra > 2:
                falhas.append(f"[celular] {rota}: pagina {sobra}px mais larga que a tela")
        await br.close()
    for f in sorted(set(falhas)):
        print("FALHA", f)
    print(f"{len(rotas())} paginas, {len(set(falhas))} falha(s)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
