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
<p>A inteligência artificial é usada em três pontos, sempre com conferência:</p>
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

<h2>Explicações ao passar o mouse</h2>
<p>Ao passar o mouse (ou tocar no “i”) sobre um projeto aparece uma explicação curta em palavras simples. Quando o texto integral do projeto está disponível, ela vem da análise conferida com o texto; nos outros casos, é a ementa oficial reescrita por inteligência artificial (Gemini), sem acrescentar nada. Ao passar o mouse sobre uma etapa (parecer, 1ª discussão, emenda…) aparece o que ela significa, inclusive quando votar “sim” quer dizer ser contra o projeto.</p>

<h2>Limites</h2>
<ul className="lista-simples">
  <li>Votações simbólicas, sem painel, não têm registro nominal.</li>
  <li>Antes de setembro de 2026 não há registro de quem estava presente e não votou.</li>
  <li>Projetos em PDF escaneado podem ficar sem autoria identificada até serem transcritos.</li>
  <li>O Diário Oficial é consultado para os últimos 45 dias a cada atualização.</li>
</ul>

<h2>Código</h2>
<p>Todo o código e todos os dados coletados ficam num repositório público: <a href={meta.repo} rel="noopener noreferrer">{meta.repo.replace("https://", "")}</a>. Se encontrar um erro, abra um aviso por lá.</p>
</div>
    </div>
  );
}
