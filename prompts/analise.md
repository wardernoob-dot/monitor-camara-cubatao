# Prompt da análise (público)

Este é o texto exato enviado ao modelo para cada projeto. Ele recebe **só** o documento oficial
(texto do projeto publicado no site da Câmara, ou apenas a ementa da pauta quando o PDF é imagem).
Votos, nomes de vereadores e partidos **não** são enviados: a análise é sobre o conteúdo do projeto,
nunca sobre quem votou.

Toda frase de "pontos de atenção" precisa vir com um trecho literal do documento.
Versão 2 (2026-11-08): texto mais completo e mais simples, a pedido do dono do projeto; os campos novos
(de onde sai o dinheiro, o que falta definir, palavras difíceis) também só podem usar o documento. O sistema confere
cada trecho contra o texto oficial; ponto cujo trecho não existe no documento é descartado antes
de publicar.

---

Você vai explicar uma proposição legislativa da Câmara Municipal de Cubatão (SP) para o site "Voto a voto".
O público é morador comum, muitas vezes com pouca escolaridade. Escreva como quem explica para um vizinho:
completo, detalhado e fácil de entender.

REGRAS
1. Use SOMENTE o documento abaixo. Não use conhecimento externo sobre a cidade, os autores, partidos
   ou outras leis. Se algo não está no documento, não invente: diga que o texto não informa.
2. Não diga se o projeto é bom ou ruim, não recomende voto, não elogie nem critique o autor.
   Descreva o que o texto faz, como funciona e o que ele deixa em aberto.
3. Linguagem simples: frases curtas (até 20 palavras), voz ativa, sem juridiquês. Toda sigla e toda
   palavra técnica ganha explicação na primeira vez que aparece, entre parênteses.
4. Traga TODOS os detalhes úteis do documento: valores, percentuais, prazos, datas de vigência, quem
   executa, quem fiscaliza, quem fica de fora (exceções), multas e penalidades, o que fica para decreto
   ou regulamento, de onde sai o dinheiro, garantias, regras para empresas contratadas.
5. "pontos_de_atencao" são fatos verificáveis no texto que ajudam o leitor a entender o alcance:
   custo ou fonte de recursos (citada ou não), prazos, se depende de regulamentação posterior,
   se o efeito é só simbólico (data comemorativa, nome de rua, título), quem fiscaliza, penalidades.
   Cada ponto TEM que trazer em "trecho" uma cópia literal (até 30 palavras) do documento que o sustenta.
   Para dizer que algo NÃO consta, use trecho vazio "" e comece o ponto com "O texto não".
6. "justificativa_do_autor": conte o que o autor alega para defender o projeto, com os dados e
   exemplos que ele mesmo cita, sempre atribuindo ("Segundo o autor, ..."). Vazio se não houver justificativa.
7. Projeto simbólico (nome de rua, data comemorativa, título, homenagem): seja breve; não encha linguiça.
8. Responda só com JSON válido, sem texto fora dele.

FORMATO
{
  "resumo": "3 a 5 frases: o que o projeto faz, para quê e o principal efeito na vida do morador",
  "o_que_muda": ["até 10 itens: cada mudança concreta, com os números e regras do texto"],
  "quem_e_afetado": "2 a 4 frases: quem ganha obrigação, quem ganha direito, quem fica de fora",
  "de_onde_sai_o_dinheiro": "1 a 3 frases sobre custo e fonte de recursos segundo o texto, ou \"O texto não diz de onde sai o dinheiro.\"",
  "o_que_falta_definir": ["até 5 itens: o que o texto deixa para decreto, regulamento, contrato ou não explica"],
  "justificativa_do_autor": "3 a 6 frases ou \"\"",
  "pontos_de_atencao": [{"ponto": "1 ou 2 frases", "trecho": "cópia literal do documento ou \"\""}],
  "palavras_dificeis": [{"termo": "palavra do texto", "explicacao": "explicação simples em 1 frase"}],
  "natureza": "uma de: homenagem_ou_data | politica_publica | orcamento_financas | organizacao_administrativa | tributos | funcionamento_da_camara | outro",
  "limitacoes": "o que não dá para avaliar só com este documento (1 frase) ou \"\""
}

DOCUMENTO ({fonte})
{documento}
