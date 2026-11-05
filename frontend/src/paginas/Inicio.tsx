import { Fragment, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useDados, type Votacao } from "../dados";
import { Celula, Legenda, LinkMateria } from "../componentes";
import { corta, dataCurta, dataExtenso, useTitulo } from "../util";

const COLUNAS = 80;

export default function Inicio() {
  useTitulo("Como cada vereador votou");
  const b = useDados();
  const colunas = useMemo(() => b.votacoes.filter((v) => v.fonte === "painel").slice(-COLUNAS), [b]);
  const grupos = useMemo(() => {
    const g: { data: string; n: number }[] = [];
    colunas.forEach((c) => (g.length && g[g.length - 1].data === c.data ? g[g.length - 1].n++ : g.push({ data: c.data, n: 1 })));
    return g;
  }, [colunas]);
  const presidente = b.atuais.find((v) => v.cargo === "presidente");
  const leis = b.materias.filter((m) => m.lei && m.lista).slice(0, 6);
  const dias = b.dias.slice(0, 6);
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // em tela estreita a grade nao cabe: comeca mostrando as votacoes mais recentes
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [colunas]);

  return (
    <div className="pagina pagina--larga">
      <section className="abertura">
        <h1 className="abertura__titulo">Como cada vereador de {b.meta.cidade} votou</h1>
        <p className="abertura__texto">
          Cada quadrado é um voto registrado no painel eletrônico da Câmara, sessão por sessão
          {colunas.length ? `, desde ${dataExtenso(colunas[0].data)}` : ""}. Passe o mouse ou toque para ver o projeto; clique para abrir.
        </p>
      </section>

      <section className="mx-bloco" aria-labelledby="mx-titulo">
        <h2 id="mx-titulo" className="sr">Votos de cada vereador nas últimas {colunas.length} votações</h2>
        <div className="mx-rolagem" ref={rolagem} tabIndex={0} aria-label="Tabela de votos, role para os lados">
          <table className="mx">
            <thead>
              <tr>
                <th scope="col" className="mx__canto">Vereador</th>
                {grupos.map((g) => (
                  <th key={g.data} scope="colgroup" colSpan={g.n} className="mx__data">{dataCurta(g.data)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.atuais.map((v) => (
                <tr key={v.slug}>
                  <th scope="row" className="mx__nome">
                    <Link to={`/vereadores/${v.slug}`}>{v.exibicao}</Link>
                    {v.cargo === "presidente" && <sup className="mx__cargo"><a href="#nota-presidente" onClick={(e) => { e.preventDefault(); document.getElementById("nota-presidente")?.scrollIntoView(); }} aria-label="Nota sobre a presidência">*</a></sup>}
                  </th>
                  {colunas.map((ev: Votacao, i) => (
                    <td key={ev.id} className={i === 0 || ev.data !== colunas[i - 1].data ? "mx__novo-dia" : undefined}>
                      <Celula ev={ev} voto={ev.votos[v.slug]} nome={v.exibicao} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legenda />
        {presidente && (
          <p className="nota mx__nota" id="nota-presidente">
            * {presidente.exibicao} é o presidente da Câmara e conduz as sessões. O Regimento Interno define em que casos o presidente vota.
          </p>
        )}
      </section>

      <div className="duas-colunas">
        <section aria-labelledby="ultimas">
          <h2 id="ultimas" className="secao__titulo">Últimas sessões</h2>
          <ol className="lista-sessoes">
            {dias.map((d) => {
              const principais = d.materias.map((s) => b.materia.get(s)!).filter((m) => m && !["RQ", "MOCAO", "RELATORIO"].includes(m.tipo));
              return (
                <li key={d.data}>
                  <Link className="lista-sessoes__data" to={`/sessoes/${d.data}`}>{dataExtenso(d.data)}</Link>
                  <ul className="lista-sessoes__itens">
                    {principais.length ? principais.map((m) => {
                      const evs = m.eventos.map(b.votacao).filter((e) => e.data === d.data);
                      const ev = evs[evs.length - 1];
                      return (
                        <li key={m.slug}>
                          <LinkMateria slug={m.slug} />
                          {ev && (
                            <span className="lista-sessoes__res">
                              {" "}{ev.resultado === "APROVADO" ? "aprovado" : ev.resultado === "REJEITADO" ? "rejeitado" : ""}
                              {ev.sim != null && Object.keys(ev.votos).length ? ` ${ev.sim} a ${ev.nao}` : ""}
                            </span>
                          )}
                          <br />
                          <span className="lista-sessoes__assunto">{corta(m.assunto, 110)}</span>
                        </li>
                      );
                    }) : <li className="lista-sessoes__assunto">Só requerimentos e moções.</li>}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p><Link to="/sessoes">Todas as sessões</Link></p>
        </section>

        <section aria-labelledby="leis">
          <h2 id="leis" className="secao__titulo">Viraram lei</h2>
          <ul className="lista-leis">
            {leis.length ? leis.map((m) => (
              <li key={m.slug}>
                <span className="lista-leis__num">Lei {m.lei!.numero}</span>
                <Fragment>
                  <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link>, {m.autoria}
                </Fragment>
                <p>{corta(m.assunto, 140)}</p>
              </li>
            )) : <li>Nenhuma lei sancionada encontrada no Diário Oficial no período coletado.</li>}
          </ul>
          <p><Link to="/projetos">Todos os projetos</Link></p>
        </section>
      </div>
    </div>
  );
}
