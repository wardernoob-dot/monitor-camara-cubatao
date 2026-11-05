from pathlib import Path

import numpy as np
from PIL import Image

from camara import painel as P
from camara import validacao as V
from camara.cabecalho import interpretar

FIX = Path(__file__).parent / "fixtures"

PAUTA = (
    "PAUTA PARA A 36ª SESSÃO ORDINÁRIA DO DIA 27 DE OUTUBRO DE 2026. "
    "1º PROC. Nº 300/2026 ESPÉCIE: PROJETO DE LEI Nº 22/2026 AUTORIA: RONALDO ARAÚJO QUEIROZ ASSUNTO: X. "
    "2º PROC. Nº 400/2026 ESPÉCIE: PROJETO DE LEI Nº 38/2026 AUTORIA: DANIEL BARBOSA DE ASSIS SILVA ASSUNTO: Y. "
    "3º PROC. Nº 10/2026 ESPÉCIE: OFÍCIO Nº 41/2026/SEJUR AUTORIA: PREFEITO MUNICIPAL "
    "ASSUNTO: VETO PARCIAL AO PROJETO DE LEI Nº 60/2025 QUE DISPOE"
)
APEL = {"xuxa": "daniel barbosa de assis silva", **V.APELIDOS_EXTRA}


def cands():
    return V.candidatos([PAUTA])


def test_candidatos_da_pauta():
    c = {(x["tipo"], x["numero"]) for x in cands()}
    assert c == {("PL", "22"), ("PL", "38"), ("VETO", "60")}


def test_confirma_e_corrige():
    assert V.validar(interpretar("PL nº 22/2026 - 1ª Discussão"), cands(), APEL)["status"] == "confirmado_pauta"
    r = V.validar(interpretar("PL nº 30/2026 - 1ª Discussão - Autor: Vereador Xuxa"), cands(), APEL)
    assert (r["status"], r["numero"], r["numero_lido"]) == ("corrigido_pauta", "38", "30")
    r = V.validar(interpretar("PL nº 99/2026 - 1ª Discussão"), cands(), APEL)
    assert r["status"] == "nao_confirmado"
    assert V.validar(interpretar("RQ nº 57/2026 - Autor: X"), cands(), APEL)["status"] == "a_confirmar_resumo"
    assert V.validar(interpretar("Veto Parcial ao PL nº 60/2025"), cands(), APEL)["status"] == "confirmado_pauta"


def test_emenda_confere_o_projeto_emendado():
    r = V.validar(interpretar("Emenda ao PL nº 22/2026 - Autor: Vereador Tinho"), cands(), APEL)
    assert (r["status"], r["numero"]) == ("confirmado_pauta", "22")


def test_empate_desfeito_pela_votacao_seguinte():
    # "PL 28" esta a 1 digito de 22 e de 38; o projeto votado logo depois e o 38
    mats = [interpretar("PL nº 28/2026 - Parecer favorável"),
            interpretar("PL nº 30/2026 - 1ª Discussão - Autor: Vereador Xuxa")]
    r = V.validar_sessao(mats, cands(), APEL)
    assert (r[0]["status"], r[0]["numero"]) == ("corrigido_pauta", "38")
    assert "seguinte" in r[0]["motivo"]


def test_tribuna_nao_e_painel():
    falso = np.asarray(Image.open(FIX / "falso_tribuna_36a.jpg").convert("RGB")).astype(np.int16)
    assert not P.eh_painel(falso)
    bom = np.asarray(Image.open(FIX / "painel_36a_ausentes.png").convert("RGB")).astype(np.int16)
    assert P.eh_painel(bom)
