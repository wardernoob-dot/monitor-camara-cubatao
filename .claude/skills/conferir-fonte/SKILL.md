---
name: conferir-fonte
display-name: "Auditor de Fonte do Voto"
description: >
  Audita o docs/data/dados.json com .claude/skills/conferir-fonte/auditar.py e confere, à mão, se
  o front e os posts mostram de onde veio cada voto, placar e partido (painel da transmissão ou
  resumo oficial, com link). Does NOT corrige dado, NÃO edita o dados.json e NÃO avalia se o voto
  foi lido certo (isso é a revisar-regra-de-voto e a validar-painel).
  Ativa quando o usuário diz "conferir a fonte", "todo voto tem fonte?", "audita o dados.json",
  "antes de publicar" ou depois de mudar site.py, consolidar.py ou o front.
metadata:
  version: "1.1"
  updated: "2026-11-05"
  author: "Gabriela Caligares"
---

# Auditor de Fonte do Voto

## Papel

Você verifica que nenhum voto, placar ou partido aparece sem dizer de onde veio. A regra do projeto é que todo voto mostra a fonte (painel da transmissão ou resumo oficial) e que a IA nunca é fonte de fato. Você roda a auditoria automática, complementa com a conferência manual do que o script não vê e relata o que foi e o que não foi checado. Este roteiro é uma sugestão, não uma regra.

## Quando usar

- Foi alterado `camara/site.py`, `consolidar.py` ou algo no `frontend/`
- Antes de publicar, ou quando o usuário pergunta se os votos têm fonte

## Quando NÃO usar

- A dúvida é o sentido de "favor" ou "contra": use `revisar-regra-de-voto`
- A dúvida é se o painel leu a cor certa: use `validar-painel`
- O texto da tela está confuso, mas a fonte existe: use `clareza-pro-leitor`

## Entradas necessárias

- [ ] `docs/data/dados.json` (ou outro caminho informado pelo usuário)
- [ ] Python 3 (o `auditar.py` usa só a biblioteca padrão)

Se o `dados.json` estiver desatualizado em relação à mudança, avise que a auditoria olha o arquivo como está.

---

## Saída

Um relatório curto na resposta:

```markdown
# Auditoria de fonte
**Votações por fonte:** painel [N] | resumo [N] | sem fonte e sem voto [N]
**Problemas na auditoria automática:** [N]
- [descrição de cada um, se houver]

## Conferência manual
- Front mostra a fonte: [sim / não / não verifiquei]
- Análise (IA) separada dos votos: [...]
- Posts do Instagram citam a fonte: [...]
```

**Regras da saída**
- Se o `auditar.py` retornar código 1, mostre os problemas; não diga que está tudo certo.
- Cada item da conferência manual vira "não verifiquei" se você não abriu o código ou a tela.

---

## Passos

### 1. Rodar a auditoria automática

```bash
python .claude/skills/conferir-fonte/auditar.py            # usa docs/data/dados.json
python .claude/skills/conferir-fonte/auditar.py outro.json # ou um arquivo específico
```

Ela falha (código 1) quando encontra:
- votação com votos, mas `fonte` diferente de `painel` ou `resumo`
- `fonte: painel` sem `link` do vídeo, ou `fonte: resumo` sem `resumo_url`
- placar sem nenhum link
- vereador com partido sem `partido_fonte`

Mostra também quantas votações vêm de cada fonte.

### 2. Conferir à mão o que o script não pega

1. O front mostra a fonte? Procure em `frontend/src/` onde `fonte`, `link` e `resumo_url` aparecem (página de projeto e de sessão). Campo gerado mas não renderizado não vale para o leitor.
2. Na seção "Entenda o projeto", o texto da IA aparece separado dos votos e com o documento de origem (`documento.fonte`)?
3. Os posts em `data/posts/` citam a fonte do placar?
4. Fonte `painel` só vale quando a leitura está `completo`; senão `site.py` cai para o resumo (veja `_evento`).

### 3. Relatar

Entregue o relatório no formato acima.

---

## Regras

- Painel da transmissão (com link no minuto) ou resumo oficial (com link do PDF) são as únicas fontes de voto. A IA nunca é fonte de fato.
- Votação sem voto e sem placar não precisa de fonte; a auditoria não a conta como problema.
- Não edite o `dados.json` para "passar" na auditoria: ele é gerado pelo `site.py`. Corrija a causa lá.

---

## Exemplo

**Saída da auditoria:**
```
votacoes por fonte: {'resumo': 186, None: 13, 'painel': 35}
0 problema(s)
```

**Relatório:**
```markdown
**Votações por fonte:** painel 35 | resumo 186 | sem fonte e sem voto 13
**Problemas na auditoria automática:** 0
```

---

## Histórico de versões

- **v1.1** (2026-11-05): Reformatada no modelo padrão de skills. O script passa a imprimir em UTF-8 no Windows. [Gabriela Caligares]
- **v1.0** (2026-11-05): Criada com o `auditar.py`, rodado no `dados.json` do dia (0 problemas). [Gabriela Caligares]
