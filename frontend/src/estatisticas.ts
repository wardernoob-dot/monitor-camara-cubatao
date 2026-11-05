import type { Base, Votacao, Vereador } from "./dados";

/** Segunda-feira da semana (ISO) de uma data AAAA-MM-DD. */
function semana(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

function serieSemanal(datas: string[], peso: (i: number) => number, ini: string, fim: string) {
  const mapa = new Map<string, number>();
  const s0 = semana(ini);
  for (let d = new Date(`${s0}T12:00:00Z`); d.toISOString().slice(0, 10) <= fim; d.setUTCDate(d.getUTCDate() + 7)) {
    mapa.set(d.toISOString().slice(0, 10), 0);
  }
  datas.forEach((dt, i) => {
    const k = semana(dt);
    if (mapa.has(k)) mapa.set(k, mapa.get(k)! + peso(i));
  });
  return [...mapa.entries()].map(([x, y]) => ({ x, y }));
}

export interface Ponto { x: string; y: number }

export interface Painel {
  votacoes: number;
  votosIndividuais: number;
  sessoes: number;
  leis: number;
  serieVotacoes: Ponto[];
  serieNao: Ponto[];
  serieSemVoto: Ponto[];
  serieDivididas: Ponto[];
  funilProjetos: { rotulo: string; valor: number }[];
  funilVotacoes: { rotulo: string; valor: number }[];
  alinhamento: { a: Vereador; b: Vereador; iguais: number; total: number }[][];
  presenca: { v: Vereador; dias: { data: string; estado: "votou" | "semvoto" | "ausente" | "nada" }[] }[];
}

export function calcular(b: Base): Painel {
  const vs = b.votacoes;
  const comVotos = vs.filter((v) => Object.keys(v.votos).length);
  const painel = vs.filter((v) => v.fonte === "painel");
  const ini = vs.length ? vs[0].data : "2026-01-01";
  const fim = vs.length ? vs[vs.length - 1].data : ini;
  const datas = comVotos.map((v) => v.data);

  const divididas = (v: Votacao) => Object.values(v.votos).includes("NAO");
  const projetos = b.materias.filter((m) => m.lista);

  // alinhamento: so votacoes do painel (o resumo lista todo presente como favoravel nas unanimes)
  const atuais = b.atuais;
  const alinhamento = atuais.map((a) =>
    atuais.map((c) => {
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

  const diasPainel = [...new Set(painel.map((v) => v.data))];
  const presenca = atuais.map((v) => ({
    v,
    dias: diasPainel.map((data) => {
      const doDia = painel.filter((e) => e.data === data).map((e) => e.votos[v.slug]);
      const estado: "votou" | "semvoto" | "ausente" | "nada" = doDia.some((x) => x === "SIM" || x === "NAO")
        ? "votou"
        : doDia.some((x) => x === "BRANCO")
          ? "semvoto"
          : doDia.some((x) => x === "AUSENTE")
            ? "ausente"
            : "nada";
      return { data, estado };
    }),
  }));

  return {
    votacoes: comVotos.length,
    votosIndividuais: comVotos.reduce((s, v) => s + Object.values(v.votos).filter((x) => x === "SIM" || x === "NAO").length, 0),
    sessoes: b.dias.length,
    leis: projetos.filter((m) => m.lei).length,
    serieVotacoes: serieSemanal(datas, () => 1, ini, fim),
    serieNao: serieSemanal(datas, (i) => Object.values(comVotos[i].votos).filter((x) => x === "NAO").length, ini, fim),
    serieDivididas: serieSemanal(datas, (i) => (divididas(comVotos[i]) ? 1 : 0), ini, fim),
    serieSemVoto: painel.length
      ? serieSemanal(painel.map((v) => v.data), (i) => Object.values(painel[i].votos).filter((x) => x === "BRANCO").length, painel[0].data, fim)
      : [],
    funilProjetos: [
      { rotulo: "Apresentados", valor: projetos.length },
      { rotulo: "Foram à pauta", valor: projetos.filter((m) => m.pautas.length || m.eventos.length).length },
      { rotulo: "Aprovados pela Câmara", valor: projetos.filter((m) => ["aprovado", "lei", "veto"].includes(m.situacao_cls)).length },
      { rotulo: "Viraram lei", valor: projetos.filter((m) => m.lei).length },
    ],
    funilVotacoes: [
      { rotulo: "Votações com placar", valor: comVotos.length },
      { rotulo: "Com algum voto não", valor: comVotos.filter(divididas).length },
      { rotulo: "Decididas por 3 votos ou menos", valor: comVotos.filter((v) => divididas(v) && Math.abs((v.sim ?? 0) - (v.nao ?? 0)) <= 3).length },
      { rotulo: "Rejeitadas", valor: comVotos.filter((v) => v.resultado === "REJEITADO").length },
    ],
    alinhamento,
    presenca,
  };
}
