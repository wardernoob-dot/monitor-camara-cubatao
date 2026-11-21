import { lazy, Suspense, StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, NavLink, Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-mono/400.css";
import "./estilo.css";
import { ProvedorDados, useDados } from "./dados";
import { Busca, BotaoBusca } from "./busca";
import { BotaoTema } from "./tema";
import { BotaoPergunta, Pergunta } from "./pergunta";
import { Guara, GuaraVoo } from "./guara";
import { motion, useScroll } from "framer-motion";
import Inicio from "./paginas/Inicio";
const Vereadores = lazy(() => import("./paginas/Vereadores"));
const VereadorPagina = lazy(() => import("./paginas/Vereador"));
const Projetos = lazy(() => import("./paginas/Projetos"));
const ProjetoPagina = lazy(() => import("./paginas/Projeto"));
const Sessoes = lazy(() => import("./paginas/Sessoes"));
const SessaoPagina = lazy(() => import("./paginas/Sessao"));
const ComoFunciona = lazy(() => import("./paginas/ComoFunciona"));
const Ranking = lazy(() => import("./paginas/Ranking"));
const ListaPartidos = lazy(() => import("./paginas/Partidos").then((m) => ({ default: m.ListaPartidos })));
const PaginaPartido = lazy(() => import("./paginas/Partidos").then((m) => ({ default: m.PaginaPartido })));
const Reportagens = lazy(() => import("./paginas/Reportagens"));
const Temas = lazy(() => import("./paginas/Temas"));
const Leis = lazy(() => import("./paginas/Leis"));
const EmAberto = lazy(() => import("./paginas/EmAberto"));
import NaoEncontrado from "./paginas/NaoEncontrado";
const ReportagemPagina = lazy(() => import("./paginas/Reportagem"));

/** Links antigos (#/reportagens/<id>) continuam valendo. */
function AntigaReportagem() {
  const { id } = useParams();
  return <Navigate to={`/o-que-muda/${id}`} replace />;
}

function RolaParaTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const alvo = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (alvo) alvo.scrollIntoView();
    else window.scrollTo(0, 0);
    document.getElementById("conteudo")?.focus({ preventScroll: true });
  }, [pathname, hash]);
  return null;
}

const SECOES = [
  ["/o-que-muda", "O que muda"],
  ["/vereadores", "Vereadores"],
  ["/ranking", "Ranking"],
  ["/partidos", "Partidos"],
  ["/projetos", "Projetos"],
  ["/sessoes", "Sessões"],
  ["/como-funciona", "Como funciona"],
] as const;

const OUTRAS = [
  ["/temas", "Votos por tema"],
  ["/leis", "Leis de 2026"],
  ["/em-aberto", "O que ficou pendente"],
] as const;

/** Celular: a barra de seções rola de lado e esconde metade dos itens. Este botão abre a lista inteira. */
function MenuCelular() {
  const ref = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("click", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", fora); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="menu-celular" ref={ref}>
      <summary className="tema-botao menu-celular__botao" aria-label="Todas as páginas">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </summary>
      {/* div com role, não <nav>: as regras de ".topo nav" (barra que rola de lado) não podem pegar aqui */}
      <div role="navigation" className="menu-celular__lista" aria-label="Todas as páginas">
        <ul>
          <li><Link to="/">Início</Link></li>
          {[...SECOES, ...OUTRAS].map(([para, nome]) => <li key={para}><Link to={para}>{nome}</Link></li>)}
        </ul>
      </div>
    </details>
  );
}

/** Barra fina de leitura no pé do cabeçalho. */
function Progresso() {
  const { scrollYProgress } = useScroll();
  return <motion.div className="topo__progresso" style={{ scaleX: scrollYProgress }} aria-hidden="true" />;
}

function Rodape() {
  const { meta } = useDados();
  const d = new Date(meta.atualizado);
  return (
    <footer className="rodape">
      <svg className="rodape__mangue" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 80V46C60 38 100 30 150 38C190 18 240 16 280 36C330 16 390 16 430 38C480 26 540 26 580 42C640 26 700 26 742 42C800 24 870 26 914 44C972 28 1036 28 1078 44C1130 28 1196 30 1236 46C1300 34 1370 34 1440 50V80Z" fill="var(--rodape-mangue)" />
      </svg>
      <div className="rodape__dentro">
        <div className="rodape__grade">
          <div className="rodape__marca">
            <span className="rodape__glifo"><Guara tamanho={40} /></span>
            <p className="rodape__nome">Voto a voto</p>
            <p className="rodape__lema">Como cada vereador de {meta.cidade} votou, com a fonte de cada voto.</p>
            <GuaraVoo tamanho={44} className="rodape__voo" />
          </div>
          <nav className="rodape__col" aria-label="Mais no site">
            <h2 className="rodape__titulo">Mais no site</h2>
            <ul>
              <li><Link to="/temas">Votos por tema</Link></li>
              <li><Link to="/leis">Leis de 2026</Link></li>
              <li><Link to="/em-aberto">O que ficou pendente</Link></li>
            </ul>
          </nav>
          <nav className="rodape__col" aria-label="Método">
            <h2 className="rodape__titulo">Método</h2>
            <ul>
              <li><Link to="/como-funciona">Como os dados são conferidos</Link></li>
              <li><Link to={{ pathname: "/como-funciona", hash: "#indice" }}>Como o índice é calculado</Link></li>
              <li><Link to={{ pathname: "/como-funciona", hash: "#limites" }}>O que o site não sabe</Link></li>
            </ul>
          </nav>
          <nav className="rodape__col" aria-label="Dados e código">
            <h2 className="rodape__titulo">Dados e código</h2>
            <ul>
              <li><a href="./data/dados.json">Baixar os dados (JSON)</a></li>
              <li><a href="./reportagens.xml">“O que muda” por RSS</a></li>
              <li><a href={meta.repo} rel="noopener noreferrer">Código-fonte aberto</a></li>
              <li><a href="https://www.cubatao.sp.leg.br/" rel="noopener noreferrer">Câmara Municipal de {meta.cidade}</a></li>
            </ul>
          </nav>
        </div>
        <div className="rodape__base">
          <p>
            Dados públicos da Câmara Municipal de {meta.cidade}. Projeto independente, sem vínculo com a Câmara. De onde vem cada informação está em <Link to="/como-funciona">Como funciona</Link>.
          </p>
          <p className="rodape__data">Atualizado em {d.toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <>
      <a className="pular" href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById("conteudo")?.focus(); }}>
        Pular para o conteúdo
      </a>
      <header className="topo">
        <div className="topo__dentro">
          <Link className="marca" to="/">
            <span className="marca__glifo"><Guara tamanho={26} /></span>
            <span className="marca__texto">
              <span className="marca__nome">Voto a voto</span>
              <span className="marca__sub">Câmara de Cubatão</span>
            </span>
          </Link>
          <div className="topo__acoes">
            <nav aria-label="Seções">
              <ul>
                {SECOES.map(([para, nome]) => (
                  <li key={para}>
                    <NavLink to={para}>
                      {({ isActive }) => (
                        <>
                          {isActive && <motion.span layoutId="nav-ativo" className="nav__pilula" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                          <span className="nav__texto">{nome}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="topo__botoes">
              <BotaoBusca />
              <BotaoTema />
              <BotaoPergunta />
              <MenuCelular />
            </div>
          </div>
        </div>
        <Progresso />
      </header>
      <Pergunta />
      <ProvedorDados>
        <RolaParaTopo />
        <Busca />
        <main id="conteudo" tabIndex={-1}>
          <Suspense fallback={<div className="pagina carregando" aria-busy="true"><p>Carregando…</p></div>}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/vereadores" element={<Vereadores />} />
            <Route path="/vereadores/:slug" element={<VereadorPagina />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/partidos" element={<ListaPartidos />} />
            <Route path="/partidos/:sigla" element={<PaginaPartido />} />
            <Route path="/projetos" element={<Projetos />} />
            <Route path="/projetos/:slug" element={<ProjetoPagina />} />
            <Route path="/sessoes" element={<Sessoes />} />
            <Route path="/sessoes/:data" element={<SessaoPagina />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/temas" element={<Temas />} />
            <Route path="/leis" element={<Leis />} />
            <Route path="/em-aberto" element={<EmAberto />} />
            <Route path="/o-que-muda" element={<Reportagens />} />
            <Route path="/reportagens" element={<Navigate to="/o-que-muda" replace />} />
            <Route path="/o-que-muda/:id" element={<ReportagemPagina />} />
            <Route path="/reportagens/:id" element={<AntigaReportagem />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
          </Suspense>
        </main>
        <Rodape />
      </ProvedorDados>
    </>
  );
}

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
