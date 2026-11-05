from pathlib import Path

from camara.nomes import Registro, split_lista
from camara.parser_resumo import parse_resumo
from camara.textclean import normalize, undouble_line

FX = Path(__file__).parent / "fixtures"


def _ler(nome):
    return (FX / nome).read_text(encoding="utf-8")


def _registro_base():
    reg = Registro()
    parse_resumo(_ler("ord35_2026.txt"), reg)
    reg.adicionar("WASHINGTON LUIZ LESSA DE SOUZA")
    return reg


def test_negrito_falso():
    assert undouble_line("RREESSUUMMOO DDAA 3355ªª SSEESSSSÃÃOO") == "RESUMO DA 35ª SESSÃO"
    assert undouble_line("APROVADO EM 1ª DISCUSSÃO") == "APROVADO EM 1ª DISCUSSÃO"


def test_cirilico_e_cabecalho():
    t = normalize("DIVISÃO LEGISLATIVA\nCâmara Municipal de Cubatão\n(DEZ POR CENTО)")
    assert t == "(DEZ POR CENTO)"


def test_split_lista():
    assert split_lista("Os Vereadores: Ana Souza, José da Silva e Márcio Nascimento") == [
        "Ana Souza", "José da Silva", "Márcio Nascimento"]


def test_cabecalho_e_presenca():
    r = parse_resumo(_ler("ord35_2026.txt"))
    assert r["sessao"] == {"numero": 35, "tipo": "ordinaria", "data": "2026-10-20",
                           "inicio": "14:19", "fim": "16:29"}
    assert len(r["presenca"]) == 15
    assert all(v == "sim" for v in r["presenca"].values())
    assert r["avisos"] == []


def test_parecer_favoravel_rejeitado():
    r = parse_resumo(_ler("ord35_2026.txt"))
    pl87 = next(i for i in r["itens"] if i.get("numero") == "87/2026")
    v = pl87["votacoes"][0]
    assert pl87["resultado"] == "rejeitado"
    assert v["placar"] == {"favor": 6, "contra": 8}
    assert v["por_vereador"]["jose afonso"] == "favor"
    assert v["por_vereador"]["jair ferreira lucas"] == "contra"


def test_parecer_contrario_inverte_sentido():
    """'aprovacao do Parecer contrario' = voto CONTRA o projeto."""
    r = parse_resumo(_ler("ord35_2026.txt"))
    pl75 = next(i for i in r["itens"] if i.get("numero") == "75/2026")
    v = pl75["votacoes"][0]
    assert v["placar"] == {"favor": 6, "contra": 8}
    assert v["por_vereador"]["jose afonso"] == "favor"          # rejeitou parecer contrario
    assert v["por_vereador"]["roniele martins da silva"] == "contra"  # aprovou parecer contrario


def test_retirado_de_pauta():
    r = parse_resumo(_ler("ord35_2026.txt"))
    pl79 = next(i for i in r["itens"] if i.get("numero") == "79/2026")
    assert pl79["resultado"] == "retirado"
    assert pl79["votacoes"][0]["grupos"] == []


def test_veto_mantido_e_derrubado():
    r = parse_resumo(_ler("ext17_2026_ordem.txt"), _registro_base())
    v1, v2 = [i for i in r["itens"] if i["secao"] == "ordem_do_dia"]
    assert v1["objeto_votado"] == "veto"
    assert len(v1["votacoes"]) == 2  # um OBS por artigo vetado
    assert v1["resultado"] == "veto_mantido"
    assert v1["votacoes"][0]["placar"] == {"favor": 11, "contra": 2}
    assert v2["resultado"] == "veto_derrubado"
    assert v2["votacoes"][0]["placar"] == {"favor": 2, "contra": 11}
    assert v2["rotulos"]["contra"] == "derrubar o veto"
    assert r["avisos"] == []


def test_obstrucao_quorum_e_variacao_de_nome():
    r = parse_resumo(_ler("ord06_2026_parcial.txt"), _registro_base())
    assert r["encerrada_por_falta_de_quorum"] is True
    assert {o["bancada"] for o in r["obstrucoes"]} == {"REPUBLICANOS", "AGIR", "PSB", "UNIÃO BRASIL"}
    req17 = next(i for i in r["itens"] if i.get("numero") == "17")
    assert req17["autoria"] == "José Elan dos Santos Gomes"
    # "Barbosa" no texto casa com "Barboza" da lista de presenca
    assert "allan matias barboza de souza" in req17["votacoes"][0]["por_vereador"]
    pl = next(i for i in r["itens"] if i["secao"] == "ordem_do_dia")
    assert pl["resultado"] == "retornou_comissoes"
    # frase de obstrucao nao pode vazar pro assunto do item
    assert "obstru" not in (pl["assunto"] or "").lower()
    assert r["avisos"] == []


def test_negrito_falso_por_palavra_e_titulo_do_site():
    texto = ("RESUMORESUMO DADA 44ªª SESSSESSÃÃOO ORDINORDINÁÁRIA,RIA, DODO 22°° ANOANO\n"
             "REALIZADAREALIZADA NONO DIADIA 2424 DEDE FEVEREIROFEVEREIRO DEDE 2026.2026.\n"
             "Início às 14h28min.\nA Sessão foi encerrada às 15h00min.\n")
    r = parse_resumo(texto, titulo="RESUMO DA 4ª SESSÃO ORDINÁRIA - 24/02/2026")
    assert r["sessao"]["numero"] == 4 and r["sessao"]["data"] == "2026-02-24"
    assert not any("diverge" in a for a in r["avisos"])


def test_titulo_do_site_divergente_gera_aviso():
    texto = "RESUMO DA 9ª SESSÃO ORDINÁRIA, REALIZADA NO DIA 22 DE ABRIL DE 2026.\n"
    r = parse_resumo(texto, titulo="RESUMO DA 9ª SESSÃO ORDINÁRIA - 23/04/2026")
    assert r["sessao"]["data"] == "2026-04-22"
    assert any("diverge" in a for a in r["avisos"])


def test_participacao_remota_nao_vira_vereador_fantasma():
    reg = _registro_base()
    texto = ("O Vereador Allan Matias Barboza de Souza participou de forma remota.\n"
             "1ª PARTE - EXPEDIENTE DA MESA\na) Comunicado blah.\nORDEM DO DIA\n"
             "O Vereador Márcio Silva Nascimento solicitou obstrução da Sessão em nome da bancada do PSB.\n")
    r = parse_resumo(texto, reg)
    assert r["participacao_remota"] == ["allan matias barboza de souza"]
    assert r["obstrucoes"] == [{"vereador": "marcio silva nascimento", "bancada": "PSB"}]
    assert all(len(k) < 60 for k in r["vereadores"])
