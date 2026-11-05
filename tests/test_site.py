from pathlib import Path

from camara import site as S

RAIZ = Path(__file__).resolve().parent.parent


def test_assinaturas_e_destinatario():
    t = ("Art. 3 Revoga.\n__________\nGuilherme dos Santos Malaquias\nVereador PSB– Cubatão\n"
         "A Vossa Excelência o Senhor\nVereador ALEXANDRE MENDES DA SILVA\nPresidente da Câmara Municipal\n"
         "Vereador Edson Mota - União Brasil\n")
    assert S._assinaturas(t) == [("Guilherme dos Santos Malaquias", "PSB"), ("Edson Mota", "UNIÃO BRASIL")]


def test_descricao_de_requerimento():
    assert S._desc_curta("Aprovado o Requerimento nº 52, de autoria do Vereador Márcio Silva Nascimento, "
                         "solicitando a formação de comissão") == "Solicitando a formação de comissão"


def test_site_gerado_com_dados_do_repo(tmp_path):
    r = S.gerar(RAIZ / "data", tmp_path / "site")
    assert r["paginas"] > 50
    inicio = (tmp_path / "site" / "index.html").read_text("utf-8")
    assert "Como cada vereador de Cubatão votou" in inicio and 'class="mx"' in inicio
    for p in ("vereadores/xuxa", "vereadores/topete", "projetos/pl-92-2026", "como-funciona"):
        assert (tmp_path / "site" / p / "index.html").exists(), p
    pl92 = (tmp_path / "site" / "projetos" / "pl-92-2026" / "index.html").read_text("utf-8")
    assert "Virou a Lei 4.487" in pl92 and "../../static/site.css" in pl92
