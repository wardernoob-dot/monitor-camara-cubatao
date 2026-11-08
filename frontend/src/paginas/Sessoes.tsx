import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useDados } from "../dados";
import { EASE } from "../movimento";
import { dataExtenso, nomeSessao, useTitulo } from "../util";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");

export default function Sessoes() {
  useTitulo("Sessões");
  const { dias } = useDados();
  const reduz = useReducedMotion();
  const [limite, setLimite] = useState(14);
  const visiveis = dias.slice(0, limite);

  // agrupa por mês, mantendo a ordem (mais recente primeiro)
  const meses = useMemo(() => {
    const g: { chave: string; rotulo: string; itens: typeof dias }[] = [];
    visiveis.forEach((d) => {
      const chave = d.data.slice(0, 7);
      let m = g[g.length - 1];
      if (!m || m.chave !== chave) {
        m = { chave, rotulo: `${MESES[Number(chave.slice(5)) - 1]} de ${chave.slice(0, 4)}`, itens: [] };
        g.push(m);
      }
      m.itens.push(d);
    });
    return g;
  }, [visiveis]);

  return (
    <div className="pagina">
      <p className="selo-pagina">Dia a dia</p>
      <h1 className="titulo-pagina">Sessões</h1>
      <p className="lead">Cada dia em que a Câmara votou alguma coisa em 2026. Ordinárias e extraordinárias do mesmo dia aparecem juntas.</p>

      <div className="sessoes">
        {meses.map((m) => (
          <section key={m.chave} className="sessoes__mes" aria-label={m.rotulo}>
            <h2 className="sessoes__titulo"><span>{m.rotulo}</span><span className="sessoes__conta">{m.itens.length} {m.itens.length === 1 ? "dia" : "dias"}</span></h2>
            <ol className="sessoes__lista">
              {m.itens.map((d, i) => {
                const itens = d.materias.length;
                return (
                  <motion.li key={d.data} className="sessao" initial={reduz ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-4% 0px" }} transition={{ duration: 0.45, delay: Math.min(i, 5) * 0.04, ease: EASE }}>
                    <span className="sessao__data" aria-hidden="true">
                      <span className="sessao__dia">{d.data.slice(8)}</span>
                      <span className="sessao__semana">{diaSemana(d.data)}</span>
                    </span>
                    <span className="sessao__corpo">
                      <Link to={`/sessoes/${d.data}`} className="sessao__link esticado"><span className="sr">{dataExtenso(d.data)}: </span>
                        {d.sessoes.map((s) => `${s.numero}ª ${nomeSessao(s.tipo)}`).join(" e ")}
                      </Link>
                      <span className="sessao__info">
                        {itens > 0 ? `${itens} ${itens === 1 ? "item votado" : "itens votados"}` : "sem itens votados"}
                        {d.sessoes.length > 1 && <span className="sessao__selo">{d.sessoes.length} sessões no dia</span>}
                      </span>
                    </span>
                    <span className="sessao__seta" aria-hidden="true">→</span>
                  </motion.li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {dias.length > limite && (
        <div className="mais">
          <button type="button" className="botao botao--fantasma" onClick={() => setLimite((l) => l + 14)}>
            Mostrar mais {Math.min(14, dias.length - limite)} de {dias.length - limite} restantes
          </button>
        </div>
      )}
    </div>
  );
}
