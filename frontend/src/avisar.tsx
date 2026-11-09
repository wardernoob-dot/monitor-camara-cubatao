import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useDados } from "./dados";

/** "Achou um erro?": caminho para o morador avisar sem precisar de conta em lugar nenhum.
 *  Monta a mensagem com o endereço da página; envia por e-mail ou formulário se houver (data/contato.json). */
export function AvisarErro({ sobre }: { sobre: string }) {
  const { meta } = useDados();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const [copiou, setCopiou] = useState(false);
  const pagina = `${window.location.origin}${window.location.pathname}#${pathname}`;
  const msg = `Achei um erro no Voto a voto.\nPágina: ${sobre}\nEndereço: ${pagina}\nO que está errado: \nComo sei disso (documento, link): `;
  const c = meta.contato;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); setCopiou(true); window.setTimeout(() => setCopiou(false), 2500); } catch { /* sem permissão: o texto está na tela */ }
  };
  return (
    <aside className="avisar" aria-label="Avisar um erro">
      <button type="button" className="avisar__botao" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <span aria-hidden="true">!</span> Achou um erro nesta página? Avise
      </button>
      {aberto && (
        <div className="avisar__corpo">
          <p>Todo dado daqui vem de documento oficial, mas a leitura automática pode errar. Conte o que está errado e, se puder, de onde você sabe. A gente confere no documento e corrige.</p>
          <pre className="avisar__msg">{msg}</pre>
          <div className="avisar__acoes">
            <button type="button" className="botao botao--fantasma" onClick={copiar}>{copiou ? "Copiado" : "Copiar o texto"}</button>
            {c?.email && <a className="botao botao--acao" href={`mailto:${c.email}?subject=${encodeURIComponent("Erro no Voto a voto: " + sobre)}&body=${encodeURIComponent(msg)}`}>Enviar por e-mail</a>}
            {c?.formulario && <a className="botao botao--acao" href={c.formulario} rel="noopener noreferrer" target="_blank">Abrir o formulário</a>}
            <a className="link-seta" href={`${meta.repo}/issues/new?title=${encodeURIComponent("Erro: " + sobre)}&body=${encodeURIComponent(msg)}`} rel="noopener noreferrer">Avisar pelo GitHub <span aria-hidden="true">→</span></a>
          </div>
          {!c?.email && !c?.formulario && <p className="nota">Copie o texto e mande para quem cuida do site, ou use o GitHub se tiver conta.</p>}
        </div>
      )}
    </aside>
  );
}
