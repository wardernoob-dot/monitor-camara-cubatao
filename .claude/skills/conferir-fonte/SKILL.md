---
name: conferir-fonte
description: Audita se todo voto, placar e partido exibidos no site mostram de onde vieram (painel da transmissão ou resumo oficial, com link). Use após mudar site.py/consolidar.py/front ou antes de publicar.
---

# Conferir a fonte de cada voto

Regra do projeto: **todo voto mostra de onde veio** (painel da transmissão ou resumo oficial) e a IA nunca é fonte de fato.

## Auditoria automática

```bash
python .claude/skills/conferir-fonte/auditar.py            # usa docs/data/dados.json
python .claude/skills/conferir-fonte/auditar.py outro.json # ou um arquivo específico
```

Ela falha (código 1) quando encontra:
- votação com votos, mas `fonte` diferente de `painel` ou `resumo`;
- `fonte: painel` sem `link` do vídeo, ou `fonte: resumo` sem `resumo_url` do documento;
- placar sem nenhum link;
- vereador com partido sem `partido_fonte`.

Mostra também quantas votações vêm de cada fonte (hoje a maioria é `resumo`; `painel` só desde set/2026).

## O que a auditoria não pega (confira à mão)

1. O front mostra a fonte? Procure em `frontend/src/` como `fonte`, `link` e `resumo_url` aparecem na tela de projeto e de sessão. Se um campo é gerado mas não renderizado, a regra não vale para o leitor.
2. Páginas de análise: o texto da IA aparece claramente separado dos votos e com o documento de origem (`documento.fonte`).
3. Posts do Instagram (`data/posts/`) citam a fonte do placar.
4. Fonte `painel` só vale quando a leitura está `completo`; senão `site.py` cai para o resumo (veja `_evento`).

## Ao terminar

Relate: nº de votações por fonte, quantos problemas a auditoria achou e se a verificação do front foi feita (ou não).
