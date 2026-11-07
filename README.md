# Voto a Voto — Monitor da Câmara Municipal de Cubatão

Plataforma cívica e independente de transparência legislativa que coleta automaticamente tudo o que a **Câmara Municipal de Cubatão/SP** publica — pautas, resumos oficiais de sessão, projetos de lei, vetos, notícias, Diário Oficial do Município e transmissões da TV Câmara no YouTube — e transforma em **dados abertos auditáveis**, **análises imparciais baseadas estritamente no documento oficial** e um **portal web interativo**.

- **Portal principal (Surge):** [https://votoavoto.surge.sh](https://votoavoto.surge.sh)
- **Espelho oficial (GitHub Pages):** [https://wardernoob-dot.github.io/monitor-camara-cubatao/](https://wardernoob-dot.github.io/monitor-camara-cubatao/)

## Como funciona, em resumo

1. **Coleta:** a cada 4 horas, um robô (GitHub Actions) baixa o que a Câmara publica e guarda o texto e o `SHA-256` de cada documento.
2. **Leitura dos votos:** vêm do texto do resumo oficial ou da cor do painel eletrônico na transmissão do YouTube. A IA não lê nem decide voto.
3. **Consolidação:** painel, resumo, pauta, notícias e Diário Oficial são cruzados, e as divergências ficam lado a lado.
4. **Site:** um portal estático (React) mostra cada voto com a fonte.

## Documentação

- [**Arquitetura e funcionamento interno**](ARQUITETURA.md): módulos, workflows do Actions, papel da IA, regras de leitura de voto, anomalias dos PDFs, segurança e estrutura do repositório.
- [`CLAUDE.md`](CLAUDE.md): guia para o Claude Code trabalhar no repositório.
- [`prompts/analise.md`](prompts/analise.md): prompt público da análise "Entenda o projeto".

---

## Como Rodar Localmente

### Pré-requisitos
- **Python 3.11+**
- **Node.js 20+** (para desenvolver ou recompilar o frontend em `frontend/`)

### 1. Instalar dependências e rodar a suíte de testes
```bash
pip install -r requirements.txt
python -m pytest -q
```
> Todos os **53 testes** (cobrindo parser de resumos, leitura do painel, consolidação, exportação do site e controles de segurança) devem passar antes de qualquer coleta ou deploy.

### 2. Executar o pipeline de dados
```bash
# Apenas coletar novos PDFs do site da Câmara (a partir de 2026)
python -m camara coletar --desde 2026

# Apenas reprocessar os documentos que já estão em data/ e atualizar docs/data/
python -m camara processar

# Pipeline completo: coleta + processa + painel + notícias + DO + análises + posts + site
python -m camara tudo --desde 2026
```

**Variáveis de ambiente opcionais (para etapas de OCR e análise):**
- `GEMINI_API_KEY`: habilita leitura de cabeçalho de novas transmissões (`cabecalho.py`), OCR de PDFs escaneados (`analise.py`), explicações curtas (`explicacao.py`) e análise de projetos no plano gratuito do Gemini (`analise.py`).
- `ANTHROPIC_API_KEY`: se definida, assume prioridade na geração das análises de projetos (`camara/analise.py`).
- `MODELO_CLAUDE` / `MODELO_GEMINI`: permitem sobrescrever o modelo padrão.
*(Sem chaves configuradas, o pipeline executa normalmente toda a coleta, leitura de votos, consolidação e geração do site, pulando apenas chamadas novas de LLM).*

### 3. Rodar ou compilar o Frontend (React/Vite)
```bash
cd frontend
npm install --ignore-scripts
npm run dev      # servidor local de desenvolvimento
npm run build    # compila para ../docs/ (atualiza o bundle estático do site)
```

---

## Princípios Inegociáveis do Projeto

1. **Fonte oficial sempre à vista:** Todo voto e todo projeto exibem o link direto para o PDF oficial da Câmara ou para o segundo exato do vídeo da sessão no YouTube.
2. **A IA nunca é fonte de fato:** Votos são lidos por cor de pixel no painel ou extraídos do texto oficial do resumo. Análises textuais usam apenas o documento oficial, com prompt aberto e verificação automática de citações literais.
3. **Trilha de auditoria imutável:** O histórico do Git + os hashes `SHA-256` em `data/indice.json` permitem comprovar exatamente quando cada documento foi publicado pela Câmara e se sofreu alteração posterior.
4. **Sem ranking de voto:** Nenhuma nota ou ordem de vereadores por *como votaram* (nada de "mais fiel" ou "mais faltoso"). A única nota é o **Índice de Atuação Parlamentar** (0 a 10, `camara/impacto.py`): mede atividade registrada em documento público, não qualidade, e a conta é aberta em Como funciona e na página de cada vereador. "Posição da Prefeitura" e "bancada unida" são porcentagens descritivas.
