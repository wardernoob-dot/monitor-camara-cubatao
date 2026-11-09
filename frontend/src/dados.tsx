import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Voto = "SIM" | "NAO" | "BRANCO" | "AUSENTE" | "?";
export type Resultado = "APROVADO" | "REJEITADO" | null;

export interface Vereador {
  slug: string;
  exibicao: string;
  nome: string;
  iniciais: string;
  foto: string | null;
  partido: string | null;
  partido_fonte: string | null;
  partido_url?: string | null;
  executivo: { com: number; contra: number; contra_ids: number[] };
  cargo: "presidente" | "vice" | null;
  em_exercicio: boolean;
  contagem: Record<"SIM" | "NAO" | "BRANCO" | "AUSENTE", number>;
  total_votacoes: number;
  contra_resultado: number;
  sessoes_total: number;
  faltas: number;
  leis: number;
  indice: Indice;
  presenca: Partial<Record<"sim" | "justificada" | "ausente", number>>;
  projetos: string[];
  requerimentos: string[];
}

export interface ItemIndice { nome: string; pontos: number; max: number; conta: string; nao_se_aplica?: boolean }
export interface PilarIndice {
  id: string; nome: string; max: number; pontos: number; media_camara: number; itens: ItemIndice[]; nao_se_aplica?: boolean;
  motivo?: "sem_painel" | "presidiu" | "poucas_votacoes" | null; presidiu?: number;
}
export interface Indice { nota: number; pilares: PilarIndice[]; parcial: boolean; presidente: boolean; pontos_validos: number; media_camara: number }

export interface LeituraVeto {
  resumo: string;
  o_que_foi_vetado: string[];
  razoes: { razao: string; trecho: string }[];
  fundamento: string;
  limitacoes: string;
  modelo: string;
  fonte: string;
}

export interface Impacto { faixa: string; nome: string; peso: number; motivo: string; fonte: "regra" | "revisao" }

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
  sentido: "direto" | "inverso" | "emenda" | null;
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
  lei: {
    numero: string; data: string; url: string | null;
    vigencia?: { data: string; trecho: string; regra: "data" | "dias" | "publicacao" };
    depende?: { trecho: string; prazo_dias?: number; vence?: string }[];
  } | null;
  veto: {
    alcance: string; url?: string | null; resultado?: "veto_mantido" | "veto_derrubado" | null; data?: string; pagina?: string;
    oficio?: string | null; data_oficio?: string | null; leitura?: LeituraVeto;
  } | null;
  ultima_data: string;
  eventos: number[];
  divergencias: Divergencia[];
  analise: boolean;
  lista: boolean;
  tema: string;
  relevancia: { nivel: "alta" | "media" | "baixa"; motivos: string[] };
  impacto: Impacto;
  explicacao: { texto: string; base: string; modelo: string } | null;
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
  de_onde_sai_o_dinheiro?: string;
  o_que_falta_definir?: string[];
  palavras_dificeis?: { termo: string; explicacao: string }[];
}

export interface Partido {
  sigla: string;
  membros: string[];
  em_exercicio: string[];
  indice_medio: number | null;
  executivo: { com: number; contra: number };
  coesao: number | null;
  votacoes_coesao: number;
  rachas: number[];
  projetos: number;
  leis: number;
  contra_resultado: number;
}

export interface Reportagem {
  id: string;
  status: "rascunho" | "publicado";
  data: string;
  chapeu: string | null;
  manchete: string;
  linha_fina: string;
  projetos: string[];
  votacao: number | null;
  foto: { g: string; p: string; alt: string; legenda: string | null; credito: string; licenca: string; link: string; ilustrativa: boolean };
  corpo: { t: "h" | "p" | "ul"; x: string | string[] }[];
}

interface Bruto {
  meta: { atualizado: string; nome_site: string; cidade: string; repo: string; contato?: { email: string | null; formulario: string | null } };
  vereadores: Vereador[];
  materias: Materia[];
  votacoes: Votacao[];
  dias: Dia[];
  partidos: Partido[];
  reportagens?: Reportagem[];
  executivo?: { nome: string; cargo: string; foto: string | null };
}

export interface Base extends Bruto {
  vereador: Map<string, Vereador>;
  materia: Map<string, Materia>;
  votacao: (id: number) => Votacao;
  atuais: Vereador[];
  partido: Map<string, Partido>;
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
      partido: new Map((bruto.partidos ?? []).map((p) => [slugPartido(p.sigla), p])),
      reportagens: bruto.reportagens ?? [],
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
    if (!existe || !/^[a-z0-9-]+$/.test(slug)) return;
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

export const slugPartido = (sigla: string) => sigla.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
