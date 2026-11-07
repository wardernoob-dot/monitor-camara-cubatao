import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useDados, type Vereador, type Votacao } from "../dados";
import { Avatar, Celula, Legenda, TagPartido } from "../componentes";
import { calcular } from "../estatisticas";
import { EASE, useEntrou } from "../movimento";
import { Barras, COR, FeedVotacoes, Funil, GradeHero, Heatmap, Modal } from "../viz";
import { IndiceMini } from "../indice";
import { Painel } from "../painel";
import { Paisagem } from "../guara";
import { Destaque, Termo } from "../explica";
import { dataCurta, dataExtenso, useTitulo } from "../util";

const COLUNAS = 80;
const LINHAS_TITULO: [string, string?][] = [["Como cada vereador"], ["de Cubatão ", "votou"]];

const I = (d: ReactNode) => <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICONE = {
  pessoas: I(<><circle cx="8" cy="7" r="3" /><path d="M2.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="14.5" cy="8" r="2.2" /><path d="M15 12.2c2 .2 3.5 1.8 3.5 4.3" /></>),
  doc: I(<><path d="M5 2.5h6.5l4 4v11H5z" /><path d="M11.5 2.5v4h4" /><path d="M7.5 10.5h6M7.5 13.5h6" /></>),
  agenda: I(<><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v3M13 2.5v3" /></>),
  barras: I(<path d="M4 16V9M10 16V4M16 16v-5" />),
  predio: I(<path d="M3 8l7-4.5L17 8M4.5 8v7M8 8v7M12 8v7M15.5 8v7M3 17h14" />),
  escudo: I(<><path d="M10 2.5l6 2.2v4.8c0 4-2.6 6.4-6 8-3.4-1.6-6-4-6-8V4.7z" /><path d="M7 10l2.2 2.2L13.2 8" /></>),
};

const CAMINHOS = [
  { to: "/vereadores", icone: ICONE.pessoas, titulo: "Como meu vereador votou", texto: "Votos, presença e projetos de cada um dos 15 vereadores, com a fonte de cada voto.", chamada: "Ver os vereadores" },
  { to: "/projetos", icone: ICONE.doc, titulo: "Quero achar um projeto", texto: "Busque por tema ou número e acompanhe as etapas, o placar e se virou lei ou foi vetado.", chamada: "Buscar um projeto" },
  { to: "/sessoes", icone: ICONE.agenda, titulo: "O que aconteceu nas sessões", texto: "Pauta, presença e votações de cada sessão da Câmara em 2026.", chamada: "Ver as sessões" },
  { to: "/ranking", icone: ICONE.barras, titulo: "Índice de Atuação", texto: "Nota de 0 a 10 por presença, participação, projetos e fiscalização, com a conta aberta.", chamada: "Ver o ranking" },
  { to: "/partidos", icone: ICONE.predio, titulo: "Partidos e a Prefeitura", texto: "Como cada bancada vota e com que frequência acompanha a posição da Prefeitura.", chamada: "Ver os partidos" },
  { to: "/como-funciona", icone: ICONE.escudo, titulo: "Como os dados são conferidos", texto: "De onde vem cada informação, como lemos o painel e o que o site não consegue saber.", chamada: "Ver o método" },
];

const luz = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

const EXPLORAR = [
  { area: "Vereadores", texto: "Quem são, como votaram e como atuam.", links: [["Os 15 vereadores", "/vereadores"], ["Índice de Atuação", "/ranking"]] },
  { area: "Projetos", texto: "O que foi apresentado, votado, vetado ou virou lei.", links: [["Todos os projetos", "/projetos"], ["Projetos em destaque", "/projetos?destaque=1"]] },
  { area: "Sessões", texto: "Pauta, presença e votações dia a dia.", links: [["Todas as sessões", "/sessoes"], ["Partidos e a Prefeitura", "/partidos"]] },
  { area: "Método e dados", texto: "De onde vem cada informação e como baixar.", links: [["Como funciona", "/como-funciona"], ["Como o índice é calculado", "/como-funciona#indice"], ["Dados abertos (JSON)", "./data/dados.json"]] },
] as const;

const PASSOS: { n: string; titulo: string; texto: ReactNode }[] = [
  { n: "01", titulo: "Documentos oficiais", texto: <>Pautas, resumos de sessão, projetos e <Termo chave="diario">Diário Oficial</Termo>, guardados com um código de verificação (<Termo chave="sha256">SHA-256</Termo>).</> },
  { n: "02", titulo: "Painel da transmissão", texto: <>O voto de cada vereador é lido pela cor do quadrado no <Termo chave="painel">painel</Termo> do YouTube, sem IA.</> },
  { n: "03", titulo: "Conferência", texto: <>Painel e <Termo chave="resumo">resumo oficial</Termo> ficam lado a lado, e as divergências aparecem na tela.</> },
  { n: "04", titulo: "Fonte à vista", texto: "Todo voto mostra de onde veio: painel da transmissão ou resumo oficial." },
];


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

  const mediaAlinh = useMemo(() => {
    const pares = p.alinhamento.flat().filter((c) => c.a !== c.b && c.total);
    return pares.length ? Math.round((100 * pares.reduce((s, c) => s + c.iguais / c.total, 0)) / pares.length) : 0;
  }, [p]);
  const corAlinh = (v: number | null) => v == null ? "var(--suave-2)" : `color-mix(in srgb, var(--color-accent) ${Math.round(Math.max(0, (v - 0.6) / 0.4) * 100)}%, var(--suave))`;

  return (
    <>
      <section ref={hero} className="hero" aria-labelledby="titulo-inicio">
        <motion.div className="hero__fundo" style={{ opacity: reduz ? 1 : opacidadeGrade }}><GradeHero /></motion.div>
        <Paisagem />
        <div className="hero__dentro">
          <p className="hero__selo">Câmara Municipal de Cubatão · 2026</p>
          <h1 id="titulo-inicio" className="hero__titulo">
            {LINHAS_TITULO.map((l, i) => (
              <span key={l[0]} className="hero__linha">
                <motion.span initial={reduz ? false : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: EASE }}>
                  {l[0]}{l[1] && <span className="hero__destaque">{l[1]}</span>}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="hero__texto" initial={reduz ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            {b.votacoes.filter((v) => Object.keys(v.votos).length).length} votações da Câmara Municipal em 2026, com o voto de cada um dos 15 vereadores, conferidas com o <Termo chave="painel">painel eletrônico</Termo> da transmissão e os documentos oficiais.
          </motion.p>
          <motion.div className="hero__acoes" initial={reduz ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65, ease: EASE }}>
            <Link className="botao botao--acao" to="/vereadores">Ver os vereadores</Link>
            <Link className="botao botao--fantasma" to="/projetos">Buscar um projeto</Link>
          </motion.div>
        </div>
      </section>

      <div className="pagina pagina--larga">
        <section className="caminhos" aria-labelledby="caminhos-titulo">
          <header className="cab-secao">
            <p className="cab-secao__selo">Comece por aqui</p>
            <h2 id="caminhos-titulo" className="cab-secao__titulo">Por onde você quer começar?</h2>
          </header>
          <ul className="caminhos__lista">
            {CAMINHOS.map((c, i) => (
              <motion.li key={c.to} className="caminho" onPointerMove={luz} initial={reduz ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8% 0px" }} transition={{ duration: 0.55, delay: (i % 3) * 0.07, ease: EASE }}>
                <div className="caminho__topo">
                  <span className="caminho__icone">{c.icone}</span>
                  <span className="caminho__n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="caminho__titulo">{c.titulo}</h3>
                <p className="caminho__texto">{c.texto}</p>
                <Link to={c.to} className="caminho__link esticado">{c.chamada}<span className="caminho__seta" aria-hidden="true">→</span></Link>
              </motion.li>
            ))}
          </ul>
        </section>

        <section className="passos" aria-labelledby="passos-titulo">
          <header className="cab-secao cab-secao--lado">
            <div>
              <p className="cab-secao__selo">Método</p>
              <h2 id="passos-titulo" className="cab-secao__titulo">Como cada voto chega até aqui</h2>
            </div>
            <Link to="/como-funciona" className="link-seta">Ver o método completo <span aria-hidden="true">→</span></Link>
          </header>
          <ol className="passos__lista">
            <motion.span className="passos__linha" aria-hidden="true" initial={reduz ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 1.4, ease: EASE }} />
            {PASSOS.map((x, i) => (
              <motion.li key={x.n} className="passo" initial={reduz ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.6, delay: 0.15 + i * 0.18, ease: EASE }}>
                <span className="passo__n">{x.n}</span>
                <h3 className="passo__titulo">{x.titulo}</h3>
                <p className="passo__texto">{x.texto}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {destaques.length > 0 && (
          <section className="em-destaque" aria-labelledby="destaque-titulo">
            <header className="cab-secao cab-secao--lado">
              <div>
                <p className="cab-secao__selo">Atenção</p>
                <h2 id="destaque-titulo" className="cab-secao__titulo">Projetos em destaque</h2>
                <p className="cab-secao__texto">Mexem no orçamento, em servidores ou na <Termo chave="loa">Lei Orgânica</Termo>, foram vetados, rejeitados ou tiveram votação dividida. Critério fixo e público, igual para todos; não diz se o projeto é bom ou ruim.</p>
              </div>
              <Link to="/projetos?destaque=1" className="link-seta">Ver todos <span aria-hidden="true">→</span></Link>
            </header>
            <ul className="destaques">
              {destaques.slice(0, 3).map((m) => (
                <li key={m.slug} className="destaque" onPointerMove={luz}>
                  <span className="destaque__id">{m.titulo}</span>
                  <span className="destaque__corpo">
                    <span className="destaque__situacao">{m.situacao}</span>
                    <span className="destaque__ementa">{m.assunto.toLowerCase().replace(/cubat[ãa]o/g, "Cubatão")}</span>
                  </span>
                  <Link to={`/projetos/${m.slug}`} className="destaque__link esticado" aria-label={`Ver o projeto ${m.titulo}`}><span aria-hidden="true">→</span></Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="painel-secao" aria-labelledby="painel-titulo">
          <h2 id="painel-titulo" className="sr">A Câmara em 2026</h2>
          <Painel rotulo="A Câmara em 2026" abas={[
            { id: "projetos", numero: p.apresentados, rotulo: "projetos em 2026", titulo: "Do projeto à lei",
              descricao: `${p.leis} viraram lei no Diário Oficial. Abaixo, do que tratam os projetos.`, conteudo: (
              <>
            <div className="tile-solto">
                <Funil etapas={p.funilProjetos} />
                <h3 className="tile__titulo tile__titulo--seguinte">Do que tratam os projetos</h3>
                <Barras
                  itens={p.temas.map((t) => ({ rotulo: t.rotulo, partes: [
                    { valor: t.aprovados, classe: "parte--aprovado", nome: "aprovados" },
                    { valor: t.outros, classe: "parte--outro", nome: "em andamento ou não votados" },
                  ] }))}
                  legenda={[{ classe: "parte--aprovado", nome: "Aprovados" }, { classe: "parte--outro", nome: "Em andamento ou não votados" }]}
                />
            </div>
              </>) },
            { id: "vetos", numero: p.vetos.length, rotulo: "vetos do prefeito", titulo: "Vetos do prefeito",
              descricao: "O prefeito pode vetar um projeto aprovado. O veto volta para a Câmara, que mantém ou derruba.", conteudo: (
              <div className="tile-solto">
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
              </div>) },
            { id: "destaques", numero: b.materias.filter((m) => m.lista && m.relevancia.nivel === "alta").length, rotulo: "projetos em destaque", titulo: "Projetos em destaque",
              descricao: "Mexem no orçamento, em servidores ou na Lei Orgânica, foram vetados, rejeitados ou tiveram votação dividida.", conteudo: (
              <div className="tile-solto">
              <ul className="lista-vetos">
                {destaques.map((m) => (
                  <li key={m.slug}>
                    <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link> <Destaque m={m} compacto />
                    <span className="lista-vetos__assunto">{m.assunto}</span>
                  </li>
                ))}
              </ul>
              <p><Link to="/projetos?destaque=1">Ver todos os projetos em destaque</Link></p>
              </div>) },
            { id: "autoria", numero: p.autoria.filter((x) => x.para).length, rotulo: "vereadores com projetos", titulo: "Quem apresenta os projetos",
              descricao: "Projeto apresentado por mais de um vereador conta para cada um e aparece listrado.", conteudo: (
              <>
<div className="tile-solto">
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
            </div>
              </>) },
            { id: "faltas", numero: p.faltas.reduce((s, f) => s + f.ausente + f.justificada, 0), rotulo: "faltas nas sessões", titulo: "Faltas nas sessões",
              descricao: `Lista de presença dos resumos oficiais de ${p.sessoes} dias de sessão em 2026.`, conteudo: (
              <>
<div className="tile-solto">
                <Barras
                  itens={p.faltas.map((f) => ({ rotulo: f.v.exibicao, para: `/vereadores/${f.v.slug}`, partes: [
                    { valor: f.ausente, classe: "parte--ausente", nome: "faltas sem justificativa" },
                    { valor: f.justificada, classe: "parte--justificada", nome: "faltas justificadas" },
                  ] }))}
                  legenda={[{ classe: "parte--ausente", nome: "Sem justificativa" }, { classe: "parte--justificada", nome: "Justificada" }]}
                />
            </div>
              </>) },
            { id: "alinhamento", numero: mediaAlinh, sufixo: "%", rotulo: "das vezes votam igual", titulo: "Quem vota igual a quem", arrastavel: false,
              descricao: "Votações do painel em que os dois votaram igual. Toque num quadrado para ver onde discordaram.", conteudo: (
              <>
<div className="tile-solto">
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
            </div>
              </>) },
            { id: "voto-a-voto", numero: colunas.length, rotulo: "votações no painel", titulo: `Voto a voto, desde ${colunas.length ? dataExtenso(colunas[0].data) : "setembro"}`, arrastavel: false,
              descricao: "Cada quadrado é um voto registrado no painel eletrônico. Passe o mouse ou toque para ver o projeto.", conteudo: (
            <div className="mx-secao">
            <div className="mx-secao__principal">
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
            </div>
            ) },
          ]} />
        </section>

        <section aria-labelledby="ver-titulo">
          <h2 id="ver-titulo" className="secao__titulo">Os 15 vereadores</h2>
          <ul className="cartoes">
            {b.atuais.map((v, i) => (
              <motion.li key={v.slug} className="cartao" initial={reduz ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: EASE }}>
                <div className="cartao__link">
                  <Avatar v={v} tamanho="retrato" />
                  <span>
                    <Link to={`/vereadores/${v.slug}`} className="cartao__nome esticado">{v.exibicao}</Link>
                    <span className="cartao__civil">{v.nome}{v.cargo === "presidente" ? ", presidente da Câmara" : ""} <TagPartido sigla={v.partido} /></span>
                  </span>
                  <IndiceMini i={v.indice} />
                  <span className="cartao__nums">
                    <span><strong>{v.sessoes_total ? Math.round((100 * (v.presenca.sim ?? 0)) / v.sessoes_total) : 0}%</strong> presença</span>
                    <span><strong>{v.projetos.length}</strong> {v.projetos.length === 1 ? "projeto" : "projetos"}</span>
                    <span><strong>{v.leis}</strong> {v.leis === 1 ? "virou lei" : "viraram lei"}</span>
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>

        <section className="explorar" aria-labelledby="explorar-titulo">
          <header className="cab-secao"><p className="cab-secao__selo">Mapa do site</p><h2 id="explorar-titulo" className="cab-secao__titulo">Explorar o site</h2></header>
          <div className="explorar__grade">
            {EXPLORAR.map((e) => (
              <div key={e.area} className="explorar__area">
                <h3 className="explorar__nome">{e.area}</h3>
                <p className="explorar__texto">{e.texto}</p>
                <ul className="explorar__links">
                  {e.links.map(([t, to]) => (
                    <li key={t}>{to.startsWith("./") ? <a href={to}>{t}</a> : <Link to={to}>{t}</Link>}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
