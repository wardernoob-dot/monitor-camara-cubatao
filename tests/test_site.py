import json
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


def test_exporta_json_do_app(tmp_path):
    S.exportar(RAIZ / "data", tmp_path)
    d = json.loads((tmp_path / "dados.json").read_text("utf-8"))
    assert set(d) == {"meta", "vereadores", "materias", "votacoes", "dias"}
    slugs = {v["slug"] for v in d["vereadores"]}
    assert {"xuxa", "topete", "marcinho"} <= slugs
    materias = {m["slug"]: m for m in d["materias"]}
    pl92 = materias["pl-92-2026"]
    assert pl92["lei"]["numero"] == "4.487" and pl92["situacao_cls"] == "lei"
    # toda referencia do app aponta pra algo que existe
    for m in d["materias"]:
        assert all(0 <= i < len(d["votacoes"]) for i in m["eventos"])
        assert set(m["autores"]) <= slugs
    for ev in d["votacoes"]:
        assert ev["materia"] in materias and set(ev["votos"]) <= slugs
    assert [e["data"] for e in d["votacoes"]] == sorted(e["data"] for e in d["votacoes"])
    for s in (tmp_path / "analises").glob("*.json"):
        assert s.stem in materias and materias[s.stem]["analise"]
