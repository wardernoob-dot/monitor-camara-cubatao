# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

"Voto a voto": coleta o que a Câmara Municipal de Cubatão publica (resumos de sessão, pautas, projetos, vetos) e a leitura do painel de votação da transmissão no YouTube, e gera dado estruturado + um site estático. O código e os dados estão em português (sem acentos nos identificadores/docstrings do Python).

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
7. `site.py`: gera `docs/data/dados.json`, que o app React em `frontend/` lê ao abrir.

Pontos que exigem ler mais de um arquivo:

- **`docs/` é saída commitada.** O build do front (`npm run build`) e as fotos processadas (`docs/fotos/*.webp`) ficam no repo e são servidos pelo GitHub Pages. O Actions só atualiza `docs/data/` e `data/`, sem Node. Mudou o front, tem que rodar o build e commitar `docs/`.
- **O YouTube bloqueia IPs de nuvem.** O Actions não consegue pegar o spec do storyboard; quem faz isso é o script do PC (`pc/`, tarefa agendada no Windows) que atualiza `data/storyboard_specs.json`. `sonda-storyboard.yml` é um teste manual que escreve só no branch `amostras`.
- **Automação diária:** `.github/workflows/coleta.yml` (08h17 BRT) roda os testes, `python -m camara tudo` e commita `data/` como `monitor-camara-bot`. Testes quebrados bloqueiam a coleta.
- **Fotos:** `fotos/` recebe imagens com qualquer nome; `site.py:preparar_fotos` casa por apelido/nome civil (aceita extensão repetida tipo `ivan.jpg..jpg` e nome parcial único), recorta no rosto e converte para webp. Detalhes em `fotos/LEIA-ME.md`.
- Suplentes com ao menos uma sessão em 2026 ganham página de vereador.

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
- Todo voto mostra a fonte (painel ou resumo oficial). A IA nunca é fonte de fato; a análise usa só o texto do projeto, sem votos nem nomes. Sem ranking nem nota de vereador.
- O SAPL não tem PL nem votação; não usar como fonte de voto.
- O histórico do git é trilha de auditoria (o sha256 muda se o documento mudar); não reescreva histórico de `data/`.
