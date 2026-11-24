import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useDados, votacaoDecisiva, type Base, type Materia, type Reportagem, type Vereador, type Votacao } from "./dados";
import { Avatar } from "./componentes";
import { dataCurta } from "./util";

/* ------------------------------------------------------------------ fatos que vem do dado, nao do texto */

/** Lado de cada voto em relação ao projeto: em parecer contrário, votar Sim é ser contra o projeto. */
export function lado(ev: Votacao, voto: string): "favor" | "contra" | null {
  if (voto !== "SIM" && voto !== "NAO") return null;
  if (ev.sentido === "inverso") return voto === "SIM" ? "contra" : "favor";
  if (ev.sentido === "emenda") return null;
  return voto === "SIM" ? "favor" : "contra";
}

export function ladosDaVotacao(b: Base, ev: Votacao) {
  const favor: Vereador[] = [];
  const contra: Vereador[] = [];
  for (const [slug, voto] of Object.entries(ev.votos)) {
    const v = b.vereador.get(slug);
    const l = v && lado(ev, voto);
    if (l === "favor") favor.push(v!);
    else if (l === "contra") contra.push(v!);
  }
  const ord = (a: Vereador, c: Vereador) => a.exibicao.localeCompare(c.exibicao, "pt-BR");
  return { favor: favor.sort(ord), contra: contra.sort(ord) };
}

/** Votação que aparece no cartão: a escolhida no texto ou a que decidiu o projeto principal (nunca emenda nem parecer sem lado). */
export function votacaoDa(b: Base, r: Reportagem): Votacao | null {
  if (r.votacao != null && b.votacoes[r.votacao]) return b.votacoes[r.votacao];
  const m = b.materia.get(r.projetos[0]);
  const ev = m ? votacaoDecisiva(b, m) : null;
  return ev && Object.keys(ev.votos).length ? ev : null;
}

/** Situação em linguagem de quem não acompanha a Câmara. Parecer contrário aprovado = projeto rejeitado. */
function rejeitado(m: Materia) {
  return m.situacao_cls === "rejeitado" || /parecer contr[áa]rio[^:]*: aprovado/i.test(m.situacao) || /parecer[^:]*favor[áa]vel[^:]*: rejeitado/i.test(m.situacao);
}
function situacaoCurta(m: Materia): string {
  if (m.lei) return `Virou a Lei ${m.lei.numero}`;
  if (rejeitado(m)) return "Rejeitado pela Câmara";
  // "Aprovado pela Câmara" num projeto de lei ainda vai para o prefeito sancionar ou vetar
  if (m.situacao_cls === "aprovado" && /^(PL|PLC)$/.test(m.tipo)) return "Aprovado, falta o prefeito";
  return m.situacao.replace(/;.*$/, "");
}
const classeSituacao = (m: Materia) => (m.lei ? "lei" : rejeitado(m) ? "rejeitado" : m.situacao_cls);

/* ------------------------------------------------------------------ texto: **negrito** e [link](url) */

export function Inline({ t }: { t: string }) {
  const partes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > i) partes.push(t.slice(i, m.index));
    if (m[1]) partes.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[3].startsWith("#/")) partes.push(<Link key={m.index} to={m[3].slice(1)}>{m[2]}</Link>);
    else if (m[3].startsWith("https://")) partes.push(<a key={m.index} href={m[3]} rel="noopener">{m[2]}</a>);
    else partes.push(m[2]);
    i = m.index + m[0].length;
  }
  if (i < t.length) partes.push(t.slice(i));
  return <>{partes}</>;
}

/* ------------------------------------------------------------------ pecas */

const ehPrefeito = (m: Materia) => !m.autores.length && /prefeit|executivo|sejur/i.test(m.autoria);

function FotoPrefeito({ tamanho }: { tamanho: "p" | "m" }) {
  const b = useDados();
  const e = b.executivo;
  if (e?.foto) return <img className={`avatar avatar--${tamanho}`} src={`./${e.foto}`} alt={`Foto de ${e.nome}`} loading="lazy" decoding="async" />;
  return <span className={`avatar avatar--${tamanho} avatar--iniciais`} aria-hidden="true">P</span>;
}

/** Quem propôs, em destaque: foto grande, nome e o que a pessoa é. */
function Autoria({ m, claro = false }: { m: Materia; claro?: boolean }) {
  const b = useDados();
  const autores = m.autores.map((s) => b.vereador.get(s)).filter(Boolean) as Vereador[];
  const pessoas = autores.length
    ? autores.map((v) => ({ chave: v.slug, foto: <Avatar v={v} tamanho="m" />, nome: v.exibicao, papel: `Vereador${v.partido ? ` (${v.partido})` : ""}`, link: `/vereadores/${v.slug}` }))
    : ehPrefeito(m)
      ? [{ chave: "prefeito", foto: <FotoPrefeito tamanho="m" />, nome: b.executivo?.nome ?? "Prefeito", papel: b.executivo?.cargo ?? "Prefeito", link: null }]
      : [{ chave: "outro", foto: <span className="avatar avatar--m avatar--iniciais" aria-hidden="true">?</span>, nome: m.autoria, papel: "", link: null }];
  return (
    <div className={`rp-autor${claro ? " rp-autor--claro" : ""}`}>
      <span className="rp-autor__rot">{pessoas.length > 1 ? "Propuseram" : "Quem propôs"}</span>
      <ul className="rp-autor__lista">
        {pessoas.map((p) => (
          <li key={p.chave} className="rp-autor__pessoa">
            {p.foto}
            <span className="rp-autor__txt">
              {p.link && !claro ? <Link to={p.link} className="rp-autor__nome">{p.nome}</Link> : <span className="rp-autor__nome">{p.nome}</span>}
              {p.papel && <span className="rp-autor__papel">{p.papel}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O que o prefeito fez com o projeto (sancionou, vetou, ainda não chegou nele). */
export function acaoPrefeito(m: Materia): { texto: string; tom: "bom" | "ruim" | "alerta" | "neutro" } {
  const dele = ehPrefeito(m);
  const v = m.veto;
  const depois = v?.resultado === "veto_mantido" ? "A Câmara manteve o veto." : v?.resultado === "veto_derrubado" ? "A Câmara derrubou o veto." : "Falta a Câmara votar o veto.";
  if (v && v.alcance === "integral") return { texto: `Vetou o projeto inteiro. ${depois}`, tom: "ruim" };
  if (v) return { texto: `Sancionou${m.lei ? ` a Lei ${m.lei.numero}` : ""}, mas vetou um trecho. ${depois}`, tom: "alerta" };
  if (m.lei) return { texto: `${dele ? "Sancionou o próprio projeto" : "Sancionou"}: virou a Lei ${m.lei.numero}, em ${dataCurta(m.lei.data, true)}.`, tom: "bom" };
  if (rejeitado(m)) return { texto: dele ? "Era projeto dele, mas a Câmara rejeitou." : "Não chegou a ele: a Câmara rejeitou.", tom: "neutro" };
  if (m.situacao_cls === "aprovado") return { texto: "Aprovado pela Câmara, aguardando o prefeito sancionar ou vetar.", tom: "alerta" };
  return { texto: dele ? "Projeto dele, ainda em tramitação na Câmara." : "Ainda não chegou ao prefeito.", tom: "neutro" };
}

function Prefeito({ m }: { m: Materia }) {
  const b = useDados();
  const a = acaoPrefeito(m);
  return (
    <div className={`rp-pref rp-pref--${a.tom}`}>
      <FotoPrefeito tamanho="m" />
      <span className="rp-pref__txt">
        <span className="rp-pref__rot">E o prefeito{b.executivo ? `, ${b.executivo.nome.split(" ")[0]}` : ""}?</span>
        <span className="rp-pref__acao">{a.texto}</span>
      </span>
    </div>
  );
}

function Rostos({ lista }: { lista: Vereador[] }) {
  return (
    <ul className="rp-rostos">
      {lista.map((v) => (
        <li key={v.slug} className="rp-rosto" title={v.exibicao}>
          <Avatar v={v} tamanho="m" />
          <span className="rp-rosto__nome">{v.exibicao.replace(/^Dr\. /, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function PlacarRostos({ ev }: { ev: Votacao }) {
  const b = useDados();
  const { favor, contra } = ladosDaVotacao(b, ev);
  return (
    <div className="rp-placar">
      <div className="rp-placar__lado rp-placar__lado--favor">
        <span className="rp-placar__rot"><strong>{favor.length}</strong> a favor do projeto</span>
        <Rostos lista={favor} />
      </div>
      <div className="rp-placar__lado rp-placar__lado--contra">
        {contra.length ? (
          <>
            <span className="rp-placar__rot"><strong>{contra.length}</strong> contra</span>
            <Rostos lista={contra} />
          </>
        ) : <span className="rp-placar__rot rp-placar__nenhum">nenhum voto contra</span>}
      </div>
    </div>
  );
}

function Foto({ r, classe, prioridade = false }: { r: Reportagem; classe: string; prioridade?: boolean }) {
  return (
    <img className={classe} src={`./${r.foto.g}`} srcSet={`./${r.foto.p} 800w, ./${r.foto.g} 1600w`} sizes="(max-width: 800px) 100vw, 80rem"
      alt={r.foto.alt} loading={prioridade ? "eager" : "lazy"} decoding="async" draggable={false} />
  );
}

/* ------------------------------------------------------------------ capa "O que muda" da pagina inicial */

/** Cor da bolinha da situação: virou lei, ainda andando ou parou (rejeitado, veto, só na pauta). */
const TOM: Partial<Record<string, "lei" | "anda">> = { lei: "lei", aprovado: "anda", andamento: "anda" };
const tomSituacao = (m: Materia) => TOM[classeSituacao(m)] ?? "parou";

/** Placar só quando votar Sim é ser a favor do projeto; em parecer contrário, emenda ou veto o número solto confunde. */
function placarDireto(ev: Votacao | null) {
  return ev && ev.sim != null && ev.nao != null && ev.sentido === "direto" && Object.keys(ev.votos).length ? `${ev.sim} a ${ev.nao}` : null;
}

function MetaCapa({ m, ev }: { m: Materia | undefined; ev: Votacao | null }) {
  const placar = placarDireto(ev);
  if (!m && !placar) return null;
  return (
    <p className="capa__meta">
      {m && <span className={`capa__sit capa__sit--${tomSituacao(m)}`}>{situacaoCurta(m)}</span>}
      {placar && <span className="capa__placar" aria-label={`placar ${placar}`}>{placar}</span>}
    </p>
  );
}

function TopoCapa({ r }: { r: Reportagem }) {
  return (
    <p className="capa__topo">
      {r.status === "rascunho" && <span className="rp__rascunho">Rascunho</span>}
      {r.chapeu && <span className="capa__chapeu">{r.chapeu}</span>}
      <span className="capa__data">{dataCurta(r.data)}</span>
    </p>
  );
}

const credito = (r: Reportagem) => `Foto${r.foto.ilustrativa ? " ilustrativa" : ""}: ${r.foto.credito}`;

/** Um item da capa. O título é o link e cobre o cartão inteiro (.esticado); o crédito da foto fica fora do nome do link. */
function ItemCapa({ r, forma }: { r: Reportagem; forma: "lista" | "cartao" }) {
  const b = useDados();
  const m = b.materia.get(r.projetos[0]);
  return (
    <li className={`capa__item capa__item--${forma}`}>
      <div className="capa__txt">
        <TopoCapa r={r} />
        <h3 className="capa__tit"><Link to={`/o-que-muda/${r.id}`} className="esticado">{r.manchete}</Link></h3>
        {forma === "cartao" && <p className="capa__fina">{r.linha_fina}</p>}
        <MetaCapa m={m} ev={votacaoDa(b, r)} />
      </div>
      <div className="capa__midia">
        <span className="capa__foto"><img src={`./${r.foto.p}`} alt="" loading="lazy" decoding="async" draggable={false} /></span>
        <span className="capa__credito">Foto: {r.foto.credito}</span>
      </div>
    </li>
  );
}

/** Manchete principal: a reportagem marcada com `destaque: sim` (a mais recente, se houver mais de uma); sem nenhuma, a mais recente. */
export function principalDa(itens: Reportagem[]): Reportagem | undefined {
  return itens.find((r) => r.destaque) ?? itens[0];
}

export function CapaOQueMuda() {
  const b = useDados();
  const todas = b.reportagens ?? [];
  const assuntos = useMemo(() => [...new Set(todas.map((r) => r.chapeu).filter(Boolean) as string[])], [todas]);
  const [assunto, setAssunto] = useState<string | null>(null);
  if (!todas.length) return null;
  const itens = assunto ? todas.filter((r) => r.chapeu === assunto) : todas;
  const lead = principalDa(itens)!;
  const resto = itens.filter((r) => r !== lead);
  const mLead = b.materia.get(lead.projetos[0]);
  const recentes = resto.slice(0, 3);
  const mais = resto.slice(3);

  return (
    <section className="capa" aria-labelledby="capa-titulo">
      <header className="capa__cab">
        <div className="capa__cab-txt">
          <p className="capa__selo">Atualizações da Câmara</p>
          <h2 id="capa-titulo" className="capa__titulo">O que muda em Cubatão</h2>
          <p className="capa__desc">Projetos e leis que mexem com a cidade, em linguagem simples. Situação e votos vêm do próprio projeto, com a fonte.</p>
        </div>
        <div className="capa__cab-lado">
          <p className="capa__atualizado">Atualizado em {dataCurta(todas[0].data, true)}</p>
          <Link to="/o-que-muda" className="capa__todas-link">Todas as atualizações <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      {assuntos.length > 1 && (
        <div className="capa__filtros" role="group" aria-label="Filtrar por assunto">
          {[null, ...assuntos].map((a) => (
            <button key={a ?? "todas"} type="button" className={`capa__filtro${assunto === a ? " capa__filtro--on" : ""}`}
              aria-pressed={assunto === a} onClick={() => setAssunto(a)}>{a ?? "Todas"}</button>
          ))}
        </div>
      )}

      <div className="capa__grade">
        <article className="capa__lead">
          <figure className="capa__lead-fig">
            <span className="capa__lead-foto">
              {lead.destaque && !assunto && <span className="capa__destaque">Destaque</span>}
              <Foto r={lead} classe="capa__lead-img" />
            </span>
            <figcaption className="capa__credito capa__credito--dir">{credito(lead)}</figcaption>
          </figure>
          <TopoCapa r={lead} />
          <h3 className="capa__lead-tit"><Link to={`/o-que-muda/${lead.id}`} className="esticado">{lead.manchete}</Link></h3>
          <p className="capa__lead-fina">{lead.linha_fina}</p>
          <div className="capa__lead-pe">
            <MetaCapa m={mLead} ev={votacaoDa(b, lead)} />
            <span className="capa__ler" aria-hidden="true">Ler a matéria <span>→</span></span>
          </div>
        </article>
        {recentes.length > 0 && (
          <div className="capa__recentes">
            <p className="capa__rot">Mais recentes</p>
            <ul className="capa__lista">{recentes.map((r) => <ItemCapa key={r.id} r={r} forma="lista" />)}</ul>
          </div>
        )}
      </div>

      {mais.length > 0 && (
        <ul className="capa__cartoes">
          {mais.map((r) => <ItemCapa key={r.id} r={r} forma="cartao" />)}
          <li className="capa__como">
            <p className="capa__rot capa__rot--azul">Como a gente escreve</p>
            <p className="capa__como-tit">Texto feito por gente, sem opinião sobre quem votou</p>
            <p className="capa__como-txt">Situação, autor e votos vêm do próprio projeto, então nunca ficam desatualizados. Toda foto traz crédito e licença.</p>
            <ol className="capa__passos" aria-label="Como uma atualização nasce">
              <li><strong>A Câmara vota</strong><span>no painel da sessão ou no resumo oficial</span></li>
              <li><strong>A gente lê o documento</strong><span>o texto do projeto, não a opinião de ninguém</span></li>
              <li><strong>Explica aqui</strong><span>em linguagem simples, com link pra fonte</span></li>
            </ol>
            <Link to="/como-funciona" className="capa__como-link">Como funciona <span aria-hidden="true">→</span></Link>
          </li>
        </ul>
      )}
      <Link to="/o-que-muda" className="botao botao--fantasma capa__todas-botao">Todas as atualizações</Link>
    </section>
  );
}

/* ------------------------------------------------------------------ letreiro "Últimas votações" no topo */

/** Requerimento, moção e relatório entram aos montes e quase sempre por unanimidade: não são notícia. */
const FORA_DO_LETREIRO = new Set(["RQ", "MOCAO", "RELATORIO"]);

/** O que aconteceu, dito do jeito certo para cada tipo: no veto, Sim é manter o veto. */
export function resultadoLetreiro(m: Materia, ev: Votacao): string {
  if (m.tipo === "VETO") {
    const placar = ev.sim != null && ev.nao != null;
    if (/veto mantido/i.test(m.situacao)) return placar ? `veto mantido por ${ev.sim} a ${ev.nao}` : "veto mantido";
    if (/derrubad/i.test(m.situacao)) return placar ? `veto derrubado por ${ev.nao} a ${ev.sim}` : "veto derrubado";
  }
  const sit = situacaoCurta(m);
  const placar = placarDireto(ev);
  return `${sit.charAt(0).toLowerCase()}${sit.slice(1)}${placar ? `, ${placar}` : ""}`;
}

export function ultimasVotacoes(b: Base, n = 6): { ev: Votacao; m: Materia }[] {
  const vistos = new Set<string>();
  const out: { ev: Votacao; m: Materia }[] = [];
  const ordem = b.votacoes.filter((v) => Object.keys(v.votos).length).sort((x, y) => y.data.localeCompare(x.data) || y.id - x.id);
  for (const ev of ordem) {
    const m = b.materia.get(ev.materia);
    if (!m || FORA_DO_LETREIRO.has(m.tipo) || vistos.has(m.slug)) continue;
    vistos.add(m.slug);
    out.push({ ev, m });
    if (out.length === n) break;
  }
  return out;
}

export function Letreiro() {
  const b = useDados();
  const reduz = useReducedMotion();
  const [parado, setParado] = useState(false);
  const itens = useMemo(() => ultimasVotacoes(b), [b]);
  if (!itens.length) return null;
  const roda = !reduz && !parado;
  const lista = (copia: boolean) => itens.map(({ ev, m }) => (
    <li key={`${copia ? "c" : "o"}-${m.slug}`} className="letreiro__item" aria-hidden={copia || undefined}>
      <span className="letreiro__data">{dataCurta(ev.data)}</span>
      <Link to={`/projetos/${m.slug}`} tabIndex={copia ? -1 : undefined} className="letreiro__proj">{m.titulo}</Link>
      {m.tema && <span className="letreiro__tema">{m.tema}</span>}
      <span className="letreiro__res">{resultadoLetreiro(m, ev)}</span>
    </li>
  ));
  return (
    <div className={`letreiro${roda ? " letreiro--roda" : ""}`}>
      <p className="letreiro__rot" id="letreiro-rot">Últimas votações<span className="letreiro__quando">· dados de {dataCurta(b.meta.atualizado.slice(0, 10))}</span></p>
      <div className="letreiro__janela">
        <ul className="letreiro__trilho" aria-labelledby="letreiro-rot" style={{ animationDuration: `${itens.length * 8}s` }}>
          {lista(false)}
          {roda && lista(true)}
        </ul>
      </div>
      {!reduz && (
        <button type="button" className="letreiro__pausa" onClick={() => setParado((x) => !x)}
          aria-label={parado ? "Voltar a rolar as últimas votações" : "Parar as últimas votações"}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
            {parado ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />}
          </svg>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pagina da reportagem */

export function CorpoReportagem({ r }: { r: Reportagem }) {
  return (
    <div className="rp-corpo">
      {r.corpo.map((bl, k) => (
        <Fragment key={k}>
          {bl.t === "h" && <h2>{bl.x as string}</h2>}
          {bl.t === "p" && <p><Inline t={bl.x as string} /></p>}
          {bl.t === "ul" && <ul>{(bl.x as string[]).map((it, j) => <li key={j}><Inline t={it} /></li>)}</ul>}
        </Fragment>
      ))}
    </div>
  );
}

export { PlacarRostos, Autoria, Foto, Prefeito, situacaoCurta, classeSituacao };
