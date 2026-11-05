import type { Base, Materia, Vereador } from "./dados";

export interface Painel {
  apresentados: number;
  leis: number;
  vetados: number;
  sessoes: number;
  funilProjetos: { rotulo: string; valor: number }[];
  vetos: { m: Materia; resultado: "mantido" | "derrubado" | "aguardando" }[];
  autoria: { rotulo: string; para?: string; aprovados: number; outros: number }[];
  temas: { rotulo: string; aprovados: number; outros: number }[];
  faltas: { v: Vereador; justificada: number; ausente: number }[];
  alinhamento: { a: Vereador; b: Vereador; iguais: number; total: number }[][];
}

const APROVADO = new Set(["aprovado", "lei", "veto"]);

export function calcular(b: Base): Painel {
  const projetos = b.materias.filter((m) => m.lista);
  const anoCorrente = new Date().getFullYear().toString();

  // vetos do prefeito: projetos com veto registrado (oficio ou votacao do veto)
  const vetos = b.materias
    .filter((m) => m.veto && (m.tipo === "PL" || m.tipo === "PLC"))
    .map((m) => ({
      m,
      resultado: (m.veto!.resultado === "veto_mantido" ? "mantido" : m.veto!.resultado === "veto_derrubado" ? "derrubado" : "aguardando") as
        "mantido" | "derrubado" | "aguardando",
    }))
    .sort((x, y) => (y.m.veto!.data ?? "9999").localeCompare(x.m.veto!.data ?? "9999"));

  // quem apresenta: autoria agrupada; vereadores pelo apelido
  const porAutor = new Map<string, { para?: string; aprovados: number; outros: number }>();
  for (const m of projetos) {
    const chave = m.autoria || "Autoria não identificada";
    const v = m.autores.length === 1 ? b.vereador.get(m.autores[0]) : undefined;
    const atual = porAutor.get(chave) ?? { para: v ? `/vereadores/${v.slug}` : undefined, aprovados: 0, outros: 0 };
    APROVADO.has(m.situacao_cls) ? atual.aprovados++ : atual.outros++;
    porAutor.set(chave, atual);
  }
  const autoria = [...porAutor.entries()]
    .map(([rotulo, x]) => ({ rotulo, ...x }))
    .sort((x, y) => (x.rotulo === "Autoria não identificada" ? 1 : y.rotulo === "Autoria não identificada" ? -1 : y.aprovados + y.outros - (x.aprovados + x.outros)));

  const porTema = new Map<string, { aprovados: number; outros: number }>();
  for (const m of projetos) {
    const atual = porTema.get(m.tema) ?? { aprovados: 0, outros: 0 };
    APROVADO.has(m.situacao_cls) ? atual.aprovados++ : atual.outros++;
    porTema.set(m.tema, atual);
  }
  const temas = [...porTema.entries()]
    .map(([rotulo, x]) => ({ rotulo, ...x }))
    .sort((x, y) => (x.rotulo === "Outros" ? 1 : y.rotulo === "Outros" ? -1 : y.aprovados + y.outros - (x.aprovados + x.outros)));

  const faltas = b.atuais
    .map((v) => ({ v, justificada: v.presenca.justificada ?? 0, ausente: v.presenca.ausente ?? 0 }))
    .sort((x, y) => y.justificada + y.ausente - (x.justificada + x.ausente) || x.v.exibicao.localeCompare(y.v.exibicao));

  const painel = b.votacoes.filter((v) => v.fonte === "painel");
  const alinhamento = b.atuais.map((a) =>
    b.atuais.map((c) => {
      let iguais = 0;
      let total = 0;
      for (const ev of painel) {
        const x = ev.votos[a.slug];
        const y = ev.votos[c.slug];
        if ((x === "SIM" || x === "NAO") && (y === "SIM" || y === "NAO")) {
          total++;
          if (x === y) iguais++;
        }
      }
      return { a, b: c, iguais, total };
    }),
  );

  return {
    apresentados: projetos.length,
    leis: projetos.filter((m) => m.lei).length,
    vetados: vetos.filter((x) => (x.m.veto!.data ?? anoCorrente).startsWith(anoCorrente) || x.resultado === "aguardando").length,
    sessoes: b.dias.length,
    funilProjetos: [
      { rotulo: "Apresentados", valor: projetos.length },
      { rotulo: "Foram à pauta", valor: projetos.filter((m) => m.pautas.length || m.eventos.length).length },
      { rotulo: "Aprovados pela Câmara", valor: projetos.filter((m) => APROVADO.has(m.situacao_cls)).length },
      { rotulo: "Viraram lei (Diário Oficial, últimos 45 dias coletados)", valor: projetos.filter((m) => m.lei).length },
    ],
    vetos,
    autoria,
    temas,
    faltas,
    alinhamento,
  };
}
