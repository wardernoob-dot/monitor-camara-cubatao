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

function Rodape() {
  const { meta } = useDados();
  const d = new Date(meta.atualizado);
  return (
    <footer className="rodape">
      <PoeiraRodape />
      <div className="rodape__dentro">
        <p>
          Dados públicos da Câmara Municipal de {meta.cidade}, reunidos automaticamente a partir do painel de votação
          exibido na transmissão oficial, dos resumos das sessões, das pautas e do Diário Oficial. Atualizado em{" "}
          {d.toLocaleDateString("pt-BR")}.
        </p>
        <ul className="rodape__links">
          <li><Link to="/como-funciona">Como os dados são coletados e conferidos</Link></li>
          <li><a href={meta.repo} rel="noopener noreferrer">Código-fonte aberto</a></li>
          <li><a href="./data/dados.json">Baixar os dados (JSON)</a></li>
        </ul>
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
            <span className="marca__nome">Voto a voto</span>
            <span className="marca__sub">Câmara Municipal de Cubatão</span>
          </Link>
          <div className="topo__acoes">
            <nav aria-label="Seções">
              <ul>
                {SECOES.map(([para, nome]) => (
                  <li key={para}><NavLink to={para}>{nome}</NavLink></li>
                ))}
              </ul>
            </nav>
            <BotaoBusca />
            <BotaoTema />
            <BotaoPergunta />
          </div>
        </div>
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
