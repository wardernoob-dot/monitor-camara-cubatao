import pytest

from camara import reportagens as RP

CAB = """---
id: teste
status: publicado
data: 2026-11-07
manchete: Manchete
linha_fina: Linha fina
projetos: pl-1-2026
votacao: pl-1-2026 2026-03-17 1a_discussao
foto_alt: descricao
foto_credito: Fulano/Orgao
foto_licenca: CC BY 4.0
foto_link: https://exemplo.org/foto
foto_ilustrativa: sim
---
## O que muda

Texto com **negrito** e [link](https://exemplo.org) e [projeto](#/projetos/pl-1-2026).

- item um
- item dois
"""


def _escreve(tmp_path, texto, nome="teste.md"):
    (tmp_path / "fotos").mkdir(exist_ok=True)
    arq = tmp_path / nome
    arq.write_text(texto, "utf-8")
    return arq


def test_le_cabecalho_e_corpo(tmp_path):
    r = RP.ler(_escreve(tmp_path, CAB))
    assert r["projetos"] == ["pl-1-2026"]
    assert [b["t"] for b in r["corpo"]] == ["h", "p", "ul"]
    assert r["corpo"][2]["x"] == ["item um", "item dois"]


@pytest.mark.parametrize("troca", [
    ("foto_credito: Fulano/Orgao\n", ""),                      # credito obrigatorio
    ("foto_alt: descricao\n", ""),                             # texto alternativo obrigatorio
    ("status: publicado", "status: talvez"),
    ("foto_link: https://exemplo.org/foto", "foto_link: http://exemplo.org/foto"),
    ("(https://exemplo.org)", "(javascript:alert(1))"),        # link perigoso no corpo
    ("id: teste", "id: outro"),                                # id diferente do arquivo
])
def test_rejeita_reportagem_incompleta_ou_perigosa(tmp_path, troca):
    with pytest.raises(RP.ReportagemInvalida):
        RP.ler(_escreve(tmp_path, CAB.replace(*troca)))


def test_exporta_so_publicado_e_confere_projeto_e_votacao(tmp_path, monkeypatch):
    from PIL import Image
    monkeypatch.setattr(RP, "PASTA", tmp_path)
    monkeypatch.setattr(RP, "DESTINO_FOTOS", tmp_path / "saida")
    _escreve(tmp_path, CAB)
    Image.new("RGB", (40, 30), "white").save(tmp_path / "fotos" / "teste.jpg")
    _escreve(tmp_path, CAB.replace("id: teste", "id: rasc").replace("status: publicado", "status: rascunho"), "rasc.md")
    mats = {"pl-1-2026": {}}
    vots = [{"id": 7, "materia": "pl-1-2026", "data": "2026-03-17", "etapa": "1a_discussao"}]
    out = RP.exportar(mats, vots, rascunhos=False)
    assert [r["id"] for r in out] == ["teste"]
    assert out[0]["votacao"] == 7 and out[0]["foto"]["ilustrativa"] is True
    assert (tmp_path / "saida" / "teste-g.webp").exists()
    with pytest.raises(RP.ReportagemInvalida):
        RP.exportar({}, vots, rascunhos=False)                 # projeto que nao existe
    with pytest.raises(RP.ReportagemInvalida):
        RP.exportar(mats, [], rascunhos=False)                 # votacao que nao existe


def test_reportagens_do_repo_sao_validas():
    for arq in sorted(RP.PASTA.glob("*.md")):
        if not arq.name.upper().startswith("LEIA"):
            RP.ler(arq)
            assert any((RP.PASTA / "fotos").glob(f"{arq.stem}.*")), f"falta foto de {arq.stem}"
