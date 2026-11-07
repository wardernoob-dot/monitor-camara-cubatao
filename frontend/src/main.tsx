import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, NavLink, Link, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-mono/400.css";
import "./estilo.css";
import { ProvedorDados, useDados } from "./dados";
import { PoeiraRodape } from "./viz";
import { Busca, BotaoBusca } from "./busca";
import { BotaoTema } from "./tema";
import { BotaoPergunta, Pergunta } from "./pergunta";
import { Guara, GuaraVoo } from "./guara";
import { motion, useScroll } from "framer-motion";
import Inicio from "./paginas/Inicio";
import Vereadores from "./paginas/Vereadores";
import VereadorPagina from "./paginas/Vereador";
import Projetos from "./paginas/Projetos";
import ProjetoPagina from "./paginas/Projeto";
import Sessoes from "./paginas/Sessoes";
import SessaoPagina from "./paginas/Sessao";
import ComoFunciona from "./paginas/ComoFunciona";
import Ranking from "./paginas/Ranking";
import { ListaPartidos, PaginaPartido } from "./paginas/Partidos";
import NaoEncontrado from "./paginas/NaoEncontrado";

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
  ["/vereadores", "Vereadores"],
  ["/ranking", "Ranking"],
  ["/partidos", "Partidos"],
  ["/projetos", "Projetos"],
  ["/sessoes", "Sessões"],
  ["/como-funciona", "Como funciona"],
] as const;

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
      <PoeiraRodape />
      <div className="rodape__dentro">
        <div className="rodape__grade">
          <div className="rodape__marca">
            <span className="rodape__glifo"><Guara tamanho={40} /></span>
            <p className="rodape__nome">Voto a voto</p>
            <p className="rodape__lema">Como cada vereador de {meta.cidade} votou, com a fonte de cada voto.</p>
            <GuaraVoo tamanho={44} className="rodape__voo" />
          </div>
          <nav className="rodape__col" aria-label="Navegar">
            <h2 className="rodape__titulo">Navegar</h2>
            <ul>
              {SECOES.map(([para, nome]) => <li key={para}><Link to={para}>{nome}</Link></li>)}
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
              <li><a href={meta.repo} rel="noopener noreferrer">Código-fonte aberto</a></li>
              <li><a href="https://www.cubatao.sp.leg.br/" rel="noopener noreferrer">Câmara Municipal de {meta.cidade}</a></li>
            </ul>
          </nav>
        </div>
        <div className="rodape__base">
          <p>
            Dados públicos da Câmara Municipal de {meta.cidade}, reunidos automaticamente a partir do painel de votação exibido na transmissão
            oficial, dos resumos das sessões, das pautas e do Diário Oficial. Projeto independente, sem vínculo com a Câmara.
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
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
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
