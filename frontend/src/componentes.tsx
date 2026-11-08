import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDados, type Materia, type Vereador, type Votacao, type Voto, type Resultado } from "./dados";
import { slugPartido } from "./dados";
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
          <Link className="grade__nome" to={`/vereadores/${v!.slug}`}><Avatar v={v!} tamanho="p" />{v!.exibicao}</Link>
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

/** Rosto do vereador: foto (docs/fotos) quando existir; senao as iniciais. */
export function Avatar({ v, tamanho = "m" }: { v: Vereador; tamanho?: "p" | "m" | "g" | "retrato" }) {
  if (v.foto)
    return <img className={`avatar avatar--${tamanho}`} src={`./${v.foto}`} alt={`Foto de ${v.exibicao}`} loading="lazy" decoding="async" />;
  return <span className={`avatar avatar--${tamanho} avatar--iniciais`} aria-hidden="true">{v.iniciais}</span>;
}

/** Sigla do partido como tag clicavel (leva a /partidos/<sigla>). */
export function TagPartido({ sigla, parar }: { sigla: string | null | undefined; parar?: boolean }) {
  if (!sigla) return null;
  return (
    <Link to={`/partidos/${slugPartido(sigla)}`} className="tag-partido"
      onClick={parar ? (e) => e.stopPropagation() : undefined} aria-label={`Partido ${sigla}: ver todos os vereadores`}>
      {sigla}
    </Link>
  );
}

/** Quadro "Como ler": explica os termos de uma tela em definições curtas, com a nota de fonte e o link para o método. */
export function ComoLer({ itens, nota, link }: { itens: readonly (readonly [string, ReactNode])[]; nota?: ReactNode; link?: { ancora?: string; rotulo: string } }) {
  return (
    <aside className="como-ler" aria-label="Como ler esta página">
      <header className="como-ler__cab">
        <span className="como-ler__icone" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.4v.1" />
          </svg>
        </span>
        <p className="como-ler__selo">Como ler</p>
      </header>
      <dl className="como-ler__itens">
        {itens.map(([termo, texto]) => (
          <div key={termo} className="como-ler__item"><dt>{termo}</dt><dd>{texto}</dd></div>
        ))}
      </dl>
      {(nota || link) && (
        <footer className="como-ler__rodape">
          {nota && <p>{nota}</p>}
          {link && <Metodo ancora={link.ancora}>{link.rotulo}</Metodo>}
        </footer>
      )}
    </aside>
  );
}

/** Ponteiro para o método (Como funciona), no mesmo formato em todas as páginas: ícone de livro, texto e seta. */
export function Metodo({ ancora, children }: { ancora?: string; children: ReactNode }) {
  return (
    <Link to={{ pathname: "/como-funciona", hash: ancora ? `#${ancora}` : "" }} className="metodo-link">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4.5A1.5 1.5 0 015.5 3H16v12H5.5A1.5 1.5 0 004 16.5z" /><path d="M4 16.5A1.5 1.5 0 005.5 18H16" />
      </svg>
      <span>{children}</span><span className="metodo-link__seta" aria-hidden="true">→</span>
    </Link>
  );
}

/** Nota curta sobre como ler um número, com o ponteiro para o método. */
export function NotaMetodo({ children, ancora, rotulo }: { children: ReactNode; ancora?: string; rotulo: string }) {
  return (
    <aside className="nota-metodo">
      <p>{children}</p>
      <Metodo ancora={ancora}>{rotulo}</Metodo>
    </aside>
  );
}
