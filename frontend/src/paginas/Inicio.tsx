import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useDados, type Vereador, type Votacao } from "../dados";
import { Avatar, Celula, Legenda } from "../componentes";
import { calcular } from "../estatisticas";
import { EASE, useEntrou } from "../movimento";
import { Barras, COR, Contador, FaixaMini, FeedVotacoes, Funil, GradeHero, Heatmap, Modal } from "../viz";
import { Destaque } from "../explica";
import { dataCurta, dataExtenso, useTitulo } from "../util";

const COLUNAS = 80;
const LINHAS_TITULO = ["Como cada vereador", "de Cubatão votou"];


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
  const destaques = useMemo(() => b.materias.filter((m) => m.lista && m.relevancia.nivel === "alta").slice(0, 6), [b]);
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
        <motion.div className="hero__fundo" style={{ opacity: reduz ? 1 : opacidadeGrade }}><GradeHero /></motion.div>
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
            {b.votacoes.filter((v) => Object.keys(v.votos).length).length} votações da Câmara Municipal em 2026, com o voto de cada um dos 15 vereadores, conferidas com o painel eletrônico da transmissão e os documentos oficiais.
          </motion.p>
          <motion.div className="hero__acoes" initial={reduz ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65, ease: EASE }}>
            <Link className="botao botao--acao" to="/vereadores">Ver os vereadores</Link>
            <Link className="botao botao--fantasma" to="/projetos">Buscar um projeto</Link>
          </motion.div>
        </div>
      </section>

      <div className="pagina pagina--larga">
        <section aria-labelledby="numeros-titulo">
          <h2 id="numeros-titulo" className="secao__titulo">O que a Câmara fez em 2026</h2>
          <div className="bento">
            <Bloco i={0} classe="bento__tile--contador"><Contador valor={p.apresentados} rotulo="projetos apresentados ou votados" /></Bloco>
            <Bloco i={1} classe="bento__tile--contador"><Contador valor={p.leis} rotulo="viraram lei no Diário Oficial" /></Bloco>
            <Bloco i={2} classe="bento__tile--contador"><Contador valor={p.vetos.length} rotulo="projetos vetados pelo prefeito" /></Bloco>
            <Bloco i={3} classe="bento__tile--contador"><Contador valor={p.sessoes} rotulo="dias de sessão com votação" /></Bloco>

            <Bloco i={4} classe="bento__tile--largo">
              <h3 className="tile__titulo">Vetos do prefeito</h3>
              <p className="tile__nota">O prefeito pode vetar um projeto aprovado. O veto volta para a Câmara, que decide se mantém (o projeto ou a parte vetada não vale) ou derruba.</p>
              <Barras
                itens={[{ rotulo: "Vetos", partes: [
                  { valor: p.vetos.filter((x) => x.resultado === "mantido").length, classe: "parte--mantido", nome: "mantidos pela Câmara" },
                  { valor: p.vetos.filter((x) => x.resultado === "derrubado").length, classe: "parte--derrubado", nome: "derrubados pela Câmara" },
                  { valor: p.vetos.filter((x) => x.resultado === "aguardando").length, classe: "parte--aguardando", nome: "aguardando votação" },
                ] }]}
                legenda={[{ classe: "parte--mantido", nome: "Veto mantido" }, { classe: "parte--derrubado", nome: "Veto derrubado" }, { classe: "parte--aguardando", nome: "Falta votar" }]}
              />
              <ul className="lista-vetos">
                {p.vetos.map(({ m, resultado }) => (
                  <li key={m.slug}>
                    <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link>
                    <span className={`lista-vetos__res lista-vetos__res--${resultado}`}>{resultado === "mantido" ? "veto mantido" : resultado === "derrubado" ? "veto derrubado" : "falta votar o veto"}</span>
                    <span className="lista-vetos__assunto">{m.assunto}</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            <Bloco i={5} classe="bento__tile--largo">
              <h3 className="tile__titulo">Do projeto à lei</h3>
              <Funil etapas={p.funilProjetos} />
              <h3 className="tile__titulo tile__titulo--seguinte">Do que tratam os projetos</h3>
              <Barras
                itens={p.temas.map((t) => ({ rotulo: t.rotulo, partes: [
                  { valor: t.aprovados, classe: "parte--aprovado", nome: "aprovados" },
                  { valor: t.outros, classe: "parte--outro", nome: "em andamento ou não votados" },
                ] }))}
                legenda={[{ classe: "parte--aprovado", nome: "Aprovados" }, { classe: "parte--outro", nome: "Em andamento ou não votados" }]}
              />
            </Bloco>

            <Bloco i={6} classe="bento__tile--largo">
              <h3 className="tile__titulo">Quem apresenta os projetos</h3>
              <p className="tile__nota">Projetos de lei, de resolução e de decreto legislativo, por autor. Projeto apresentado por mais de um vereador conta para cada um e aparece listrado.</p>
              <Barras
                itens={p.autoria.map((a) => ({ rotulo: a.rotulo, para: a.para, partes: [
                  { valor: a.aprovados, classe: "parte--aprovado", nome: "aprovados (sozinho)" },
                  { valor: a.aprovadosJunto, classe: "parte--aprovado parte--junto", nome: "aprovados (com outros vereadores)" },
                  { valor: a.outros, classe: "parte--outro", nome: "em andamento ou não votados (sozinho)" },
                  { valor: a.outrosJunto, classe: "parte--outro parte--junto", nome: "em andamento ou não votados (com outros vereadores)" },
                ] }))}
                legenda={[
                  { classe: "parte--aprovado", nome: "Aprovados" },
                  { classe: "parte--outro", nome: "Em andamento ou não votados" },
                  { classe: "parte--neutro parte--junto", nome: "Com outros vereadores" },
                ]}
              />
            </Bloco>

            <Bloco i={7} classe="bento__tile--largo">
              <h3 className="tile__titulo">Faltas nas sessões</h3>
              <p className="tile__nota">Segundo a lista de presença dos resumos oficiais de {p.sessoes} dias de sessão em 2026.</p>
              <Barras
                itens={p.faltas.map((f) => ({ rotulo: f.v.exibicao, para: `/vereadores/${f.v.slug}`, partes: [
                  { valor: f.ausente, classe: "parte--ausente", nome: "faltas sem justificativa" },
                  { valor: f.justificada, classe: "parte--justificada", nome: "faltas justificadas" },
                ] }))}
                legenda={[{ classe: "parte--ausente", nome: "Sem justificativa" }, { classe: "parte--justificada", nome: "Justificada" }]}
              />
            </Bloco>

            <Bloco i={8} classe="bento__tile--largo">
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

            <Bloco i={9} classe="bento__tile--largo">
              <h3 className="tile__titulo">Projetos em destaque</h3>
              <p className="tile__nota">Mexem no orçamento, em servidores ou na Lei Orgânica, foram vetados, rejeitados ou tiveram votação dividida.</p>
              <ul className="lista-vetos">
                {destaques.map((m) => (
                  <li key={m.slug}>
                    <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link> <Destaque m={m} compacto />
                    <span className="lista-vetos__assunto">{m.assunto}</span>
                  </li>
                ))}
              </ul>
              <p><Link to="/projetos?destaque=1">Ver todos os projetos em destaque</Link></p>
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
                  <Avatar v={v} tamanho="retrato" />
                  <span>
                    <span className="cartao__nome">{v.exibicao}</span>
                    <span className="cartao__civil">{v.nome}{v.partido ? `, ${v.partido}` : ""}{v.cargo === "presidente" ? ". Presidente da Câmara" : ""}</span>
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
