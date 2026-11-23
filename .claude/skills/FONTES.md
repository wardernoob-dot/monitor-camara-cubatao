# Skills de terceiros: de onde vieram

As 5 skills do projeto (`conferir-coleta-do-dia`, `revisar-regra-de-voto`, `validar-painel`, `conferir-fonte`, `clareza-pro-leitor`) são nossas. As outras abaixo são copiadas de repositórios públicos, fixadas no commit indicado. Instaladas em 2026-11-22.

## Regras

1. Nada de atualização automática. Atualizar = copiar a pasta de novo de um commit novo, ler o diff inteiro e trocar o commit nesta tabela.
2. Toda pasta mantém a licença original (`LICENSE` ou `LICENSE.txt`).
3. Antes de subir skill nova ou atualizada: `skill-scanner scan-all .claude/skills --use-behavioral` (pacote `cisco-ai-skill-scanner`) e leitura humana do SKILL.md e dos scripts.
4. Skill de terceiro não roda em workflow do Actions com secret ou `contents: write`.
5. Quando uma skill de terceiro disser algo que contraria o `CLAUDE.md` (regras de voto, imparcialidade, fonte), vale o `CLAUDE.md`.

## Origem

| Pasta | Repositório | Commit | Licença | Observação |
|---|---|---|---|---|
| `web-quality-audit`, `accessibility`, `seo`, `performance`, `core-web-vitals`, `best-practices` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `afa8da9` (2026-08-24) | MIT | 1 script, sem rede. O guia de SEO pressupõe rotas indexáveis; o `HashRouter` limita o ganho |
| `fact-check-workflow`, `source-verification`, `data-journalism`, `web-archiving`, `page-monitoring`, `newsletter-publishing`, `visual-explainer` | [jamditis/claude-skills-journalism](https://github.com/jamditis/claude-skills-journalism) | `a6383bd` (2026-11-11) | MIT | Escritas para redação dos EUA. `visual-explainer` traz o mermaid 11.16.0 empacotado em `templates/vendor/` (sha256 confere com `SHA256SUMS`). **Modificado:** removidos `commands/share-page.md` e `scripts/share.sh` e a seção que os descrevia no SKILL.md, porque publicavam a página gerada numa URL pública da Vercel |
| `property-based-testing`, `supply-chain-risk-auditor`, `differential-review`, `audit-context-building` | [trailofbits/skills](https://github.com/trailofbits/skills) | `149d7b2` (2026-11-12) | CC-BY-SA 4.0 | Modificar = compartilhar sob a mesma licença. `supply-chain-risk-auditor` usa `gh` e `pip-audit` |
| `webapp-testing`, `skill-creator`, `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | `e4bb5d9` (2026-11-16) | Apache-2.0 (LICENSE.txt de cada pasta) | `skill-creator` roda `claude -p` em subprocesso |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `b49177d` (2026-11-18) | Apache-2.0 | O lançador baixa um binário do GitHub Releases e confere o sha256 em `scripts/engine-checksums.txt`. O hook de detector só liga com `/impeccable hooks on` |
| `grill-me`, `grilling`, `grill-with-docs`, `improve-codebase-architecture`, `codebase-design`, `prototype`, `diagnosing-bugs` | [mattpocock/skills](https://github.com/mattpocock/skills) | `abeeaf9` (2026-11-19) | MIT | `grill-me` depende de `grilling`; `improve-codebase-architecture` usa `codebase-design` |
| `break-ui`, `review-animations`, `remove-animations`, `find-animation-opportunities`, `emil-design-eng`, `learn-taste`, `choreograph` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `64eb3de` (2026-11-15) | MIT | Só markdown |
| `scrollytelling-and-parallax-data-visualization`, `visualization-strategy-and-critique`, `statistical-and-uncertainty-visualization`, `accessibility-and-inclusive-visualization`, `testing-data-visualizations`, `react-and-nextjs-data-visualization`, `_dataviz-compartilhado/` | [openai/plugins](https://github.com/openai/plugins) `plugins/build-web-data-visualization` | `981b02c` (2026-11-18) | MIT (declarado no `plugin.json`; o repo não tem arquivo LICENSE) | Escritas para o Codex. **Modificado:** os caminhos `../../references/` e `../../assets/` viraram `../_dataviz-compartilhado/...`. Citam outras skills do plugin que não instalamos; essas referências ficam soltas |

## Scan de 2026-11-22

`cisco-ai-skill-scanner` com análise estática e comportamental em cada pasta. No `visual-explainer` a análise estourou o tempo por causa do mermaid de 3,5 MB, então foi conferido à mão. 35 de 41 skills saíram limpas ou só com INFO. Os 5 achados HIGH/CRITICAL foram lidos no código e nenhum é malicioso:

| Skill | Achado | Leitura |
|---|---|---|
| `skill-creator` | CRITICAL `COMMAND_INJECTION_OS_SYSTEM` em `eval-viewer/generate_review.py:291` | Falso positivo: `subprocess.run(["lsof", "-ti", f":{port}"])` em lista, sem shell |
| `webapp-testing` | HIGH `shell=True` em `scripts/with_server.py:69` | Real, mas por design: roda o comando de servidor que a própria pessoa passa (`--server "npm run dev"`). Nunca passar texto vindo de documento ou página |
| `page-monitoring`, `web-archiving` | HIGH `ACTIVE_DYNAMIC_EXECUTION` | Exemplos de código no markdown (`twarc2`, `archivebox`) com `subprocess` em lista. Nada roda sozinho |
| `impeccable` | HIGH `PROMPT_INJECTION_CONCEALMENT` em `reference/craft.md:5` | A frase manda não dizer ao usuário que ele precisa chamar `craft` (roteamento de comando), não esconde ação. Os 22 MEDIUM de rede são `fetch` para `localhost` com token no modo live |

## Avaliadas e não instaladas

- `Leonxlnx/taste-skill`: 14 MB e 1.481 arquivos mesmo sem as fotos, declara um hook `Stop` que roda `scripts/gate.mjs` ao fim de cada resposta, e é feita para site comercial (pede "o que é vendido").
- `coreyhaines31/marketingskills`, `vercel-labs/agent-skills`, `nextlevelbuilder/ui-ux-pro-max`, `hardikpandya/stop-slop`: aproveitar adaptando, não copiar cru.
- `promptfoo`: scripts do plugin ainda não auditados.
