from camara.diario import classificar, parse_busca, similaridade

HTML = """<div class="space-y-4"><details><summary><div class="pr-6"><div>
<span>Edição 2119</span><span><i class="far fa-calendar-alt"></i> 29/10/2026</span>
<span><i class="fas fa-folder-open"></i> Secretaria de Assuntos Jurídicos (SEJUR)</span></div>
<h4>EXTRA - LEI Nº 4.487, DE 29 DE OUTUBRO DE 2026</h4>
<p>ALTERA A REDA&Ccedil;&Atilde;O DO INCISO II DO ART. 6&deg; DA LEI MUNICIPAL N&deg; 4.435 ...</p></div></summary>
<div><button onclick="window.open('imprimir.php?acao=materia&id=26258', '_blank')">Imprimir</button>
<div class="texto-legal"><p>FULANO, Prefeito, faço saber que a Câmara Municipal aprovou e eu sanciono e promulgo a seguinte Lei:</p></div>
</div></details></div>"""


def test_parse_e_classifica():
    (p,) = parse_busca(HTML)
    assert (p["id"], p["edicao"], p["data"]) == ("26258", "2119", "2026-10-29")
    assert p["ementa"].startswith("ALTERA A REDAÇÃO DO INCISO II")
    assert p["url"].endswith("id=26258")
    assert classificar(p) == {"tipo": "lei", "numero": "4487"}


def test_veto_e_similaridade():
    v = {"titulo": "OFÍCIO Nº 41/2026", "texto": "Comunico VETO PARCIAL ao Projeto de Lei nº 60/2025 que dispõe"}
    assert classificar(v) == {"tipo": "veto", "alcance": "parcial", "pl": "60", "ano": "2025"}
    assert similaridade("INSTITUI DIRETRIZES PARA A PROMOÇÃO DO BEM-ESTAR SONORO",
                        "INSTITUI DIRETRIZES PARA A PROMOÇÃO DO BEM- ESTAR SONORO DE PESSOAS") > 0.9
    assert similaridade("INSTITUI O DIA DO NORDESTINO", "AUTORIZA OPERAÇÃO DE CRÉDITO COM A CAIXA") < 0.5
