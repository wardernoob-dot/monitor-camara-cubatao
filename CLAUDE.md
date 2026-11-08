# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

"Voto a voto": coleta o que a Câmara Municipal de Cubatão publica (resumos de sessão, pautas, projetos, vetos) e a leitura do painel de votação da transmissão no YouTube, e gera dado estruturado + um site estático. O código e os dados estão em português (sem acentos nos identificadores/docstrings do Python).

Documentação longa (módulos, workflows, IA, regras de leitura de voto, segurança, estrutura): `ARQUITETURA.md`. O `README.md` é só a porta de entrada. O diagrama do pipeline é `imagens/arquitetura.svg` (SVG feito à mão, sem gerador): mudou a ordem ou os módulos do pipeline, atualize o SVG e o "Detalhamento passo a passo" do `ARQUITETURA.md`.

## Comandos

```bash
pip install -r requirements.txt
python -m pytest -q                              # todos os testes (rodam antes da coleta no Actions)
python -m pytest tests/test_painel.py -q         # um arquivo
python -m pytest tests/test_parser.py -k nome -q # um teste

python -m camara coletar [--desde 2026] [--secoes resumo,pauta,projetos] [--guardar-pdf]
python -m camara processar                       # só processa o que já está em data/
python -m camara tudo [--desde 2026]             # coleta + processa + site (o que o Actions roda)

cd frontend && npm install && npm run dev        # front React/Vite
cd frontend && npm run build                     # compila para ../docs/ (apaga docs/assets antes)
```

Variáveis de ambiente opcionais: `GEMINI_API_KEY` (identificação do cabeçalho do painel e análise), `ANTHROPIC_API_KEY` (tem prioridade na análise), `MODELO_CLAUDE`, `MODELO_GEMINI`. Sem chave, essas etapas são puladas.

## Arquitetura

Pipeline único, orquestrado em `camara/__main__.py` (`tudo` chama as etapas nesta ordem):

1. `coletor.py`: baixa PDFs/páginas do site da Câmara → `data/indice.json` (sha256) e `data/texto/<sha256>.txt`.
2. `processar.py` + `parser_resumo.py`: transforma o texto do resumo em `data/sessoes/AAAA-MM-DD_tipo_NN.json` e `data/vereadores.json`.
3. `videos.py` + `painel.py` + `youtube.py`: lê o painel eletrônico nas miniaturas (storyboard) do YouTube por cor de pixel em posição fixa (sem IA), grava `data/painel/<video_id>.json`. `cabecalho.py` usa Gemini para identificar qual matéria está em votação e `validacao.py` confere com a pauta.
4. `noticias.py` e `diario.py`: notícias e Diário Oficial.
5. `consolidar.py`: junta painel × resumo × notícia × DO em `data/consolidado/<data>.json`.
6. `analise.py` (prompt público em `prompts/analise.md`, cache por matéria+hash do documento+versão do prompt) e `posts.py` (carrossel Instagram em `data/posts/`).
7. `impacto.py` (faixa de impacto de cada projeto, regra fixa sem IA, exceções em `data/impacto_manual.json`) alimenta o Índice de Atuação calculado em `site.py`.
8. `site.py`: gera `docs/data/dados.json`, que o app React em `frontend/` lê ao abrir.

Pontos que exigem ler mais de um arquivo:

- **`docs/` é saída commitada.** O build do front (`npm run build`) e as fotos processadas (`docs/fotos/*.webp`) ficam no repo e são servidos pelo GitHub Pages. Quando há dados novos em `data/`, o robô do Actions também commita `docs/data/` junto com `data/`, mantendo o GitHub Pages sincronizado com o Surge (`https://votoavoto.surge.sh`). Mudou o front, tem que rodar o build e commitar `docs/`.
- **O YouTube bloqueia IPs de nuvem.** O Actions não consegue pegar o spec do storyboard; quem faz isso é o script do PC (`pc/`, tarefa agendada no Windows) que atualiza `data/storyboard_specs.json`. `sonda-storyboard.yml` é um teste manual que escreve só no branch `amostras`.
- **Automação:** `.github/workflows/coleta.yml` roda a cada 4 horas (minuto 17), executa os testes e `python -m camara tudo`, commita `data/` e `docs/data/` (quando há novidade em `data/`) como `monitor-camara-bot` e publica o `docs/` em https://votoavoto.surge.sh (precisa dos secrets `SURGE_LOGIN` e `SURGE_TOKEN`; sem eles o passo é pulado). Testes quebrados bloqueiam a coleta. `publicar-surge.yml` republica no Surge quando `docs/`, `fotos/` ou `camara/site.py` mudam na `main`. Nunca commite `docs/CNAME`: o Surge o cria localmente e, commitado, derruba o endereço do GitHub Pages (já está no `.gitignore`).
- **Fotos:** `fotos/` recebe imagens com qualquer nome; `site.py:preparar_fotos` casa por apelido/nome civil (aceita extensão repetida tipo `ivan.jpg..jpg` e nome parcial único), recorta no rosto e converte para webp. Detalhes em `fotos/LEIA-ME.md`.
- **Rotas com `#`:** o front usa `HashRouter`, então link de página precisa do `#` (`https://votoavoto.surge.sh/#/vereadores/topete`); sem ele o Surge responde 404. Decisão de manter assim: funciona nos dois hospedeiros sem arquivo de fallback.
- Suplentes com ao menos uma sessão em 2026 ganham página de vereador.
- **Reportagens** (`reportagens/*.md` + `reportagens/fotos/`, lidas por `camara/reportagens.py`, carrossel logo abaixo do hero e `#/reportagens/<id>`): texto escrito por gente e aprovado pelo dono do projeto (`status: publicado`); rascunho só aparece com `VAV_RASCUNHOS=1`. Situação, autor e votos não vão no texto, o site lê do projeto. Toda foto precisa de crédito, licença e link de origem. Detalhes em `reportagens/LEIA-ME.md`.

## Skills do projeto

Ficam em `.claude/skills/<nome>/SKILL.md`. São roteiros sugeridos, não regras. Cada uma termina dizendo o que foi e o que não foi verificado.

| Quando | Skill |
|---|---|
| Depois de uma rodada do robô, ou ao revisar commits `dados: coleta ...` | `conferir-coleta-do-dia` |
| Mexeu em `parser_resumo.py`, `consolidar.py`, `site.py` ou `posts.py` | `revisar-regra-de-voto` |
| Mexeu em `painel.py`/`videos.py`, ou uma votação do painel parece errada | `validar-painel` |
| Mudou o que o site ou os posts mostram de voto, ou antes de publicar | `conferir-fonte` |
| Criou ou mudou texto ou tela que o morador lê | `clareza-pro-leitor` |

Ordem sugerida para uma mudança que vai pra `main`: `revisar-regra-de-voto` (se tocou em voto) → `conferir-fonte` → `clareza-pro-leitor` (se tocou em tela) → revisão do dono do projeto.

## Regras de interpretação de voto (ler antes de mexer em parser/consolidação/site)

- O resumo só lista quem votou. Presente e ausente da lista = "não consta", **nunca** voto contrário. Na maioria das votações só aparecem os votos a favor; contrário só em votação dividida, veto e parecer.
- "Aprovação do Parecer contrário" = voto **contra** o projeto. "Manutenção do Veto" = a favor do veto; "rejeição do Veto" = derrubar o veto. "Rejeição do Parecer" do TCE = derrubar o parecer.
- Cada item carrega `objeto_votado` (`materia`, `veto`, `parecer_tc`) e `rotulos` explicando o que "favor"/"contra" significa naquele caso.
- Quirks reais do PDF que o código já trata: "negrito falso" (letra/palavra/frase duplicada), cirílico no meio do texto, grafias diferentes do mesmo vereador (normalizadas em `nomes.py`), título do site divergindo do PDF (mantém o PDF e registra aviso), PDF escaneado sem texto (precisa OCR).
- Todo voto mostra a fonte (painel ou resumo oficial). A IA nunca é fonte de fato; a análise usa só o texto do projeto, sem votos nem nomes. Sem ranking nem nota **de voto**: nada de "mais fiel", "mais faltoso", "índice de fidelidade" nem ordenar vereadores por como votaram. Desde 2026-11-07 (decisão do dono do projeto) existe o **Índice de Atuação Parlamentar** (nota 0 a 10 e página Ranking, `Ranking.tsx`, `camara/impacto.py`), que mede atividade registrada em documento público e tem método aberto em Como funciona. Posição da Prefeitura e "bancada unida" por partido são porcentagens descritivas (`Partidos.tsx`).
- **Perguntar à IA e tema escuro:** `frontend/src/pergunta.tsx` só monta um prompt e abre Claude/ChatGPT numa aba nova (o site é estático e não guarda chave de API; o prompt carrega as regras de voto deste arquivo, então mudou regra, atualize `montarPrompt`). Nenhuma IA responde dentro do site. O tema escuro (`tema.tsx`, `public/tema.js`, tokens em `estilo.css`) segue o sistema e o botão da lua grava a escolha; o CSP bloqueia script inline, por isso `tema.js` é arquivo próprio. Cor nova no CSS: use variável, não hexadecimal.
- O SAPL não tem PL nem votação; não usar como fonte de voto.
- O histórico do git é trilha de auditoria (o sha256 muda se o documento mudar); não reescreva histórico de `data/`.
