import { Link, useParams } from "react-router-dom";
import { useAnalise, useDados } from "../dados";
import { Grade, NotaFonte, Placar, ResultadoTag, Situacao } from "../componentes";
import { dataCurta, dataExtenso, useTitulo } from "../util";
import { Destaque, EtapaComDica } from "../explica";
import NaoEncontrado from "./NaoEncontrado";
import BlocoVeto from "../veto";

export default function ProjetoPagina() {
  const { slug = "" } = useParams();
  const b = useDados();
  const m = b.materia.get(slug);
  useTitulo(m ? m.titulo : "Projeto não encontrado");
  const a = useAnalise(slug, !!m?.analise);
  if (!m) return <NaoEncontrado />;
  const eventos = m.eventos.map(b.votacao);
  const autores = m.autores.map((s) => b.vereador.get(s)!).filter(Boolean);

  return (
    <div className="pagina">
      <p className="migalha"><Link to="/projetos">Projetos</Link></p>
      <header className="cabeca-projeto">
        <p className="cabeca-projeto__tipo">{m.tipo_nome}</p>
        <h1 className="titulo-pagina">{m.titulo}</h1>
        <p className="cabeca-projeto__selos"><Situacao m={m} /> <Destaque m={m} /></p>
        {m.assunto && <p className="lead">{m.assunto}</p>}
      </header>

      {m.explicacao && !m.analise && (
        <aside className="em-poucas" aria-label="Em palavras simples">
          <p className="em-poucas__titulo">Em palavras simples</p>
          <p className="em-poucas__texto">{m.explicacao.texto}</p>
          <p className="em-poucas__fonte">Texto de IA ({m.explicacao.modelo}) feito só com {m.explicacao.base}. Pode simplificar demais: o texto oficial vale.</p>
        </aside>
      )}
      {m.relevancia.nivel !== "baixa" && (
        <aside className={`por-que por-que--${m.relevancia.nivel}`} aria-label="Por que este projeto merece atenção">
          <p className="por-que__titulo">{m.relevancia.nivel === "alta" ? "Por que este projeto merece atenção" : "O que observar"}</p>
          <ul>{m.relevancia.motivos.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="por-que__fonte">Critérios fixos e públicos (veja <Link to="/como-funciona">Como funciona</Link>). Não diz se o projeto é bom ou ruim.</p>
        </aside>
      )}

      <dl className="ficha">
        <div><dt>Autoria</dt><dd>
          {autores.length ? autores.map((v, i) => <span key={v.slug}>{i > 0 && ", "}<Link to={`/vereadores/${v.slug}`}>{v.exibicao}</Link></span>) : m.autoria}
        </dd></div>
        {m.pautas.length > 0 && <div><dt>Na pauta em</dt><dd>{m.pautas.map((p) => dataCurta(p, true)).join(", ")}</dd></div>}
        {m.documento && <div><dt>Texto original</dt><dd><a href={m.documento} rel="noopener">PDF no site da Câmara</a></dd></div>}
        {m.lei && <div><dt>Lei</dt><dd>Lei {m.lei.numero}, publicada no Diário Oficial em {dataExtenso(m.lei.data)}{m.lei.url && <> (<a href={m.lei.url} rel="noopener">ver publicação</a>)</>}</dd></div>}
        {m.veto && <div><dt>Veto</dt><dd>Veto {m.veto.alcance} do prefeito{m.veto.url && <> (<a href={m.veto.url} rel="noopener">ver ofício</a>)</>}. {m.veto.resultado === "veto_mantido" ? <>A Câmara manteve o veto{m.veto.data ? ` em ${dataExtenso(m.veto.data)}` : ""}.</> : m.veto.resultado === "veto_derrubado" ? <>A Câmara derrubou o veto{m.veto.data ? ` em ${dataExtenso(m.veto.data)}` : ""}.</> : <>A Câmara ainda não votou o veto.</>}{m.veto.pagina && <> <Link to={`/projetos/${m.veto.pagina}`}>Ver a votação do veto</Link>.</>}</dd></div>}
      </dl>

      {m.veto && <BlocoVeto m={m} />}

      {eventos.length > 0 && (
        <section aria-labelledby="votacoes">
          <h2 id="votacoes" className="secao__titulo">Votações</h2>
          <ol className="linha-tempo">
            {eventos.map((ev) => (
              <li key={ev.id} className="linha-tempo__item">
                <p className="linha-tempo__quando"><Link to={`/sessoes/${ev.data}`}>{dataExtenso(ev.data)}</Link></p>
                <h3 className="linha-tempo__etapa"><EtapaComDica ev={ev} tipo={m.tipo} /></h3>
                {ev.sentido === "inverso" && <p className="aviso-voto">Nesta votação, votar <strong>Sim</strong> era ser contra o projeto seguir, e votar <strong>Não</strong> era ser a favor.</p>}
                {ev.sentido === "emenda" && <p className="aviso-voto">Esta votação é sobre uma mudança no texto (emenda), não sobre o projeto inteiro.</p>}
                <p className="linha-tempo__res">
                  <ResultadoTag r={ev.resultado} /> <Placar ev={ev} grande={Object.keys(ev.votos).length > 0} />
                  {ev.detalhe && <span className="linha-tempo__detalhe">{ev.detalhe[0] + ev.detalhe.slice(1).toLowerCase()}</span>}
                </p>
                <Grade ev={ev} />
                {ev.fonte && <NotaFonte ev={ev} />}
              </li>
            ))}
          </ol>
        </section>
      )}

      {m.divergencias.length > 0 && (
        <section aria-labelledby="diverg">
          <h2 id="diverg" className="secao__titulo">Painel e resumo oficial não batem</h2>
          <p>O voto mostrado no painel eletrônico durante a transmissão é diferente do que o resumo oficial da sessão registra nestes casos:</p>
          <ul className="lista-simples">
            {m.divergencias.map((d, i) => (
              <li key={i}>
                {d.etapa}, {dataCurta(d.data)}: {d.vereador ? <Link to={`/vereadores/${d.vereador}`}>{d.vereador_txt}</Link> : d.vereador_txt} aparece no painel como{" "}
                <strong>{d.painel === "nao votou" ? "não votou" : d.painel === "ausente" ? "ausente" : d.painel === "SIM" ? "sim" : "não"}</strong> e no resumo como{" "}
                <strong>{d.resumo === "SIM" ? "favorável" : "contrário"}</strong>.
              </li>
            ))}
          </ul>
        </section>
      )}

      {a && (
        <section className="analise" aria-labelledby="entenda">
          <h2 id="entenda" className="secao__titulo">Entenda o projeto</h2>
          <p className="analise__aviso">
            Texto gerado por inteligência artificial ({a.modelo}) lendo só o {a.fonte}. Não avalia vereadores nem recomenda voto.{" "}
            <Link to="/como-funciona">Como funciona</Link>.
          </p>
          <p className="analise__resumo">{a.resumo}</p>
          {a.o_que_muda.length > 0 && <><h3>O que muda</h3><ul className="lista-simples">{a.o_que_muda.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {a.quem_e_afetado && <><h3>Quem é afetado</h3><p>{a.quem_e_afetado}</p></>}
          {a.pontos_de_atencao.length > 0 && (
            <>
              <h3>Pontos de atenção</h3>
              <ul className="lista-simples">
                {a.pontos_de_atencao.map((p, i) => (
                  <li key={i}>{p.ponto}{p.trecho && <blockquote className="trecho">“{p.trecho}”</blockquote>}</li>
                ))}
              </ul>
            </>
          )}
          {a.justificativa_do_autor && <><h3>O que diz o autor</h3><p>{a.justificativa_do_autor}</p></>}
          {a.limitacoes && <p className="nota">{a.limitacoes}</p>}
        </section>
      )}
    </div>
  );
}
