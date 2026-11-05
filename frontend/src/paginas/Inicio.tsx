import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useDados, type Vereador, type Votacao } from "../dados";
import { Celula, Legenda } from "../componentes";
import { calcular } from "../estatisticas";
import { EASE, useEntrou } from "../movimento";
import { COR, Contador, FaixaMini, FeedVotacoes, Funil, GradeHero, Heatmap, Modal, Sparkline } from "../viz";
import { dataCurta, dataExtenso, useTitulo } from "../util";

const COLUNAS = 80;
const LINHAS_TITULO = ["Como cada vereador", "de Cubatão votou"];

function semana(p: { x: string }) {
  return `semana de ${dataCurta(p.x)}`;
}

function Bloco({ children, classe = "", i }: { children: React.ReactNode; classe?: string; i: number }) {
  const [ref, entrou] = useEntrou<HTMLDivElement>("-10% 0px");
  const reduz = useReducedMotion();
  return (
    <motion.div ref={ref} className={`bento__tile ${classe}`} initial={reduz ? false : { opacity: 0, y: 16 }}
      animate={entrou || reduz ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: (i % 6) * 0.06, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export default function Inicio() {
  useTitulo("Como cada vereador votou");
  const b = useDados();
  const reduz = useReducedMotion();
  const p = useMemo(() => calcular(b), [b]);
  const colunas = useMemo(() => b.votacoes.filter((v) => v.fonte === "painel").slice(-COLUNAS), [b]);
  const grupos = useMemo(() => {
    const g: { data: string; n: number }[] = [];
    colunas.forEach((c) => (g.length && g[g.length - 1].data === c.data ? g[g.length - 1].n++ : g.push({ data: c.data, n: 1 })));
    return g;
  }, [colunas]);
  const recentes = useMemo(() => [...b.votacoes].filter((v) => v.resultado).reverse().slice(0, 20), [b]);
  const presidente = b.atuais.find((v) => v.cargo === "presidente");
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [colunas]);

  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const opacidadeGrade = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const [par, setPar] = useState<{ a: Vereador; b: Vereador } | null>(null);
  const fecha = useCallback(() => setPar(null), []);
  const detalhePar = useMemo(() => {
    if (!par) return [];
    return b.votacoes.filter((ev) => ev.fonte === "painel" && ["SIM", "NAO"].includes(ev.votos[par.a.slug]) &&
      ["SIM", "NAO"].includes(ev.votos[par.b.slug]) && ev.votos[par.a.slug] !== ev.votos[par.b.slug]);
  }, [b, par]);

  const corAlinh = (v: number | null) => v == null ? "#eeeeee" : `color-mix(in srgb, ${COR.verde} ${Math.round(Math.max(0, (v - 0.6) / 0.4) * 100)}%, #f1f1f1)`;
  const ultimos30 = (v: Vereador) => colunas.slice(-30).map((ev) => ev.votos[v.slug]);

  return (
    <>
      <section ref={hero} className="hero" aria-labelledby="titulo-inicio">
        {!reduz && <motion.div className="hero__fundo" style={{ opacity: opacidadeGrade }}><GradeHero /></motion.div>}
        <div className="hero__dentro">
          <h1 id="titulo-inicio" className="hero__titulo">
            {LINHAS_TITULO.map((l, i) => (
              <span key={l} className="hero__linha">
                <motion.span initial={reduz ? false : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: EASE }}>
                  {l}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="hero__texto" initial={reduz ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            {p.votacoes} votações da Câmara Municipal em 2026, com o voto de cada um dos 15 vereadores, conferidas com o painel eletrônico da transmissão e os documentos oficiais.
          </motion.p>
          <motion.div className="hero__acoes" initial={reduz ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65, ease: EASE }}>
            <Link className="botao botao--acao" to="/vereadores">Ver os vereadores</Link>
            <Link className="botao botao--fantasma" to="/projetos">Buscar um projeto</Link>
          </motion.div>
        </div>
      </section>

      <div className="pagina pagina--larga">
        <section aria-labelledby="numeros-titulo">
          <h2 id="numeros-titulo" className="secao__titulo">A Câmara em números</h2>
          <div className="bento">
            <Bloco i={0} classe="bento__tile--contador"><Contador valor={p.votacoes} rotulo="votações com placar registrado" /></Bloco>
            <Bloco i={1} classe="bento__tile--contador"><Contador valor={p.votosIndividuais} rotulo="votos individuais de sim ou não" /></Bloco>
            <Bloco i={2} classe="bento__tile--contador"><Contador valor={p.sessoes} rotulo="dias de sessão com votação" /></Bloco>
            <Bloco i={3} classe="bento__tile--contador"><Contador valor={p.leis} rotulo="projetos que viraram lei" /></Bloco>
            <Bloco i={4} classe="bento__tile--largo">
              <h3 className="tile__titulo">Votações por semana</h3>
              <Sparkline serie={p.serieVotacoes} rotulo="Votações por semana" formato={(x) => `${x.y} votações na ${semana(x)}`} />
            </Bloco>
            <Bloco i={5} classe="bento__tile--largo">
              <h3 className="tile__titulo">Votos “não” por semana</h3>
              <Sparkline serie={p.serieNao} cor={COR.vermelho} rotulo="Votos não por semana" formato={(x) => `${x.y} votos não na ${semana(x)}`} />
            </Bloco>
            <Bloco i={6} classe="bento__tile--largo">
              <h3 className="tile__titulo">Votações divididas por semana</h3>
              <Sparkline serie={p.serieDivididas} rotulo="Votações com algum voto não, por semana" formato={(x) => `${x.y} votações divididas na ${semana(x)}`} />
            </Bloco>
            <Bloco i={7} classe="bento__tile--largo">
              <h3 className="tile__titulo">Presentes que não votaram, por semana</h3>
              <Sparkline serie={p.serieSemVoto} cor={COR.cinza} rotulo="Presentes sem votar por semana, desde setembro" formato={(x) => `${x.y} registros de presente sem votar na ${semana(x)}`} />
            </Bloco>
            <Bloco i={8} classe="bento__tile--largo">
              <h3 className="tile__titulo">Projetos de lei, do protocolo à lei</h3>
              <Funil etapas={p.funilProjetos} />
            </Bloco>
            <Bloco i={9} classe="bento__tile--largo">
              <h3 className="tile__titulo">Quanto as votações dividem a Câmara</h3>
              <Funil etapas={p.funilVotacoes} />
            </Bloco>
            <Bloco i={10} classe="bento__tile--alto">
              <h3 className="tile__titulo">Quem vota igual a quem</h3>
              <p className="tile__nota">Porcentagem de votações do painel em que os dois votaram igual, entre as que ambos votaram sim ou não. Clique num quadrado para ver as votações em que discordaram.</p>
              <Heatmap
                linhas={p.alinhamento}
                colunas={b.atuais.length}
                valor={(c) => (c.total ? c.iguais / c.total : null)}
                cor={(v) => corAlinh(v)}
                rotuloCelula={(c) => c.a === c.b ? c.a.exibicao : `${c.a.exibicao} e ${c.b.exibicao}: votaram igual em ${c.iguais} de ${c.total}`}
                aoClicar={(c) => c.a !== c.b && setPar({ a: c.a, b: c.b })}
                rotuloLinha={(i) => b.atuais[i].exibicao}
                rotuloColuna={(j) => b.atuais[j].iniciais}
                legenda={<p className="tile__nota heat__legenda"><span className="heat__amostra" style={{ background: corAlinh(0.6) }} /> 60% ou menos <span className="heat__amostra" style={{ background: corAlinh(1) }} /> 100%</p>}
              />
            </Bloco>
            <Bloco i={11} classe="bento__tile--alto">
              <h3 className="tile__titulo">Votou em cada dia de sessão</h3>
              <p className="tile__nota">Por dia de sessão desde setembro: votou ao menos uma vez, esteve presente sem votar, ou ausente.</p>
              <Heatmap
                linhas={p.presenca.map((x) => x.dias.map((d) => ({ ...d, v: x.v })))}
                colunas={p.presenca[0]?.dias.length ?? 0}
                valor={() => 1}
                cor={(_, c) => c.estado === "votou" ? COR.verde : c.estado === "semvoto" ? "#ffffff" : c.estado === "ausente" ? "repeating-linear-gradient(135deg,#c9c9c9 0 2px,transparent 2px 4px)" : "#eeeeee"}
                rotuloCelula={(c) => `${c.v.exibicao}, ${dataCurta(c.data)}: ${c.estado === "votou" ? "votou" : c.estado === "semvoto" ? "presente sem votar" : c.estado === "ausente" ? "ausente" : "sem registro"}`}
                rotuloLinha={(i) => p.presenca[i].v.exibicao}
                rotuloColuna={(j) => dataCurta(p.presenca[0].dias[j].data).slice(0, 2)}
                legenda={
                  <ul className="legenda" aria-label="Legenda">
                    <li><span className="cel cel--sim" aria-hidden="true" /> Votou</li>
                    <li><span className="cel cel--branco" aria-hidden="true" /> Presente sem votar</li>
                    <li><span className="cel cel--ausente" aria-hidden="true" /> Ausente</li>
                    <li><span className="cel cel--vazio" aria-hidden="true" /> Sem registro</li>
                  </ul>}
              />
            </Bloco>
          </div>
        </section>

        <section className="mx-secao" aria-labelledby="mx-titulo">
          <div className="mx-secao__principal">
            <h2 id="mx-titulo" className="secao__titulo">Voto a voto, desde {colunas.length ? dataExtenso(colunas[0].data) : "setembro"}</h2>
            <p className="tile__nota">Cada quadrado é um voto registrado no painel eletrônico. Passe o mouse ou toque para ver o projeto; clique para abrir.</p>
            <div className="mx-rolagem" ref={rolagem} tabIndex={0} aria-label="Tabela de votos, role para os lados">
              <table className="mx">
                <thead>
                  <tr>
                    <th scope="col" className="mx__canto">Vereador</th>
                    {grupos.map((g) => <th key={g.data} scope="colgroup" colSpan={g.n} className="mx__data">{dataCurta(g.data)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {b.atuais.map((v) => (
                    <tr key={v.slug}>
                      <th scope="row" className="mx__nome">
                        <Link to={`/vereadores/${v.slug}`}>{v.exibicao}</Link>
                        {v.cargo === "presidente" && <sup className="mx__cargo" aria-label="presidente">*</sup>}
                      </th>
                      {colunas.map((ev: Votacao, i) => (
                        <td key={ev.id} className={i === 0 || ev.data !== colunas[i - 1].data ? "mx__novo-dia" : undefined}>
                          <Celula ev={ev} voto={ev.votos[v.slug]} nome={v.exibicao} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legenda />
            {presidente && <p className="nota">* {presidente.exibicao} é o presidente da Câmara e conduz as sessões. O Regimento Interno define em que casos o presidente vota.</p>}
          </div>
          <aside className="mx-secao__feed"><FeedVotacoes eventos={recentes} /></aside>
        </section>

        <section aria-labelledby="ver-titulo">
          <h2 id="ver-titulo" className="secao__titulo">Os 15 vereadores</h2>
          <ul className="cartoes">
            {b.atuais.map((v, i) => (
              <motion.li key={v.slug} className="cartao" initial={reduz ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: EASE }}>
                <Link to={`/vereadores/${v.slug}`} className="cartao__link">
                  <span className="cartao__topo">
                    <span className="monograma" aria-hidden="true">{v.iniciais}</span>
                    <span>
                      <span className="cartao__nome">{v.exibicao}</span>
                      <span className="cartao__civil">{v.nome}{v.partido ? `, ${v.partido}` : ""}</span>
                    </span>
                  </span>
                  <FaixaMini votos={ultimos30(v)} rotulo={v.exibicao} />
                  <span className="cartao__nums">
                    <span><strong>{v.contagem.NAO}</strong> não</span>
                    <span><strong>{v.contagem.BRANCO}</strong> sem votar</span>
                    <span><strong>{v.projetos.length}</strong> {v.projetos.length === 1 ? "projeto" : "projetos"}</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>

      <Modal aberto={!!par} aoFechar={fecha} titulo={par ? `${par.a.exibicao} e ${par.b.exibicao}` : ""}>
        {par && (
          <>
            <p>Votações do painel em que um votou sim e o outro não ({detalhePar.length}):</p>
            {detalhePar.length ? (
              <ul className="lista-simples">
                {detalhePar.map((ev) => (
                  <li key={ev.id}>
                    <Link to={`/projetos/${ev.materia}`} onClick={fecha}>{b.materia.get(ev.materia)?.titulo}</Link>, {ev.etapa_txt.toLowerCase()}, {dataCurta(ev.data)}: {par.a.exibicao} {ev.votos[par.a.slug] === "SIM" ? "sim" : "não"}, {par.b.exibicao} {ev.votos[par.b.slug] === "SIM" ? "sim" : "não"}.
                  </li>
                ))}
              </ul>
            ) : <p>Nenhuma: votaram igual em todas.</p>}
          </>
        )}
      </Modal>
    </>
  );
}
