import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { EASE, useContador, useEntrou } from "./movimento";

export interface Aba {
  id: string;
  numero: number;
  sufixo?: string;
  rotulo: string;     // embaixo do numero, no cartao
  titulo: string;     // titulo do painel aberto
  descricao?: string;
  conteudo: ReactNode;
  arrastavel?: boolean;
  cor?: string; // cor do assunto (realce da aba ativa e ponto da aba) // false quando o conteudo ja rola para os lados (tabela, mapa de calor)
}

function NumeroAba({ valor, sufixo = "", ativo }: { valor: number; sufixo?: string; ativo: boolean }) {
  const [ref, entrou] = useEntrou<HTMLSpanElement>();
  const v = useContador(valor, entrou, 900);
  return <span ref={ref} className={`painel__num ${ativo ? "painel__num--ativo" : ""}`} aria-hidden="true">{v}{sufixo}</span>;
}

/** Painel interativo: os cartoes de numeros sao as abas. Clicar, usar as setas do teclado
 *  ou arrastar o conteudo para o lado troca de assunto; a aba aberta fica no endereco (?aba=). */
export function Painel({ abas, rotulo }: { abas: Aba[]; rotulo: string }) {
  const [params, setParams] = useSearchParams();
  const inicial = Math.max(0, abas.findIndex((a) => a.id === params.get("aba")));
  const [[atual, direcao], setEstado] = useState<[number, number]>([inicial, 0]);
  const reduz = useReducedMotion();
  const [toque] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  const trilho = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  const ir = useCallback((i: number, foco = false) => {
    const n = (i + abas.length) % abas.length;
    setEstado(([a]) => [n, n > a ? 1 : -1]);
    setParams((p) => { const q = new URLSearchParams(p); q.set("aba", abas[n].id); return q; }, { replace: true, preventScrollReset: true });
    if (foco) botoes.current[n]?.focus();
  }, [abas, setParams]);

  // mantem o cartao ativo visivel no trilho rolavel (celular)
  useEffect(() => {
    const b = botoes.current[atual];
    const t = trilho.current;
    if (b && t) t.scrollTo({ left: b.offsetLeft - t.clientWidth / 2 + b.clientWidth / 2, behavior: reduz ? "auto" : "smooth" });
  }, [atual, reduz]);

  const teclado = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); ir(atual + 1, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); ir(atual - 1, true); }
    if (e.key === "Home") { e.preventDefault(); ir(0, true); }
    if (e.key === "End") { e.preventDefault(); ir(abas.length - 1, true); }
  };
  const arrastou = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -500) ir(atual + 1);
    else if (info.offset.x > 80 || info.velocity.x > 500) ir(atual - 1);
  };
  const aba = abas[atual];

  return (
    <div className="painel">
      <div className="painel__trilho" ref={trilho} role="tablist" aria-label={rotulo} onKeyDown={teclado}>
        {abas.map((a, i) => {
          const ativo = i === atual;
          return (
            <button key={a.id} ref={(el) => { botoes.current[i] = el; }} role="tab" type="button" id={`aba-${a.id}`}
              aria-selected={ativo} aria-controls={`painel-${a.id}`} tabIndex={ativo ? 0 : -1}
              className={`painel__aba ${ativo ? "painel__aba--ativa" : ""}`} onClick={() => ir(i)}
              style={{ ["--aba-cor" as string]: a.cor ?? "var(--color-ink)" }}>
              {ativo && <motion.span layoutId="painel-realce" className="painel__realce" style={{ background: a.cor ?? "var(--color-ink)" }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <NumeroAba valor={a.numero} sufixo={a.sufixo} ativo={ativo} />
              <span className="painel__rotulo">{a.rotulo}</span>
              <span className="sr">{a.numero}{a.sufixo}</span>
            </button>
          );
        })}
      </div>

      <div className="painel__pontos" aria-hidden="true">
        {abas.map((a, i) => <span key={a.id} className={i === atual ? "ativo" : ""} />)}
      </div>

      <motion.div className="painel__palco" style={{ ["--aba-cor" as string]: aba.cor ?? "var(--color-ink)" }} layout={!reduz} transition={{ duration: 0.35, ease: EASE }}>
        <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
          <motion.div
            key={aba.id}
            id={`painel-${aba.id}`}
            role="tabpanel"
            aria-labelledby={`aba-${aba.id}`}
            className="painel__conteudo"
            custom={direcao}
            variants={{
              entra: (d: number) => (reduz ? { opacity: 0 } : { opacity: 0, x: d >= 0 ? 60 : -60, filter: "blur(4px)" }),
              fica: { opacity: 1, x: 0, filter: "blur(0px)" },
              sai: (d: number) => (reduz ? { opacity: 0 } : { opacity: 0, x: d >= 0 ? -60 : 60, filter: "blur(4px)" }),
            }}
            initial="entra"
            animate="fica"
            exit="sai"
            transition={{ duration: 0.38, ease: EASE }}
            drag={!reduz && toque && aba.arrastavel !== false ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragDirectionLock
            onDragEnd={arrastou}
          >
            <header className="painel__cabeca">
              <div>
                <p className="painel__contagem">{atual + 1} de {abas.length}</p>
                <h3 className="painel__titulo">{aba.titulo}</h3>
                {aba.descricao && <p className="painel__descricao">{aba.descricao}</p>}
              </div>
              <div className="painel__setas">
                <button type="button" onClick={() => ir(atual - 1)} aria-label="Assunto anterior">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" onClick={() => ir(atual + 1)} aria-label="Próximo assunto">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </header>
            {aba.conteudo}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
