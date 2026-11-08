import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

/** "Nesta página": barra horizontal com as seções, logo abaixo do cabeçalho do site, que acompanha a rolagem.
 *  A pílula desliza até a seção em foco; no celular a barra rola para o lado e centraliza a seção atual.
 *  As seções são as de <Secao id=…> ou <section id=…>; clicar leva até a seção, e a Secao abre sozinha pelo #id.
 *  O CSS põe a barra antes do conteúdo (order: -1), então ela pode ficar em qualquer lugar do contêiner. */
export function Toc({ itens, caminho }: { itens: readonly (readonly [string, string])[]; caminho: string }) {
  const reduz = useReducedMotion();
  const [ativo, setAtivo] = useState<string>("");
  const [presentes, setPresentes] = useState<string[]>(() => itens.map(([id]) => id));
  const trilho = useRef<HTMLUListElement>(null);

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
    }, { rootMargin: "-22% 0px -62% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [itens, presentes]);

  // mantém a seção atual visível quando a barra rola para o lado (celular)
  useEffect(() => {
    const t = trilho.current;
    const el = t?.querySelector<HTMLElement>("[aria-current='location']");
    if (t && el) t.scrollTo({ left: el.offsetLeft - t.clientWidth / 2 + el.clientWidth / 2, behavior: reduz ? "auto" : "smooth" });
  }, [ativo, reduz]);

  const lista = itens.filter(([id]) => presentes.includes(id));
  if (lista.length < 2) return null;
  const topo = () => window.scrollTo({ top: 0, behavior: reduz ? "auto" : "smooth" });

  return (
    <nav className="subnav" aria-label="Nesta página">
      <span className="subnav__rotulo">Nesta página</span>
      <ul className="subnav__lista" ref={trilho}>
        {lista.map(([id, nome]) => {
          const em = id === ativo;
          return (
            <li key={id}>
              <Link to={{ pathname: caminho, hash: `#${id}` }} className={`subnav__link${em ? " subnav__link--ativo" : ""}`} aria-current={em ? "location" : undefined}>
                {em && <motion.span layoutId="subnav-pilula" className="subnav__pilula" transition={reduz ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }} />}
                <span className="subnav__texto">{nome}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button type="button" className="subnav__topo" onClick={topo} aria-label="Voltar ao topo" title="Voltar ao topo">↑</button>
    </nav>
  );
}
