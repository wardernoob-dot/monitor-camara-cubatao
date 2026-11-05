---
name: clareza-pro-leitor
description: Checklist para textos e telas voltados ao público (frontend/src, prompts/analise.md, data/posts/, README) - garante que cada número, "Sim"/"Não" e rótulo diga o que significa, com fonte, e que respeite as regras editoriais do projeto. Use ao criar ou mudar qualquer coisa que o morador vai ler.
---

# Clareza para o leitor

O público é morador da cidade, sem formação jurídica, que lê rápido. O dado pode estar certo e a tela ainda
induzir a uma conclusão errada. Antes de dar uma mudança por pronta, passe por estas perguntas.

## 1. Cada número e cada "Sim/Não" diz a que se refere?

- **"Sim" é sobre o quê?** Numa votação de parecer, veto ou parecer do TCE, o SIM do painel é sobre *o que está em votação*,
  não sobre o projeto. No PL 75/2026, a etapa "Parecer contrário" mostra SIM 8 / NÃO 6 e "Aprovado"; quem votou "Sim"
  aprovou o parecer, ou seja, **votou contra o projeto**. Sem uma frase explicando, o leitor entende o oposto.
  Os rótulos corretos já existem no parser: `objeto_votado` e `rotulos` (`parser_resumo.py`).
- **"Aprovado" é o quê?** Aprovado o projeto, o parecer, o veto mantido? Rotule pela etapa (`etapa_txt`) ao lado.
- **Placar "8 a 6"** vem do painel ou do resumo? Quando divergem (resumo conta como SIM quem não votou), as duas versões aparecem?
- **Branco/"não votou"** nunca pode aparecer como "contra" nem como "a favor". Presente sem voto ≠ ausente ≠ contra.

> Estado em 2026-11-05: o front **não** explica o SIM do parecer contrário (tabela do vereador e linha do tempo do projeto).
> O dono do projeto foi avisado e vai decidir; não mude sem alinhar com ele.

## 2. Toda afirmação sobre voto tem fonte?

Painel da transmissão (com link no minuto) ou resumo oficial (com link do PDF). Rode
`python .claude/skills/conferir-fonte/auditar.py` depois de mudar o que exibe voto.

## 3. Regras editoriais do projeto (não negociáveis)

- **Sem ranking, nota, "mais fiel", "mais faltoso"** de vereador, nem comparações que funcionem como ranking.
- **A IA nunca é fonte de fato.** O texto de "Entenda o projeto" é rotulado como gerado por IA, cita o documento lido e
  **não recebe votos, nomes de vereadores nem partidos** (veja `prompts/analise.md`). Toda frase de "pontos de atenção" tem trecho literal do documento.
- **Tom imparcial:** não dizer se o projeto é bom ou ruim, não recomendar voto, não elogiar nem criticar o autor.
- **Os dois lados quando as fontes divergem**, sem concluir qual está certa.

## 4. Linguagem

- Frases curtas, sem juridiquês. "Veto" e "parecer" precisam de uma explicação de uma linha na primeira vez que aparecem na tela.
- Toda votação deixa claro de que sessão e de que data é (dia, mês e ano); sem isso o leitor não consegue cruzar com o resumo oficial.
- Acessibilidade: o sentido não pode depender só de cor (verde/vermelho). Veja se há texto ou `title`/`sr` acompanhando (padrão em `componentes.tsx`, `Celula`).
- Ausência de dado é dita ("sem registro", "resumo ainda não publicado"), nunca preenchida.

## 5. Antes de concluir

1. Abra a tela afetada (`cd frontend && npm run dev`) e leia como um morador: o que eu concluo daqui?
2. Se houver caso de parecer, veto ou divergência, confira um exemplo real no `docs/data/dados.json`.
3. Se mudou o front, o `npm run build` gera `docs/`, que é commitado (o Surge e o GitHub Pages servem esse build).
4. Relate o que foi lido na tela e o que não foi verificado.
