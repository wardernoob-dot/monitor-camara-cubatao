import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

/** "Nesta página": índice das seções, igual em todas as páginas longas.
 *  Telas largas: coluna ao lado, com trilha, barra que desliza até a seção em foco e as já lidas em destaque.
 *  Telas estreitas: barra recolhível fixa no topo, que mostra a seção atual.
 *  As seções são as de <Secao id=…> ou <section id=…>; clicar leva até a seção, e a Secao abre sozinha pelo #id. */
export function Toc({ itens, caminho }: { itens: readonly (readonly [string, string])[]; caminho: string }) {
  const reduz = useReducedMotion();
  const [ativo, setAtivo] = useState<string>("");
  const [presentes, setPresentes] = useState<string[]>(() => itens.map(([id]) => id));
  const [aberto, setAberto] = useState(false);
  const movel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const novo = itens.map(([id]) => id).filter((id) => document.getElementById(id));
    setPresentes((ant) => (ant.join("|") === novo.join("|") ? ant : novo));
  }, [itens, caminho]);

  useEffect(() => {
    const els = itens.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      const visiveis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visiveis[0]) setAtivo(visiveis[0].target.id);
    }, { rootMargin: "-18% 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [itens, presentes]);

  // a lista do celular fecha com Esc ou clique fora
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const fora = (e: PointerEvent) => { if (!movel.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("keydown", esc);
    document.addEventListener("pointerdown", fora);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("pointerdown", fora); };
  }, [aberto]);

  const lista = itens.filter(([id]) => presentes.includes(id));
  if (lista.length < 2) return null;
  const idx = lista.findIndex(([id]) => id === ativo);
  const atual = idx >= 0 ? lista[idx][1] : "Escolha uma seção";
  const topo = () => window.scrollTo({ top: 0, behavior: reduz ? "auto" : "smooth" });

  return (
    <>
      <aside className="toc" aria-label="Nesta página">
        <p className="toc__titulo">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 5h14M3 10h9M3 15h12" /></svg>
          Nesta página
        </p>
        <ul className="toc__lista">
          {lista.map(([id, nome], i) => {
            const em = id === ativo;
            return (
              <li key={id}>
                <Link to={{ pathname: caminho, hash: `#${id}` }} className={`toc__link${em ? " toc__link--ativo" : idx >= 0 && i < idx ? " toc__link--lido" : ""}`}
                  aria-current={em ? "location" : undefined}>
                  {em && <motion.span layoutId="toc-barra" className="toc__barra" transition={reduz ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }} />}
                  {nome}
                </Link>
              </li>
            );
          })}
        </ul>
        <button type="button" className="toc__topo" onClick={topo}><span aria-hidden="true">↑</span> Voltar ao topo</button>
      </aside>

      <div className="toc-movel" ref={movel}>
        <button type="button" className="toc-movel__botao" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          <span className="toc-movel__rotulo">Nesta página</span>
          <strong className="toc-movel__atual">{atual}</strong>
          <svg className="toc-movel__seta" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {aberto && (
          <ul className="toc-movel__lista">
            {lista.map(([id, nome]) => (
              <li key={id}>
                <Link to={{ pathname: caminho, hash: `#${id}` }} onClick={() => setAberto(false)} aria-current={id === ativo ? "location" : undefined}>{nome}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
