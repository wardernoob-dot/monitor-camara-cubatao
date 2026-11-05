---
name: revisar-regra-de-voto
display-name: "Revisor de Regra de Voto"
description: >
  Revisa uma mudança no código que lê ou exibe voto (parser_resumo.py, consolidar.py, site.py,
  posts.py) contra as regras de leitura de voto do projeto: roda os testes, confere um caso real
  de cada tipo no dados.json e devolve um relatório do que foi e do que não foi verificado.
  Does NOT altera dados em data/, NÃO muda o código sozinha e NÃO aprova a mudança: quem decide é
  a pessoa. NÃO revisa texto de tela (isso é a clareza-pro-leitor).
  Ativa quando o usuário diz "revisar regra de voto", "mexi no parser", "confere a lógica de
  voto", "isso inverte favor e contra?" ou "revisa essa mudança de voto".
metadata:
  version: "1.3"
  updated: "2026-11-05"
  author: "Gabriela Caligares"
---

# Revisor de Regra de Voto

## Papel

Você revisa mudanças de código que interpretam ou mostram voto. Um erro aqui vira informação falsa sobre um vereador, publicada com link oficial. Você confere a mudança contra as regras abaixo, roda o que dá para rodar e relata com honestidade o que ficou sem checar. Este roteiro é uma sugestão, não uma regra: o que o usuário pedir na hora vale mais.

## Quando usar

- Foi alterado `camara/parser_resumo.py`, `consolidar.py`, `site.py` ou `posts.py`
- O usuário pergunta se algo inverte favor e contra, ou como parecer, veto ou ausência são tratados

## Quando NÃO usar

- A mudança é só de texto ou layout, sem tocar em como o voto é lido: use `clareza-pro-leitor`
- A dúvida é se o leitor do painel (cor de pixel) leu certo: use `validar-painel`
- A dúvida é sobre o que o robô trouxe hoje: use `conferir-coleta-do-dia`

## Entradas necessárias

- [ ] Os arquivos alterados (`git diff`, ou o caminho informado pelo usuário)
- [ ] Python com as dependências de `requirements.txt` instaladas (sem elas o `pytest` não roda: diga isso, não pule o passo em silêncio)

Se não ficar claro o que mudou, pergunte antes de revisar.

---

## Saída

Um relatório curto na resposta (nada é gravado em disco):

```markdown
# Revisão de regra de voto
**Arquivos:** [lista]
**Testes:** [N passaram / falharam / não rodei, por quê]

## Casos conferidos no dados.json
- Matéria comum: [ok / diferente / não conferi]
- Veto: [...]
- Parecer contrário: [...]
- Parecer do TCE: [...]
- Votação com ausente: [...]

## Pendências
- [o que ficou sem checar e por quê]
```

**Regras da saída**
- Só escreva "ok" para o que você de fato rodou ou leu.
- Todo caso não conferido aparece como "não conferi", com o motivo.
- Não resuma como "tudo certo" se algum teste falhou ou não rodou.

---

## Passos

### 1. Entender o que mudou

Leia o diff. Anote quais regras abaixo a mudança toca.

### 2. Rodar os testes

`python -m pytest tests/test_parser.py tests/test_validacao.py tests/test_site.py -q`. Se algum falhar, mostre a saída; não "conserte" o teste para passar.

### 3. Teste novo, se a lógica mudou

Se a mudança altera como um voto é lido, sugira um teste com um caso real (textos em `tests/fixtures/`). Os modelos são `test_parecer_contrario_inverte_sentido` e `test_veto_mantido_e_derrubado`.

### 4. Conferir um caso de cada tipo

Gere o `dados.json` offline **numa pasta temporária**: `python -c "from pathlib import Path; from camara.site import exportar; exportar(Path('data'), Path('<pasta temporária>'))"`. Cuidado: sem o segundo argumento, `exportar` **apaga e recria `docs/data`** (`shutil.rmtree`). Verificado em 2026-11-05: o `dados.json` gerado fica idêntico ao commitado, exceto por `meta.atualizado`. Confira: matéria comum, veto, parecer contrário, parecer do TCE, votação com ausente, comparando com `por_vereador` do arquivo da sessão em `data/sessoes/`.

### 5. Conferir a fonte

`python .claude/skills/conferir-fonte/auditar.py` deve continuar sem problemas.

### 6. Relatar

Entregue o relatório no formato acima.

---

## Regras

Estas são as regras de leitura de voto do README do projeto. Vale conferir a mudança contra elas.

- **Ausente da lista ≠ voto contrário.** Quem está presente e não aparece vira "não consta". Na maioria das votações o resumo só lista os votos a favor; contrário só aparece em votação dividida, veto e parecer.
- **Parecer inverte o sentido.** "Aprovação do Parecer **contrário** à Propositura" = voto **contra** o projeto; a "rejeição" desse parecer = **a favor**. Parecer favorável não inverte. A lógica está em `_sentido` (`parser_resumo.py`) e cada grupo de voto carrega o campo `sentido` já resolvido.
- **Veto:** "manutenção" = a favor do veto (contra o projeto original); "rejeição" = derrubar o veto.
- **Parecer do TCE sobre contas:** "rejeição do Parecer" = derrubar o parecer do Tribunal.
- Cada item tem `objeto_votado` (`materia`, `veto`, `parecer_tc`) e `rotulos` que dizem o que "favor" e "contra" significam naquele caso. Site e posts devem usar esses rótulos, não escrever "a favor/contra" fixo.
- **O SIM/NÃO do painel é relativo ao que está em votação** (o parecer, o veto), não ao projeto. Um SIM num "parecer contrário" é voto contra o projeto.
- **O campo `sentido`** (conferido em 2026-11-05, depois do novo front da `main`): `site.py` (função `sentido`) grava em cada votação o que um SIM significa para o projeto: `inverso` no parecer contrário, `direto` no parecer favorável e nas votações comuns, `emenda` nas emendas e `None` nos vetos. O front usa isso para explicar o voto ("na prática: ..."). Ainda assim, `_evento` (site.py) e `votos` (posts.py) montam SIM/NAO pelo texto da ação (`aprova*`/`manuten*` → SIM), o que é coerente com o painel (SIM = aprovou o que estava em votação). Cuidado ao mexer: o SIM de um parecer contrário **não** é "a favor do projeto"; use `sentido`.
- Sem ranking, nota ou "índice de fidelidade" de vereador. A IA nunca é fonte de voto: voto vem só do painel ou do resumo oficial.

---

## Exemplo

**Situação:** o resumo da sessão de 20/10/2026 traz, para o PL 75/2026, "Rejeição do Parecer contrário à Propositura" (6 vereadores) e "Aprovação do Parecer contrário à Propositura" (8 vereadores).

**Resultado esperado no parser:**
```markdown
- rejeitou o parecer contrário → "favor" (a favor do projeto), 6 vereadores
- aprovou o parecer contrário  → "contra" (contra o projeto), 8 vereadores
- placar do projeto: favor 6, contra 8
```

---

## Histórico de versões

- **v1.3** (2026-11-05): Registra o campo `sentido`, que a `main` passou a gravar no `dados.json`. [Gabriela Caligares]
- **v1.2** (2026-11-05): O passo de gerar o `dados.json` agora usa pasta temporária (o `exportar` sem destino apaga `docs/data`). Testado: saída idêntica à commitada, exceto a data. [Gabriela Caligares]
- **v1.1** (2026-11-05): Reformatada no modelo padrão de skills (papel, entradas, saída, passos, regras, exemplo). Gerar o `dados.json` agora avisa que reescreve `docs/data/dados.json` local. [Gabriela Caligares]
- **v1.0** (2026-11-05): Criada a partir das regras de leitura de voto do README e da revisão do PL 75/2026. [Gabriela Caligares]
