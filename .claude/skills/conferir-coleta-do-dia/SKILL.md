---
name: conferir-coleta-do-dia
display-name: "Conferidor da Coleta do Dia"
description: >
  Depois de uma rodada do robô (ou de um `python -m camara tudo`), roda
  .claude/skills/conferir-coleta-do-dia/resumo.py e relata o que entrou e o que merece olho humano:
  avisos do parser, PDFs sem texto, votações não identificadas e divergências incomuns entre painel
  e resumo. Does NOT altera dados, NÃO roda a coleta e NÃO corrige o parser sozinha.
  Ativa quando o usuário diz "conferir a coleta", "o que o robô trouxe", "revisa os commits de
  dados", "tem algo estranho na coleta?" ou quando algo no site parecer estranho.
metadata:
  version: "1.1"
  updated: "2026-11-05"
  author: "Gabriela Caligares"
---

# Conferidor da Coleta do Dia

## Papel

O robô roda a cada 4 horas e commita `data/` sem revisão humana. Você resume o que a última rodada trouxe e separa o que é esperado do que vale investigar. Você só lê e relata; não coleta nem corrige. Este roteiro é uma sugestão, não uma regra.

## Quando usar

- Depois de uma rodada do robô ou de um `python -m camara tudo`
- Ao revisar os commits `dados: coleta ...`, ou quando o site mostrar algo estranho

## Quando NÃO usar

- Você quer rodar a coleta: use `python -m camara tudo`
- A dúvida é se o leitor do painel acertou em geral: use `validar-painel`
- A dúvida é uma regra de voto no código: use `revisar-regra-de-voto`

## Entradas necessárias

- [ ] `data/relatorio_processamento.json` e `data/consolidado/*.json` (vêm no repo, commitados pelo robô)
- [ ] Python 3 (o `resumo.py` usa só a biblioteca padrão)

Se precisar de dados mais novos que os da sua cópia, faça `git fetch` e veja se há commit do robô à frente antes de concluir.

---

## Saída

Um relatório curto na resposta; o script só imprime no terminal.

```markdown
# Coleta do dia
**Relatório:** [N] sessões | [N] itens | [N] votos | avisos do parser: [N]
**PDFs que precisam de OCR:** [N] ([quais])

## Dias conferidos
- [data] [status]: [N] matérias, [N] divergências ([N] esperadas, [N] incomuns)

## Incomuns
- [tipo, matéria, vereador]: [o que diz cada fonte]

## Sem checar
- [o que ficou de fora e por quê]
```

**Regras da saída**
- Separe sempre divergência esperada de incomum.
- Se o resumo oficial do dia ainda não saiu (sai com cerca de 2 semanas de atraso), diga que a conferência painel × resumo ainda não é possível.

---

## Passos

### 1. Rodar o resumo

```bash
python .claude/skills/conferir-coleta-do-dia/resumo.py            # últimos 3 dias consolidados
python .claude/skills/conferir-coleta-do-dia/resumo.py --dias 7
```

Só lê `data/relatorio_processamento.json`, `data/consolidado/*.json` e o `git log`.

### 2. Ler o relatório

- Se `votos` cair em relação à rodada anterior, algo quebrou no parser.
- `nome nao reconhecido '...'` é vereador ou suplente novo, ou grafia nova (veja `camara/nomes.py` e `data/vereadores.json`).
- Aviso de título divergente entre site e PDF é esperado e só registra.
- PDF que precisa de OCR: conhecido o resumo da 1ª sessão ordinária de 03/02/2026 (PDF escaneado). Item novo na lista merece atenção.

### 3. Ler cada dia consolidado

- `oficial_conferido` = tem painel e resumo para comparar; `so_oficial` = só o resumo (normal antes de set/2026 e enquanto o painel não foi processado).
- `votacoes_nao_identificadas` > 0: o cabeçalho lido do painel não casou com a pauta (o modelo de visão erra dígito em texto miúdo). Veja `validacao.py` e `data/painel/<video>.json` (campos `lido` e `validacao`).
- **Esperado:** `resumo_inclui_nao_votante` junto com `placar_divergente`. O resumo oficial costuma contar como SIM quem o painel mostra sem voto. O site mostra as duas versões lado a lado (veja "Quando as fontes não batem" em *Como funciona*).

### 4. Investigar as linhas `! INCOMUM`

- `voto_divergente`: o painel mostra um voto e o resumo registra o contrário para o mesmo vereador. Caso conhecido: PL 27/2026, 1ª discussão, 29/09, descrito em *Como funciona*. **Qualquer outro caso novo é o mais importante da lista:** compare a imagem em `data/painel/img/` com o texto do resumo e veja qual fonte errou. O site mostra as duas, sem concluir.
- `painel_incompleto`: o print foi capturado antes do fim da votação (o campo `obs` explica). Caso conhecido: PL 87/2026, parecer, 20/10. Em geral é benigno: o site cai para o resumo quando a leitura não está `completo`.
- Outros tipos: compare `data/consolidado/<data>.json` (`conferencia.divergencias`) com `data/sessoes/<data>_*.json` e o PDF em `data/texto/`.

### 5. Se a causa for o código

Corrija em `painel.py`, `parser_resumo.py` ou `nomes.py` e rode `python -m pytest -q`. Evite editar o JSON de dados na mão: o robô o regenera na próxima rodada.

### 6. Relatar

Entregue o relatório no formato acima.

---

## Regras

- Só leia e relate. Não rode a coleta e não commite dados.
- Divergência esperada não é motivo de alarme; divergência incomum nunca é descartada sem olhar a imagem e o texto.
- Sem juízo sobre vereador: divergência é sobre fonte, não sobre pessoa. (O Índice de Atuação é o único ranking permitido; não o use para explicar divergência de coleta.)

---

## Exemplo

**Saída do script (trecho):**
```
  2026-11-03 [oficial_conferido] materias=8 transmissoes=1 noticias=1 votacoes_nao_identificadas=0 divergencias=6
      (3 caso(s) esperado(s) de resumo que conta como SIM quem o painel mostra sem voto)
```

**Relatório:**
```markdown
- 2026-11-03 oficial_conferido: 8 matérias, 6 divergências (6 esperadas, 0 incomuns)
```

---

## Histórico de versões

- **v1.1** (2026-11-05): Reformatada no modelo padrão de skills. Documenta os tipos `voto_divergente` e `painel_incompleto` com os casos conhecidos. O script imprime em UTF-8 no Windows. [Gabriela Caligares]
- **v1.0** (2026-11-05): Criada com o `resumo.py`, testado nos últimos 7 dias de coleta. [Gabriela Caligares]
