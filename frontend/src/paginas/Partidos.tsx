import { Link, useParams } from "react-router-dom";
import { slugPartido, useDados, type Partido, type Vereador } from "../dados";
import { Avatar, LinkMateria, ResultadoTag, VotoTag } from "../componentes";
import { IndiceMini } from "../indice";
import { dataCurta, useTitulo } from "../util";
import NaoEncontrado from "./NaoEncontrado";

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : null);
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Medida({ valor, rotulo, nota }: { valor: string; rotulo: string; nota?: string }) {
  return (
    <div className="medida">
      <dt>{rotulo}</dt>
      <dd>{valor}{nota && <span className="medida__nota">{nota}</span>}</dd>
    </div>
  );
}

function BarraExecutivo({ com, contra }: { com: number; contra: number }) {
  const t = com + contra;
  if (!t) return <span className="nota">sem votos com posição da Prefeitura definida</span>;
  return (
    <span className="exec" title={`${com} com a Prefeitura, ${contra} contra`}>
      <span className="exec__trilho" aria-hidden="true">
        <span className="exec__com" style={{ width: `${(100 * com) / t}%` }} />
        <span className="exec__contra" style={{ width: `${(100 * contra) / t}%` }} />
      </span>
      <span className="exec__txt">{pct(com, t)}% com · {contra} contra</span>
    </span>
  );
}

export function ListaPartidos() {
  useTitulo("Partidos");
  const { partidos, vereador } = useDados();
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Partidos</h1>
      <p className="lead">Como cada bancada da Câmara vota e trabalha. Clique num partido para ver os vereadores e as votações em que a bancada se dividiu.</p>
      <ul className="partidos">
        {partidos.map((p) => {
          const membros = p.membros.map((s) => vereador.get(s)!).filter(Boolean);
          return (
            <li key={p.sigla} className="partido-card">
              <Link to={`/partidos/${slugPartido(p.sigla)}`} className="partido-card__sigla esticado">{p.sigla}</Link>
              <p className="partido-card__qtd">
                {p.em_exercicio.length} {p.em_exercicio.length === 1 ? "vereador em exercício" : "vereadores em exercício"}
                {p.membros.length > p.em_exercicio.length && `, mais ${p.membros.length - p.em_exercicio.length} que já exerceram em 2026`}
              </p>
              <span className="partido-card__rostos" aria-hidden="true">
                {membros.map((v) => <Avatar key={v.slug} v={v} tamanho="p" />)}
              </span>
              <dl className="partido-card__medidas">
                <Medida rotulo="Índice médio" valor={p.indice_medio != null ? `${fmt1(p.indice_medio)}` : "–"} />
                <Medida rotulo="Bancada unida" valor={p.coesao != null ? `${p.coesao}%` : "–"} nota={p.coesao == null ? "1 vereador" : undefined} />
                <Medida rotulo="Projetos / leis" valor={`${p.projetos} / ${p.leis}`} />
              </dl>
              <p className="partido-card__exec-rot">Votos na posição da Prefeitura</p>
              <BarraExecutivo com={p.executivo.com} contra={p.executivo.contra} />
            </li>
          );
        })}
      </ul>
      <aside className="rank__aviso">
        <p><strong>Como ler.</strong> “Posição da Prefeitura” conta só votações em que ela tem lado claro: projetos enviados pelo prefeito (votar pela aprovação) e vetos do prefeito (votar por manter o veto). Votar diferente não é bom nem ruim: mostra independência ou oposição, conforme o caso. “Bancada unida” é a parte dos votos que acompanhou a maioria do próprio partido, nas votações em que dois ou mais membros votaram.</p>
        <p>Até agosto de 2026 os votos vêm do resumo oficial, que costuma registrar como favorável quem estava presente. <Link to="/como-funciona#partidos">Como funciona</Link>.</p>
      </aside>
    </div>
  );
}

function LinhaMembro({ v }: { v: Vereador }) {
  const t = v.executivo.com + v.executivo.contra;
  return (
    <tr>
      <th scope="row"><span className="tabela__quem"><Avatar v={v} tamanho="p" /> <Link to={`/vereadores/${v.slug}`}>{v.exibicao}</Link>{!v.em_exercicio && <span className="selo-cinza">não está em exercício</span>}</span></th>
      <td className="tabela__num">{v.indice.parcial ? "–" : fmt1(v.indice.nota)}</td>
      <td className="tabela__num">{t ? `${pct(v.executivo.com, t)}%` : "–"}</td>
      <td className="tabela__num">{v.executivo.contra}</td>
      <td className="tabela__num">{v.projetos.length}</td>
      <td className="tabela__num">{v.leis}</td>
    </tr>
  );
}

export function PaginaPartido() {
  const { sigla = "" } = useParams();
  const b = useDados();
  const p: Partido | undefined = b.partido.get(sigla);
  useTitulo(p ? `Partido ${p.sigla}` : "Partido não encontrado");
  if (!p) return <NaoEncontrado />;
  const membros = p.membros.map((s) => b.vereador.get(s)!).filter(Boolean)
    .sort((a, c) => Number(c.em_exercicio) - Number(a.em_exercicio) || c.indice.nota - a.indice.nota);
  const rachas = p.rachas.map(b.votacao).reverse();
  const t = p.executivo.com + p.executivo.contra;

  return (
    <div className="pagina">
      <p className="migalha"><Link to="/partidos">Partidos</Link></p>
      <h1 className="titulo-pagina">{p.sigla}</h1>
      <p className="lead">
        {p.em_exercicio.length} {p.em_exercicio.length === 1 ? "vereador em exercício" : "vereadores em exercício"} na Câmara de {b.meta.cidade}
        {p.membros.length > p.em_exercicio.length && `, mais ${p.membros.length - p.em_exercicio.length} que já exerceram mandato em 2026`}.
      </p>

      <dl className="numeros">
        <div><dt>índice médio da bancada</dt><dd>{p.indice_medio != null ? fmt1(p.indice_medio) : "–"}</dd></div>
        <div><dt>dos votos na posição da Prefeitura</dt><dd>{t ? `${pct(p.executivo.com, t)}%` : "–"}</dd></div>
        <div><dt>votos contra a posição da Prefeitura</dt><dd>{p.executivo.contra}</dd></div>
        <div><dt>bancada unida nas votações</dt><dd>{p.coesao != null ? `${p.coesao}%` : "–"}</dd></div>
        <div><dt>projetos / viraram lei</dt><dd>{p.projetos} / {p.leis}</dd></div>
      </dl>

      <h2 className="secao__titulo">Vereadores</h2>
      <ul className="vereadores">
        {membros.map((v) => (
          <li key={v.slug} className="vereadores__item">
            <div className="vereadores__card">
              <Avatar v={v} tamanho="retrato" />
              <Link to={`/vereadores/${v.slug}`} className="vereadores__nome esticado">{v.exibicao}</Link>
              <span className="vereadores__civil">{v.nome}{!v.em_exercicio && " (não está em exercício)"}</span>
              <IndiceMini i={v.indice} />
            </div>
          </li>
        ))}
      </ul>

      <h2 className="secao__titulo">Cada um, lado a lado</h2>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th scope="col">Vereador</th><th scope="col" className="tabela__num">Índice</th><th scope="col" className="tabela__num">Com a Prefeitura</th><th scope="col" className="tabela__num">Contra a Prefeitura</th><th scope="col" className="tabela__num">Projetos</th><th scope="col" className="tabela__num">Leis</th></tr></thead>
          <tbody>{membros.map((v) => <LinhaMembro key={v.slug} v={v} />)}</tbody>
        </table>
      </div>

      {p.membros.length > 1 && (
        <>
          <h2 className="secao__titulo">Quando a bancada se dividiu</h2>
          {rachas.length ? (
            <ul className="lista-simples rachas">
              {rachas.slice(0, 20).map((ev) => (
                <li key={ev.id}>
                  <strong>{dataCurta(ev.data, true)}</strong> · <LinkMateria slug={ev.materia} /> · {ev.etapa_txt.toLowerCase()} <ResultadoTag r={ev.resultado} />
                  <span className="rachas__votos">
                    {p.membros.filter((s) => ev.votos[s] === "SIM" || ev.votos[s] === "NAO").map((s) => (
                      <span key={s}>{b.vereador.get(s)?.exibicao} <VotoTag voto={ev.votos[s]} /></span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p>Em todas as votações registradas, os membros do partido que votaram sim ou não votaram igual.</p>}
        </>
      )}
    </div>
  );
}
