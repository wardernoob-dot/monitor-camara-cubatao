import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";

/** Seção retrátil: título clicável que abre e fecha o conteúdo, com animação de altura.
 *  Abre sozinha quando o endereço aponta para ela (#id). */
export function Secao({ id, titulo, resumo, aberta = false, children, classe = "" }: {
  id: string; titulo: ReactNode; resumo?: ReactNode; aberta?: boolean; children: ReactNode; classe?: string;
}) {
  const { hash } = useLocation();
  const [aberto, setAberto] = useState(aberta || hash === `#${id}`);
  const reduz = useReducedMotion();
  const corpo = useId();
  useEffect(() => {
    if (hash === `#${id}`) setAberto(true);
  }, [hash, id]);

  return (
    <section id={id} className={`sanfona ${aberto ? "sanfona--aberta" : ""} ${classe}`}>
      <h2 className="sanfona__titulo">
        <button type="button" aria-expanded={aberto} aria-controls={corpo} onClick={() => setAberto((a) => !a)}>
          <span className="sanfona__texto">{titulo}</span>
          {resumo != null && <span className="sanfona__resumo">{resumo}</span>}
          <svg className="sanfona__seta" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            id={corpo}
            className="sanfona__corpo"
            style={{ overflow: "hidden" }}
            initial={reduz ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={reduz ? undefined : { height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sanfona__interno">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
