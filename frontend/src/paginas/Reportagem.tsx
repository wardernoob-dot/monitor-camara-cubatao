import { Link, useParams } from "react-router-dom";
import { useDados } from "../dados";
import { Grade, NotaFonte } from "../componentes";
import { Autoria, CorpoReportagem, Foto, PlacarRostos, Prefeito, situacaoCurta, classeSituacao, votacaoDa } from "../reportagens";
import { dataCurta, dataExtenso, useTitulo } from "../util";
import NaoEncontrado from "./NaoEncontrado";

export default function ReportagemPagina() {
  const { id } = useParams();
  const b = useDados();
  const r = (b.reportagens ?? []).find((x) => x.id === id);
  useTitulo(r ? r.manchete : "Reportagem não encontrada");
  if (!r) return <NaoEncontrado />;
  const ev = votacaoDa(b, r);
  const projetos = r.projetos.map((s) => b.materia.get(s)).filter(Boolean) as NonNullable<ReturnType<typeof b.materia.get>>[];
  const principal = projetos[0];

  return (
    <article className="rp-pagina">
      <header className="rp-pagina__topo">
        <figure className="rp-pagina__figura">
          <Foto r={r} classe="rp-pagina__img" prioridade />
          <figcaption className="rp-pagina__credito">
            {r.foto.legenda && <span>{r.foto.legenda} </span>}
            <span>Foto{r.foto.ilustrativa ? " ilustrativa" : ""}: <a href={r.foto.link} rel="noopener">{r.foto.credito}</a> ({r.foto.licenca}).</span>
          </figcaption>
        </figure>
        <div className="pagina rp-pagina__cab">
          <nav className="migalha" aria-label="Você está em"><Link to="/">Início</Link> / Reportagens</nav>
          {r.status === "rascunho" && <p className="aviso-voto"><strong>Rascunho.</strong> Este texto ainda não foi aprovado e não aparece no site publicado.</p>}
          <p className="rp-pagina__topo-linha">
            {r.chapeu && <span className="rp__chapeu">{r.chapeu}</span>}
            {principal && <span className={`rp__sit rp__sit--${classeSituacao(principal)}`}>{situacaoCurta(principal)}</span>}
          </p>
          <h1 className="titulo-pagina rp-pagina__manchete">{r.manchete}</h1>
          <p className="rp-pagina__fina">{r.linha_fina}</p>
          {principal && <div className="rp-pagina__autor"><Autoria m={principal} /></div>}
          <p className="rp-pagina__data">Texto revisado em {dataExtenso(r.data)}. Situação, autoria e votos abaixo vêm direto dos documentos e são atualizados sozinhos.</p>
        </div>
      </header>

      <div className="pagina rp-pagina__grade">
        <aside className="rp-ficha" aria-label="Os fatos, direto dos documentos">
          <h2 className="rp-ficha__titulo">Em resumo</h2>
          {projetos.map((m) => (
            <div key={m.slug} className="rp-ficha__projeto">
              <Link to={`/projetos/${m.slug}`} className="rp-ficha__id">{m.titulo}</Link>
              <span className={`rp__sit rp__sit--${classeSituacao(m)}`}>{situacaoCurta(m)}</span>
              {m !== principal && m.autoria !== principal?.autoria && <Autoria m={m} />}
              {m.lei && <span className="rp-ficha__lei">Lei {m.lei.numero}, de {dataCurta(m.lei.data, true)}{m.lei.url && <> · <a href={m.lei.url} rel="noopener">Diário Oficial</a></>}</span>}
              <Prefeito m={m} />
            </div>
          ))}
          {ev && (
            <div className="rp-ficha__voto">
              <span className="rp-ficha__rot">Como votaram em {dataCurta(ev.data, true)} ({b.materia.get(ev.materia)?.titulo}, {ev.etapa_txt.toLowerCase()})</span>
              <PlacarRostos ev={ev} />
            </div>
          )}
        </aside>

        <div className="rp-pagina__texto">
          <CorpoReportagem r={r} />
          {ev && Object.keys(ev.votos).length > 0 && (
            <section className="rp-pagina__votos" aria-labelledby="rp-votos">
              <h2 id="rp-votos">Voto a voto: {b.materia.get(ev.materia)?.titulo}, {ev.etapa_txt.toLowerCase()}</h2>
              {ev.sentido === "inverso" && <p className="aviso-voto">Nesta votação, votar <strong>Sim</strong> era ser contra o projeto seguir, e votar <strong>Não</strong> era ser a favor.</p>}
              <Grade ev={ev} />
              <NotaFonte ev={ev} />
              <p><Link to={`/projetos/${ev.materia}`} className="link-seta">Ver todas as etapas do projeto <span aria-hidden="true">→</span></Link></p>
            </section>
          )}
          <p className="nota rp-pagina__nota">
            Texto da equipe do Voto a voto, escrito a partir dos documentos oficiais linkados acima. Não diz se o projeto é bom ou ruim.
            Achou um erro? <a href={`${b.meta.repo}/issues`} rel="noopener">Avise</a>.
          </p>
        </div>
      </div>
    </article>
  );
}
