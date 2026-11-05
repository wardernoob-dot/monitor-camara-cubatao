# Monitor da Câmara de Cubatão

Coleta automática do que a Câmara Municipal de Cubatão publica (resumos de sessão,
pautas, projetos de lei e vetos) e transformação disso em dado estruturado: quem votou,
em quê, como, e qual foi o resultado.

## Status

| Etapa | Situação |
|---|---|
| Coletor (pautas, resumos, projetos, notícias, Diário Oficial) | pronto, roda todo dia no GitHub Actions |
| Votos nominais pelo painel da transmissão (inclui quem não votou) | pronto, desde set/2026 |
| Identificação do que está em votação, conferida com a pauta | pronto |
| Consolidado por dia (painel × resumo × notícia × DO) | pronto |
| Análise imparcial por projeto (só com o texto oficial, prompt público) | pronto |
| Site (React, em `frontend/`, publicado de `docs/`) | pronto |
| Carrossel pro Instagram (`data/posts/`) | pronto |

Site: https://wardernoob-dot.github.io/monitor-camara-cubatao/ (GitHub Pages servindo a pasta `/docs`).

## Fontes (todas públicas)

| Fonte | Onde | Observação |
|---|---|---|
| Resumo das Sessões | `cubatao.sp.leg.br/processo-legislativo/resumo-das-sessoes` | PDF com presença e votos nominais. Sai com ~2 semanas de atraso. |
| Pauta das Sessões | `.../pauta-das-sessoes-1` | Sai na véspera da sessão. |
| Projetos de Lei e Vetos | `.../projetos-de-lei` | Ementa + PDF de cada PL/PR/veto. |
| SAPL | `sapl.cubatao.sp.leg.br` | Só tem indicação, requerimento, moção e resposta. **Nenhum PL e nenhuma votação.** Não serve como fonte de voto. |

## Como os votos são interpretados (ler antes de publicar qualquer coisa)

1. **O resumo só lista quem votou.** Vereador presente que não aparece na lista **não** é
   voto contrário: fica como "não consta" (pode ser o presidente, alguém fora do plenário
   no momento, abstenção não registrada).
2. **Na maioria das votações o resumo só lista os votos a favor.** Voto contrário só
   aparece explícito em votação dividida, em veto e em parecer.
3. **Votação de parecer inverte o sentido quando o parecer é contrário.**
   "Aprovação do Parecer contrário à Propositura" = voto **contra** o projeto.
4. **Veto:** "manutenção do Veto" = a favor do veto (contra o projeto original);
   "rejeição do Veto" = derrubar o veto.
5. **Parecer do TCE sobre contas:** "rejeição do Parecer" = derrubar o parecer do Tribunal.

Cada item sai com `objeto_votado` (`materia`, `veto` ou `parecer_tc`) e `rotulos`
explicando o que "favor" e "contra" significam naquele caso.

## Problemas reais do site que o código trata

- Título em "negrito falso" no PDF, em 3 variantes: letra duplicada (`RREESSUUMMOO`),
  palavra duplicada (`RESUMORESUMO DADA`) e frase duplicada.
- Caractere cirílico no meio do texto (`CENTО` com О cirílico).
- Mesmo vereador com grafias diferentes (`Barbosa`/`Barboza`, `Olivpeira`).
- Título no site divergindo do PDF (ex.: a 12ª ordinária de 2026: site diz 23/04, PDF diz 22/04).
  O sistema mantém o dado do PDF e registra o aviso.
- 1ª sessão ordinária de 2026 publicada como PDF escaneado (sem texto): precisa de OCR.

## Rodar local

```bash
pip install -r requirements.txt
python -m pytest -q          # 14 testes
python -m camara tudo        # coleta + processa (padrão: 2026 em diante)
```

Saída em `data/`:

- `indice.json`: todo documento baixado (URL, título, sha256, data do download)
- `texto/<sha256>.txt`: texto extraído de cada PDF
- `sessoes/AAAA-MM-DD_tipo_NN.json`: uma sessão estruturada por arquivo
- `vereadores.json`: catálogo de vereadores, bancada declarada e presença
- `relatorio_processamento.json`: contagens e avisos da última rodada

O histórico do git funciona como trilha de auditoria: dá pra provar quando cada documento
apareceu no site e se foi alterado depois (o sha256 muda).

## Princípios do projeto

- O dado de voto vem só do documento oficial, com link. A IA nunca é fonte de fato.
- A análise da IA segue estrutura fixa e o prompt fica público.
- Sem ranking nem nota de vereador.
