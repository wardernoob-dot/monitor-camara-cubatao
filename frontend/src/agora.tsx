import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { votacaoDecisiva, useDados, type Base, type Materia, type Vereador } from "./dados";
import { ACESSORIAS, resultadoVeto } from "./componentes";
import { dataExtenso } from "./util";

/* "Essa semana na Câmara", "E agora?" e "Seguir um projeto": o que o visitante faz depois de ler.
   Tudo sai do dado público (resumos, painel, SAPL); seguir fica só no navegador de quem segue. */

export interface ItemResumo { m: Materia; r: string; placar: string | null }

/** O que cada matéria teve num dia, numa frase: a votação que decidiu (se foi nesse dia) ou a última do dia que decide. */
export function resumoDoDia(b: Base, materias: string[], data: string): ItemResumo[] {
  return materias.map((s) => b.materia.get(s)).filter((m): m is Materia => !!m).map((m) => {
    const evs = m.eventos.map(b.votacao).filter((e) => e.data === data);
    const dec = votacaoDecisiva(b, m);
    const ult = dec && dec.data === data ? dec : [...evs].reverse().find((e) => !ACESSORIAS.includes(e.etapa)) ?? evs[evs.length - 1];
    const inverso = ult?.sentido === "inverso";
    // veto: o resumo oficial diz "MANTIDO"/"REJEITADO" no detalhe e deixa o resultado vazio
    const veto = m.tipo === "VETO" ? resultadoVeto(ult, m) : null;
    const r = veto ? (veto === "mantido" ? "o veto foi mantido" : "o veto foi derrubado")
      : !ult ? "entrou na pauta" : !ult.resultado ? "não foi votado nesta sessão"
      : (ult.resultado === "APROVADO") !== inverso ? "foi aprovado" : "foi rejeitado";
    const etapa = ult && ult.etapa !== "unica" ? ` na ${ult.etapa_txt.toLowerCase()}` : "";
    return { m, r: r + (ult?.resultado || veto ? etapa : ""), placar: ult && ult.sim != null ? `${ult.sim} a ${ult.nao ?? 0}` : null };
  });
}

const primeiraFrase = (t: string) => (t.match(/^.+?[.!?](\s|$)/)?.[0] ?? t).trim().replace(/\.$/, "");

/** Home: a última sessão em poucas linhas, quando é a próxima e onde assistir. Dá motivo pra voltar toda semana. */
export function EssaSemana() {
  const b = useDados();
  const d = b.dias[0];
  if (!d) return null;
  const cam = b.meta.camara;
  const itens = resumoDoDia(b, d.materias, d.data);
  const principais = itens.filter((x) => !["RQ", "MOCAO"].includes(x.m.tipo))
    .sort((x, y) => Number(y.m.relevancia.nivel === "alta") - Number(x.m.relevancia.nivel === "alta"));
  const homenagens = itens.length - principais.length;
  return (
    <section className="semana" aria-labelledby="semana-titulo">
      <div className="semana__dentro">
        <p className="semana__selo">Essa semana na Câmara</p>
        <h2 id="semana-titulo" className="semana__titulo">Na sessão de {dataExtenso(d.data)}</h2>
        {principais.length ? (
          <ul className="semana__lista">
            {principais.slice(0, 3).map(({ m, r, placar }) => (
              <li key={m.slug}>
                <Link to={`/projetos/${m.slug}`} className="semana__item">
                  <span className="semana__frase">{primeiraFrase(m.explicacao?.texto ?? m.assunto)}.</span>
                  <span className="semana__res">{r[0].toUpperCase() + r.slice(1)}{placar ? ` (${placar})` : ""} · {m.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="semana__vazio">Só homenagens e requerimentos nesta sessão.</p>}
        <p className="semana__mais">
          {homenagens > 0 && <>E mais {homenagens} {homenagens === 1 ? "homenagem ou requerimento" : "homenagens e requerimentos"}. </>}
          <Link to={`/sessoes/${d.data}`} className="link-seta">Ver a sessão inteira <span aria-hidden="true">→</span></Link>
        </p>
        {cam && (
          <p className="semana__proxima">
            As sessões ordinárias costumam ser às terças, a partir das 14h, abertas ao público.{" "}
            <a href={cam.transmissao} rel="noopener noreferrer">Assistir ao vivo no YouTube da TV Câmara</a>{" · "}
            <a href={cam.pautas} rel="noopener noreferrer">Ver a pauta</a>
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ seguir um projeto (só neste navegador) */
const CHAVE = "vav:seguindo";
type Seguidos = Record<string, string>; // slug -> situação quando a pessoa viu pela última vez

function ler(): Seguidos {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") as Seguidos; } catch { return {}; }
}
function gravar(s: Seguidos) {
  try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch { /* navegador sem armazenamento: segue só nesta visita */ }
  window.dispatchEvent(new Event(CHAVE));
}
const marca = (m: Materia) => `${m.situacao}|${m.eventos.length}`;

export function useSeguidos() {
  const [s, setS] = useState<Seguidos>(ler);
  useEffect(() => {
    const atualiza = () => setS(ler());
    window.addEventListener(CHAVE, atualiza);
    window.addEventListener("storage", atualiza);
    return () => { window.removeEventListener(CHAVE, atualiza); window.removeEventListener("storage", atualiza); };
  }, []);
  const seguir = useCallback((m: Materia) => gravar({ ...ler(), [m.slug]: marca(m) }), []);
  const parar = useCallback((slug: string) => { const x = ler(); delete x[slug]; gravar(x); }, []);
  const visto = useCallback((m: Materia) => { const x = ler(); if (x[m.slug] !== undefined) { x[m.slug] = marca(m); gravar(x); } }, []);
  return { s, seguir, parar, visto };
}

export function BotaoSeguir({ m }: { m: Materia }) {
  const { s, seguir, parar, visto } = useSeguidos();
  const seguindo = s[m.slug] !== undefined;
  useEffect(() => { if (seguindo) visto(m); }, [seguindo, m, visto]); // abriu a página: a novidade foi vista
  return (
    <div className="seguir">
      <button type="button" className={`botao ${seguindo ? "botao--fantasma" : "botao--acao"}`} aria-pressed={seguindo}
        onClick={() => (seguindo ? parar(m.slug) : seguir(m))}>
        {seguindo ? "Seguindo este projeto" : "Seguir este projeto"}
      </button>
      <p className="seguir__nota">{seguindo
        ? "Quando ele andar (nova votação, virar lei ou ser vetado), aparece um aviso no começo do site. Fica salvo só neste navegador."
        : "Receba um aviso no começo do site quando ele andar. Sem cadastro: fica salvo só neste navegador."}</p>
    </div>
  );
}

/** Home: projetos que a pessoa segue, com aviso do que mudou desde a última vez que ela viu. */
export function ProjetosSeguidos() {
  const b = useDados();
  const { s } = useSeguidos();
  const lista = Object.keys(s).map((slug) => b.materia.get(slug)).filter((m): m is Materia => !!m);
  if (!lista.length) return null;
  const mudou = (m: Materia) => s[m.slug] !== marca(m);
  lista.sort((x, y) => Number(mudou(y)) - Number(mudou(x)));
  return (
    <section className="seguidos" aria-labelledby="seguidos-titulo">
      <h2 id="seguidos-titulo" className="seguidos__titulo">Projetos que você segue</h2>
      <ul className="seguidos__lista">
        {lista.map((m) => (
          <li key={m.slug} className={mudou(m) ? "seguidos__item seguidos__item--novo" : "seguidos__item"}>
            <Link to={`/projetos/${m.slug}`}>{m.titulo}</Link>
            {mudou(m) && <span className="seguidos__novo">Andou</span>}
            <span className="seguidos__sit">{m.situacao.replace(/;.*$/, "")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ E agora? */
/** O que o morador pode fazer depois de ler: falar com o gabinete, assistir, falar na Tribuna Popular, sugerir lei. */
export function EAgora({ v, m }: { v?: Vereador; m?: Materia }) {
  const b = useDados();
  const cam = b.meta.camara;
  const canais = b.meta.contato;
  const autores = m ? m.autores.map((s) => b.vereador.get(s)).filter((x): x is Vereador => !!x && !!x.contato) : [];
  if (!cam) return null;
  return (
    <section className="e-agora" aria-labelledby="e-agora-titulo">
      <h2 id="e-agora-titulo" className="e-agora__titulo">E agora?</h2>
      <p className="e-agora__lead">{v ? `Concorda ou discorda de como ${v.exibicao} votou? Dá pra falar direto com o gabinete e acompanhar as próximas votações.`
        : "Esse assunto mexe com você? Dá pra acompanhar, falar com os vereadores e até levar o tema à Câmara."}</p>
      <ul className="e-agora__lista">
        {v?.contato && (
          <li>
            <strong>Falar com o gabinete de {v.exibicao}</strong>
            <span>
              {v.contato.telefone && <><a href={`tel:${v.contato.telefone.replace(/\D/g, "")}`}>{v.contato.telefone}</a>{v.contato.email ? " · " : ""}</>}
              {v.contato.email && <a href={`mailto:${v.contato.email}`}>{v.contato.email}</a>}
            </span>
          </li>
        )}
        {autores.map((a) => (
          <li key={a.slug}>
            <strong>Falar com quem propôs: {a.exibicao}</strong>
            <span>
              {a.contato!.telefone && <><a href={`tel:${a.contato!.telefone.replace(/\D/g, "")}`}>{a.contato!.telefone}</a>{a.contato!.email ? " · " : ""}</>}
              {a.contato!.email && <a href={`mailto:${a.contato!.email}`}>{a.contato!.email}</a>}
            </span>
          </li>
        ))}
        {m && !v && (
          <li>
            <strong>Falar com qualquer vereador</strong>
            <span>Telefone e e-mail de cada um estão na <Link to="/vereadores">página dos vereadores</Link>.</span>
          </li>
        )}
        <li>
          <strong>Assistir às sessões</strong>
          <span>Costumam ser às terças, a partir das 14h, abertas ao público. <a href={cam.transmissao} rel="noopener noreferrer">Ao vivo no YouTube</a> · <a href={cam.pautas} rel="noopener noreferrer">pauta da próxima sessão</a></span>
        </li>
        <li>
          <strong>Falar na Tribuna Popular</strong>
          <span>Morador pode falar até 10 minutos antes da 1ª e da 3ª sessão do mês. O pedido vai por escrito ao protocolo da Câmara, com 5 dias de antecedência e mais 5 assinaturas. <a href={cam.tribuna_popular} rel="noopener noreferrer">Regras</a></span>
        </li>
        <li>
          <strong>Sugerir uma lei</strong>
          <span><a href={cam.banco_de_ideias} rel="noopener noreferrer">Banco de Ideias Legislativas</a> da Câmara · <a href={cam.ouvidoria} rel="noopener noreferrer">Ouvidoria</a></span>
        </li>
        {(canais?.instagram || canais?.canal_whatsapp) && (
          <li>
            <strong>Seguir o Voto a voto</strong>
            <span>
              {canais.canal_whatsapp && <a href={canais.canal_whatsapp} rel="noopener noreferrer">Canal no WhatsApp</a>}
              {canais.canal_whatsapp && canais.instagram && " · "}
              {canais.instagram && <a href={canais.instagram} rel="noopener noreferrer">Instagram</a>}
            </span>
          </li>
        )}
      </ul>
      <p className="e-agora__fonte">Contatos e regras copiados do site da Câmara e do SAPL (conferidos em {dataExtenso(cam.conferido_em)}).</p>
    </section>
  );
}
