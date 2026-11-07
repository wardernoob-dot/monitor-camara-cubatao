import { useDados } from "../dados";
import { useTitulo } from "../util";
import { Secao } from "../secao";
import { Termo } from "../explica";

export default function ComoFunciona() {
  useTitulo("Como funciona");
  const { meta } = useDados();
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Como funciona</h1>
      <div className="texto">
<p className="lead">Este site lê todos os dias os documentos públicos da Câmara Municipal de {meta.cidade} e organiza o que foi votado, quem votou como e o que aconteceu com cada projeto depois. Ninguém escolhe à mão o que entra.</p>

<div className="sanfonas">
<Secao id="de-onde-vem-os-dados" titulo="De onde vêm os dados">
<dl className="fontes">
  <dt>Painel de votação na transmissão</dt>
  <dd>Durante cada votação a TV Câmara mostra o <Termo chave="painel">painel eletrônico</Termo> com a foto de cada vereador: moldura verde para sim, vermelha para não, branca para quem está presente e não votou, foto apagada para quem está ausente. O sistema lê esse painel nas imagens de prévia do vídeo publicado no YouTube, sem baixar o vídeo. É a fonte dos votos individuais a partir de setembro de 2026. Cada voto tem link para o momento exato da transmissão.</dd>
  <dt>Pauta da sessão</dt>
  <dd>Publicada na véspera. Diz o que vai ser votado, quem é o autor e qual é o assunto. Serve também para conferir a leitura do painel: um número de projeto lido no painel só é aceito se estiver na pauta daquele dia.</dd>
  <dt>Resumo oficial da sessão</dt>
  <dd>Publicado pela Câmara cerca de duas semanas depois. Registra presença, resultado e os nomes de quem votou a favor e contra. É a fonte dos votos de fevereiro a agosto.</dd>
  <dt>Texto dos projetos</dt>
  <dd>PDFs publicados no site da Câmara. Quando o PDF é uma imagem escaneada, o texto é transcrito automaticamente.</dd>
  <dt>Diário Oficial do Município</dt>
  <dd>Mostra quando um projeto aprovado vira lei.</dd>
</dl>
</Secao>
<Secao id="quando-as-fontes-nao-batem" titulo="Quando as fontes não batem">
<p>O <Termo chave="resumo">resumo oficial</Termo> costuma listar como favoráveis todos os vereadores presentes numa votação sem votos contrários, inclusive quem aparece no painel sem ter votado. Em pelo menos um caso o painel mostra um voto contrário que o resumo registra como favorável. O site mostra as duas versões lado a lado, sem tirar conclusão, na página de cada projeto.</p>
</Secao>
<Secao id="ia" titulo="Uso de inteligência artificial">
<p>A inteligência artificial é usada nestes pontos, sempre com conferência:</p>
<ul className="lista-simples">
  <li>Ler o texto miúdo no topo do painel, que diz qual projeto está em votação. O número lido é conferido contra a pauta do dia.</li>
  <li>Transcrever PDFs escaneados de projetos.</li>
  <li>Escrever a seção “Entenda o projeto”. O modelo recebe só o texto do projeto, sem votos, nomes de vereadores ou partidos. Cada ponto de atenção precisa citar um trecho literal do projeto, e o sistema confere se esse trecho existe; se não existir, o ponto é descartado. As instruções enviadas ao modelo são públicas: <a href={`${meta.repo}/blob/main/prompts/analise.md`} rel="noopener noreferrer">leia o texto completo</a>.</li>
</ul>
<p>Os votos individuais nunca passam por inteligência artificial: são lidos pela cor de cada moldura no painel.</p>
</Secao>
<Secao id="destaque" titulo="Projetos em destaque">
<p>O selo “Atenção” segue regras fixas, aplicadas igual a todos os projetos. Ele não diz se o projeto é bom ou ruim, só que vale a pena olhar com cuidado. Um projeto recebe o selo quando:</p>
<ul className="lista-simples">
  <li>mexe no orçamento, em impostos, em empréstimos ou nas finanças da cidade;</li>
  <li>mexe com servidores ou com a estrutura da Prefeitura;</li>
  <li>muda a Lei Orgânica, a lei mais importante do município;</li>
  <li>foi vetado pelo prefeito;</li>
  <li>foi rejeitado pela Câmara ou teve votação dividida, com 3 ou mais votos contrários.</li>
</ul>
<p>O tema de cada projeto (saúde, educação, homenagens etc.) é identificado por palavras da <Termo chave="ementa">ementa</Termo> oficial.</p>
</Secao>
<Secao id="indice" titulo="Índice de Atuação Parlamentar">
<p>Nota de 0 a 10 que resume atividade registrada em documento público. Não mede qualidade, mérito das ideias nem trabalho que não deixa registro (atendimento, articulação, bairro). Serve para comparar e para abrir perguntas, não para dizer quem é bom vereador. A conta completa de cada um fica aberta na página do vereador.</p>
<ul className="lista-simples">
  <li><strong>Assiduidade (25 pontos).</strong> Presença nas sessões (15): presença conta 1, falta justificada desconta 0,5 e falta sem justificativa desconta 1,5. Estar no plenário na hora de votar (10): só votações do painel, desde setembro de 2026.</li>
  <li><strong>Participação nas votações (25 pontos).</strong> Quando estava presente, votou sim ou não (15)? E nos projetos em destaque (10)? Só painel, porque o resumo oficial não registra quem estava presente sem votar. Quem está na cadeira da presidência conduz a votação e não vota, então essas votações saem da conta de quem presidiu. Por padrão quem preside é o presidente; quando ele está ausente ou votou e o vice aparece presente sem votar, o site considera que o vice presidia. É uma dedução pelo painel, não um registro oficial. Se sobrarem menos de 10 votações fora da presidência, o pilar não conta e o peso é redistribuído.</li>
  <li><strong>Produção legislativa (35 pontos).</strong> Projetos apresentados (15), aprovados (10) e que viraram lei ou tiveram veto derrubado (10). Cada projeto tem um peso conforme o impacto: <em>simbólico</em> 0,2 (nome de rua ou prédio, data comemorativa, calendário, título, utilidade pública); <em>autorizativo ou campanha</em> 0,5 (só autoriza o Executivo, sem obrigar, ou cria campanha de conscientização); <em>normativo</em> 1 (cria direito, obrigação ou proibição, ou muda lei em vigor); <em>estrutural</em> 1,5 (Lei Orgânica, tributo, orçamento, código municipal). A faixa sai de regras fixas sobre a ementa e o texto do projeto, e aparece na página de cada projeto. Projeto com vários autores divide o crédito por √(número de autores).</li>
  <li><strong>Fiscalização e plenário (15 pontos).</strong> Requerimentos aprovados (10), com peso 1 para comissão de inquérito, de acompanhamento ou pedido de informações; 0,5 para pedido de providência ou estudo ao Executivo; 0,2 para procedimento interno (urgência, prorrogação, sessão) e comissão para organizar evento. Emendas e relatórios de comissão votados com autoria no painel (5).</li>
</ul>
<p>Em produção e fiscalização conta a <strong>raiz quadrada</strong> da soma ponderada, para que volume não valha mais que impacto: dez projetos simbólicos não passam dois normativos aprovados. A raiz é comparada com a média dos 3 maiores da Câmara, com teto na pontuação cheia, para que um único caso fora da curva não achate todo mundo. A referência usa só titulares em exercício com pelo menos 10 sessões. Quem tem menos sessões ou não pegou o período do painel recebe o selo “Amostra parcial”.</p>
<p>A nota final é 10 × pontos obtidos ÷ pontos possíveis. Item que não se aplica sai da conta em vez de valer zero.</p>
</Secao>
<Secao id="partidos" titulo="Partidos e posição da Prefeitura">
<p>O partido de cada vereador vem do resumo oficial da sessão ou da assinatura nos projetos. Quando nenhum documento da Câmara diz o partido, vale o partido pelo qual a pessoa foi eleita em 2024 (dados do TSE), com a fonte indicada na página do vereador. Troca de partido depois da eleição só aparece quando estiver num documento oficial.</p>
<p><strong>Posição da Prefeitura.</strong> Conta só as votações em que a Prefeitura tem lado claro: projetos enviados pelo prefeito (a favor é votar pela aprovação; no <Termo chave="parecer">parecer</Termo> contrário, votar contra o parecer) e <Termo chave="veto">vetos</Termo> do prefeito (a favor é votar por manter o veto). Emendas e projetos de vereadores ficam de fora. Votar contra não é bom nem ruim: o número mostra com que frequência cada vereador e cada bancada acompanha o Executivo.</p>
<p><strong>Bancada unida.</strong> Em cada votação em que dois ou mais vereadores do mesmo partido votaram sim ou não, conta quantos acompanharam a maioria do partido. A média dessas votações é a porcentagem mostrada.</p>
<p>Até agosto de 2026 os votos vêm do resumo oficial, que costuma registrar como favorável quem estava presente sem votar; por isso os números desse período tendem a mostrar mais concordância do que houve de fato.</p>
</Secao>
<Secao id="vetos" titulo="Vetos do prefeito">
<p>Quando o prefeito veta um projeto, ele manda à Câmara um ofício explicando por quê. O site localiza esse ofício nas pastas de projetos da Câmara (pelo número do projeto no título, no texto ou, se faltar, pela ementa), transcreve quando o PDF é escaneado e gera um resumo com inteligência artificial: o que foi vetado, as razões alegadas e o tipo de fundamento. Cada razão precisa citar um trecho literal do ofício, conferido automaticamente; o resumo descreve a posição do prefeito sem dizer se ele tem razão. <a href={`${meta.repo}/blob/main/prompts/veto.md`} rel="noopener noreferrer">Instruções enviadas ao modelo</a>.</p>
</Secao>
<Secao id="explicacoes-ao-passar-o-mouse" titulo="Explicações ao passar o mouse">
<p>Ao passar o mouse (ou tocar no “i”) sobre um projeto aparece uma explicação curta em palavras simples. Quando o texto integral do projeto está disponível, ela vem da análise conferida com o texto; nos outros casos, é a ementa oficial reescrita por inteligência artificial (Gemini), sem acrescentar nada. Ao passar o mouse sobre uma etapa (parecer, 1ª discussão, emenda…) aparece o que ela significa, inclusive quando votar “sim” quer dizer ser contra o projeto. Termos como veto, parecer ou Diário Oficial, quando aparecem com sublinhado pontilhado no texto, também explicam o que significam.</p>
</Secao>
<Secao id="perguntar-a-ia" titulo="Perguntar à IA">
<p>O botão “Perguntar” não responde nada dentro do site. Ele abre um assistente externo (Claude ou ChatGPT) com a sua pergunta e instruções para ler só os dados abertos deste site e citar a fonte de cada voto. O Voto a voto não recebe a pergunta nem a resposta. A resposta de uma IA não é fonte de voto e pode errar: confira sempre na página do projeto, que mostra de onde veio cada voto.</p>
</Secao>
<Secao id="limites" titulo="Limites">
<ul className="lista-simples">
  <li>Votações simbólicas, sem painel, não têm registro nominal.</li>
  <li>Antes de setembro de 2026 não há registro de quem estava presente e não votou.</li>
  <li>Projetos em PDF escaneado podem ficar sem autoria identificada até serem transcritos.</li>
  <li>O <Termo chave="diario">Diário Oficial</Termo> é consultado desde o início do ano a cada atualização; leis publicadas antes disso podem não aparecer.</li>
</ul>
</Secao>
<Secao id="codigo" titulo="Código">
<p>Todo o código e todos os dados coletados ficam num repositório público: <a href={meta.repo} rel="noopener noreferrer">{meta.repo.replace("https://", "")}</a>. Se encontrar um erro, abra um aviso por lá.</p>
</Secao>
</div>
</div>
    </div>
  );
}
