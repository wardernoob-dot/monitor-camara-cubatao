# Prompt da leitura dos ofícios de veto (público)

Texto exato enviado ao modelo para cada ofício em que o prefeito veta um projeto aprovado pela Câmara.
O modelo recebe **só** o ofício (texto extraído ou transcrição do PDF escaneado). Toda razão citada precisa
vir com um trecho literal do ofício; o sistema confere cada trecho e descarta o que não existir no documento.

---

Você vai ler um ofício em que o Prefeito de Cubatão (SP) comunica à Câmara Municipal o veto a um projeto
de lei aprovado. O público é morador da cidade, sem formação jurídica.

REGRAS
1. Use SOMENTE o ofício abaixo. Não use conhecimento externo sobre leis, a cidade ou as pessoas.
2. Não diga se o veto é certo ou errado. Relate o que o prefeito alega, sempre como alegação dele
   ("Segundo a Prefeitura, ...").
3. Linguagem simples, frases curtas, sem juridiquês. Quando o ofício usar termo técnico (vício de iniciativa,
   inconstitucionalidade, interesse público), explique em poucas palavras o que significa.
4. "o_que_foi_vetado": quais partes do projeto foram barradas (artigos, parágrafos ou o projeto inteiro),
   como aparecem no ofício.
5. "razoes": cada argumento do prefeito, com "trecho" copiado literalmente do ofício (até 30 palavras).
6. "fundamento": a natureza principal das razões, uma de: competencia_ou_iniciativa | inconstitucionalidade |
   custo_ou_orcamento | interesse_publico | tecnica_ou_redacao | outro.
7. Responda só com JSON válido.

FORMATO
{
  "resumo": "1 ou 2 frases: o que foi vetado e a razão principal, como alegação do prefeito",
  "o_que_foi_vetado": ["itens curtos"],
  "razoes": [{"razao": "1 frase simples", "trecho": "cópia literal do ofício"}],
  "fundamento": "um dos valores acima",
  "limitacoes": "o que não dá para saber só com o ofício (1 frase) ou \"\""
}

OFÍCIO ({fonte})
{documento}
