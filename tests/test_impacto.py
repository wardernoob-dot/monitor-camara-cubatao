from camara.impacto import classificar


def m(tipo, assunto, slug="x"):
    return {"tipo": tipo, "assunto": assunto, "slug": slug, "tema": ""}


def test_simbolico():
    assert classificar(m("PL", "DENOMINA RUA FULANO O LOGRADOURO"))["faixa"] == "simbolico"
    assert classificar(m("PL", "INSTITUI O DIA MUNICIPAL DO SKATE"))["faixa"] == "simbolico"
    assert classificar(m("PL", "DECLARA DE UTILIDADE PÚBLICA A ASSOCIAÇÃO X"))["faixa"] == "simbolico"


def test_autorizativo_x_normativo_pelo_texto():
    e = m("PL", "INSTITUI O PROGRAMA MUNICIPAL X")
    assert classificar(e, "Art. 1º Fica o Poder Executivo autorizado a instituir o programa.")["faixa"] == "autorizativo"
    assert classificar(e, "Art. 1º Fica obrigatória a afixação de cartaz, sob pena de multa.")["faixa"] == "normativo"
    assert classificar(m("PL", "AUTORIZA O PODER EXECUTIVO A FIRMAR CONVÊNIOS"))["faixa"] == "autorizativo"


def test_estrutural_e_manual():
    assert classificar(m("PELOM", "ALTERA O ART. 31 DA LEI ORGÂNICA"))["faixa"] == "estrutural"
    man = {"pl-1-2026": {"faixa": "normativo", "motivo": "cria obrigacao no art. 2"}}
    r = classificar(m("PL", "DENOMINA RUA X", "pl-1-2026"), None, man)
    assert r["faixa"] == "normativo" and r["fonte"] == "revisao"


def test_requerimentos():
    assert classificar(m("RQ", "Solicitando a formação de Comissão Especial de Inquérito para APURAR"))["faixa"] == "rq_investigacao"
    assert classificar(m("RQ", "Solicitando a prorrogação por mais 60 dias da Comissão Especial de Vereadores"))["faixa"] == "rq_procedimento"
    assert classificar(m("RQ", "Solicitando a formação de Comissão Especial de Vereadores para ORGANIZAR a sessão solene"))["faixa"] in ("rq_organizacao", "rq_procedimento")
    assert classificar(m("RQ", "Solicitando gestões ao Poder Executivo para a realização de estudos"))["faixa"] == "rq_pedido"
