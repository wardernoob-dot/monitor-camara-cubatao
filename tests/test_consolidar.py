"""consolidar.py decide o que o site mostra de cada votacao (painel x resumo x noticia). Erro aqui muda voto."""
import json

from camara import consolidar as C

A, B, D, E = "ana silva", "bruno costa", "dora lima", "edu reis"


def _resumo_vot(sim, nao=(), resultado="aprovado", turno="1a_discussao", alvo="Propositura"):
    grupos = [{"acao": "aprovação", "alvo": alvo, "sentido": "favor", "vereadores": list(sim)}]
    if nao:
        grupos.append({"acao": "rejeição", "alvo": alvo, "sentido": "contra", "vereadores": list(nao)})
    return {"turno": turno, "resultado": resultado, "detalhe": "", "grupos": grupos}


def _painel(votos, resultado="APROVADO"):
    placar = {k: sum(1 for v in votos.values() if v == k) for k in ("SIM", "NAO", "BRANCO", "AUSENTE")}
    return {"votos": votos, "resultado": resultado, "placar": placar}


def tipos(div):
    return sorted(d["tipo"] for d in div)


def test_confere_quando_painel_e_resumo_batem():
    assert C.conferir(_painel({A: "SIM", B: "SIM", D: "NAO"}), _resumo_vot([A, B], [D])) == []


def test_voto_divergente_aponta_o_vereador():
    div = C.conferir(_painel({A: "SIM", B: "NAO"}), _resumo_vot([A, B]))
    d = next(x for x in div if x["tipo"] == "voto_divergente")
    assert (d["vereador"], d["painel"], d["resumo"]) == (B, "NAO", "SIM")


def test_resumo_lista_quem_o_painel_mostra_sem_voto_ou_ausente():
    div = C.conferir(_painel({A: "SIM", B: "BRANCO", D: "AUSENTE"}), _resumo_vot([A, B, D]))
    assert {"resumo_inclui_nao_votante", "resumo_inclui_ausente"} <= set(tipos(div))


def test_resumo_omite_voto_do_painel():
    div = C.conferir(_painel({A: "SIM", B: "SIM"}), _resumo_vot([A]))
    assert any(d["tipo"] == "resumo_omite_voto" and d["vereador"] == B for d in div)


def test_manutencao_do_veto_conta_como_sim():
    rv = {"turno": "unica", "resultado": "mantido", "grupos": [
        {"acao": "manutenção", "alvo": "Veto", "vereadores": [A]}, {"acao": "rejeição", "alvo": "Veto", "vereadores": [B]}]}
    assert not [d for d in C.conferir(_painel({A: "SIM", B: "NAO"}), rv) if d["tipo"] == "voto_divergente"]


def test_resultado_divergente_so_fora_de_parecer():
    p = _painel({A: "SIM", B: "SIM"}, resultado="APROVADO")
    assert "resultado_divergente" in tipos(C.conferir(p, _resumo_vot([A, B], resultado="rejeitado")))
    # no parecer, "aprovado" no painel e o parecer; o resumo registra o destino da materia
    assert "resultado_divergente" not in tipos(C.conferir(p, _resumo_vot([A, B], resultado="rejeitado", alvo="Parecer contrário")))


def test_noticia_que_diverge_do_painel():
    p = _painel({A: "SIM", B: "BRANCO"})
    assert C.conferir_noticia({"SIM": [A], "NAO": []}, p) == []
    d = C.conferir_noticia({"SIM": [A, B], "NAO": []}, p)
    assert d == [{"tipo": "noticia_diverge_painel", "vereador": B, "noticia": "SIM", "painel": "nao votou"}]


def test_etapas():
    assert C._etapa_painel({"tipo": "EMENDA", "parecer": True}) == "parecer_emenda"
    assert C._etapa_painel({"tipo": "PL", "parecer": "contrario"}) == "parecer"
    assert C._etapa_painel({"tipo": "PL", "turno": "2ª DISCUSSÃO"}) == "2a_discussao"
    assert C._etapa_painel({"tipo": "PL", "turno": "Discussão Única"}) == "discussao_unica"
    assert C._etapa_painel({"tipo": "RQ"}) == "unica"
    assert C._etapa_resumo(_resumo_vot([A], alvo="Parecer contrário")) == "parecer"
    assert C._chave_item_resumo({"especie": "PROJETO DE LEI COMPLEMENTAR Nº 09/2026", "numero": "09/2026"}) == ("PLC", "9")
    assert C._chave_item_resumo({"especie": "REQUERIMENTO", "numero": None}) is None
    assert C._chave_painel({"final": {"tipo": "PL", "numero": "92"}}) == ("PL", "92")
    assert C._chave_painel({"tipo": "MOÇÃO", "numero": "08"}) == ("MOCAO", "8")
    assert C._chave_painel({"tipo": "PL", "numero": "92"}) is None  # PL sem validacao contra a pauta nao entra


def _dia(tmp_path, votos_painel, completo=True, com_resumo=True, validacao="confirmado"):
    for p in ("sessoes", "painel", "texto"):
        (tmp_path / p).mkdir()
    (tmp_path / "indice.json").write_text("{}")
    if com_resumo:
        (tmp_path / "sessoes" / "2026-10-29_extra_30.json").write_text(json.dumps({
            "fonte": "https://exemplo/resumo", "sessao": {"numero": 30, "tipo": "extraordinaria", "data": "2026-10-29"},
            "itens": [{"tipo": "deliberacao", "especie": "PROJETO DE LEI Nº 92/2026", "numero": "92/2026", "autoria": "PREFEITO",
                       "assunto": "ALTERA O ORCAMENTO", "resultado": "aprovado",
                       "votacoes": [_resumo_vot([A, B], [D])]}]}))
    (tmp_path / "painel" / "vid.json").write_text(json.dumps({
        "titulo": "30ª SESSÃO", "url": "https://youtu.be/vid", "sessao": {"data": "2026-10-29"},
        "votacoes": [{"n": 1, "resultado": "APROVADO" if completo else None, "votos": votos_painel,
                      "placar": _painel(votos_painel)["placar"], "link": "https://youtu.be/vid?t=1",
                      "materia": {"final": {"tipo": "PL", "numero": "92"}, "tipo": "PL", "turno": "1ª DISCUSSÃO",
                                  "validacao": {"status": validacao}}}]}))
    return C.consolidar_dia(tmp_path, "2026-10-29")


def test_dia_casa_painel_com_resumo_e_confere(tmp_path):
    r = _dia(tmp_path, {A: "SIM", B: "SIM", D: "NAO"})
    assert r["status"] == "oficial_conferido" and r["divergencias"] == []
    (m,) = r["materias"]
    (v,) = m["votacoes"]
    assert (m["tipo"], m["numero"], m["ano"]) == ("PL", "92", "2026")
    assert v["etapa"] == "1a_discussao" and v["conferencia"]["status"] == "confere"
    assert v["painel"]["votos"][D] == "NAO" and v["resumo"]["por_acao"]["rejeição"] == [D]


def test_dia_registra_divergencia_com_o_nome(tmp_path):
    r = _dia(tmp_path, {A: "SIM", B: "NAO", D: "NAO"})
    assert any(d["tipo"] == "voto_divergente" and d["vereador"] == B and d["materia"] == "PL 92" for d in r["divergencias"])


def test_painel_sem_resultado_na_tela_nao_acusa_ninguem(tmp_path):
    r = _dia(tmp_path, {A: "SIM", B: "BRANCO", D: "BRANCO"}, completo=False)
    assert tipos(r["divergencias"]) == ["painel_incompleto"]


def test_painel_nao_confirmado_pela_pauta_nao_gera_divergencia(tmp_path):
    r = _dia(tmp_path, {A: "NAO", B: "NAO", D: "SIM"}, validacao="nao_confirmado")
    assert r["divergencias"] == []


def test_dia_so_com_painel_fica_provisorio(tmp_path):
    r = _dia(tmp_path, {A: "SIM"}, com_resumo=False)
    assert r["status"] == "provisorio_painel"
    assert r["materias"][0]["votacoes"][0]["conferencia"]["status"] == "aguardando_resumo"
