---
name: revisar-regra-de-voto
description: Checklist para mexer em como um voto é lido ou exibido (parser_resumo.py, consolidar.py, site.py, posts.py). Use antes de alterar ou revisar qualquer código que interprete "a favor"/"contra", parecer, veto, ausência ou placar.
---

# Revisar regra de voto

> Sugestões de roteiro, não regras: use o que ajudar e ignore o resto. Os princípios do projeto citados aqui vêm do README.

Um erro aqui vira informação falsa sobre um vereador, publicada com link oficial. Rode esta checklist
antes de concluir qualquer mudança em `camara/parser_resumo.py`, `consolidar.py`, `site.py` ou `posts.py`.

## Regras de leitura do voto (vêm do README; vale conferir)

1. **Ausente da lista ≠ voto contrário.** Quem está presente e não aparece vira "não consta". Na maioria
   das votações o resumo só lista os votos a favor; contrário só aparece em votação dividida, veto e parecer.
2. **Parecer inverte o sentido.** "Aprovação do Parecer **contrário** à Propositura" = voto **contra** o projeto;
   "rejeição" do mesmo parecer = a **favor**. Parecer favorável não inverte. A lógica está em `_sentido`
   (`parser_resumo.py`), e cada grupo de voto carrega o campo `sentido` já resolvido.
3. **Veto:** "manutenção" = a favor do veto (contra o projeto original); "rejeição" = derrubar o veto.
4. **Parecer do TCE sobre contas:** "rejeição do Parecer" = derrubar o parecer do Tribunal.
5. Cada item tem `objeto_votado` (`materia`, `veto`, `parecer_tc`) e `rotulos` que dizem o que "favor" e
   "contra" significam naquele caso. O site e os posts devem usar esses rótulos, não escrever "a favor/contra" fixo.
6. **O SIM/NÃO do painel é relativo ao que está sendo votado** (o parecer, o veto), não ao projeto. Um SIM
   num "parecer contrário" é voto contra o projeto.

## Como o site mostra um parecer (verificado em 2026-11-05)

`site.py` (`_evento`, ramo do resumo) e `posts.py` (`votos`) classificam o voto pelo **texto da ação**
(`aprova*`/`manuten*` → SIM, resto → NAO), não pelo `sentido` do grupo. Isso é coerente com o painel
(SIM = aprovou o que estava em votação): no PL 75/2026 (sessão 2026-10-20) o site mostra a etapa
"Parecer contrário" com SIM 8 / NÃO 6 e resultado APROVADO, ou seja, o placar é **do parecer**, e a etapa vem
rotulada por `rotulo_etapa`. Cuidado ao mexer: o SIM de uma etapa de parecer contrário **não** é "a favor do projeto".
Se algum texto novo (front, post) chamar esse SIM de "a favor", ele estará errado; use o `sentido` ou o rótulo da etapa.
Ainda não verificado: se o front deixa claro, para o leitor, o que o SIM significa nessa etapa.

## Passos

1. Rode os testes que cobrem o assunto: `python -m pytest tests/test_parser.py tests/test_validacao.py tests/test_site.py -q`.
2. Se a mudança for em lógica de voto, **adicione ou ajuste um teste** com um caso real (os textos de exemplo ficam em `tests/fixtures/`). Os testes `test_parecer_contrario_inverte_sentido` e `test_veto_mantido_e_derrubado` são o modelo.
3. Regenere e confira um caso de cada tipo no `dados.json`: matéria comum, veto, parecer contrário, parecer do TCE, votação com ausente.
4. Rode `python .claude/skills/conferir-fonte/auditar.py` para garantir que todo voto continua com fonte.
5. Diga ao usuário o que foi checado e o que não foi (ex.: sem PDF novo para testar).

## Evitar

- Não criar ranking, nota ou "índice de fidelidade" de vereador: é princípio do projeto.
- Não tratar o texto da IA como fonte de voto: voto vem só do painel ou do resumo oficial.
