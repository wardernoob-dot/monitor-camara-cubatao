---
name: validar-painel
display-name: "Validador do Leitor do Painel"
description: >
  Compara o que o leitor do painel de votação (camara/painel.py, leitura por cor de pixel das
  miniaturas do YouTube) registrou contra os resumos oficiais, vereador a vereador, usando
  scripts/validar_painel.py, e relata a concordância geral. Does NOT corrige o leitor sozinha,
  NÃO edita dados em data/painel/ e NÃO interpreta regra de voto (isso é a revisar-regra-de-voto).
  Ativa quando o usuário diz "validar o painel", "o painel leu errado", "mexi no painel.py",
  "confere o leitor do painel" ou "qual a concordância do painel".
metadata:
  version: "1.1"
  updated: "2026-11-05"
  author: "Gabriela Caligares"
---

# Validador do Leitor do Painel

## Papel

Você mede o quanto o leitor do painel concorda com o resumo oficial. O painel tem 15 fotos em layout fixo (8 em cima, 7 embaixo): moldura verde = SIM, vermelha = NÃO, branca = não votou. O leitor é pura leitura de pixel, sem IA, calibrado em miniaturas 320x180. Você roda o validador, interpreta a saída e relata números, sem mexer no dado. Este roteiro é uma sugestão, não uma regra.

## Quando usar

- Foi alterado `camara/painel.py`, `videos.py` ou o catálogo de rostos (`data/rostos_2026.npz`)
- Uma votação lida do painel parece errada no site

## Quando NÃO usar

- A dúvida é o que "favor" ou "contra" significa num parecer ou veto: use `revisar-regra-de-voto`
- Você quer um resumo do que o robô trouxe hoje: use `conferir-coleta-do-dia`
- Não há imagens de storyboard disponíveis: diga isso e pare (veja Entradas)

## Entradas necessárias

- [ ] `data/storyboard_specs.json` e `data/rostos_2026.npz` (já estão no repo)
- [ ] As **imagens** do storyboard. Não estão na `main`: ficam no branch `amostras`, geradas pelo workflow `sonda-storyboard.yml` (manual) ou pelo script do PC (`pc/`)
- [ ] Python com as dependências de `requirements.txt` (numpy, pillow)

Extraia as imagens para uma **pasta temporária**, nunca para dentro do repo:

```bash
git fetch origin amostras
mkdir -p "$TMP/amostras" && git archive origin/amostras data/storyboard | tar -x -C "$TMP/amostras"
```

Se o branch `amostras` não tiver as imagens do vídeo em questão, diga que não dá para validar esse vídeo.

---

## Saída

Um relatório curto na resposta; o validador só imprime no terminal.

```markdown
# Validação do painel
**Vídeos:** [N] | **Votações lidas:** [N] (completas: [N], parciais: [N])
**Concordância geral (só completas):** [ok]/[total] = [%] | **15/15:** [N]/[N]

## Divergências
- [data, matéria, vereador]: painel [SIM/NÃO/BRANCO] × resumo [..], provável causa [rosto confundido / ordem alterada / outro]

## Sem resumo ainda
- [vídeos cujo resumo oficial ainda não saiu]
```

**Regras da saída**
- Só votações `OK` (completas) entram na concordância; `PARCIAL` fica de fora.
- "Sem resumo ainda" não é erro: o resumo sai com cerca de 2 semanas de atraso.
- Se comparar antes e depois de uma mudança, mostre os dois números.

---

## Passos

### 1. Preparar as imagens

Extraia o storyboard do branch `amostras` para a pasta temporária (comandos acima).

### 2. Rodar o validador

`python scripts/validar_painel.py "$TMP/amostras/data/storyboard"`. Para cada vídeo ele lista as votações lidas (`OK`/`PARCIAL`, placar SIM/NÃO/BRANCO/AUSENTE) e, se o resumo da data já saiu, a votação do resumo que melhor casa (`casa k/n`). No fim: concordância geral e quantas fecharam 15/15.

### 3. Interpretar

- BRANCO no painel casa com "vereador fora das listas de voto". Presidente e ausente do plenário também aparecem em branco.
- Divergência em **um** vereador costuma ser rosto confundido (`conf` baixa) ou ordem das fotos alterada naquele dia.
- Divergência em **quase todos** costuma ser o mapeamento SIM/NÃO ao contrário (parecer contrário e veto: o painel mostra o sentido do que está em votação, não do projeto).

### 4. Depois de mexer em painel.py

Rode `python -m pytest tests/test_painel.py tests/test_validacao.py -q` e compare a concordância geral antes e depois. Se ela cair, proponha desfazer a mudança.

### 5. Relatar

Entregue o relatório no formato acima.

---

## Regras

- O dado do painel vai ao ar sem revisão humana, então uma queda de concordância pesa mais que um ganho pequeno.
- Prefira corrigir a causa em `painel.py` a ajustar o dado na mão; `data/painel/` é regenerado pelo robô.
- O painel só é fonte de voto quando a leitura está `completo`; caso contrário o site usa o resumo.
- Sem ranking nem nota de vereador a partir dessa concordância: ela mede o leitor, não as pessoas.

---

## Exemplo

**Saída do validador (formato; os números são ilustrativos):**
```
=== 37ª sessão ordinária 03/11 (aG3vhRvCeis), 8 votações no vídeo, 8 no resumo
  1h58 OK  APROVADO  SIM=14 NAO= 0 BR= 1 AUS=0 ?=0 conf=alta | casa 15/15 com: 37a Ordin | PL 22 | ...
```

**Relatório:**
```markdown
**Concordância geral (só completas):** 15/15 = 100% | **15/15:** 1/1
```

---

## Histórico de versões

- **v1.1** (2026-11-05): Reformatada no modelo padrão de skills. Acrescenta a saída em formato fixo, a regra de que a concordância mede o leitor e não as pessoas, e o aviso para parar quando faltam imagens. [Gabriela Caligares]
- **v1.0** (2026-11-05): Criada a partir de `scripts/validar_painel.py`. [Gabriela Caligares]
