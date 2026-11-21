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

/* letras cirílicas/gregas com cara de latina que aparecem nos PDFs da Câmara ("autistа" com а cirílico) */
const HOMOGLIFOS: Record<string, string> = { "А": "a", "В": "b", "Е": "e", "К": "k", "М": "m", "Н": "h", "О": "o", "Р": "p", "С": "c", "Т": "t", "Х": "x", "І": "i", "Ј": "j", "Ѕ": "s",
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s", "Ο": "o", "ο": "o", "Α": "a", "Ε": "e", "Ι": "i" };

export function semAcento(t: string): string {
  return (t || "").replace(/[\u0370-\u04FF]/g, (c) => HOMOGLIFOS[c] ?? c).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Palavra que o morador usa -> como a lei costuma escrever. A busca acha qualquer uma delas. */
const SINONIMOS: Record<string, string[]> = {
  onibus: ["onibus", "transporte coletivo", "transporte publico", "passe livre"],
  busao: ["onibus", "transporte coletivo"],
  estacionamento: ["estacionamento", "rotativo", "zona azul"],
  aposentadoria: ["aposentadoria", "previdenc", "aposentad"],
  imposto: ["imposto", "tribut", "iptu", "iss ", "taxa"],
  iptu: ["iptu", "imposto predial"],
  escola: ["escola", "ensino", "educac", "creche"],
  creche: ["creche", "educacao infantil", "ensino infantil"],
  remedio: ["remedio", "medicamento", "farmac"],
  salario: ["salario", "vencimento", "remunera", "piso"],
  cachorro: ["cachorro", "caes", "animal", "animais"],
  gato: ["gato", "felin", "animal", "animais"],
  lixo: ["lixo", "residuo", "entulho", "coleta"],
  autismo: ["autismo", "autista", "espectro autista"],
  autista: ["autista", "autismo", "espectro autista"],
  idoso: ["idoso", "pessoa idosa", "melhor idade", "terceira idade", "50 anos"],
  deficiencia: ["deficien", "pcd"],
  gravida: ["gravida", "gestante", "gestacao"],
  aposta: ["aposta", "bets", "jogo", "ludopatia"],
  bet: ["bet", "aposta"],
  bets: ["bets", "aposta"],
  emprego: ["emprego", "empregabilidade", "trabalho", "vaga"],
  policia: ["policia", "guarda", "seguranca"],
};

/** Cada palavra buscada precisa aparecer no texto, ela mesma ou um sinônimo. */
export function casaBusca(texto: string, termos: string[]): boolean {
  return termos.every((t) => (SINONIMOS[t] ?? [t]).some((a) => texto.includes(a)));
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
