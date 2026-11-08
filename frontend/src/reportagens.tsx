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

const ehPrefeito = (m: Materia) => !m.autores.length && /prefeit|executivo|sejur/i.test(m.autoria);

function FotoPrefeito({ tamanho }: { tamanho: "p" | "m" }) {
  const b = useDados();
  const e = b.executivo;
  if (e?.foto) return <img className={`avatar avatar--${tamanho}`} src={`./${e.foto}`} alt={`Foto de ${e.nome}`} loading="lazy" decoding="async" />;
  return <span className={`avatar avatar--${tamanho} avatar--iniciais`} aria-hidden="true">P</span>;
}

/** Quem propôs, em destaque: foto grande, nome e o que a pessoa é. */
function Autoria({ m, claro = false }: { m: Materia; claro?: boolean }) {
  const b = useDados();
  const autores = m.autores.map((s) => b.vereador.get(s)).filter(Boolean) as Vereador[];
  const pessoas = autores.length
    ? autores.map((v) => ({ chave: v.slug, foto: <Avatar v={v} tamanho="m" />, nome: v.exibicao, papel: `Vereador${v.partido ? ` (${v.partido})` : ""}`, link: `/vereadores/${v.slug}` }))
    : ehPrefeito(m)
      ? [{ chave: "prefeito", foto: <FotoPrefeito tamanho="m" />, nome: b.executivo?.nome ?? "Prefeito", papel: b.executivo?.cargo ?? "Prefeito", link: null }]
      : [{ chave: "outro", foto: <span className="avatar avatar--m avatar--iniciais" aria-hidden="true">?</span>, nome: m.autoria, papel: "", link: null }];
  return (
    <div className={`rp-autor${claro ? " rp-autor--claro" : ""}`}>
      <span className="rp-autor__rot">{pessoas.length > 1 ? "Propuseram" : "Quem propôs"}</span>
      <ul className="rp-autor__lista">
        {pessoas.map((p) => (
          <li key={p.chave} className="rp-autor__pessoa">
            {p.foto}
            <span className="rp-autor__txt">
              {p.link && !claro ? <Link to={p.link} className="rp-autor__nome">{p.nome}</Link> : <span className="rp-autor__nome">{p.nome}</span>}
              {p.papel && <span className="rp-autor__papel">{p.papel}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O que o prefeito fez com o projeto (sancionou, vetou, ainda não chegou nele). */
export function acaoPrefeito(m: Materia): { texto: string; tom: "bom" | "ruim" | "alerta" | "neutro" } {
  const dele = ehPrefeito(m);
  const v = m.veto;
  const depois = v?.resultado === "veto_mantido" ? "A Câmara manteve o veto." : v?.resultado === "veto_derrubado" ? "A Câmara derrubou o veto." : "Falta a Câmara votar o veto.";
  if (v && v.alcance === "integral") return { texto: `Vetou o projeto inteiro. ${depois}`, tom: "ruim" };
  if (v) return { texto: `Sancionou${m.lei ? ` a Lei ${m.lei.numero}` : ""}, mas vetou um trecho. ${depois}`, tom: "alerta" };
  if (m.lei) return { texto: `${dele ? "Sancionou o próprio projeto" : "Sancionou"}: virou a Lei ${m.lei.numero}, em ${dataCurta(m.lei.data, true)}.`, tom: "bom" };
  if (rejeitado(m)) return { texto: dele ? "Era projeto dele, mas a Câmara rejeitou." : "Não chegou a ele: a Câmara rejeitou.", tom: "neutro" };
  if (m.situacao_cls === "aprovado") return { texto: "Aprovado pela Câmara, aguardando o prefeito sancionar ou vetar.", tom: "alerta" };
  return { texto: dele ? "Projeto dele, ainda em tramitação na Câmara." : "Ainda não chegou ao prefeito.", tom: "neutro" };
}

function Prefeito({ m }: { m: Materia }) {
  const b = useDados();
  const a = acaoPrefeito(m);
  return (
    <div className={`rp-pref rp-pref--${a.tom}`}>
      <FotoPrefeito tamanho="m" />
      <span className="rp-pref__txt">
        <span className="rp-pref__rot">E o prefeito{b.executivo ? `, ${b.executivo.nome.split(" ")[0]}` : ""}?</span>
        <span className="rp-pref__acao">{a.texto}</span>
      </span>
    </div>
  );
}

function Rostos({ lista }: { lista: Vereador[] }) {
  return (
    <ul className="rp-rostos">
      {lista.map((v) => (
        <li key={v.slug} className="rp-rosto" title={v.exibicao}>
          <Avatar v={v} tamanho="m" />
          <span className="rp-rosto__nome">{v.exibicao.replace(/^Dr\. /, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function PlacarRostos({ ev }: { ev: Votacao }) {
  const b = useDados();
  const { favor, contra } = ladosDaVotacao(b, ev);
  return (
    <div className="rp-placar">
      <div className="rp-placar__lado rp-placar__lado--favor">
        <span className="rp-placar__rot"><strong>{favor.length}</strong> a favor do projeto</span>
        <Rostos lista={favor} />
      </div>
      <div className="rp-placar__lado rp-placar__lado--contra">
        {contra.length ? (
          <>
            <span className="rp-placar__rot"><strong>{contra.length}</strong> contra</span>
            <Rostos lista={contra} />
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
              <div className="rp__texto">
                <p className="rp__topo">
                  {r.status === "rascunho" && <span className="rp__rascunho">Rascunho</span>}
                  {r.chapeu && <span className="rp__chapeu">{r.chapeu}</span>}
                  {m && <span className={`rp__sit rp__sit--${classeSituacao(m)}`}>{situacaoCurta(m)}</span>}
                </p>
                <h2 className="rp__manchete"><Link to={`/reportagens/${r.id}`} className="esticado">{r.manchete}</Link></h2>
                <p className="rp__fina">{r.linha_fina}</p>
                {m && <div className="rp__vidro rp__vidro--autor"><Autoria m={m} claro /></div>}
                <span className="rp__ler" aria-hidden="true">Ler a reportagem <span>→</span></span>
              </div>
              {(ev || m) && (
                <aside className="rp__vidro rp__painel" aria-label="Como votaram e o que o prefeito fez">
                  {ev && (
                    <>
                      <span className="rp__fato-rot">Como votaram · {dataCurta(ev.data)}{ev.fonte === "resumo" ? " · resumo oficial" : ev.fonte === "painel" ? " · painel" : ""}</span>
                      <PlacarRostos ev={ev} />
                    </>
                  )}
                  {m && <Prefeito m={m} />}
                </aside>
              )}
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

export { PlacarRostos, Autoria, Foto, Prefeito, situacaoCurta, classeSituacao };
