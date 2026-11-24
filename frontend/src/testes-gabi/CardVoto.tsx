import type { ReactNode } from "react";
import type { Materia, Vereador, Voto, Votacao } from "../dados";
import "./insta.css";

/* Card de votação do carrossel (1080×1350). Três variações do mesmo padrão. Técnicas das referências:
   topo minúsculo e centralizado, título grande em peso leve, círculos concêntricos de fundo, mockup de celular cortado
   na borda com cartões brancos de interface, e pílulas coloridas sobre a borda.
   Regras de voto do site: o resumo só lista quem votou; "não consta" nunca é voto contrário; toda votação mostra a fonte. */

export type Variante = 1 | 2 | 3;

const ROTULO: Record<Voto, string> = { SIM: "Sim", NAO: "Não", BRANCO: "Não votou", AUSENTE: "Ausente", "?": "?" };
const ORDEM: Voto[] = ["SIM", "NAO", "BRANCO", "AUSENTE", "?"];
const COR: Record<Voto, string> = { SIM: "#2E7D4F", NAO: "#C4342B", BRANCO: "#9A6B1F", AUSENTE: "#7C8594", "?": "#7C8594" };
/* tons claros dos mesmos votos, para texto sobre fundo escuro */
const COR_CLARA: Record<Voto, string> = { SIM: "#7FE3A6", NAO: "#FF8A7A", BRANCO: "#FFD58A", AUSENTE: "#C3CBD6", "?": "#C3CBD6" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function frase(t: string) {
  t = (t || "").replace(/\s+/g, " ").trim();
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const maius = letras.replace(/[^A-ZÀ-Þ]/g, "");
  if (letras && maius.length > 0.6 * letras.length) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function dataTxt(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1].toUpperCase()} ${a}`;
}

function fonteTxt(v: Votacao) {
  if (v.fonte === "painel") return "painel eletrônico da transmissão oficial";
  if (v.fonte === "resumo") return "resumo oficial da sessão";
  return "documento oficial da Câmara";
}

function ordenados(v: Votacao, ver: Map<string, Vereador>) {
  return Object.entries(v.votos)
    .map(([slug, voto]) => ({ slug, voto, v: ver.get(slug) }))
    .sort((a, b) => ORDEM.indexOf(a.voto) - ORDEM.indexOf(b.voto) || (a.v?.exibicao ?? a.slug).localeCompare(b.v?.exibicao ?? b.slug));
}

/* Votação de parecer, de emenda ou de sentido invertido: "Aprovado" sozinho enganaria (aprovar o parecer contrário
   significa que o projeto não seguiu). Nesses casos o resultado leva o nome da etapa e sai em cor neutra. */
const lateral = (v: Votacao) => /parecer|emenda/i.test(v.etapa) || (v.sentido != null && v.sentido !== "direto");
const resultadoTxt = (v: Votacao) => {
  if (!v.resultado) return "Sem resultado";
  const r = v.resultado === "APROVADO" ? "aprovado" : "rejeitado";
  return lateral(v) ? `${v.etapa_txt} ${r}` : r.charAt(0).toUpperCase() + r.slice(1);
};
const NEUTRO = "#4F7391";
const corResultado = (v: Votacao) => (lateral(v) ? NEUTRO : v.resultado === "REJEITADO" ? COR.NAO : v.resultado === "APROVADO" ? COR.SIM : COR.AUSENTE);

function Aneis({ escuro = true }: { escuro?: boolean }) {
  const c = escuro ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.55)";
  return (
    <svg className="vd-aneis" viewBox="0 0 1080 1350" aria-hidden="true">
      {[300, 440, 580, 720, 860].map((r) => <circle key={r} cx="540" cy="760" r={r} fill="none" stroke={c} strokeWidth="2" />)}
    </svg>
  );
}

function Topo({ data, claro = false }: { data: string; claro?: boolean }) {
  return (
    <header className={`vd-topo${claro ? " vd-topo--claro" : ""}`}>
      <b>VOTO A VOTO</b><i /><span>{dataTxt(data)}</span>
    </header>
  );
}

function Fonte({ votacao, claro = false }: { votacao: Votacao; claro?: boolean }) {
  return (
    <footer className={`vd-fonte${claro ? " vd-fonte--claro" : ""}`}>
      <span><small>Fonte dos votos</small>{fonteTxt(votacao)}</span>
      <span><small>Todos os projetos</small>votoavoto.surge.sh</span>
    </footer>
  );
}

function Nota({ votacao, m, claro = false }: { votacao: Votacao; m: Materia; claro?: boolean }) {
  const linhas: string[] = [];
  if (votacao.sentido === "inverso") linhas.push("Nesta votação, votar Sim era ser contra o projeto seguir.");
  if (!Object.keys(votacao.votos).length) linhas.push("Votação simbólica: não há registro nominal de votos.");
  if (m.veto && !m.veto.fora_da_cobertura) {
    const fim = m.veto.resultado === "veto_mantido" ? " A Câmara manteve o veto." : m.veto.resultado === "veto_derrubado" ? " A Câmara derrubou o veto." : "";
    linhas.push(`Depois de aprovado, o Prefeito vetou o projeto (veto ${m.veto.alcance}).${fim}`);
  }
  if (m.lei) linhas.push(`Virou a Lei nº ${m.lei.numero}.`);
  return linhas.length ? <div className={`vd-nota${claro ? " vd-nota--claro" : ""}`}>{linhas.map((l) => <p key={l}>{l}</p>)}</div> : null;
}

function Pilula({ cor, children, estilo }: { cor: string; children: ReactNode; estilo?: React.CSSProperties }) {
  return <span className="vd-pilula" style={{ background: cor, ...estilo }}>{children}</span>;
}

function Resumo({ cont, topo }: { cont: { k: Voto; n: number }[]; topo: number }) {
  return (
    <div className="vd-resumo" style={{ top: topo }}>
      {cont.map((c) => (
        <span key={c.k}><b style={{ background: COR[c.k] }}>{c.n}</b>{ROTULO[c.k]}</span>
      ))}
    </div>
  );
}

function Chip({ i }: { i: ReturnType<typeof ordenados>[number] }) {
  return (
    <div className="vd-chip" style={{ borderLeftColor: COR[i.voto] }}>
      <b>{i.v?.exibicao ?? i.slug}</b>
      <span style={{ color: COR[i.voto] }}>{ROTULO[i.voto]}</span>
    </div>
  );
}

/* 1: painel de cantos retos sobre fundo azul (Easy English), selo girado com o placar e cartões brancos na grade. */
function V1({ data, m, votacao, ver }: Props) {
  const itens = ordenados(votacao, ver);
  return (
    <div className="insta insta-card vd vd--azul">
      <Aneis />
      <Topo data={data} />
      <div className="vd1-painel">
        <span className="vd1-tag">{m.tipo_nome.toUpperCase()} · {votacao.etapa_txt.toUpperCase()}</span>
        <h1>{m.titulo}</h1>
        <p>{frase(m.assunto)}</p>
        <Pilula cor={corResultado(votacao)}>{resultadoTxt(votacao)}</Pilula>
      </div>
      {votacao.sim != null && votacao.nao != null && (
        <div className="vd1-selo"><b>{votacao.sim} a {votacao.nao}</b><small>placar</small></div>
      )}
      <div className="vd1-quadro">
        <div className="vd-grade">{itens.map((i) => <Chip key={i.slug} i={i} />)}</div>
      </div>
      <Nota votacao={votacao} m={m} />
      <Fonte votacao={votacao} />
    </div>
  );
}

/* 2: centralizado em tom claro (OverOne): título leve, placar em linha e um celular cortado com a lista dentro. */
function V2({ data, m, votacao, ver }: Props) {
  const itens = ordenados(votacao, ver);
  const cont = ORDEM.map((k) => ({ k, n: itens.filter((i) => i.voto === k).length })).filter((x) => x.n);
  return (
    <div className="insta insta-card vd vd--claro">
      <Aneis escuro={false} />
      <Topo data={data} claro />
      <div className="vd2-cabeca">
        <p className="vd2-tag">{m.tipo_nome} · {votacao.etapa_txt}</p>
        <h1>{m.titulo}</h1>
        <p className={`vd2-sub${resultadoTxt(votacao).length > 14 ? " vd2-sub--longo" : ""}`}><b style={{ color: corResultado(votacao) }}>{resultadoTxt(votacao)}</b>{votacao.sim != null && votacao.nao != null && <> por {votacao.sim} a {votacao.nao}</>}</p>
        <p className="vd2-assunto">{frase(m.assunto)}</p>
      </div>
      <Resumo cont={cont} topo={510} />
      <div className="vd2-celular">
        <span className="vd2-notch" />
        <div className="vd2-tela">
          <p className="vd2-tela__tit">Quem votou</p>
          <div className="vd2-lista">
            {itens.map((i) => (
              <div key={i.slug} className="vd2-linha">
                <span className="vd2-bola" style={{ background: COR[i.voto] }} />
                <b>{i.v?.exibicao ?? i.slug}</b>
                <em style={{ color: COR[i.voto] }}>{ROTULO[i.voto]}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Nota votacao={votacao} m={m} claro />
      <Fonte votacao={votacao} claro />
    </div>
  );
}

/* 3: círculo grande com as fotos (Fortiv), anéis ao redor e pílulas sobre a borda. */
function V3({ data, m, votacao, ver }: Props) {
  const itens = ordenados(votacao, ver);
  const cont = ORDEM.map((k) => ({ k, n: itens.filter((i) => i.voto === k).length })).filter((x) => x.n);
  return (
    <div className="insta insta-card vd vd--azul">
      <Aneis />
      <Topo data={data} />
      <div className="vd3-cabeca">
        <h1>{m.titulo}</h1>
        <p className={`vd3-sub${resultadoTxt(votacao).length > 14 ? " vd3-sub--longo" : ""}`}><b style={{ color: lateral(votacao) ? "#BFE0F5" : votacao.resultado === "REJEITADO" ? "#FF8A7A" : "#7FE3A6" }}>{resultadoTxt(votacao)}</b>{votacao.sim != null && votacao.nao != null && <> por {votacao.sim} a {votacao.nao}</>}</p>
        <p className="vd3-assunto">{frase(m.assunto)}</p>
      </div>
      <Resumo cont={cont} topo={452} />
      <div className="vd3-disco">
        <div className="vd3-mosaico">
          {itens.map((i) => (
            <div key={i.slug} className="vd3-pessoa">
              <span className="vd3-foto" style={{ borderColor: COR[i.voto] }}>
                {i.v?.foto_p || i.v?.foto ? <img src={i.v.foto_p ?? i.v.foto ?? ""} alt="" /> : <em>{i.v?.iniciais}</em>}
              </span>
              <b>{i.v?.exibicao ?? i.slug}</b>
              <span style={{ color: COR_CLARA[i.voto] }}>{ROTULO[i.voto]}</span>
            </div>
          ))}
        </div>
      </div>
      <Nota votacao={votacao} m={m} />
      <Fonte votacao={votacao} />
    </div>
  );
}

interface Props { data: string; m: Materia; votacao: Votacao; ver: Map<string, Vereador> }

export function CardVoto({ variante, ...p }: Props & { variante: Variante }) {
  return variante === 1 ? <V1 {...p} /> : variante === 2 ? <V2 {...p} /> : <V3 {...p} />;
}
