"""Uso:
    python -m camara coletar   [--desde 2026] [--secoes resumo,pauta,projetos] [--guardar-pdf]
    python -m camara processar
    python -m camara tudo      [--desde 2026]
"""
import argparse
from pathlib import Path

DADOS = Path(__file__).resolve().parent.parent / "data"


def main():
    ap = argparse.ArgumentParser(prog="camara")
    ap.add_argument("comando", choices=["coletar", "processar", "tudo"])
    ap.add_argument("--desde", type=int, default=2026)
    ap.add_argument("--secoes", default="resumo,pauta,projetos")
    ap.add_argument("--guardar-pdf", action="store_true")
    ap.add_argument("--dados", type=Path, default=DADOS)
    a = ap.parse_args()

    if a.comando in ("coletar", "tudo"):
        from .coletor import Coletor

        c = Coletor(a.dados, desde=a.desde, guardar_pdf=a.guardar_pdf)
        novos = c.coletar(tuple(a.secoes.split(",")))
        print(f"{len(novos)} documento(s) novo(s)")

    if a.comando in ("processar", "tudo"):
        from .processar import processar

        rel = processar(a.dados)
        print(f"{rel['sessoes']} sessoes | {rel['itens']} itens | {rel['votos']} votos individuais")
        if rel["precisa_ocr"]:
            print("precisam de OCR:", *rel["precisa_ocr"], sep="\n  ")
        if rel["avisos"]:
            print(f"{len(rel['avisos'])} aviso(s):", *rel["avisos"][:30], sep="\n  ")

        from .videos import processar_videos

        rv = processar_videos(a.dados)
        print(f"{rv['processados']} transmissao(oes) lida(s) no painel; {len(rv['erros'])} erro(s)")


if __name__ == "__main__":
    main()
