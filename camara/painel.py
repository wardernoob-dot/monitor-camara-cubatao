"""Leitor do painel eletronico de votacao a partir das miniaturas (storyboard) do YouTube.

O painel da Camara tem layout fixo: 15 fotos (8 em cima, 7 embaixo), moldura verde = SIM,
vermelha = NAO, branca = nao votou (presidente, ausente do plenario ou ainda nao votou).
Nada aqui usa IA: e leitura de cor de pixel em posicao fixa.

Calibrado em miniaturas 320x180 (nivel L3 do storyboard, 1 quadro a cada 10 s).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

TW, TH = 320, 180
# canto superior esquerdo de cada moldura (x, y) e tamanho
VAGAS = [(6 + 32 * i, 48) for i in range(8)] + [(6 + 32 * i, 87) for i in range(7)]
BW, BH = 25, 26

# ordem das vagas no painel (validada contra os resumos oficiais de set-out/2026)
LAYOUT_2026 = [
    "alessandro donizete de oliveira", "alexandre mendes da silva", "joemerson alves de souza",
    "edson menezes mota", "guilherme dos santos malaquias", "jose elan dos santos gomes",
    "jair ferreira lucas", "marcio silva nascimento",
    "ronaldo araujo queiroz", "roniele martins da silva", "marcos roberto silva",
    "daniel barbosa de assis silva", "jose afonso", "allan matias barboza de souza",
    "anderson de lana andrade",
]


@dataclass
class Quadro:
    indice: int
    segundo: int
    votos: list[str]          # 15 x {"SIM","NAO","BRANCO","AUSENTE","?"}
    resultado: str | None     # "APROVADO" / "REJEITADO" / None (ainda em votacao)
    fotos: list = field(default_factory=list, repr=False)

    @property
    def placar(self):
        return {k: self.votos.count(k) for k in ("SIM", "NAO", "BRANCO", "AUSENTE", "?")}


@dataclass
class Evento:
    quadros: list[Quadro] = field(default_factory=list)

    @property
    def final(self) -> Quadro:
        com_resultado = [q for q in self.quadros if q.resultado]
        return com_resultado[-1] if com_resultado else self.quadros[-1]

    @property
    def completo(self) -> bool:
        return self.final.resultado is not None


def miniaturas(pasta: Path, intervalo_s: int = 10):
    """Itera (indice, segundo, array RGB 180x320) por todas as folhas L3 de um video."""
    for f in sorted(Path(pasta).glob("L3_M*.jpg")):
        m = int(re.search(r"M(\d+)", f.stem).group(1))
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
        linhas, colunas = im.shape[0] // TH, im.shape[1] // TW
        for r in range(linhas):
            for c in range(colunas):
                idx = m * linhas * colunas + r * colunas + c
                yield idx, idx * intervalo_s, im[r * TH:(r + 1) * TH, c * TW:(c + 1) * TW]


def eh_painel(t: np.ndarray) -> bool:
    lum = t.mean(axis=2)
    # faixa do topo e coluna do placar (SIM/NAO/ABSTER/VOTOS) sao quase pretas no painel (~17);
    # plano de tribuna com terno escuro passava no teste de fundo escuro (36a sessao) e da ~70 aqui
    if lum[0:12].mean() > 35 or lum[20:140, 268:320].mean() > 35:
        return False
    fundo_escuro = (lum[15:150, 0:300] < 60).mean()
    if fundo_escuro < 0.55 or fundo_escuro > 0.97:
        return False
    # as 15 fotos precisam estar la (descarta tela de ementa e tela preta)
    fotos = sum(lum[y + 4:y + BH - 4, x + 4:x + BW - 4].mean() > 45 for x, y in VAGAS)
    return fotos >= 12


def _borda(t, x0, y0):
    px = np.concatenate([
        t[y0:y0 + BH, x0:x0 + 2].reshape(-1, 3), t[y0:y0 + BH, x0 + BW - 2:x0 + BW].reshape(-1, 3),
        t[y0:y0 + 2, x0:x0 + BW].reshape(-1, 3), t[y0 + BH - 2:y0 + BH, x0:x0 + BW].reshape(-1, 3),
    ])
    return px.mean(axis=0)


def _miolo(t, x0, y0):
    return t[y0 + 3:y0 + BH - 3, x0 + 3:x0 + BW - 3]


def cor_vaga(t, x0, y0) -> str:
    r, g, b = _borda(t, x0, y0)
    m = _miolo(t, x0, y0)
    sat = (m.max(axis=2) - m.min(axis=2)).mean()
    if sat < 9 and m.mean() < 95 and max(r, g, b) - min(r, g, b) < 12:
        return "AUSENTE"
    if min(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 25:
        return "BRANCO"
    if g - r > 6 and g - b > 4:
        return "SIM"
    if r - g > 12 and r - b > 6:
        return "NAO"
    return "?"


def resultado(t) -> str | None:
    """Texto APROVADO (verde) / REJEITADO (vermelho) acima do titulo."""
    z = t[14:27, 90:230]
    verde = (z[..., 1] - z[..., 0] > 25).sum()
    verm = (z[..., 0] - z[..., 1] > 30).sum()
    if verde > 40 and verde > 2 * verm:
        return "APROVADO"
    if verm > 40 and verm > 2 * verde:
        return "REJEITADO"
    return None


def ler_quadro(idx, seg, t) -> Quadro:
    return Quadro(idx, seg, [cor_vaga(t, x, y) for x, y in VAGAS], resultado(t),
                  [_miolo(t, x, y).copy() for x, y in VAGAS])


# ---------- identificacao do vereador pela foto ----------
def _assinatura(foto: np.ndarray) -> np.ndarray:
    """Foto em tons de cinza normalizada (media 0, desvio 1): ignora brilho e o acinzentado de ausente."""
    g = foto.astype(float).mean(axis=2)
    g = g - g.mean()
    return (g / (g.std() + 1e-6)).ravel()


class Rostos:
    """Referencia de fotos por vereador, montada a partir de um quadro com todos presentes."""

    def __init__(self, ref: dict[str, np.ndarray]):
        self.chaves = list(ref)
        self.mat = np.stack([_assinatura(ref[k]) for k in self.chaves])

    @classmethod
    def de_quadro(cls, q: Quadro, layout=LAYOUT_2026):
        return cls(dict(zip(layout, q.fotos)))

    def salvar(self, caminho: Path):
        np.savez_compressed(
            caminho,
            chaves=np.asarray(self.chaves, dtype="U80"),
            mat=np.asarray(self.mat, dtype=np.float32),
        )

    @classmethod
    def carregar(cls, caminho: Path):
        z = np.load(caminho, allow_pickle=False)
        obj = cls.__new__(cls)
        obj.chaves, obj.mat = [str(k) for k in z["chaves"]], z["mat"]
        return obj

    def identificar(self, q: Quadro):
        """Atribui cada vaga a um vereador (atribuicao otima por correlacao). Retorna (chaves, confiancas)."""
        from scipy.optimize import linear_sum_assignment

        A = np.stack([_assinatura(f) for f in q.fotos])
        sim = A @ self.mat.T / A.shape[1]          # correlacao [-1, 1]
        lin, col = linear_sum_assignment(-sim)
        chaves = [None] * len(q.fotos)
        conf = [0.0] * len(q.fotos)
        for i, j in zip(lin, col):
            chaves[i] = self.chaves[j]
            conf[i] = float(sim[i, j])
        return chaves, conf


def eventos(pasta: Path, intervalo_s: int = 10, folga: int = 2) -> list[Evento]:
    """Agrupa quadros de painel consecutivos (tolerando 'folga' quadros sem painel) em votacoes."""
    evs: list[Evento] = []
    ultimo = -999
    for idx, seg, t in miniaturas(pasta, intervalo_s):
        if not eh_painel(t):
            continue
        q = ler_quadro(idx, seg, t)
        # placar zerado sem resultado = tela de abertura da votacao; nao abre evento sozinho
        if idx - ultimo > folga + 1:
            evs.append(Evento())
        evs[-1].quadros.append(q)
        ultimo = idx
    # descarta grupos que nunca tiveram voto
    return [e for e in evs if any(v in ("SIM", "NAO") for q in e.quadros for v in q.votos)]


def votos_por_vereador(q: Quadro, rostos: "Rostos | None" = None) -> tuple[dict[str, str], float]:
    if rostos is None:
        return dict(zip(LAYOUT_2026, q.votos)), 1.0
    chaves, conf = rostos.identificar(q)
    return dict(zip(chaves, q.votos)), min(conf)


def resumo_evento(e: Evento, rostos: "Rostos | None" = None) -> dict:
    f = e.final
    votos, conf = votos_por_vereador(f, rostos)
    return {
        "confianca_rostos": round(conf, 2),
        "inicio_s": e.quadros[0].segundo, "fim_s": e.quadros[-1].segundo,
        "quadros": len(e.quadros), "completo": e.completo, "resultado": f.resultado,
        "placar": f.placar, "votos": votos,
    }
