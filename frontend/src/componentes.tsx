import { Link } from "react-router-dom";
import { useDados, type Materia, type Votacao, type Voto, type Resultado } from "./dados";
import { ORDEM_VOTO, ROTULO, dataCurta, minusculaInicial } from "./util";

export function LinkMateria({ slug }: { slug: string }) {
  const { materia } = useDados();
  const m = materia.get(slug);
  if (!m) return null;
  return <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link>;
}

export function Celula({ ev, voto, nome }: { ev: Votacao; voto?: Voto; nome: string }) {
  const { materia } = useDados();
  const m = materia.get(ev.materia);
  const res = ev.resultado === "APROVADO" ? "aprovado" : ev.resultado === "REJEITADO" ? "rejeitado" : "sem resultado";
  const v = voto ? ROTULO[voto] : "sem registro";
  const titulo = `${nome}: ${v}. ${m?.titulo ?? ""}, ${minusculaInicial(ev.etapa_txt)}, ${dataCurta(ev.data)} (${res})`;
  return (
    <Link className={`cel cel--${voto ? voto.toLowerCase() : "vazio"}`} to={`/projetos/${ev.materia}`} title={titulo}>
      <span className="sr">{titulo}</span>
    </Link>
  );
}

export function Legenda() {
  return (
    <ul className="legenda" aria-label="Legenda">
      <li><span className="cel cel--sim" aria-hidden="true" /> Sim</li>
      <li><span className="cel cel--nao" aria-hidden="true" /> Não</li>
      <li><span className="cel cel--branco" aria-hidden="true" /> Presente, não votou</li>
      <li><span className="cel cel--ausente" aria-hidden="true" /> Ausente</li>
      <li><span className="cel cel--vazio" aria-hidden="true" /> Sem registro</li>
    </ul>
  );
}

export function VotoTag({ voto }: { voto: Voto }) {
  return <span className={`voto voto--${voto.toLowerCase()}`}>{ROTULO[voto]}</span>;
}

export function ResultadoTag({ r }: { r: Resultado }) {
  if (r === "APROVADO") return <span className="res res--sim">Aprovado</span>;
  if (r === "REJEITADO") return <span className="res res--nao">Rejeitado</span>;
  return <span className="res">Sem resultado registrado</span>;
}

export function Placar({ ev, grande = false }: { ev: Votacao; grande?: boolean }) {
  if (ev.sim == null) return null;
  return <span className={`placar${grande ? " placar--grande" : ""}`}>{ev.sim} a {ev.nao}</span>;
}

export function Situacao({ m }: { m: Materia }) {
  return <span className={`sit sit--${m.situacao_cls}`}>{m.situacao}</span>;
}

export function Fonte({ ev }: { ev: Votacao }) {
  if (ev.fonte === "painel")
    return ev.link ? <a href={ev.link} rel="noopener">painel na transmissão</a> : <>painel na transmissão</>;
  if (ev.fonte === "resumo")
    return ev.resumo_url ? <a href={ev.resumo_url} rel="noopener">resumo oficial</a> : <>resumo oficial</>;
  return <>—</>;
}

export function Grade({ ev }: { ev: Votacao }) {
  const { vereador } = useDados();
  const itens = Object.entries(ev.votos)
    .map(([slug, voto]) => ({ v: vereador.get(slug), voto }))
    .filter((x) => x.v)
    .sort((a, b) => ORDEM_VOTO.indexOf(a.voto) - ORDEM_VOTO.indexOf(b.voto) || a.v!.exibicao.localeCompare(b.v!.exibicao));
  if (!itens.length) return null;
  return (
    <ul className="grade">
      {itens.map(({ v, voto }) => (
        <li key={v!.slug} className={`grade__item grade__item--${voto.toLowerCase()}`}>
          <Link className="grade__nome" to={`/vereadores/${v!.slug}`}>{v!.exibicao}</Link>
          <span className="grade__voto">{ROTULO[voto]}</span>
        </li>
      ))}
    </ul>
  );
}

export function NotaFonte({ ev }: { ev: Votacao }) {
  return (
    <p className="nota">
      Fonte: <Fonte ev={ev} />
      {ev.fonte === "resumo" ? ". O resumo oficial não registra quem estava presente e não votou" : ""}.
    </p>
  );
}
