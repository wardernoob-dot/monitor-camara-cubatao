import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Toc } from "../toc";
import { useDados } from "../dados";
import { AvisoVeto, Grade, LinkMateria, NotaFonte, Placar, ResultadoVotacao } from "../componentes";
import { dataExtenso, nomeSessao, useTitulo } from "../util";
import { Destaque, DicaMateria, EtapaComDica, Termo } from "../explica";
import NaoEncontrado from "./NaoEncontrado";

export default function SessaoPagina() {
  const { data = "" } = useParams();
  const b = useDados();
  const d = b.dias.find((x) => x.data === data);
  const toc = useMemo(() => (d ? d.materias.map((s) => [s, b.materia.get(s)?.titulo ?? s] as const) : []), [d, b]);
  const resultados = useMemo(() => {
    const evs = d ? d.materias.flatMap((s) => (b.materia.get(s)?.eventos ?? []).map(b.votacao).filter((e) => e.data === d.data)) : [];
    return { votacoes: evs.length, aprovadas: evs.filter((e) => e.resultado === "APROVADO").length, rejeitadas: evs.filter((e) => e.resultado === "REJEITADO").length };
  }, [d, b]);
  useTitulo(d ? `Sessão de ${dataExtenso(d.data)}` : "Sessão não encontrada");
  if (!d) return <NaoEncontrado />;

  return (
    <div className="pagina">
      <p className="migalha"><Link to="/sessoes">Sessões</Link></p>
      <p className="selo-pagina">Sessão</p>
      <h1 className="titulo-pagina">{dataExtenso(d.data)}</h1>
      <ul className="sessao-cab">
        {d.sessoes.map((s, i) => (
          <li key={i} className="sessao-cab__item">
            <strong>{s.numero}ª sessão {nomeSessao(s.tipo)}</strong>
            {s.inicio && <span className="sessao-cab__hora">{s.inicio} às {s.fim}</span>}
            {s.resumo && <a href={s.resumo} rel="noopener" className="sessao-cab__link">resumo oficial <span aria-hidden="true">↗</span></a>}
          </li>
        ))}
      </ul>
      <dl className="numeros sessao-nums">
        <div><dt>{d.materias.length === 1 ? "item votado" : "itens votados"}</dt><dd>{d.materias.length}</dd></div>
        <div><dt>{resultados.votacoes === 1 ? "votação registrada" : "votações registradas"}</dt><dd>{resultados.votacoes}</dd></div>
        <div><dt>aprovadas</dt><dd>{resultados.aprovadas}</dd></div>
        <div><dt>rejeitadas</dt><dd>{resultados.rejeitadas}</dd></div>
      </dl>
      {d.status === "provisorio_painel" && <p className="nota">O <Termo chave="resumo">resumo oficial</Termo> desta sessão ainda não foi publicado. Os dados abaixo vêm do <Termo chave="painel">painel</Termo> exibido na transmissão.</p>}

      <div className="com-toc">
      <div className="com-toc__corpo">
      {d.materias.map((s, idx) => {
        const m = b.materia.get(s);
        if (!m) return null;
        const evs = m.eventos.map(b.votacao).filter((e) => e.data === d.data);
        return (
          <section key={s} id={s} className="item-sessao">
            <p className="item-sessao__n">Item {String(idx + 1).padStart(2, "0")}</p>
            <h2 className="item-sessao__titulo"><DicaMateria m={m}><LinkMateria slug={s} /></DicaMateria> <Destaque m={m} compacto /></h2>
            {m.autoria !== "Autoria não identificada" && <p className="item-sessao__autor">{m.autoria}</p>}
            {m.assunto && <p>{m.assunto}</p>}
            {evs.map((ev) => (
              <div key={ev.id} className="item-sessao__votacao">
                <div className="votacao__cab">
                  <h3 className="linha-tempo__etapa"><EtapaComDica ev={ev} tipo={m.tipo} /></h3>
                  <span className="votacao__res"><ResultadoVotacao ev={ev} m={m} />{Object.keys(ev.votos).length > 0 && <Placar ev={ev} grande />}</span>
                </div>
                {ev.sentido === "inverso" && <p className="aviso-voto">Nesta votação, votar <strong>Sim</strong> era ser contra o projeto seguir.</p>}
                <AvisoVeto m={m} />
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
      <Toc itens={toc} caminho={`/sessoes/${d.data}`} />
      </div>
    </div>
  );
}
