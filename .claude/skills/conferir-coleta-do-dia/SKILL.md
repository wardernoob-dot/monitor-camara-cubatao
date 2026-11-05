---
name: conferir-coleta-do-dia
description: Depois de uma rodada do robô (ou de um `python -m camara tudo`), resume o que entrou e destaca o que merece olho humano - avisos do parser, PDFs sem texto, votações não identificadas, divergências incomuns entre painel e resumo. Use ao revisar os commits "dados: coleta ..." ou quando algo no site parecer estranho.
---

# Conferir a coleta do dia

O robô roda a cada 4 horas e commita `data/` sem revisão humana. Esta skill mostra, em um comando, o que a última rodada trouxe.

## Rodar

```bash
python .claude/skills/conferir-coleta-do-dia/resumo.py            # últimos 3 dias consolidados
python .claude/skills/conferir-coleta-do-dia/resumo.py --dias 7
```

Só lê `data/relatorio_processamento.json`, `data/consolidado/*.json` e o `git log`; não altera nada.
Se precisar de dados mais novos, rode `git pull` antes.

## Como ler a saída

- **Relatório:** nº de sessões, itens e votos individuais. Se `votos` cair em relação à rodada anterior, algo quebrou no parser.
- **Avisos do parser** (`avisos`): `nome nao reconhecido '...'` é vereador/suplente novo ou grafia nova (veja `camara/nomes.py` e o catálogo `data/vereadores.json`); aviso de título divergente entre site e PDF é esperado e só registra.
- **PDFs que precisam de OCR:** hoje é só o resumo da 1ª sessão ordinária de 03/02/2026 (PDF escaneado). Item novo na lista merece atenção.
- **Status do consolidado:** `oficial_conferido` = tem painel e resumo para comparar; `so_oficial` = só resumo (normal antes de set/2026 e enquanto o painel não foi processado).
- **`votacoes_nao_identificadas` > 0:** o cabeçalho lido do painel não casou com a pauta (o modelo de visão erra dígito em texto miúdo). Veja `validacao.py` e `data/painel/<video>.json` (campos `lido` e `validacao`).
- **Divergências esperadas:** o resumo oficial costuma contar como SIM quem o painel mostra sem voto, então aparecem juntas `resumo_inclui_nao_votante` e `placar_divergente` (placar do resumo 1 acima). O script as agrupa em uma linha. O site mostra as duas versões lado a lado; é assim que deve ser (veja "Quando as fontes não batem" em *Como funciona*).
- **Linhas `! INCOMUM`:** divergência de outro tipo, ou `placar_divergente` sem nenhum não-votante por trás. Vale investigar,
  mas dois tipos já aparecem no histórico e têm explicação:
  - `voto_divergente`: o painel mostra um voto e o resumo registra o contrário para o mesmo vereador. Caso conhecido:
    PL 27/2026, 1ª discussão, 29/09 (Alessandro: painel NÃO, resumo SIM), descrito em *Como funciona*. **Qualquer outro caso novo é o mais importante da lista**:
    compare a imagem em `data/painel/img/` com o texto do resumo e veja qual das duas fontes errou (o site mostra as duas, sem concluir).
  - `painel_incompleto`: o print do painel foi capturado antes do fim da votação (campo `obs` explica). Caso conhecido: PL 87/2026, parecer, 20/10.
    Em geral é benigno: o site cai para o resumo quando a leitura do painel não está `completo`.

## Se achar algo incomum

1. Veja o item em `data/consolidado/<data>.json` (`conferencia.divergencias`) e a imagem em `data/painel/img/`.
2. Compare com `data/sessoes/<data>_*.json` (o resumo estruturado) e com o PDF em `data/texto/`.
3. Corrija a causa no código (`painel.py`, `parser_resumo.py`, `nomes.py`) e rode `python -m pytest -q`. Nunca edite o JSON de dados na mão: o robô o regenera.
4. Para validar o leitor do painel contra os resumos, use a skill `validar-painel`; para regras de voto, `revisar-regra-de-voto`.

## Relatar

Diga ao usuário: o que entrou de novo (datas/sessões), quantos avisos e de que tipo, e se algo ficou sem checar
(por exemplo, resumo oficial ainda não publicado, que sai com ~2 semanas de atraso).
