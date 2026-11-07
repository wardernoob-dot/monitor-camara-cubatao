import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDados } from "./dados";
import { ABRIR_PERGUNTA } from "./pergunta";

/** Busca global (Ctrl K ou /): vereadores, projetos e páginas. O botão fica no cabeçalho, fora do provedor de dados,
 *  e avisa a janela por um evento; a janela fica dentro do provedor, onde os dados existem. */
export const ABRIR_BUSCA = "abrir-busca";

const sem = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

interface Item { id: string; grupo: string; rotulo: string; sub?: string; to: string; acao?: () => void }

const PAGINAS: Item[] = [
  { id: "p-vereadores", grupo: "Páginas", rotulo: "Vereadores", sub: "Quem são e como votaram", to: "/vereadores" },
  { id: "p-ranking", grupo: "Páginas", rotulo: "Ranking", sub: "Índice de Atuação Parlamentar", to: "/ranking" },
  { id: "p-partidos", grupo: "Páginas", rotulo: "Partidos", sub: "Bancadas e posição da Prefeitura", to: "/partidos" },
  { id: "p-projetos", grupo: "Páginas", rotulo: "Projetos", sub: "Tudo que foi pautado ou publicado", to: "/projetos" },
  { id: "p-sessoes", grupo: "Páginas", rotulo: "Sessões", sub: "Pauta, presença e votações", to: "/sessoes" },
  { id: "p-como", grupo: "Páginas", rotulo: "Como funciona", sub: "Fontes, método e limites", to: "/como-funciona" },
];

function Lupa() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BotaoBusca() {
  const mac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  return (
    <button type="button" className="busca-botao" onClick={() => window.dispatchEvent(new Event(ABRIR_BUSCA))} aria-label="Buscar vereadores e projetos">
      <Lupa />
      <span className="busca-botao__texto">Buscar</span>
      <kbd className="busca-botao__tecla" aria-hidden="true">{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}

export function Busca() {
  const b = useDados();
  const nav = useNavigate();
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const antes = useRef<Element | null>(null);
  const idLista = useId();

  useEffect(() => {
    const abre = () => { antes.current = document.activeElement; setQ(""); setAtivo(0); setAberta(true); };
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = !!alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abre(); }
      else if (e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey) { e.preventDefault(); abre(); }
    };
    window.addEventListener(ABRIR_BUSCA, abre);
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener(ABRIR_BUSCA, abre); window.removeEventListener("keydown", tecla); };
  }, []);

  useEffect(() => {
    if (!aberta) return;
    const antigo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    entrada.current?.focus();
    return () => { document.body.style.overflow = antigo; (antes.current as HTMLElement | null)?.focus?.(); };
  }, [aberta]);

  const indice = useMemo(() => ({
    vereadores: b.vereadores.map((v) => ({
      item: { id: `v-${v.slug}`, grupo: "Vereadores", rotulo: v.exibicao, sub: [v.nome, v.partido].filter(Boolean).join(" · "), to: `/vereadores/${v.slug}` } as Item,
      hay: sem(`${v.exibicao} ${v.nome} ${v.partido ?? ""}`),
    })),
    projetos: b.materias.map((m) => ({
      item: { id: `m-${m.slug}`, grupo: "Projetos", rotulo: m.titulo, sub: m.assunto.toLowerCase(), to: `/projetos/${m.slug}` } as Item,
      hay: sem(`${m.titulo} ${m.tipo_nome} ${m.numero} ${m.assunto} ${m.autoria}`),
    })),
  }), [b]);

  const resultados = useMemo(() => {
    const t = sem(q).split(/\s+/).filter(Boolean);
    if (!t.length) return PAGINAS;
    const filtra = (xs: { item: Item; hay: string }[], n: number) => xs.filter((x) => t.every((w) => x.hay.includes(w))).slice(0, n).map((x) => x.item);
    const pags = PAGINAS.filter((p) => t.every((w) => sem(`${p.rotulo} ${p.sub}`).includes(w)));
    const ia: Item = { id: "ia", grupo: "Assistente", rotulo: `Perguntar à IA: “${q.trim()}”`, sub: "abre num assistente externo", to: "",
      acao: () => window.dispatchEvent(new CustomEvent(ABRIR_PERGUNTA, { detail: q.trim() })) };
    return [...filtra(indice.vereadores, 6), ...filtra(indice.projetos, 6), ...pags, ia];
  }, [q, indice]);

  useEffect(() => setAtivo(0), [q]);
  useEffect(() => { lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" }); }, [ativo]);

  if (!aberta) return null;
  const fecha = () => setAberta(false);
  const vai = (i: Item) => { fecha(); if (i.acao) i.acao(); else nav(i.to); };
  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && resultados[ativo]) { e.preventDefault(); vai(resultados[ativo]); }
    else if (e.key === "Escape") { e.preventDefault(); fecha(); }
    else if (e.key === "Tab") { e.preventDefault(); entrada.current?.focus(); }
  };

  let grupoAtual = "";
  return createPortal(
    <div className="busca" onMouseDown={(e) => { if (e.target === e.currentTarget) fecha(); }}>
      <div className="busca__caixa" role="dialog" aria-modal="true" aria-label="Buscar" onKeyDown={teclado}>
        <div className="busca__campo">
          <Lupa />
          <input ref={entrada} className="busca__entrada" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar vereador, projeto ou número (ex.: PL 75)"
            role="combobox" aria-expanded="true" aria-controls={idLista}
            aria-activedescendant={resultados[ativo] ? `${idLista}-${ativo}` : undefined}
            aria-autocomplete="list" autoComplete="off" spellCheck={false} />
          <kbd className="busca__esc">Esc</kbd>
        </div>
        <ul id={idLista} ref={lista} className="busca__lista" role="listbox">
          {resultados.length === 1 && resultados[0].id === "ia" && (
            <li className="busca__vazio" role="presentation">Nada encontrado no site para “{q}”.</li>
          )}
          {resultados.length === 0 && (
            <li className="busca__vazio" role="presentation">Nada encontrado para “{q}”. Tente o sobrenome do vereador ou o número do projeto.</li>
          )}
          {resultados.map((r, i) => {
            const cab = r.grupo !== grupoAtual ? (grupoAtual = r.grupo) : null;
            return (
              <li key={r.id} role="presentation">
                {cab && <p className="busca__grupo" role="presentation">{cab === "Páginas" && !q ? "Ir para" : cab}</p>}
                <div id={`${idLista}-${i}`} data-i={i} role="option" aria-selected={i === ativo}
                  className={`busca__item ${i === ativo ? "busca__item--ativo" : ""}`}
                  onMouseMove={() => ativo !== i && setAtivo(i)} onClick={() => vai(r)}>
                  <span className="busca__rotulo">{r.rotulo}</span>
                  {r.sub && <span className="busca__sub">{r.sub}</span>}
                  <span className="busca__enter" aria-hidden="true">↵</span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="busca__dicas" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}
