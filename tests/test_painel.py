"""Leitor do painel em miniaturas reais (320x180) do storyboard da TV Camara."""
from pathlib import Path

import numpy as np
from PIL import Image

from camara import painel as P

FX = Path(__file__).parent / "fixtures"
ROSTOS = P.Rostos.carregar(Path(__file__).parent.parent / "data" / "rostos_2026.npz")


def _quadro(nome):
    t = np.asarray(Image.open(FX / nome).convert("RGB")).astype(np.int16)
    assert P.eh_painel(t)
    return P.ler_quadro(0, 0, t)


def test_rq52_unanime_com_quem_nao_votou():
    q = _quadro("painel_32a_rq52.png")
    assert q.resultado == "APROVADO"
    assert q.placar["SIM"] == 13 and q.placar["NAO"] == 0
    votos, conf = P.votos_por_vereador(q, ROSTOS)
    assert conf > 0.9
    assert votos["marcos roberto silva"] == "BRANCO"     # Tinho nao votou
    assert votos["alexandre mendes da silva"] == "BRANCO"  # presidente


def test_pl53_parcial_5x7():
    q = _quadro("painel_31a_pl53_parcial.png")
    assert q.resultado is None  # votacao ainda aberta neste quadro
    assert (q.placar["SIM"], q.placar["NAO"]) == (5, 7)
    votos, _ = P.votos_por_vereador(q, ROSTOS)
    assert votos["jose afonso"] == "SIM" and votos["roniele martins da silva"] == "NAO"


def test_ausentes_acinzentados_e_ordem_alterada():
    q = _quadro("painel_36a_ausentes.png")
    assert q.placar["AUSENTE"] == 2
    votos, conf = P.votos_por_vereador(q, ROSTOS)
    assert conf > 0.85
    assert votos["alexandre mendes da silva"] == "AUSENTE"
    assert votos["edson menezes mota"] == "AUSENTE"


def test_tela_sem_painel_nao_e_detectada():
    t = np.full((180, 320, 3), 120, dtype=np.int16)  # quadro "de plenario" generico
    assert not P.eh_painel(t)
