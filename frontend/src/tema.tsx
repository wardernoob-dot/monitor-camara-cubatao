import { useEffect, useState } from "react";

/** Tema claro/escuro. Sem escolha salva, segue o sistema. A escolha vai em data-tema no <html> e em localStorage.
 *  O script ./tema.js aplica o tema antes da primeira pintura (o CSP não permite script inline). */
export type Tema = "light" | "dark";
const EVENTO = "tema-mudou";
const CHAVE = "votoavoto-tema";

export function temaAtual(): Tema {
  const d = document.documentElement.dataset.tema;
  if (d === "dark" || d === "light") return d;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function definirTema(t: Tema) {
  document.documentElement.dataset.tema = t;
  try { localStorage.setItem(CHAVE, t); } catch { /* navegação privada: vale só nesta visita */ }
  window.dispatchEvent(new Event(EVENTO));
}

export function useTema(): Tema {
  const [t, setT] = useState<Tema>(temaAtual);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-color-scheme: dark)");
    const atualiza = () => setT(temaAtual());
    window.addEventListener(EVENTO, atualiza);
    m?.addEventListener("change", atualiza);
    return () => { window.removeEventListener(EVENTO, atualiza); m?.removeEventListener("change", atualiza); };
  }, []);
  return t;
}

/** Cores para quem desenha em canvas (variáveis CSS não valem lá). */
export function paleta(t: Tema = temaAtual()) {
  return t === "dark"
    ? { tinta: "#ececee", verde: "#4fbf6a", vermelho: "#ef6b6b", cinza: "#9b9da4", nevoa: "#3a3c41", papel: "#0f1012", grade: "236,236,238" }
    : { tinta: "#171717", verde: "#297a3a", vermelho: "#c4342b", cinza: "#666666", nevoa: "#c9c9c9", papel: "#fafafa", grade: "23,23,23" };
}

export function BotaoTema() {
  const t = useTema();
  const escuro = t === "dark";
  return (
    <button type="button" className="tema-botao" onClick={() => definirTema(escuro ? "light" : "dark")}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"} title={escuro ? "Tema claro" : "Tema escuro"}>
      {escuro ? (
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16.5 11.5A6.5 6.5 0 018.5 3.5a6.5 6.5 0 108 8z" />
        </svg>
      )}
    </button>
  );
}
