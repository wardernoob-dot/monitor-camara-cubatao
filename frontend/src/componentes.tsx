import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useDados, type Materia, type Vereador, type Votacao, type Voto, type Resultado } from "./dados";
import { slugPartido } from "./dados";
import { ORDEM_VOTO, ROTULO, dataCurta, minusculaInicial } from "./util";

export function LinkMateria({ slug }: { slug: string }) {
  const { materia } = useDados();
  const m = materia.get(slug);
  if (!m) return null;
  return <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link>;
}

export function Celula({ ev, voto, nome }: { ev: Votacao; voto?: Voto; nome: string }) {
  const { materia } = useDados();
  const m = materia.get(ev.materia);
  const res = ev.resultado === "APROVADO" ? "aprovado" : ev.resultado === "REJEITADO" ? "rejeitado" : "sem resultado";
  const v = voto ? ROTULO[voto] : "sem registro";
  const titulo = `${nome}: ${v}. ${m?.titulo ?? ""}, ${minusculaInicial(ev.etapa_txt)}, ${dataCurta(ev.data)} (${res})`;
  // sem link: um quadrado de 9 a 11 px colado no vizinho não dá pra tocar (WCAG 2.5.8). O projeto abre pela
  // tabela ou lista ao lado; aqui fica o desenho, com o texto para leitor de tela e o title para o mouse.
  return (
    <span className={`cel cel--${voto ? voto.toLowerCase() : "vazio"}`} title={titulo}>
      <span className="sr">{titulo}</span>
    </span>
  );
}

export function Legenda() {
  return (
    <ul className="legenda" aria-label="Legenda">
      <li><span className="cel cel--sim" aria-hidden="true" /> Sim</li>
      <li><span className="cel cel--nao" aria-hidden="true" /> Não</li>
      <li><span className="cel cel--branco" aria-hidden="true" /> Presente, não votou</li>
      <li><span className="cel cel--ausente" aria-hidden="true" /> Ausente</li>
      <li><span className="cel cel--vazio" aria-hidden="true" /> Sem registro</li>
    </ul>
  );
}

export function VotoTag({ voto }: { voto: Voto }) {
  return <span className={`voto voto--${voto.toLowerCase()}`}>{ROTULO[voto]}</span>;
}

export function ResultadoTag({ r }: { r: Resultado }) {
  if (r === "APROVADO") return <span className="res res--sim">Aprovado</span>;
  if (r === "REJEITADO") return <span className="res res--nao">Rejeitado</span>;
  return <span className="res">Sem resultado registrado</span>;
}

export function Placar({ ev, grande = false }: { ev: Votacao; grande?: boolean }) {
  if (ev.sim == null) return null;
  return <span className={`placar${grande ? " placar--grande" : ""}`}>{ev.sim} a {ev.nao}</span>;
}

/** "PLACAR 14 a 0": o mesmo desenho na capa, no carrossel e nas listas. Só aparece em votação direta. */
export function PlacarRotulado({ ev }: { ev: Votacao | null | undefined }) {
  const p = placarDireto(ev);
  return p ? <span className="placar-linha"><span className="placar-linha__rot">Placar</span> <span className="placar">{p}</span></span> : null;
}

/** Placar só quando votar Sim é ser a favor do projeto; em parecer contrário, emenda ou veto o número solto confunde. */
export function placarDireto(ev: Votacao | null | undefined): string | null {
  return ev && ev.sim != null && ev.nao != null && ev.sentido === "direto" && Object.keys(ev.votos).length ? `${ev.sim} a ${ev.nao}` : null;
}

/** Parecer contrário aprovado ou favorável rejeitado = projeto rejeitado. */
export function rejeitado(m: Pick<Materia, "situacao" | "situacao_cls">) {
  return (m.situacao_cls as string) === "rejeitado" || /parecer contr[áa]rio[^:]*: aprovado/i.test(m.situacao) || /parecer[^:]*favor[áa]vel[^:]*: rejeitado/i.test(m.situacao);
}

/** Situação em linguagem de quem não acompanha a Câmara, curta o bastante para caber num selo. A única do site. */
export function situacaoCurta(m: Pick<Materia, "situacao" | "situacao_cls" | "tipo" | "lei">): string {
  if (m.lei) return `Virou a Lei ${m.lei.numero}`;
  if (rejeitado(m)) return "Rejeitado pela Câmara";
  // "Aprovado pela Câmara" num projeto de lei ainda vai para o prefeito sancionar ou vetar
  if (m.situacao_cls === "aprovado" && /^(PL|PLC)$/.test(m.tipo)) return "Aprovado, falta o prefeito";
  if (/veto mantido/i.test(m.situacao)) return "Vetado, veto mantido";
  if (/derrubad/i.test(m.situacao)) return "Veto derrubado";
  if (/falta a C[âa]mara votar o veto/i.test(m.situacao)) return "Vetado, falta votar o veto";
  if (/^Na pauta, sem vota[çc][ãa]o registrada$/i.test(m.situacao)) return "Na pauta";
  return m.situacao.replace(/;.*$/, "");
}

/** Cor da bolinha: virou lei (verde), andando (azul), parou (vermelho: rejeitado ou vetado), só na pauta (cinza). */
export function tomSituacao(m: Pick<Materia, "situacao" | "situacao_cls" | "lei">): "lei" | "anda" | "parou" | "pauta" {
  if (m.lei) return "lei";
  if (rejeitado(m) || m.situacao_cls === "veto") return /derrubad/i.test(m.situacao) ? "anda" : "parou";
  if (m.situacao_cls === "pauta") return "pauta";
  return "anda";
}
export const classeSituacao = (m: Pick<Materia, "situacao" | "situacao_cls" | "lei">) => (m.lei ? "lei" : rejeitado(m) ? "rejeitado" : m.situacao_cls);

/** Selo de situação, o mesmo em todas as telas. `completa` mostra o texto inteiro (cabeçalho do projeto). */
export function Situacao({ m, completa = false }: { m: Materia; completa?: boolean }) {
  return <span className={`sit sit--${tomSituacao(m)}`}>{completa ? m.situacao : situacaoCurta(m)}</span>;
}

/** Chapéu (editoria) da reportagem: texto azul em caixa alta, sem fundo, igual na capa, na lista e na página. */
export function Chapeu({ texto }: { texto: string | null | undefined }) {
  return texto ? <span className="chapeu">{texto}</span> : null;
}

export function Fonte({ ev }: { ev: Votacao }) {
  if (ev.fonte === "painel")
    return ev.link ? <a href={ev.link} rel="noopener">painel na transmissão</a> : <>painel na transmissão</>;
  if (ev.fonte === "resumo")
    return ev.resumo_url ? <a href={ev.resumo_url} rel="noopener">resumo oficial</a> : <>resumo oficial</>;
  return <>—</>;
}

/** Votação em painéis: uma barra com a proporção e, embaixo, quem votou Sim, quem votou Não, quem estava presente e não votou e quem faltou. */
const GRUPOS_VOTO: [Voto, string, string][] = [
  ["SIM", "sim", "Sim"],
  ["NAO", "nao", "Não"],
  ["BRANCO", "branco", "Presente, não votou"],
  ["AUSENTE", "ausente", "Ausente"],
  ["?", "ilegivel", "Ilegível"],
];
export function Grade({ ev }: { ev: Votacao }) {
  const { vereador } = useDados();
  const itens = Object.entries(ev.votos)
    .map(([slug, voto]) => ({ v: vereador.get(slug), voto }))
    .filter((x) => x.v)
    .sort((a, b) => a.v!.exibicao.localeCompare(b.v!.exibicao, "pt-BR"));
  if (!itens.length) return null;
  const grupos = GRUPOS_VOTO.map(([voto, k, rot]) => ({ k, rot, lista: itens.filter((x) => x.voto === voto) })).filter((g) => g.lista.length > 0);
  const resumo = grupos.map((g) => `${g.rot}: ${g.lista.length}`).join(", ");
  return (
    <div className="votos">
      <div className="votos__barra" role="img" aria-label={resumo}>
        {grupos.map((g) => <span key={g.k} className={`votos__seg votos__seg--${g.k}`} style={{ flexGrow: g.lista.length, flexBasis: 0 }} />)}
      </div>
      <div className="racha__lados votos__lados">
        {grupos.map((g) => (
          <section key={g.k} className={`racha__lado racha__lado--${g.k}`}>
            <p className="racha__lado-rot"><span>{g.rot}</span><strong>{g.lista.length}</strong></p>
            <ul>
              {g.lista.map(({ v }) => (
                <li key={v!.slug}><Avatar v={v!} tamanho="p" /><Link to={`/vereadores/${v!.slug}`}>{v!.exibicao}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function NotaFonte({ ev }: { ev: Votacao }) {
  return (
    <p className="nota">
      Fonte: <Fonte ev={ev} />
      {ev.fonte === "resumo" ? ". O resumo oficial não registra quem estava presente e não votou" : ""}.
    </p>
  );
}

/** Rosto do vereador: foto (docs/fotos) quando existir; senao as iniciais. */
/** Largura em que cada tamanho aparece: o navegador escolhe entre a foto de 160 px e a de 480 px. */
const LARGURA_AVATAR: Record<string, string> = { p: "40px", m: "64px", g: "120px", retrato: "(max-width: 640px) 72px, 320px" };

export function Avatar({ v, tamanho = "m" }: { v: Vereador; tamanho?: "p" | "m" | "g" | "retrato" }) {
  // arquivo apagado ou caminho errado: cai nas iniciais em vez do ícone de imagem quebrada
  const [falhou, setFalhou] = useState(false);
  if (v.foto && !falhou)
    return (
      <img className={`avatar avatar--${tamanho}`} src={`./${v.foto}`} alt={`Foto de ${v.exibicao}`} loading="lazy" decoding="async"
        srcSet={v.foto_p ? `./${v.foto_p} 160w, ./${v.foto} 480w` : undefined} sizes={v.foto_p ? LARGURA_AVATAR[tamanho] : undefined}
        onError={() => setFalhou(true)} />
    );
  return <span className={`avatar avatar--${tamanho} avatar--iniciais`} aria-hidden="true">{v.iniciais}</span>;
}

/** Sigla do partido como tag clicavel (leva a /partidos/<sigla>). */
export function TagPartido({ sigla, parar }: { sigla: string | null | undefined; parar?: boolean }) {
  if (!sigla) return null;
  return (
    <Link to={`/partidos/${slugPartido(sigla)}`} className="tag-partido"
      onClick={parar ? (e) => e.stopPropagation() : undefined} aria-label={`Partido ${sigla}: ver todos os vereadores`}>
      {sigla}
    </Link>
  );
}

/** Quadro "Como ler": explica os termos de uma tela em definições curtas, com a nota de fonte e o link para o método. */
export function ComoLer({ itens, nota, link }: { itens: readonly (readonly [string, ReactNode])[]; nota?: ReactNode; link?: { ancora?: string; rotulo: string } }) {
  return (
    <aside className="como-ler" aria-label="Como ler esta página">
      <header className="como-ler__cab">
        <span className="como-ler__icone" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.4v.1" />
          </svg>
        </span>
        <p className="como-ler__selo">Como ler</p>
      </header>
      <dl className="como-ler__itens">
        {itens.map(([termo, texto]) => (
          <div key={termo} className="como-ler__item"><dt>{termo}</dt><dd>{texto}</dd></div>
        ))}
      </dl>
      {(nota || link) && (
        <footer className="como-ler__rodape">
          {nota && <p>{nota}</p>}
          {link && <Metodo ancora={link.ancora}>{link.rotulo}</Metodo>}
        </footer>
      )}
    </aside>
  );
}

/** Ponteiro para o método (Como funciona), no mesmo formato em todas as páginas: ícone de livro, texto e seta. */
export function Metodo({ ancora, children }: { ancora?: string; children: ReactNode }) {
  return (
    <Link to={{ pathname: "/como-funciona", hash: ancora ? `#${ancora}` : "" }} className="metodo-link">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4.5A1.5 1.5 0 015.5 3H16v12H5.5A1.5 1.5 0 004 16.5z" /><path d="M4 16.5A1.5 1.5 0 005.5 18H16" />
      </svg>
      <span>{children}</span><span className="metodo-link__seta" aria-hidden="true">→</span>
    </Link>
  );
}

/** Nota curta sobre como ler um número, com o ponteiro para o método. */
export function NotaMetodo({ children, ancora, rotulo }: { children: ReactNode; ancora?: string; rotulo: string }) {
  return (
    <aside className="nota-metodo">
      <p>{children}</p>
      <Metodo ancora={ancora}>{rotulo}</Metodo>
    </aside>
  );
}

/** Votação de veto: o "Sim" é manter o veto do prefeito e o "Não" é derrubar. O resultado vem de `veto.resultado` da matéria (ou do texto do resumo oficial). */
/** Etapas que não decidem o projeto: emenda e parecer (o resultado final é outra votação). */
export const ACESSORIAS = ["parecer", "parecer_emenda", "emenda", "parecer_comissao"];

/** Votação de veto: o resumo oficial diz "MANTIDO"/"REJEITADO" no detalhe e deixa o resultado vazio. */
export function resultadoVeto(ev: Votacao | undefined | null, m: Pick<Materia, "tipo" | "veto">): "mantido" | "derrubado" | null {
  if (m.tipo !== "VETO" || !ev || ev.resultado) return null;
  const d = (ev.detalhe ?? "").toUpperCase();
  if (m.veto?.resultado === "veto_mantido" || (!m.veto?.resultado && d.includes("MANTID"))) return "mantido";
  if (m.veto?.resultado === "veto_derrubado" || (!m.veto?.resultado && d.includes("REJEITAD"))) return "derrubado";
  return null;
}

export function ResultadoVotacao({ ev, m }: { ev: Votacao; m: Pick<Materia, "tipo" | "veto"> }) {
  const veto = resultadoVeto(ev, m);
  if (veto) return <span className="res">{veto === "mantido" ? "Veto mantido" : "Veto derrubado"}</span>;
  return <ResultadoTag r={ev.resultado} />;
}

export function AvisoVeto({ m }: { m: Pick<Materia, "tipo"> }) {
  if (m.tipo !== "VETO") return null;
  return <p className="aviso-voto">Nesta votação, votar <strong>Sim</strong> é manter o veto do prefeito, e votar <strong>Não</strong> é derrubar o veto.</p>;
}
