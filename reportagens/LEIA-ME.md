# Reportagens

Textos curtos, em linguagem simples, sobre projetos e leis que mexem com o dia a dia de Cubatão. Aparecem no carrossel logo abaixo do topo da página inicial e em `#/reportagens/<id>`.

- Um arquivo por reportagem: `<id>.md` (o `id` do cabeçalho é igual ao nome do arquivo).
- Foto em `fotos/<id>.jpg` (até 2400 px). O `site.py` gera `docs/fotos/reportagens/<id>-g.webp` e `<id>-p.webp`.
- Só aparece no site com `status: publicado`. Rascunho só aparece na prévia local (`VAV_RASCUNHOS=1`).
- **Quem aprova o texto é o dono do projeto.** Ao publicar, preencha `aprovado_por`.

## O que NÃO vai no texto

Situação do projeto, autor, placar e voto de cada vereador: o site lê isso do próprio projeto (`projetos:`) e mostra com a fonte. Assim a reportagem nunca fica desatualizada nem contradiz o dado. O texto explica o que muda, para quem, o que ainda não se sabe, e linka os documentos.

Regras de sempre: sem adjetivo sobre vereador, sem dizer se o projeto é bom ou ruim, todo fato com documento, IA nunca é fonte.

## Cabeçalho

```
---
id: estacionamento-rotativo
status: rascunho            # ou publicado
data: 2026-11-07            # data da última revisão do texto
chapeu: Mexe no bolso       # etiqueta curta (opcional)
manchete: ...
linha_fina: ...
projetos: pl-190-2025       # um ou mais, separados por vírgula; o primeiro é o principal
votacao: pl-190-2025 2026-03-17 1a_discussao   # opcional: votação que aparece no cartão (projeto, data, etapa)
foto_alt: descrição da foto para quem não enxerga
foto_legenda: ...           # opcional
foto_credito: Nome/Órgão
foto_licenca: ...
foto_link: https://...      # página de origem da foto
foto_ilustrativa: sim       # foto que não é do fato em Cubatão
aprovado_por:
---
```

Corpo: `## Título`, parágrafos, itens com `- `, `**negrito**`, `[texto](https://...)` ou `[texto](#/projetos/pl-80-2026)`.
