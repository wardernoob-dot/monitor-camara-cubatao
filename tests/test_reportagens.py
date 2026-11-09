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


def test_revisao_derruba_frase_sem_trecho_no_documento():
    from camara import revisao_reportagens as RV
    docs = {"lei": "Art. 4º Fica criada a campanha educativa permanente de conscientização sobre os riscos das apostas."}
    saida = {"blocos": [
        {"tipo": "h", "texto": "O que muda"},
        {"tipo": "p", "texto": "Cria campanha.", "fontes": [{"doc": "lei", "trecho": "Fica criada a campanha educativa permanente de conscientização"}]},
        {"tipo": "p", "texto": "Inventado.", "fontes": [{"doc": "lei", "trecho": "o prefeito prometeu dez milhoes de reais"}]},
        {"tipo": "h", "texto": "Seção vazia"},
        {"tipo": "ul", "itens": [{"texto": "Sem fonte.", "fontes": []}]},
    ]}
    blocos, rel = RV.conferir(saida, docs)
    assert blocos == [{"t": "h", "x": "O que muda"}, {"t": "p", "x": "Cria campanha."}]
    assert [x["mantido"] for x in rel] == [True, False, False]



def test_paginas_de_previa_e_rss(tmp_path):
    from camara import compartilhar as CP
    pacote = {
        "reportagens": [
            {"id": "bets", "status": "publicado", "data": "2026-11-08", "manchete": 'Lei "nova" <b>', "linha_fina": "Linha"},
            {"id": "rasc", "status": "rascunho", "data": "2026-11-08", "manchete": "x", "linha_fina": "y"}],
        "vereadores": [{"slug": "fulano", "exibicao": "Fulano", "partido": "PSD", "em_exercicio": True, "foto": None,
                        "sessoes_total": 10, "presenca": {"sim": 9}, "projetos": ["pl-1-2026"], "leis": 1}],
        "materias": [{"slug": "pl-1-2026", "titulo": "PL 1/2026", "situacao": "Protocolado", "lista": True,
                      "explicacao": {"texto": "Cria um programa. " * 30}, "assunto": "x"},
                     {"slug": "rq-9-2026", "titulo": "RQ 9", "situacao": "x", "lista": False, "explicacao": None, "assunto": ""}],
    }
    assert CP.gerar(pacote, docs=tmp_path) == {"reportagens": 1, "vereadores": 1, "projetos": 1}
    h = (tmp_path / "r" / "bets" / "index.html").read_text("utf-8")
    assert 'og:image" content="https://votoavoto.surge.sh/fotos/previa/r-bets.jpg"' in h
    assert "&lt;b&gt;" in h and "<b>" not in h                             # manchete escapada
    assert 'url=../../#/reportagens/bets"' in h
    assert not (tmp_path / "r" / "rasc").exists()                          # rascunho nao ganha link
    v = (tmp_path / "v" / "fulano" / "index.html").read_text("utf-8")
    assert "90% de presença" in v and "1 projeto apresentado, 1 virou lei" in v
    p = (tmp_path / "p" / "pl-1-2026" / "index.html").read_text("utf-8")
    assert "…" in p and not (tmp_path / "p" / "rq-9-2026").exists()
    assert "<item>" in (tmp_path / "reportagens.xml").read_text("utf-8")
    assert (tmp_path / "fotos" / "previa" / "v-fulano.jpg").exists() and (tmp_path / "fotos" / "previa" / "site.jpg").exists()
