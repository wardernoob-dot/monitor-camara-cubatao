import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** "Perguntar à IA": o site não tem IA própria (é estático e não guarda chave). A pessoa escreve a pergunta e abre
 *  num assistente externo (Claude ou ChatGPT) com um prompt que manda ele ler só os dados abertos e seguir as
 *  regras de leitura de voto do projeto. O Voto a voto não recebe a pergunta nem a resposta. */
export const ABRIR_PERGUNTA = "abrir-pergunta";

const SITE = "https://votoavoto.surge.sh";
const SUGESTOES = [
  "Explique o PL 75/2026 em palavras simples.",
  "O que significa um parecer contrário?",
  "Como o site lê o painel de votação?",
  "Quais projetos viraram lei em 2026?",
];

export function montarPrompt(pergunta: string) {
  return [
    "Responda em português, sobre a Câmara Municipal de Cubatão, usando SOMENTE os dados abertos do site Voto a voto.",
    `Dados (JSON): ${SITE}/data/dados.json`,
    `Método e limites: ${SITE}/#/como-funciona`,
    "",
    "Regras:",
    "1. Diga de onde veio cada voto: painel da transmissão ou resumo oficial da sessão.",
    "2. Quem consta como presente mas não aparece na lista de votos é \"não consta\", nunca voto contrário.",
    "3. \"Aprovação do parecer contrário\" é voto contra o projeto. \"Manutenção do veto\" é voto a favor do veto.",
    "4. Não faça ranking, nota ou juízo sobre vereadores, e não diga se um projeto é bom ou ruim.",
    "5. Se os dados não responderem, diga que não sabe. Não invente.",
    "",
    `Pergunta: ${pergunta.trim()}`,
  ].join("\n");
}

function Brilho() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3.5l1.6 4.4 4.4 1.6-4.4 1.6L9 15.5l-1.6-4.4L3 9.5l4.4-1.6z" /><path d="M15.5 2.5v3M14 4h3" />
    </svg>
  );
}

export function BotaoPergunta() {
  return (
    <button type="button" className="pergunta-botao" onClick={() => window.dispatchEvent(new CustomEvent(ABRIR_PERGUNTA, { detail: "" }))}
      aria-label="Perguntar à IA">
      <Brilho /><span className="pergunta-botao__texto">Perguntar</span>
    </button>
  );
}

export function Pergunta() {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const antes = useRef<Element | null>(null);

  useEffect(() => {
    const abre = (e: Event) => {
      antes.current = document.activeElement;
      setQ(String((e as CustomEvent).detail ?? ""));
      setCopiado(false);
      setAberta(true);
    };
    window.addEventListener(ABRIR_PERGUNTA, abre);
    return () => window.removeEventListener(ABRIR_PERGUNTA, abre);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    const antigo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    campo.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = antigo; document.removeEventListener("keydown", esc); (antes.current as HTMLElement | null)?.focus?.(); };
  }, [aberta]);

  if (!aberta) return null;
  const pronta = q.trim().length > 2;
  const prompt = pronta ? montarPrompt(q) : "";
  const enc = encodeURIComponent(prompt);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopiado(true); window.setTimeout(() => setCopiado(false), 2200); } catch { setCopiado(false); }
  };

  return createPortal(
    <div className="cmd" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberta(false); }}>
      <div className="cmd__caixa pergunta" role="dialog" aria-modal="true" aria-labelledby="pergunta-titulo">
        <header className="pergunta__cab">
          <div>
            <p className="cab-secao__selo">Experimental</p>
            <h2 id="pergunta-titulo" className="pergunta__titulo">Perguntar à IA</h2>
          </div>
          <button type="button" className="pergunta__fechar" onClick={() => setAberta(false)} aria-label="Fechar">✕</button>
        </header>
        <div className="pergunta__corpo">
          <label className="sr" htmlFor="pergunta-campo">Sua pergunta</label>
          <textarea id="pergunta-campo" ref={campo} className="pergunta__campo" rows={3} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: O que muda no PL 75/2026?" />
          <ul className="pergunta__sugestoes">
            {SUGESTOES.map((s) => <li key={s}><button type="button" onClick={() => { setQ(s); campo.current?.focus(); }}>{s}</button></li>)}
          </ul>
          <p className="pergunta__aviso">
            O Voto a voto não tem IA própria. Ao continuar, sua pergunta vai para o assistente que você escolher, junto com instruções para ele ler
            só os <a href="./data/dados.json">dados abertos</a> deste site e citar a fonte de cada voto. O Voto a voto não recebe sua pergunta.
            <strong> A IA pode errar:</strong> confira o voto na página do projeto, que mostra de onde veio.
          </p>
        </div>
        <footer className="pergunta__rodape">
          <a className={`botao botao--acao${pronta ? "" : " botao--off"}`} aria-disabled={!pronta} tabIndex={pronta ? 0 : -1}
            href={pronta ? `https://claude.ai/new?q=${enc}` : undefined} target="_blank" rel="noopener noreferrer">Abrir no Claude</a>
          <a className={`botao botao--fantasma${pronta ? "" : " botao--off"}`} aria-disabled={!pronta} tabIndex={pronta ? 0 : -1}
            href={pronta ? `https://chatgpt.com/?q=${enc}` : undefined} target="_blank" rel="noopener noreferrer">Abrir no ChatGPT</a>
          <button type="button" className="botao botao--fantasma" onClick={copiar} disabled={!pronta}>{copiado ? "Copiado" : "Copiar pergunta"}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
