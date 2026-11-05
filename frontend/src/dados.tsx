import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Voto = "SIM" | "NAO" | "BRANCO" | "AUSENTE" | "?";
export type Resultado = "APROVADO" | "REJEITADO" | null;

export interface Vereador {
  slug: string;
  exibicao: string;
  nome: string;
  iniciais: string;
  partido: string | null;
  partido_fonte: string | null;
  cargo: "presidente" | "vice" | null;
  em_exercicio: boolean;
  contagem: Record<"SIM" | "NAO" | "BRANCO" | "AUSENTE", number>;
  total_votacoes: number;
  contra_resultado: number;
  sessoes_total: number;
  presenca: Partial<Record<"sim" | "justificada" | "ausente", number>>;
  projetos: string[];
  requerimentos: string[];
}

export interface Votacao {
  id: number;
  data: string;
  materia: string;
  etapa: string;
  etapa_txt: string;
  resultado: Resultado;
  sim: number | null;
  nao: number | null;
  fonte: "painel" | "resumo" | null;
  link: string | null;
  resumo_url: string | null;
  detalhe: string | null;
  votos: Record<string, Voto>;
}

export interface Divergencia {
  etapa: string;
  data: string;
  vereador: string | null;
  vereador_txt: string;
  painel: string;
  resumo: string;
}

export interface Materia {
  slug: string;
  titulo: string;
  tipo: string;
  tipo_nome: string;
  numero: string;
  ano: string | null;
  assunto: string;
  autoria: string;
  autores: string[];
  situacao: string;
  situacao_cls: "lei" | "veto" | "aprovado" | "andamento" | "rejeitado" | "pauta";
  pautas: string[];
  documento: string | null;
  lei: { numero: string; data: string; url: string | null } | null;
  veto: { alcance: string; url: string | null } | null;
  ultima_data: string;
  eventos: number[];
  divergencias: Divergencia[];
  analise: boolean;
  lista: boolean;
}

export interface Sessao {
  numero: number;
  tipo: string;
  data: string;
  inicio?: string;
  fim?: string;
  resumo?: string;
}

export interface Dia {
  data: string;
  sessoes: Sessao[];
  status: string;
  materias: string[];
  noticias: { titulo: string; url: string }[];
}

export interface Analise {
  modelo: string;
  fonte: string;
  resumo: string;
  o_que_muda: string[];
  quem_e_afetado: string;
  justificativa_do_autor: string;
  pontos_de_atencao: { ponto: string; trecho: string }[];
  limitacoes: string;
}

interface Bruto {
  meta: { atualizado: string; nome_site: string; cidade: string; repo: string };
  vereadores: Vereador[];
  materias: Materia[];
  votacoes: Votacao[];
  dias: Dia[];
}

export interface Base extends Bruto {
  vereador: Map<string, Vereador>;
  materia: Map<string, Materia>;
  votacao: (id: number) => Votacao;
  atuais: Vereador[];
}

const Ctx = createContext<Base | null>(null);

export function ProvedorDados({ children }: { children: ReactNode }) {
  const [bruto, setBruto] = useState<Bruto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("./data/dados.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setBruto)
      .catch((e) => setErro(String(e)));
  }, []);

  const base = useMemo<Base | null>(() => {
    if (!bruto) return null;
    return {
      ...bruto,
      vereador: new Map(bruto.vereadores.map((v) => [v.slug, v])),
      materia: new Map(bruto.materias.map((m) => [m.slug, m])),
      votacao: (id: number) => bruto.votacoes[id],
      atuais: bruto.vereadores.filter((v) => v.em_exercicio),
    };
  }, [bruto]);

  if (erro)
    return (
      <div className="pagina">
        <h1 className="titulo-pagina">Não deu para carregar os dados</h1>
        <p>O arquivo de dados não respondeu ({erro}). Recarregue a página em alguns minutos.</p>
      </div>
    );
  if (!base)
    return (
      <div className="pagina carregando" aria-busy="true">
        <p>Carregando votações…</p>
      </div>
    );
  return <Ctx.Provider value={base}>{children}</Ctx.Provider>;
}

export function useDados(): Base {
  const b = useContext(Ctx);
  if (!b) throw new Error("useDados fora do ProvedorDados");
  return b;
}

export function useAnalise(slug: string, existe: boolean): Analise | null {
  const [a, setA] = useState<Analise | null>(null);
  useEffect(() => {
    setA(null);
    if (!existe) return;
    let vivo = true;
    fetch(`./data/analises/${slug}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && setA(j))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [slug, existe]);
  return a;
}
