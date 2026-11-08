import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useDados, type Base, type Materia, type Reportagem, type Vereador, type Votacao } from "./dados";
import { Avatar } from "./componentes";
import { EASE } from "./movimento";
import { dataCurta } from "./util";

/* ------------------------------------------------------------------ fatos que vem do dado, nao do texto */

/** Lado de cada voto em relação ao projeto: em parecer contrário, votar Sim é ser contra o projeto. */
export function lado(ev: Votacao, voto: string): "favor" | "contra" | null {
  if (voto !== "SIM" && voto !== "NAO") return null;
  if (ev.sentido === "inverso") return voto === "SIM" ? "contra" : "favor";
  if (ev.sentido === "emenda") return null;
  return voto === "SIM" ? "favor" : "contra";
}

export function ladosDaVotacao(b: Base, ev: Votacao) {
  const favor: Vereador[] = [];
  const contra: Vereador[] = [];
  for (const [slug, voto] of Object.entries(ev.votos)) {
    const v = b.vereador.get(slug);
    const l = v && lado(ev, voto);
    if (l === "favor") favor.push(v!);
    else if (l === "contra") contra.push(v!);
  }
  const ord = (a: Vereador, c: Vereador) => a.exibicao.localeCompare(c.exibicao, "pt-BR");
  return { favor: favor.sort(ord), contra: contra.sort(ord) };
}

/** Votação que aparece no cartão: a escolhida no texto ou a última com placar do projeto principal. */
export function votacaoDa(b: Base, r: Reportagem): Votacao | null {
  if (r.votacao != null && b.votacoes[r.votacao]) return b.votacoes[r.votacao];
  const m = b.materia.get(r.projetos[0]);
  const evs = (m?.eventos ?? []).map((id) => b.votacoes[id]).filter((e) => e && Object.keys(e.votos).length);
  return evs.length ? evs[evs.length - 1] : null;
}

/** Situação em linguagem de quem não acompanha a Câmara. Parecer contrário aprovado = projeto rejeitado. */
function rejeitado(m: Materia) {
  return m.situacao_cls === "rejeitado" || /parecer contr[áa]rio[^:]*: aprovado/i.test(m.situacao) || /parecer[^:]*favor[áa]vel[^:]*: rejeitado/i.test(m.situacao);
}
function situacaoCurta(m: Materia): string {
  if (m.lei) return `Virou a Lei ${m.lei.numero}`;
  if (rejeitado(m)) return "Rejeitado pela Câmara";
  return m.situacao.replace(/;.*$/, "");
}
const classeSituacao = (m: Materia) => (m.lei ? "lei" : rejeitado(m) ? "rejeitado" : m.situacao_cls);

/* ------------------------------------------------------------------ texto: **negrito** e [link](url) */

export function Inline({ t }: { t: string }) {
  const partes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > i) partes.push(t.slice(i, m.index));
    if (m[1]) partes.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[3].startsWith("#/")) partes.push(<Link key={m.index} to={m[3].slice(1)}>{m[2]}</Link>);
    else if (m[3].startsWith("https://")) partes.push(<a key={m.index} href={m[3]} rel="noopener">{m[2]}</a>);
    else partes.push(m[2]);
    i = m.index + m[0].length;
  }
  if (i < t.length) partes.push(t.slice(i));
  return <>{partes}</>;
}

/* ------------------------------------------------------------------ pecas */

function Autoria({ m, claro = false }: { m: Materia; claro?: boolean }) {
  const b = useDados();
  const autores = m.autores.map((s) => b.vereador.get(s)).filter(Boolean) as Vereador[];
  return (
    <span className={`rp-autor${claro ? " rp-autor--claro" : ""}`}>
      {autores.length ? (
        <>
          <span className="rp-autor__fotos">{autores.slice(0, 3).map((v) => <Avatar key={v.slug} v={v} tamanho="p" />)}</span>
          <span>{autores.map((v) => v.exibicao).join(", ")}</span>
        </>
      ) : (
        <>
          <span className="rp-autor__icone" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7-4.5L17 8M4.5 8v7M8 8v7M12 8v7M15.5 8v7M3 17h14" /></svg>
          </span>
          <span>{/prefeit/i.test(m.autoria) ? "Prefeito (Prefeitura)" : m.autoria}</span>
        </>
      )}
    </span>
  );
}

function Rostos({ lista, max }: { lista: Vereador[]; max: number }) {
  const resto = lista.length - max;
  return (
    <span className="rp-rostos">
      {lista.slice(0, max).map((v) => <span key={v.slug} title={v.exibicao}><Avatar v={v} tamanho="p" /></span>)}
      {resto > 0 && <span className="rp-rostos__mais">+{resto}</span>}
    </span>
  );
}

function PlacarRostos({ ev, compacto = false }: { ev: Votacao; compacto?: boolean }) {
  const b = useDados();
  const { favor, contra } = ladosDaVotacao(b, ev);
  const max = compacto ? 6 : 15;
  return (
    <div className="rp-placar">
      <div className="rp-placar__lado rp-placar__lado--favor">
        <span className="rp-placar__rot"><strong>{favor.length}</strong> a favor do projeto</span>
        <Rostos lista={favor} max={max} />
      </div>
      <div className="rp-placar__lado rp-placar__lado--contra">
        {contra.length ? (
          <>
            <span className="rp-placar__rot"><strong>{contra.length}</strong> contra</span>
            <Rostos lista={contra} max={max} />
          </>
        ) : <span className="rp-placar__rot rp-placar__nenhum">nenhum voto contra</span>}
      </div>
    </div>
  );
}

function Foto({ r, classe, prioridade = false }: { r: Reportagem; classe: string; prioridade?: boolean }) {
  return (
    <img className={classe} src={`./${r.foto.g}`} srcSet={`./${r.foto.p} 800w, ./${r.foto.g} 1600w`} sizes="(max-width: 800px) 100vw, 80rem"
      alt={r.foto.alt} loading={prioridade ? "eager" : "lazy"} decoding="async" draggable={false} />
  );
}

/* ------------------------------------------------------------------ carrossel da pagina inicial */

const TEMPO = 8000;

export function CarrosselReportagens() {
  const b = useDados();
  const itens = b.reportagens ?? [];
  const reduz = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [pausa, setPausa] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const raiz = useRef<HTMLElement>(null);
  const n = itens.length;

  const ir = useCallback((d: number) => { setDir(d); setI((x) => (x + d + n) % n); }, [n]);
  const para = (k: number) => { setDir(k > i ? 1 : -1); setI(k); };

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    const vis = () => setVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  const rodando = !reduz && !pausa && visivel && n > 1;
  useEffect(() => {
    if (!rodando) return;
    const t = window.setTimeout(() => ir(1), TEMPO);
    return () => window.clearTimeout(t);
  }, [rodando, i, ir]);

  if (!n) return null;
  const r = itens[i];
  const m = b.materia.get(r.projetos[0]);
  const ev = votacaoDa(b, r);

  const arrastou = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) ir(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) ir(-1);
  };

  return (
    <section ref={raiz} className="rp" aria-roledescription="carrossel" aria-label="Reportagens sobre projetos que mexem com a cidade"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setPausa(false)}
      onKeyDown={(e) => { if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); }}>
      <div className="rp__palco">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.article key={r.id} className="rp__slide" custom={dir} aria-roledescription="slide" aria-label={`${i + 1} de ${n}: ${r.manchete}`}
            initial={reduz ? { opacity: 0 } : { opacity: 0, x: `${dir * 6}%` }} animate={{ opacity: 1, x: 0 }}
            exit={reduz ? { opacity: 0 } : { opacity: 0, x: `${-dir * 6}%` }} transition={{ duration: reduz ? 0.2 : 0.7, ease: EASE }}
            drag={n > 1 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18} onDragEnd={arrastou}>
            <motion.div className="rp__foto" initial={reduz ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: TEMPO / 1000 + 1, ease: "linear" }}>
              <Foto r={r} classe="rp__img" prioridade={i === 0} />
            </motion.div>
            <div className="rp__veu" aria-hidden="true" />
            <div className="rp__conteudo">
              <p className="rp__topo">
                {r.status === "rascunho" && <span className="rp__rascunho">Rascunho</span>}
                {r.chapeu && <span className="rp__chapeu">{r.chapeu}</span>}
                {m && <span className={`rp__sit rp__sit--${classeSituacao(m)}`}>{situacaoCurta(m)}</span>}
              </p>
              <h2 className="rp__manchete"><Link to={`/reportagens/${r.id}`} className="esticado">{r.manchete}</Link></h2>
              <p className="rp__fina">{r.linha_fina}</p>
              <div className="rp__fatos">
                {m && <div className="rp__fato"><span className="rp__fato-rot">Quem propôs</span><Autoria m={m} claro /></div>}
                {ev && <div className="rp__fato rp__fato--placar"><span className="rp__fato-rot">Como votaram · {dataCurta(ev.data)}</span><PlacarRostos ev={ev} compacto /></div>}
              </div>
              <span className="rp__ler" aria-hidden="true">Ler a reportagem <span>→</span></span>
            </div>
            <p className="rp__credito">Foto{r.foto.ilustrativa ? " ilustrativa" : ""}: {r.foto.credito}</p>
          </motion.article>
        </AnimatePresence>
      </div>
      {n > 1 && (
        <div className="rp__ctl">
          <div className="rp__pontos" role="group" aria-label="Escolher reportagem">
            {itens.map((x, k) => (
              <button key={x.id} type="button" className={`rp__ponto${k === i ? " rp__ponto--atual" : ""}`} onClick={() => para(k)}
                aria-label={`${k + 1}: ${x.manchete}`} aria-current={k === i ? "true" : undefined}>
                <span className="rp__ponto-titulo">{x.manchete}</span>
                <span className="rp__ponto-barra"><span key={`${i}-${rodando}`} className={k === i && rodando ? "rp__ponto-enche" : k === i ? "rp__ponto-cheio" : ""}
                  style={{ animationDuration: `${TEMPO}ms` }} /></span>
              </button>
            ))}
          </div>
          <div className="rp__setas">
            <button type="button" className="carrossel__seta" onClick={() => ir(-1)} aria-label="Reportagem anterior">←</button>
            <button type="button" className="carrossel__seta" onClick={() => ir(1)} aria-label="Próxima reportagem">→</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ pagina da reportagem */

export function CorpoReportagem({ r }: { r: Reportagem }) {
  return (
    <div className="rp-corpo">
      {r.corpo.map((bl, k) => (
        <Fragment key={k}>
          {bl.t === "h" && <h2>{bl.x as string}</h2>}
          {bl.t === "p" && <p><Inline t={bl.x as string} /></p>}
          {bl.t === "ul" && <ul>{(bl.x as string[]).map((it, j) => <li key={j}><Inline t={it} /></li>)}</ul>}
        </Fragment>
      ))}
    </div>
  );
}

export { PlacarRostos, Autoria, Foto, situacaoCurta, classeSituacao };
