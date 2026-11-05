---
name: clareza-pro-leitor
display-name: "Revisor de Clareza para o Leitor"
description: >
  Revisa textos e telas voltados ao público (frontend/src, prompts/analise.md, data/posts/,
  README) para checar se cada número, "Sim"/"Não" e rótulo diz o que significa, tem fonte e
  respeita os princípios editoriais do projeto. Does NOT muda o front sozinha, NÃO altera dados
  e NÃO decide texto de tela sem o dono do projeto: ela aponta, a pessoa decide.
  Ativa quando o usuário diz "revisar a clareza", "o leitor entende isso?", "mudei a tela",
  "revisa o texto do site" ou ao criar ou mudar qualquer coisa que o morador vai ler.
metadata:
  version: "1.2"
  updated: "2026-11-05"
  author: "Gabriela Caligares"
---

# Revisor de Clareza para o Leitor

## Papel

O público é morador da cidade, sem formação jurídica, que lê rápido. O dado pode estar certo e a tela ainda induzir a uma conclusão errada. Você lê o que o leitor vai ver, aponta onde um número ou rótulo pode ser mal entendido e relata o que verificou e o que não conseguiu verificar. Este roteiro é uma sugestão, não uma regra.

## Quando usar

- Foi criado ou alterado texto ou tela em `frontend/src/`, `prompts/analise.md`, posts em `data/posts/` ou o README
- O usuário pergunta se o leitor vai entender um "Sim", um "Aprovado" ou um placar

## Quando NÃO usar

- A dúvida é se o voto foi lido certo do documento: use `revisar-regra-de-voto`
- A dúvida é se existe fonte para o voto: use `conferir-fonte`
- A mudança é só de estilo visual, sem número nem rótulo

## Entradas necessárias

- [ ] O texto ou a tela a revisar (arquivo, página ou print)
- [ ] `docs/data/dados.json` para conferir exemplos reais

Se você não conseguir abrir a tela num navegador, **diga isso no relatório**: a análise passa a ser só pelo código e pelo `dados.json`.

---

## Saída

Um relatório curto na resposta (nada é gravado em disco):

```markdown
# Revisão de clareza
**Revisado:** [telas/textos]  |  **Como:** [navegador / só código e dados]

## Pontos de atenção
- [onde] — [por que o leitor pode entender errado] — [sugestão, se houver]

## Conferido sem problema
- [o que foi checado]

## Não verifiquei
- [o que ficou de fora e por quê]
```

**Regras da saída**
- Cada ponto de atenção cita o arquivo ou a tela e um exemplo real.
- Mudança de texto de tela é sugestão: quem decide é o dono do projeto.

---

## Passos

### 1. Cada número e cada "Sim/Não" diz a que se refere?

- **"Sim" é sobre o quê?** Numa votação de parecer, veto ou parecer do TCE, o SIM do painel é sobre o que está em votação, não sobre o projeto. Quem votou "Sim" num parecer contrário aprovou o parecer, ou seja, votou **contra** o projeto. Os rótulos corretos já existem no parser: `objeto_votado` e `rotulos` (`parser_resumo.py`).
- **"Aprovado" é o quê?** O projeto, o parecer, o veto mantido? Rotule pela etapa (`etapa_txt`) ao lado.
- **Placar "8 a 6"** vem do painel ou do resumo? Quando divergem, as duas versões aparecem?
- **Branco ou "não votou"** nunca pode aparecer como "contra" nem como "a favor". Presente sem voto ≠ ausente ≠ contra.

Para ver como a tela mostra as etapas de parecer hoje, rode:

```bash
python .claude/skills/clareza-pro-leitor/listar_pareceres.py
```

Ele lista cada etapa de parecer do `dados.json`, marca as de parecer contrário (`INVERTE`) e conta quantas são. Use essa contagem, não um número de memória.

### 2. Toda afirmação sobre voto tem fonte?

Painel da transmissão (com link no minuto) ou resumo oficial (com link do PDF). Rode `python .claude/skills/conferir-fonte/auditar.py` depois de mudar o que exibe voto.

### 3. Checar os princípios editoriais

Veja a seção Regras.

### 4. Linguagem

- Frases curtas, sem juridiquês. "Veto" e "parecer" precisam de uma explicação de uma linha na primeira vez que aparecem.
- Toda votação deixa claro de que sessão e de que data é (dia, mês e ano), para o leitor poder cruzar com o resumo oficial.
- O sentido não pode depender só de cor (verde/vermelho): tem texto ou `title`/`sr` junto? (padrão em `componentes.tsx`, `Celula`)
- Ausência de dado é dita ("sem registro", "resumo ainda não publicado"), nunca preenchida.

### 5. Ler como um morador

Abra a tela afetada (`cd frontend && npm run dev`) e pergunte: o que eu concluo daqui? Se não puder abrir, registre em "Não verifiquei".

Sem navegador aberto, dá para tirar um print com o Edge em modo headless (verificado em 2026-11-05):

```bash
cd docs && python -m http.server 8765 --bind 127.0.0.1 &
msedge --headless=new --disable-gpu --hide-scrollbars --window-size=1280,2200 --virtual-time-budget=15000 --screenshot=print.png "http://127.0.0.1:8765/#/projetos/pl-75-2026"
```

Rotas usam `#/` (`/#/vereadores/xuxa`, `/#/projetos/pl-75-2026`). Salve o print fora do repo. A página inicial tem animações: no print os gráficos saem pela metade, então não tire conclusões dela.

### 6. Relatar

Entregue o relatório no formato acima.

---

## Regras

Estes são princípios do README do projeto. Vale conferir contra eles.

- **Sem ranking, nota, "mais fiel", "mais faltoso"** de vereador, nem comparações que funcionem como ranking. Revisão de 2026-11-05, vendo as telas: não há nota nem lista por desempenho, **mas há listas ordenadas de pessoas por semelhança**. A página de cada vereador tem "Vota mais igual a" e "Vota mais diferente de" (`Vereador.tsx`), com nomes ordenados e porcentagem (ex.: "Rony Martins 77%"), e o início tem o mapa "Quem vota igual a quem" (`Inicio.tsx`). Não medem qualidade, mas ordenam vereadores nominalmente uns contra os outros. Se isso respeita o princípio "sem ranking" é decisão do dono do projeto; mudanças nesses blocos devem ser alinhadas com ele. (Uma checagem anterior desta skill disse que não havia lista ordenada: estava errada, só procurou palavras como "rank" no código.)
- **A IA nunca é fonte de fato.** O texto de "Entenda o projeto" é rotulado como gerado por IA, cita o documento lido e não recebe votos, nomes de vereadores nem partidos (veja `prompts/analise.md`). Todo ponto de atenção traz um trecho literal do documento.
- **Tom imparcial:** não dizer se o projeto é bom ou ruim, não recomendar voto, não elogiar nem criticar o autor.
- **Os dois lados quando as fontes divergem**, sem concluir qual está certa.
- **Estado visto nas telas em 2026-11-05** (o dono do projeto foi avisado e vai decidir; não mude sem alinhar com ele; confirme o estado atual com o script do passo 1 e um print):
  - **Parecer contrário sem explicação.** Em `/#/projetos/pl-75-2026` a etapa "Parecer contrário" mostra "Aprovado 8 a 6" e os vereadores com "Sim" em verde, sem dizer que esse SIM é contra o projeto. Só a etiqueta no topo ("Parecer contrário: aprovado") ajuda um pouco.
  - **Rótulos que se contradizem.** Na mesma linha aparecem "Aprovado" (resultado do painel) e "Rejeitado" (campo `detalhe`, vindo do resumo oficial). Um leitor lê as duas palavras para a mesma votação.
  - **"Sim/Não" do parecer contrário vira estatística de "não".** Em `/#/vereadores/xuxa`, o PL 92/2026 (parecer contrário em separado) aparece como **"Não"** em vermelho, mas ele votou a favor do projeto (rejeitou o parecer) e votou "Sim" nas duas discussões. Em código, `estatisticas.ts` (linha ~92, "Votos 'não' por semana") e o cartão "votou não" contam todo `NAO`, sem olhar a etapa, então votos a favor do projeto entram como "não".
  - **"0 a 0" sem votação.** Em `/#/projetos/pl-75-2026`, as linhas de 15/09 e 18/09 mostram "Sem resultado registrado 0 a 0" para etapas que nem tiveram voto (projeto voltou às comissões; retirado de pauta). Parece uma votação com zero votos.
  - **Números que parecem não bater.** Em `/#/vereadores/xuxa` o cartão diz "88 votações com voto registrado" e "2 votou não", enquanto a lista diz "Todos (216)" e "Votou não (6)". A explicação existe (até agosto só o resumo, que lista quem votou a favor), mas está num texto pequeno abaixo do gráfico.

---

## Exemplo

**Saída do script (trecho):**
```
INVERTE 2026-10-20  pl-75-2026   Parecer contrário   APROVADO   8x6  fonte=painel
```

**Ponto de atenção:**
```markdown
- Projeto PL 75/2026, etapa "Parecer contrário", "Aprovado 8 a 6" — o leitor pode entender que o projeto foi aprovado, mas o que foi aprovado é o parecer contrário (o SIM é contra o projeto) — sugestão: uma linha explicando o que o SIM significa nessa etapa, a combinar com o dono do projeto.
```

---

## Histórico de versões

- **v1.2** (2026-11-05): Testada com prints reais do site (Edge headless). Registra os problemas vistos nas telas, corrige a afirmação de que não havia lista ordenada de vereadores ("Vota mais igual a / diferente de") e documenta como tirar o print. [Gabriela Caligares]
- **v1.1** (2026-11-05): Reformatada no modelo padrão de skills. Troca os números escritos à mão por um script (`listar_pareceres.py`) e passa a exigir o registro do que não foi verificado. [Gabriela Caligares]
- **v1.0** (2026-11-05): Criada a partir da revisão do front e do caso do parecer contrário do PL 75/2026. [Gabriela Caligares]
