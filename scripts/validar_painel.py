"""Confere o leitor do painel contra os resumos oficiais (data/sessoes/*.json).

Para cada votacao lida no video, procura no resumo do mesmo dia a votacao que melhor casa
e mede a concordancia vereador a vereador.
  painel SIM    <-> grupo 'aprovacao' (ou 'manutencao') no resumo
  painel NAO    <-> grupo 'rejeicao'
  painel BRANCO <-> vereador fora das listas de voto
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from camara import painel as P  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SB = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "data" / "storyboard"
SPECS = json.loads((RAIZ / "data" / "storyboard_specs.json").read_text("utf-8"))


def votacoes_do_dia(data):
    out = []
    for f in sorted((RAIZ / "data" / "sessoes").glob(f"{data}_*.json")):
        s = json.loads(f.read_text("utf-8"))
        for it in s["itens"]:
            for v in it["votacoes"]:
                if not v["grupos"]:
                    continue
                esperado = {}
                for g in v["grupos"]:
                    lado = "SIM" if g["acao"].startswith(("aprova", "manuten")) else "NAO"
                    for k in g["vereadores"]:
                        esperado[k] = lado
                rot = (it.get("especie") or it.get("descricao") or "")[:45]
                out.append((f"{s['sessao']['numero']}a {s['sessao']['tipo'][:5]} | {rot} | {v.get('detalhe') or ''}"[:110],
                            esperado))
    return out


def concordancia(lido, esperado):
    ok = tot = 0
    for k, v in lido.items():
        e = esperado.get(k, "BRANCO")
        tot += 1
        ok += (v == e)
    return ok, tot


ROSTOS = P.Rostos.carregar(RAIZ / "data" / "rostos_2026.npz")
geral_ok = geral_tot = 0
n_completos = n_perfeitos = 0
for vid, meta in SPECS.items():
    pasta = SB / vid
    if not pasta.exists():
        continue
    dd, mm = meta["nome"].split()[-1].split("/")
    data = f"2026-{mm}-{dd}"
    candidatos = votacoes_do_dia(data)
    evs = P.eventos(pasta)
    print(f"\n=== {meta['nome']} ({vid}) — {len(evs)} votacoes no video, {len(candidatos)} no resumo"
          + ("" if candidatos else " [SEM RESUMO AINDA]"))
    for e in evs:
        r = P.resumo_evento(e, ROSTOS)
        lin = (f"  {r['inicio_s']//3600}h{r['inicio_s']%3600//60:02d} {'OK ' if r['completo'] else 'PARCIAL'}"
               f" {r['resultado'] or '-':9s} SIM={r['placar']['SIM']:2d} NAO={r['placar']['NAO']:2d}"
               f" BR={r['placar']['BRANCO']:2d} AUS={r['placar']['AUSENTE']} ?={r['placar']['?']} conf={r['confianca_rostos']}")
        if candidatos:
            melhor = max(candidatos, key=lambda c: concordancia(r["votos"], c[1])[0])
            ok, tot = concordancia(r["votos"], melhor[1])
            lin += f" | casa {ok}/{tot} com: {melhor[0]}"
            if r["completo"]:
                geral_ok += ok
                geral_tot += tot
                n_completos += 1
                n_perfeitos += (ok == tot)
        print(lin)

if geral_tot:
    print(f"\nCONCORDANCIA GERAL (votacoes completas): {geral_ok}/{geral_tot} = {100*geral_ok/geral_tot:.1f}%"
          f" | votacoes 15/15: {n_perfeitos}/{n_completos}")
