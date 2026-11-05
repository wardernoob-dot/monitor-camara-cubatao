import { useEffect } from "react";
import type { Voto } from "./dados";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function partes(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m, d };
}

export function dataExtenso(iso: string): string {
  const { a, m, d } = partes(iso);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function dataCurta(iso: string, ano = false): string {
  const { a, m, d } = partes(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}${ano ? `/${a}` : ""}`;
}

export const ROTULO: Record<Voto, string> = {
  SIM: "Sim",
  NAO: "Não",
  BRANCO: "Não votou",
  AUSENTE: "Ausente",
  "?": "Ilegível",
};

export const ORDEM_VOTO: Voto[] = ["SIM", "NAO", "BRANCO", "AUSENTE", "?"];

export function corta(t: string | null | undefined, n: number): string {
  if (!t) return "";
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  return c.slice(0, Math.max(c.lastIndexOf(" "), n - 15)) + "…";
}

export function semAcento(t: string): string {
  return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function minusculaInicial(t: string): string {
  return t ? t[0].toLowerCase() + t.slice(1) : t;
}

export function votouDiferente(voto: Voto | undefined, resultado: string | null): boolean {
  return (voto === "SIM" || voto === "NAO") && (resultado === "APROVADO" || resultado === "REJEITADO") &&
    (voto === "SIM") !== (resultado === "APROVADO");
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | Câmara de Cubatão`;
  }, [titulo]);
}

export function nomeSessao(tipo: string): string {
  return tipo.startsWith("ord") ? "ordinária" : "extraordinária";
}
