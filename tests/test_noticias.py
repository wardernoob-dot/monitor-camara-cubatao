from camara import validacao as V
from camara.noticias import extrair, ler_rss, texto_da_pagina

APEL = dict(V.APELIDOS_EXTRA, **{"batore": "jose elan dos santos gomes", "xuxa": "daniel barbosa de assis silva",
                                 "marcinho": "marcio silva nascimento", "cleber do cavaco": "joemerson alves de souza",
                                 "afonsinho": "jose afonso"})

TEXTO = (
    "Os vereadores rejeitaram ontem (20/10), na 35ª Sessão Ordinária, o Projeto de Lei Nº 75/2026, da Prefeitura.\n"
    "O relator deu parecer desfavorável, aprovado em Plenário. Votaram a favor do parecer desfavorável os vereadores "
    "Batoré (Agir), Xuxa (PSDB) e Marcinho (PSB). Já Cléber do Cavaco (PSD) e Afonsinho (PSD) votaram contra.\n"
    "Projeto de Lei Nº 79/2026\n"
    "O Projeto de Lei Nº 79/2026 foi retirado de pauta a pedido do autor.\n"
    "Requerimento Nº 57 foi aprovado por unanimidade."
)


def test_extrair_noticia_dividida():
    e = extrair(TEXTO, "2026-10-21T12:00:00Z", APEL)
    assert e["sessao"] == {"numero": 35, "tipo": "ordinaria"} and e["data_sessao"] == "2026-10-20"
    m = {(x["tipo"], x["numero"]): x for x in e["materias"]}
    pl75 = m[("PL", "75")]
    assert pl75["resultado"] == "rejeitado"
    assert pl75["votos"] == [{"alvo": "parecer_contrario",
                              "SIM": ["jose elan dos santos gomes", "daniel barbosa de assis silva", "marcio silva nascimento"],
                              "NAO": ["joemerson alves de souza", "jose afonso"]}]
    assert m[("PL", "79")]["resultado"] == "retirado"
    assert m[("RQ", "57")]["resultado"] == "aprovado"


def test_pagina_e_rss():
    html = ('<html><h1 id="parent-fieldname-title">Titulo X</h1><div id="parent-fieldname-text">'
            '<p>Paragrafo 1.</p><p>Paragrafo 2.</p></div></html>')
    assert texto_da_pagina(html) == ("Titulo X", "Paragrafo 1.\nParagrafo 2.")
    xml = (b'<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
           b'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://purl.org/rss/1.0/">'
           b'<item rdf:about="u"><title>T</title><link>https://x/a</link><dc:date>2026-11-04T20:27:45Z</dc:date></item>'
           b'</rdf:RDF>')
    assert ler_rss(xml) == [{"url": "https://x/a", "titulo": "T", "publicado": "2026-11-04T20:27:45Z"}]
