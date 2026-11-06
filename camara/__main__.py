"""Uso:
    python -m camara coletar   [--desde 2026] [--secoes resumo,pauta,projetos] [--guardar-pdf]
    python -m camara processar
    python -m camara ocr-resumos   (manual: transcreve resumos escaneados; conferir o .ocr.txt antes de commitar)
    python -m camara tudo      [--desde 2026]
"""
import argparse
from pathlib import Path

DADOS = Path(__file__).resolve().parent.parent / "data"


def main():
    ap = argparse.ArgumentParser(prog="camara")
    ap.add_argument("comando", choices=["coletar", "processar", "tudo", "ocr-resumos"])
    ap.add_argument("--desde", type=int, default=2026)
    ap.add_argument("--secoes", default="resumo,pauta,projetos")
    ap.add_argument("--guardar-pdf", action="store_true")
    ap.add_argument("--dados", type=Path, default=DADOS)
    a = ap.parse_args()

    if a.comando == "ocr-resumos":
        from .analise import transcrever_resumos

        r = transcrever_resumos(a.dados)
        print("transcritos:", *r["transcritos"], sep="\n  ")
        print("ja existiam:", *r["ja_existiam"], sep="\n  ")
        print("falhas:", *r["falhas"], sep="\n  ")
        print("Confira cada data/texto/<sha>.ocr.txt contra o PDF antes de commitar.")
        return

    if a.comando in ("coletar", "tudo"):
        from .coletor import Coletor

        c = Coletor(a.dados, desde=a.desde, guardar_pdf=a.guardar_pdf)
        novos = c.coletar(tuple(a.secoes.split(",")))
        print(f"{len(novos)} documento(s) novo(s)")

    if a.comando in ("processar", "tudo"):
        from .processar import processar

        rel = processar(a.dados)
        print(f"{rel['sessoes']} sessoes | {rel['itens']} itens | {rel['votos']} votos individuais")
        if rel["via_ocr"]:
            print("lidos de transcricao OCR conferida:", *rel["via_ocr"], sep="\n  ")
        if rel["precisa_ocr"]:
            print("precisam de OCR:", *rel["precisa_ocr"], sep="\n  ")
        if rel["avisos"]:
            print(f"{len(rel['avisos'])} aviso(s):", *rel["avisos"][:30], sep="\n  ")

        from .videos import identificar_pendentes, limpar_falsos, processar_videos, validar_todas

        rv = processar_videos(a.dados)
        print(f"{rv['processados']} transmissao(oes) lida(s) no painel; {len(rv['erros'])} erro(s)")

        if n := limpar_falsos(a.dados):
            print(f"{n} falso(s) positivo(s) do painel removido(s)")
        ri = identificar_pendentes(a.dados)
        print(f"cabecalhos: {ri['identificadas']}/{ri['votacoes']} votacao(oes) identificada(s); {len(ri['erros'])} erro(s)")
        validar_todas(a.dados)

        from .consolidar import consolidar_tudo
        from .noticias import coletar as coletar_noticias

        coletar_noticias(a.dados)

        from .diario import coletar as coletar_diario

        coletar_diario(a.dados)

        consolidar_tudo(a.dados)

        from .analise import analisar_tudo, analisar_vetos
        from .site import montar
        from .vetos import oficios

        base = montar(a.dados)
        assuntos = {(m["tipo"], m["numero"], m["ano"]): m["assunto"] or "" for m in base.materias.values()
                    if m["numero"] and m["ano"]}
        analisar_vetos(a.dados, oficios(a.dados, assuntos))
        from .posts import gerar_tudo as gerar_posts

        analisar_tudo(a.dados)
        gerar_posts(a.dados)

        from .site import gerar as gerar_site

        gerar_site(a.dados)


if __name__ == "__main__":
    main()
