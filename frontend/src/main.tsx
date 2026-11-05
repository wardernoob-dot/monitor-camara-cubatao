import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, NavLink, Link, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "./estilo.css";
import { ProvedorDados, useDados } from "./dados";
import Inicio from "./paginas/Inicio";
import Vereadores from "./paginas/Vereadores";
import VereadorPagina from "./paginas/Vereador";
import Projetos from "./paginas/Projetos";
import ProjetoPagina from "./paginas/Projeto";
import Sessoes from "./paginas/Sessoes";
import SessaoPagina from "./paginas/Sessao";
import ComoFunciona from "./paginas/ComoFunciona";
import NaoEncontrado from "./paginas/NaoEncontrado";

function RolaParaTopo() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("conteudo")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

const SECOES = [
  ["/vereadores", "Vereadores"],
  ["/projetos", "Projetos"],
  ["/sessoes", "Sessões"],
  ["/como-funciona", "Como funciona"],
] as const;

function Rodape() {
  const { meta } = useDados();
  const d = new Date(meta.atualizado);
  return (
    <footer className="rodape">
      <div className="rodape__dentro">
        <p>
          Dados públicos da Câmara Municipal de {meta.cidade}, reunidos automaticamente a partir do painel de votação
          exibido na transmissão oficial, dos resumos das sessões, das pautas e do Diário Oficial. Atualizado em{" "}
          {d.toLocaleDateString("pt-BR")}.
        </p>
        <ul className="rodape__links">
          <li><Link to="/como-funciona">Como os dados são coletados e conferidos</Link></li>
          <li><a href={meta.repo}>Código-fonte aberto</a></li>
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
          <nav aria-label="Seções">
            <ul>
              {SECOES.map(([para, nome]) => (
                <li key={para}><NavLink to={para}>{nome}</NavLink></li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <ProvedorDados>
        <RolaParaTopo />
        <main id="conteudo" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/vereadores" element={<Vereadores />} />
            <Route path="/vereadores/:slug" element={<VereadorPagina />} />
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
