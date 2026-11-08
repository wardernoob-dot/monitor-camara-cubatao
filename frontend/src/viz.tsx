import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
export interface Ponto { x: string; y: number }
import { EASE, useContador, useEntrou, useLacoCanvas } from "./movimento";
import { useDados, type Votacao } from "./dados";
import { dataCurta } from "./util";
import { paleta, temaAtual, useTema } from "./tema";

export const COR = {
  tinta: "#171717",
  verde: "#297a3a",
  vermelho: "#c4342b",
  cinza: "#666666",
  nevoa: "#c9c9c9",
  papel: "#fafafa",
};

/* ------------------------------------------------------------------ sparkline */
export function Sparkline({ serie, cor: corProp, rotulo, formato }: { serie: Ponto[]; cor?: string; rotulo: string; formato: (p: Ponto) => string }) {
  const tema = useTema();
  const cor = corProp ?? paleta(tema).tinta;
  const [caixa, entrou] = useEntrou<HTMLDivElement>();
  const reduz = useReducedMotion();
  const [dica, setDica] = useState<{ i: number; x: number } | null>(null);
  const progresso = useRef(reduz ? 1 : 0);
  const max = Math.max(1, ...serie.map((p) => p.y));
  const ref = useLacoCanvas((ctx, w, h) => {
    if (!entrou && !reduz) return false;
    progresso.current = reduz ? 1 : Math.min(1, progresso.current + 1 / 60);
    const n = Math.max(2, Math.ceil(serie.length * progresso.current));
    const px = (i: number) => (i / Math.max(1, serie.length - 1)) * (w - 4) + 2;
    const py = (y: number) => h - 6 - (y / max) * (h - 14);
    ctx.lineWidth = 2;
    ctx.strokeStyle = cor;
    ctx.lineJoin = "round";
    ctx.beginPath();
    serie.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.y)) : ctx.moveTo(px(i), py(p.y))));
    ctx.stroke();
    ctx.lineTo(px(n - 1), h);
    ctx.lineTo(px(0), h);
    ctx.closePath();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (dica) {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(px(dica.i), py(serie[dica.i].y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return progresso.current < 1;
  }, entrou, [dica?.i, cor]);

  let espera = 0;
  const mover = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    window.clearTimeout(espera);
    espera = window.setTimeout(() => setDica({ i: Math.round((x / r.width) * (serie.length - 1)), x }), 50);
  };
  const total = serie.reduce((s, p) => s + p.y, 0);
  return (
    <div ref={caixa} className="spark" onPointerMove={mover} onPointerLeave={() => setDica(null)}>
      <canvas ref={ref} className="spark__canvas" role="img" aria-label={`${rotulo}: ${total} no total, em ${serie.length} semanas; pico de ${max}.`} />
      {dica && serie[dica.i] && (
        <span className="spark__dica" style={{ left: Math.min(Math.max(dica.x, 40), 9999) }}>{formato(serie[dica.i])}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ contador */
export function Contador({ valor, rotulo }: { valor: number; rotulo: string }) {
  const [ref, entrou] = useEntrou<HTMLDivElement>();
  const v = useContador(valor, entrou);
  return (
    <div ref={ref} className="contador">
      <span className="contador__num" aria-hidden="true">{v.toLocaleString("pt-BR")}</span>
      <span className="sr">{valor.toLocaleString("pt-BR")}</span>
      <span className="contador__rotulo">{rotulo}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ funil */
export function Funil({ etapas, max: maxFixo, sufixo = "" }: { etapas: { rotulo: string; valor: number }[]; max?: number; sufixo?: string }) {
  const [ref, entrou] = useEntrou<HTMLOListElement>();
  const max = maxFixo ?? Math.max(1, ...etapas.map((e) => e.valor));
  return (
    <ol ref={ref} className="funil">
      {etapas.map((e, i) => (
        <li key={e.rotulo} className="funil__etapa">
          <span className="funil__rotulo">{e.rotulo}</span>
          <span className="funil__valor">{e.valor}{sufixo}</span>
          <span className="funil__trilho">
            <motion.span
              className="funil__barra"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: entrou ? e.valor / max : 0 }}
              transition={{ duration: 1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={maxFixo ? undefined : { background: i === etapas.length - 1 ? "var(--cor-bom)" : `var(--seq-${Math.min(i, 3)})` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ modal */
export function Modal({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); antes?.focus(); };
  }, [aberto, aoFechar]);
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div className="modal__fundo" onClick={aoFechar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <motion.div ref={caixa} className="modal" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}
            onClick={(e) => e.stopPropagation()} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="modal__topo">
              <h2 className="modal__titulo">{titulo}</h2>
              <button type="button" className="botao botao--fantasma" onClick={aoFechar}>Fechar</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ heatmap (celulas clicaveis) */
export function Heatmap<T>({ linhas, colunas, valor, cor, rotuloCelula, aoClicar, rotuloLinha, rotuloColuna, legenda }: {
  linhas: T[][];
  colunas: number;
  valor: (c: T) => number | null;
  cor: (v: number | null, c: T) => string;
  rotuloCelula: (c: T) => string;
  aoClicar?: (c: T) => void;
  rotuloLinha: (i: number) => string;
  rotuloColuna?: (j: number) => string;
  legenda?: ReactNode;
}) {
  const [ref, entrou] = useEntrou<HTMLDivElement>();
  const reduz = useReducedMotion();
  const atrasos = useMemo(() => linhas.map((l) => l.map(() => Math.random() * 0.8)), [linhas]);
  return (
    <div ref={ref} className="heat">
      <div className="heat__grade" style={{ gridTemplateColumns: `max-content repeat(${colunas}, minmax(12px, 28px))` }}>
        {rotuloColuna && <><span />{Array.from({ length: colunas }, (_, j) => <span key={j} className="heat__col">{rotuloColuna(j)}</span>)}</>}
        {linhas.map((l, i) => (
          <div key={i} className="heat__linha" role="row">
            <span className="heat__rot" role="rowheader">{rotuloLinha(i)}</span>
            {l.map((c, j) => {
              const v = valor(c);
              const props = {
                className: "heat__cel",
                style: { background: cor(v, c) },
                title: rotuloCelula(c),
                "aria-label": rotuloCelula(c),
                initial: reduz ? false : { scale: 0 },
                animate: { scale: entrou || reduz ? 1 : 0 },
                transition: { type: "spring" as const, stiffness: 420, damping: 24, delay: reduz ? 0 : atrasos[i][j] },
              };
              return aoClicar ? (
                <motion.button key={j} type="button" {...props} onClick={() => aoClicar(c)} />
              ) : (
                <motion.span key={j} role="cell" {...props} />
              );
            })}
          </div>
        ))}
      </div>
      {legenda}
    </div>
  );
}

/* ------------------------------------------------------------------ feed das votacoes */
export function FeedVotacoes({ eventos }: { eventos: Votacao[] }) {
  const { materia } = useDados();
  const lista = useRef<HTMLOListElement>(null);
  const reduz = useReducedMotion();
  const [pausado, setPausado] = useState(false);
  const [ref, entrou] = useEntrou<HTMLDivElement>();

  useEffect(() => {
    const el = lista.current;
    if (!el || reduz || pausado || !entrou) return;
    let raf = 0;
    let acumulado = 0;
    const rola = () => {
      acumulado += 0.25;
      if (acumulado >= 1) {
        el.scrollTop = el.scrollTop + Math.floor(acumulado) >= el.scrollHeight - el.clientHeight ? 0 : el.scrollTop + Math.floor(acumulado);
        acumulado %= 1;
      }
      raf = requestAnimationFrame(rola);
    };
    raf = requestAnimationFrame(rola);
    return () => cancelAnimationFrame(raf);
  }, [reduz, pausado, entrou]);

  return (
    <div ref={ref} className="feed" onPointerEnter={() => setPausado(true)} onPointerLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)} onBlur={() => setPausado(false)}>
      <h2 className="feed__titulo">Últimas votações</h2>
      <ol ref={lista} className="feed__lista" tabIndex={0} aria-label="Últimas 20 votações, da mais recente para a mais antiga">
        {eventos.map((ev, i) => {
          const m = materia.get(ev.materia);
          return (
            <motion.li key={ev.id} className={`feed__item feed__item--${ev.resultado === "APROVADO" ? "sim" : ev.resultado === "REJEITADO" ? "nao" : "neutro"}`}
              initial={reduz ? false : { x: 24, opacity: 0 }} animate={entrou || reduz ? { x: 0, opacity: 1 } : {}}
              transition={{ duration: 0.3, delay: reduz ? 0 : i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}>
              <span className="feed__data">{dataCurta(ev.data)}</span>
              <Link to={`/projetos/${ev.materia}`} className="feed__mat">{m?.titulo}</Link>
              <span className="feed__etapa">{ev.etapa_txt}</span>
              <span className="feed__res">{ev.resultado === "APROVADO" ? "Aprovado" : ev.resultado === "REJEITADO" ? "Rejeitado" : "Sem resultado"}{ev.sim != null ? ` ${ev.sim} a ${ev.nao}` : ""}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ faixa de votos de um vereador (canvas) */
export function FaixaMini({ votos, rotulo }: { votos: (string | undefined)[]; rotulo: string }) {
  const [caixa, entrou] = useEntrou<HTMLDivElement>();
  const tema = useTema();
  const pal = paleta(tema);
  const prog = useRef(0);
  const reduz = useReducedMotion();
  const ref = useLacoCanvas((ctx, w, h) => {
    if (!entrou && !reduz) return false;
    prog.current = reduz ? 1 : Math.min(1, prog.current + 1 / 45);
    const n = Math.ceil(votos.length * prog.current);
    const lw = w / Math.max(1, votos.length);
    votos.slice(0, n).forEach((v, i) => {
      const x = i * lw;
      if (v === "SIM") { ctx.fillStyle = pal.verde; ctx.fillRect(x + 0.5, 0, lw - 1.5, h); }
      else if (v === "NAO") { ctx.fillStyle = pal.vermelho; ctx.fillRect(x + 0.5, 0, lw - 1.5, h); }
      else if (v === "BRANCO") { ctx.strokeStyle = pal.cinza; ctx.lineWidth = 1; ctx.strokeRect(x + 1, 0.5, lw - 2.5, h - 1); }
      else if (v === "AUSENTE") { ctx.fillStyle = pal.nevoa; ctx.fillRect(x + 0.5, h * 0.4, lw - 1.5, h * 0.2); }
    });
    return prog.current < 1;
  }, entrou, [tema]);
  const c = { SIM: 0, NAO: 0, BRANCO: 0, AUSENTE: 0 } as Record<string, number>;
  votos.forEach((v) => v && (c[v] = (c[v] || 0) + 1));
  return (
    <div ref={caixa} className="faixa-mini">
      <canvas ref={ref} role="img" aria-label={`${rotulo}: últimas ${votos.length} votações, ${c.SIM} sim, ${c.NAO} não, ${c.BRANCO} sem votar, ${c.AUSENTE} ausente.`} />
    </div>
  );
}

/* ------------------------------------------------------------------ barras horizontais empilhadas */
export interface Barra { rotulo: string; para?: string; partes: { valor: number; classe: string; nome: string }[] }

export function Barras({ itens, legenda }: { itens: Barra[]; legenda?: { classe: string; nome: string }[] }) {
  const [ref, entrou] = useEntrou<HTMLOListElement>();
  const reduz = useReducedMotion();
  const max = Math.max(1, ...itens.map((i) => i.partes.reduce((s, p) => s + p.valor, 0)));
  return (
    <>
      <ol ref={ref} className="barras">
        {itens.map((it, i) => {
          const total = it.partes.reduce((s, p) => s + p.valor, 0);
          const desc = it.partes.filter((p) => p.valor).map((p) => `${p.valor} ${p.nome}`).join(", ");
          return (
            <li key={it.rotulo} className="barras__item">
              <span className="barras__rotulo">{it.para ? <Link to={it.para}>{it.rotulo}</Link> : it.rotulo}</span>
              <span className="barras__total" aria-label={`${total}: ${desc}`}>{total}</span>
              <span className="barras__trilho" aria-hidden="true">
                <motion.span className="barras__cheio" initial={reduz ? false : { scaleX: 0 }}
                  animate={{ scaleX: entrou || reduz ? total / max : 0 }} transition={{ duration: 0.9, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}>
                  {it.partes.map((p) => p.valor > 0 && (
                    <span key={p.nome} className={`barras__parte ${p.classe}`} style={{ flexGrow: p.valor }} title={`${p.valor} ${p.nome}`} />
                  ))}
                </motion.span>
              </span>
            </li>
          );
        })}
      </ol>
      {legenda && (
        <ul className="legenda">
          {legenda.map((l) => <li key={l.nome}><span className={`barras__amostra ${l.classe}`} aria-hidden="true" /> {l.nome}</li>)}
        </ul>
      )}
    </>
  );
}
