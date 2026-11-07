import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/** "Nesta página": índice lateral que acompanha a rolagem e destaca a seção em foco (como nos sites de documentação).
 *  As seções são as de <Secao id=…>; clicar abre a seção, porque ela já reage ao #id do endereço. */
export function Toc({ itens, caminho }: { itens: readonly (readonly [string, string])[]; caminho: string }) {
  const [ativo, setAtivo] = useState<string>("");

  useEffect(() => {
    const els = itens.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      const visiveis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visiveis[0]) setAtivo(visiveis[0].target.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [itens]);

  return (
    <aside className="toc" aria-label="Nesta página">
      <p className="toc__titulo">Nesta página</p>
      <ul className="toc__lista">
        {itens.map(([id, nome]) => (
          <li key={id}>
            <Link to={{ pathname: caminho, hash: `#${id}` }} className={`toc__link${ativo === id ? " toc__link--ativo" : ""}`}
              aria-current={ativo === id ? "location" : undefined}>{nome}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
