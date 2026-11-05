---
name: validar-painel
description: Confere o leitor do painel de votação (camara/painel.py, leitura por cor de pixel das miniaturas do YouTube) contra os resumos oficiais, vereador a vereador. Use ao mexer em painel.py/videos.py/rostos ou quando uma votação do painel parecer errada.
---

# Validar o leitor do painel

> Sugestões de roteiro, não regras: use o que ajudar e ignore o resto. Os princípios do projeto citados aqui vêm do README.

O painel da transmissão tem 15 fotos em layout fixo (8 em cima, 7 embaixo). Moldura verde = SIM, vermelha = NÃO,
branca = não votou. O leitor (`camara/painel.py`) é pura leitura de pixel, sem IA, calibrado em miniaturas 320x180.
`scripts/validar_painel.py` compara o que ele leu com o resumo oficial da mesma data.

## Pré-requisitos

- `data/storyboard_specs.json` e `data/rostos_2026.npz` (já estão no repo).
- As **imagens** do storyboard não estão na `main`: ficam no branch `amostras`, geradas pelo workflow
  `sonda-storyboard.yml` (manual) ou pelo script do PC (`pc/`). Extraia para uma pasta temporária, nunca para dentro do repo:

  ```bash
  git fetch origin amostras
  mkdir -p "$TMP/amostras" && git archive origin/amostras data/storyboard | tar -x -C "$TMP/amostras"
  ```

## Rodar

```bash
python scripts/validar_painel.py "$TMP/amostras/data/storyboard"
```

Para cada vídeo ele lista as votações lidas (`OK`/`PARCIAL`, placar SIM/NÃO/BRANCO/AUSENTE) e, se o resumo
da data já saiu, a votação do resumo que melhor casa (`casa k/n`). No final: concordância geral e quantas votações fecharam 15/15.

## Como ler o resultado

- **Só votações `OK` (completas) entram na concordância.** `PARCIAL` é ruído esperado (tela de abertura, painel ainda preenchendo).
- Uma votação sem `casa` aparece com `[SEM RESUMO AINDA]`: o resumo sai com ~2 semanas de atraso; não é erro.
- BRANCO no painel casa com "vereador fora das listas de voto". Presidente e ausente do plenário também aparecem branco.
- Divergência em um vereador específico costuma ser **rosto confundido** (`conf` baixa) ou **ordem das fotos alterada**
  naquele dia. Divergência em quase todos é o **mapeamento SIM/NÃO ao contrário** (parecer contrário e veto: o painel
  mostra o sentido do que está sendo votado, não do projeto).
- Cada divergência real vira correção em `painel.py`, prefira corrigir no código a ajustar o dado na mão.

## Depois de mexer em painel.py

1. `python -m pytest tests/test_painel.py tests/test_validacao.py -q`
2. Rode o validador e compare a concordância geral antes e depois (anote os dois números para o usuário).
3. Se a concordância cair, desfaça: o dado do painel vai ao ar sem revisão humana.
