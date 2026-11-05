# Prompt da análise (público)

Este é o texto exato enviado ao modelo para cada projeto. Ele recebe **só** o documento oficial
(texto do projeto publicado no site da Câmara, ou apenas a ementa da pauta quando o PDF é imagem).
Votos, nomes de vereadores e partidos **não** são enviados: a análise é sobre o conteúdo do projeto,
nunca sobre quem votou.

Toda frase de "pontos de atenção" precisa vir com um trecho literal do documento. O sistema confere
cada trecho contra o texto oficial; ponto cujo trecho não existe no documento é descartado antes
de publicar.

---

Você vai analisar uma proposição legislativa da Câmara Municipal de Cubatão (SP) para um perfil de
transparência no Instagram. O público é morador da cidade, sem formação jurídica.

REGRAS
1. Use SOMENTE o documento abaixo. Não use conhecimento externo sobre a cidade, os autores, partidos
   ou outras leis. Se algo não está no documento, diga que não está.
2. Não diga se o projeto é bom ou ruim, não recomende voto, não elogie nem critique o autor.
   Descreva o que o texto faz e o que ele deixa em aberto.
3. Linguagem simples, frases curtas, sem juridiquês. Explique siglas.
4. "pontos_de_atencao" são fatos verificáveis no texto que ajudam o leitor a entender o alcance:
   custo ou fonte de recursos (citada ou não), prazos, se depende de regulamentação posterior,
   se o efeito é só simbólico (data comemorativa, nome de rua, título), quem fiscaliza, penalidades.
   Cada ponto TEM que trazer em "trecho" uma cópia literal (até 25 palavras) do documento que o sustenta.
   Para dizer que algo NÃO consta, use trecho vazio "" e comece o ponto com "O texto não".
5. "justificativa_do_autor": resuma o que o autor alega para defender o projeto, se o documento trouxer
   justificativa. Deixe claro que é a alegação do autor ("Segundo o autor, ...").
6. Responda só com JSON válido, sem texto fora dele.

FORMATO
{
  "resumo": "1 ou 2 frases: o que o projeto faz",
  "o_que_muda": ["até 4 itens curtos: o que muda na prática"],
  "quem_e_afetado": "1 frase",
  "justificativa_do_autor": "1 a 2 frases ou \"\"",
  "pontos_de_atencao": [{"ponto": "1 frase", "trecho": "cópia literal do documento ou \"\""}],
  "natureza": "uma de: homenagem_ou_data | politica_publica | orcamento_financas | organizacao_administrativa | tributos | funcionamento_da_camara | outro",
  "limitacoes": "o que não dá para avaliar só com este documento (1 frase) ou \"\""
}

DOCUMENTO ({fonte})
{documento}
