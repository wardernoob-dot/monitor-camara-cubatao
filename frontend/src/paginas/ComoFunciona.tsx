import { useDados } from "../dados";
import { useTitulo } from "../util";

export default function ComoFunciona() {
  useTitulo("Como funciona");
  const { meta } = useDados();
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Como funciona</h1>
      <div className="texto">
<p className="lead">Este site lê todos os dias os documentos públicos da Câmara Municipal de {meta.cidade} e organiza o que foi votado, quem votou como e o que aconteceu com cada projeto depois. Ninguém escolhe à mão o que entra.</p>

<h2>De onde vêm os dados</h2>
<dl className="fontes">
  <dt>Painel de votação na transmissão</dt>
  <dd>Durante cada votação a TV Câmara mostra o painel eletrônico com a foto de cada vereador: moldura verde para sim, vermelha para não, branca para quem está presente e não votou, foto apagada para quem está ausente. O sistema lê esse painel nas imagens de prévia do vídeo publicado no YouTube, sem baixar o vídeo. É a fonte dos votos individuais a partir de setembro de 2026. Cada voto tem link para o momento exato da transmissão.</dd>
  <dt>Pauta da sessão</dt>
  <dd>Publicada na véspera. Diz o que vai ser votado, quem é o autor e qual é o assunto. Serve também para conferir a leitura do painel: um número de projeto lido no painel só é aceito se estiver na pauta daquele dia.</dd>
  <dt>Resumo oficial da sessão</dt>
  <dd>Publicado pela Câmara cerca de duas semanas depois. Registra presença, resultado e os nomes de quem votou a favor e contra. É a fonte dos votos de fevereiro a agosto.</dd>
  <dt>Texto dos projetos</dt>
  <dd>PDFs publicados no site da Câmara. Quando o PDF é uma imagem escaneada, o texto é transcrito automaticamente.</dd>
  <dt>Diário Oficial do Município</dt>
  <dd>Mostra quando um projeto aprovado vira lei.</dd>
</dl>

<h2>Quando as fontes não batem</h2>
<p>O resumo oficial costuma listar como favoráveis todos os vereadores presentes numa votação sem votos contrários, inclusive quem aparece no painel sem ter votado. Em pelo menos um caso o painel mostra um voto contrário que o resumo registra como favorável. O site mostra as duas versões lado a lado, sem tirar conclusão, na página de cada projeto.</p>

<h2 id="ia">Uso de inteligência artificial</h2>
<p>A inteligência artificial é usada nestes pontos, sempre com conferência:</p>
<ul className="lista-simples">
  <li>Ler o texto miúdo no topo do painel, que diz qual projeto está em votação. O número lido é conferido contra a pauta do dia.</li>
  <li>Transcrever PDFs escaneados de projetos.</li>
  <li>Escrever a seção “Entenda o projeto”. O modelo recebe só o texto do projeto, sem votos, nomes de vereadores ou partidos. Cada ponto de atenção precisa citar um trecho literal do projeto, e o sistema confere se esse trecho existe; se não existir, o ponto é descartado. As instruções enviadas ao modelo são públicas: <a href={`${meta.repo}/blob/main/prompts/analise.md`} rel="noopener noreferrer">leia o texto completo</a>.</li>
</ul>
<p>Os votos individuais nunca passam por inteligência artificial: são lidos pela cor de cada moldura no painel.</p>

<h2 id="destaque">Projetos em destaque</h2>
<p>O selo “Atenção” segue regras fixas, aplicadas igual a todos os projetos. Ele não diz se o projeto é bom ou ruim, só que vale a pena olhar com cuidado. Um projeto recebe o selo quando:</p>
<ul className="lista-simples">
  <li>mexe no orçamento, em impostos, em empréstimos ou nas finanças da cidade;</li>
  <li>mexe com servidores ou com a estrutura da Prefeitura;</li>
  <li>muda a Lei Orgânica, a lei mais importante do município;</li>
  <li>foi vetado pelo prefeito;</li>
  <li>foi rejeitado pela Câmara ou teve votação dividida, com 3 ou mais votos contrários.</li>
</ul>
<p>O tema de cada projeto (saúde, educação, homenagens etc.) é identificado por palavras da ementa oficial.</p>

<h2 id="indice">Índice de Atuação Parlamentar</h2>
<p>Nota de 0 a 10 que resume atividade registrada em documento público. Não mede qualidade, mérito das ideias nem trabalho que não deixa registro (atendimento, articulação, bairro). Serve para comparar e para abrir perguntas, não para dizer quem é bom vereador. A conta completa de cada um fica aberta na página do vereador.</p>
<ul className="lista-simples">
  <li><strong>Assiduidade (25 pontos).</strong> Presença nas sessões (15): presença conta 1, falta justificada desconta 0,5 e falta sem justificativa desconta 1,5. Estar no plenário na hora de votar (10): só votações do painel, desde setembro de 2026.</li>
  <li><strong>Participação nas votações (25 pontos).</strong> Quando estava presente, votou sim ou não (15)? E nos projetos em destaque (10)? Só painel, porque o resumo oficial não registra quem estava presente sem votar. Quem preside a sessão conduz as votações e quase não vota no painel, então este pilar não conta para o presidente e o peso é redistribuído.</li>
  <li><strong>Produção legislativa (35 pontos).</strong> Projetos apresentados (15), aprovados (10) e que viraram lei ou tiveram veto derrubado (10). Homenagens (nome de rua, título, data comemorativa) valem 0,3. Projeto com vários autores divide o crédito por √(número de autores).</li>
  <li><strong>Fiscalização e plenário (15 pontos).</strong> Requerimentos aprovados (10), com pedidos de procedimento interno (urgência, prorrogação de prazo, sessão secreta, ato solene) e homenagens valendo 0,3. Emendas e relatórios de comissão votados com autoria no painel (5).</li>
</ul>
<p>Produção e fiscalização são comparadas com o maior valor da Câmara: quem tem o maior número leva a pontuação cheia e os outros proporcionalmente. A referência usa só titulares em exercício com pelo menos 10 sessões. Quem tem menos sessões ou não pegou o período do painel recebe o selo “Amostra parcial”.</p>
<p>A nota final é 10 × pontos obtidos ÷ pontos possíveis. Item que não se aplica sai da conta em vez de valer zero.</p>

<h2 id="vetos">Vetos do prefeito</h2>
<p>Quando o prefeito veta um projeto, ele manda à Câmara um ofício explicando por quê. O site localiza esse ofício nas pastas de projetos da Câmara (pelo número do projeto no título, no texto ou, se faltar, pela ementa), transcreve quando o PDF é escaneado e gera um resumo com inteligência artificial: o que foi vetado, as razões alegadas e o tipo de fundamento. Cada razão precisa citar um trecho literal do ofício, conferido automaticamente; o resumo descreve a posição do prefeito sem dizer se ele tem razão. <a href={`${meta.repo}/blob/main/prompts/veto.md`} rel="noopener noreferrer">Instruções enviadas ao modelo</a>.</p>

<h2>Explicações ao passar o mouse</h2>
<p>Ao passar o mouse (ou tocar no “i”) sobre um projeto aparece uma explicação curta em palavras simples. Quando o texto integral do projeto está disponível, ela vem da análise conferida com o texto; nos outros casos, é a ementa oficial reescrita por inteligência artificial (Gemini), sem acrescentar nada. Ao passar o mouse sobre uma etapa (parecer, 1ª discussão, emenda…) aparece o que ela significa, inclusive quando votar “sim” quer dizer ser contra o projeto.</p>

<h2>Limites</h2>
<ul className="lista-simples">
  <li>Votações simbólicas, sem painel, não têm registro nominal.</li>
  <li>Antes de setembro de 2026 não há registro de quem estava presente e não votou.</li>
  <li>Projetos em PDF escaneado podem ficar sem autoria identificada até serem transcritos.</li>
  <li>O Diário Oficial é consultado desde o início do ano a cada atualização; leis publicadas antes disso podem não aparecer.</li>
</ul>

<h2>Código</h2>
<p>Todo o código e todos os dados coletados ficam num repositório público: <a href={meta.repo} rel="noopener noreferrer">{meta.repo.replace("https://", "")}</a>. Se encontrar um erro, abra um aviso por lá.</p>
</div>
    </div>
  );
}
