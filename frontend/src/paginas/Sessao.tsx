import { Link, useParams } from "react-router-dom";
import { useDados } from "../dados";
import { Grade, LinkMateria, NotaFonte, Placar, ResultadoTag } from "../componentes";
import { dataExtenso, nomeSessao, useTitulo } from "../util";
import { Destaque, DicaMateria, EtapaComDica } from "../explica";
import NaoEncontrado from "./NaoEncontrado";

export default function SessaoPagina() {
  const { data = "" } = useParams();
  const b = useDados();
  const d = b.dias.find((x) => x.data === data);
  useTitulo(d ? `Sessão de ${dataExtenso(d.data)}` : "Sessão não encontrada");
  if (!d) return <NaoEncontrado />;

  return (
    <div className="pagina">
      <p className="migalha"><Link to="/sessoes">Sessões</Link></p>
      <h1 className="titulo-pagina">{dataExtenso(d.data)}</h1>
      <p className="lead">
        {d.sessoes.map((s, i) => (
          <span key={i}>
            {i > 0 && "; "}{s.numero}ª sessão {nomeSessao(s.tipo)}{s.inicio && `, das ${s.inicio} às ${s.fim}`}
            {s.resumo && <> (<a href={s.resumo} rel="noopener">resumo oficial</a>)</>}
          </span>
        ))}.
      </p>
      {d.status === "provisorio_painel" && <p className="nota">O resumo oficial desta sessão ainda não foi publicado. Os dados abaixo vêm do painel exibido na transmissão.</p>}

      {d.materias.map((s) => {
        const m = b.materia.get(s);
        if (!m) return null;
        const evs = m.eventos.map(b.votacao).filter((e) => e.data === d.data);
        return (
          <section key={s} className="item-sessao">
            <h2 className="item-sessao__titulo"><DicaMateria m={m}><LinkMateria slug={s} /></DicaMateria> <Destaque m={m} compacto /></h2>
            {m.autoria !== "Autoria não identificada" && <p className="item-sessao__autor">{m.autoria}</p>}
            {m.assunto && <p>{m.assunto}</p>}
            {evs.map((ev) => (
              <div key={ev.id} className="item-sessao__votacao">
                <h3 className="linha-tempo__etapa"><EtapaComDica ev={ev} tipo={m.tipo} /></h3>
                {ev.sentido === "inverso" && <p className="aviso-voto">Nesta votação, votar <strong>Sim</strong> era ser contra o projeto seguir.</p>}
                <p><ResultadoTag r={ev.resultado} /> {Object.keys(ev.votos).length > 0 && <Placar ev={ev} />}</p>
                <Grade ev={ev} />
                {ev.fonte && <NotaFonte ev={ev} />}
              </div>
            ))}
          </section>
        );
      })}

      {d.noticias.length > 0 && (
        <>
          <h2 className="secao__titulo">Notícias da Câmara sobre o dia</h2>
          <ul className="lista-simples">{d.noticias.map((n) => <li key={n.url}><a href={n.url} rel="noopener">{n.titulo}</a></li>)}</ul>
        </>
      )}
    </div>
  );
}
