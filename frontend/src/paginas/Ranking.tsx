import { Link, useSearchParams } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useDados, type Vereador } from "../dados";
import { Avatar, ComoLer, TagPartido } from "../componentes";
import { useTitulo } from "../util";
import { pctPilar } from "../indice";
import { EASE } from "../movimento";

type Criterio = "indice" | "assiduidade" | "participacao" | "producao" | "fiscalizacao";
const CRITERIOS: [Criterio, string][] = [
  ["indice", "Nota geral"], ["assiduidade", "Assiduidade"], ["participacao", "Participação"], ["producao", "Produção"], ["fiscalizacao", "Fiscalização"],
];
const CURTO: Record<string, string> = { assiduidade: "Assiduidade", participacao: "Participação", producao: "Produção", fiscalizacao: "Fiscalização" };
const fmt = (n: number, c = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

/** valor de 0 a 1 no criterio; null quando o pilar nao se aplica ao vereador */
function valor(v: Vereador, c: Criterio): number | null {
  if (c === "indice") return v.indice.nota / 10;
  const p = v.indice.pilares.find((x) => x.id === c)!;
  return p.nao_se_aplica ? null : pctPilar(p);
}

function Linha({ v, pos, c, i }: { v: Vereador; pos: number | null; c: Criterio; i: number }) {
  const reduz = useReducedMotion();
  const val = valor(v, c);
  const p = c === "indice" ? null : v.indice.pilares.find((x) => x.id === c)!;
  return (
    <motion.li layout={!reduz} transition={{ duration: 0.5, ease: EASE }} className={`rank__item ${pos === 1 ? "rank__item--primeiro" : ""}`}>
      <span className={`rank__pos ${pos && pos <= 3 ? `rank__pos--medalha rank__pos--${pos}` : ""}`} aria-label={pos ? `${pos}º lugar` : "fora da ordem"}>{pos ? `${pos}º` : "–"}</span>
      <div className="rank__quem">
        <Avatar v={v} tamanho="m" />
        <span>
          <Link to={`/vereadores/${v.slug}`} className="rank__nome esticado">{v.exibicao}</Link>
          <span className="rank__partido">
            <TagPartido sigla={v.partido} />
            {v.cargo === "presidente" && <span> presidente da Câmara</span>}
            {v.indice.parcial && <span className="selo-cinza rank__selo">Amostra parcial</span>}
          </span>
        </span>
      </div>
      <span className="rank__barra" aria-hidden="true">
        <motion.span className="rank__cheio" initial={reduz ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: reduz ? 0 : Math.min(i, 10) * 0.035, ease: EASE }}>
          {val != null && <span className="rank__seg" style={{ width: `${100 * val}%` }} />}
        </motion.span>
      </span>
      <span className="rank__nota">
        {val == null ? <span className="rank__na">não se aplica</span>
          : c === "indice" ? <><strong>{fmt(v.indice.nota)}</strong><span>/10</span></>
          : <><strong>{fmt(p!.pontos)}</strong><span>/{p!.max}</span></>}
      </span>
      <span className="rank__pilares" aria-hidden="true">
        {v.indice.pilares.map((pl) => (
          <span key={pl.id} className={`rank__pilar ${pl.id === c ? "rank__pilar--foco" : ""} ${c !== "indice" && pl.id !== c ? "rank__pilar--apagado" : ""}`} title={`${CURTO[pl.id]}: ${pl.nao_se_aplica ? "não se aplica" : `${fmt(pl.pontos)} de ${pl.max}`}`}>
            <span className="rank__pilar-nome">{CURTO[pl.id]}</span>
            <span className="rank__pilar-trilho"><span style={{ width: `${pl.nao_se_aplica ? 0 : 100 * pctPilar(pl)}%` }} /></span>
          </span>
        ))}
      </span>
    </motion.li>
  );
}

/** Onde cada vereador está na escala (de 0 a 10, ou de 0% a 100% no pilar): avatares empilhados quando ficam perto. Cada um leva à página do vereador. */
function Distribuicao({ lista, c, media }: { lista: Vereador[]; c: Criterio; media: number }) {
  const reduz = useReducedMotion();
  const GAP = 4.1;
  const pontos = lista.map((v) => ({ v, x: valor(v, c) })).filter((p): p is { v: Vereador; x: number } => p.x != null).sort((a, b) => a.x - b.x);
  const faixas: number[] = [];
  const pos = pontos.map((p) => {
    const x = 100 * p.x;
    let f = faixas.findIndex((ult) => x - ult >= GAP);
    if (f < 0) f = faixas.length;
    faixas[f] = x;
    return { ...p, pct: x, faixa: f };
  });
  const n = Math.max(1, faixas.length);
  const marcas = c === "indice" ? [0, 2, 4, 6, 8, 10] : [0, 25, 50, 75, 100];
  const fim = c === "indice" ? 10 : 100;
  return (
    <figure className="dist" aria-label="Distribuição dos vereadores na escala">
      <div className="dist__area" style={{ height: `${n * 2.7 + 2.2}rem` }}>
        {c === "indice" && <span className="dist__media" style={{ left: `${media * 10}%` }}><span>média {fmt(media)}</span></span>}
        {pos.map(({ v, pct, faixa }) => (
          <motion.span key={v.slug} className="dist__ponto" initial={false}
            animate={{ left: `${pct}%`, bottom: `${2.2 + faixa * 2.7}rem` }} transition={reduz ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}>
            <Link to={`/vereadores/${v.slug}`} className="dist__av" data-rotulo={`${v.exibicao} · ${c === "indice" ? fmt(valor(v, c)! * 10) : `${Math.round(100 * valor(v, c)!)}%`}`}
              aria-label={`${v.exibicao}: ${c === "indice" ? fmt(valor(v, c)! * 10) + " de 10" : Math.round(100 * valor(v, c)!) + "%"}`}>
              <Avatar v={v} tamanho="m" />
            </Link>
          </motion.span>
        ))}
        <div className="dist__eixo" aria-hidden="true">
          {marcas.map((m) => <span key={m} style={{ left: `${(100 * m) / fim}%` }}>{c === "indice" ? m : `${m}%`}</span>)}
        </div>
      </div>
    </figure>
  );
}

export default function Ranking() {
  useTitulo("Ranking");
  const { atuais, vereadores } = useDados();
  const [params, setParams] = useSearchParams();
  const c = (CRITERIOS.some(([k]) => k === params.get("por")) ? params.get("por") : "indice") as Criterio;

  const ordena = (l: Vereador[]) => [...l].sort((a, b) => (valor(b, c) ?? -1) - (valor(a, c) ?? -1) || a.exibicao.localeCompare(b.exibicao, "pt-BR"));
  const completos = ordena(atuais.filter((v) => !v.indice.parcial));
  const parciais = ordena(vereadores.filter((v) => v.indice.parcial));
  // empate na mesma nota exibida = mesma posicao
  const posicoes: (number | null)[] = [];
  completos.forEach((v, i) => {
    const val = valor(v, c);
    if (val == null) return posicoes.push(null);
    const ant = i > 0 ? completos[i - 1] : null;
    const igual = ant && valor(ant, c) != null && Math.round(1000 * valor(ant, c)!) === Math.round(1000 * val);
    posicoes.push(igual ? posicoes[i - 1] : i + 1);
  });
  const media = atuais[0]?.indice.media_camara ?? 0;

  return (
    <div className="pagina">
      <p className="selo-pagina">Atividade registrada</p>
      <h1 className="titulo-pagina">Ranking</h1>
      <p className="lead">
        Vereadores em exercício ordenados pelo Índice de Atuação, <span className="sem-quebra">de 0 a 10.</span>
        <br />Média da Câmara: <strong>{fmt(media)}</strong>.
      </p>

      <div className="rank__controle">
        <span className="filtros__rotulo">Ordenar por</span>
        <div className="segmentado" role="group" aria-label="Ordenar por">
          {CRITERIOS.map(([k, rot]) => (
            <button key={k} type="button" aria-pressed={c === k}
              onClick={() => setParams(k === "indice" ? {} : { por: k }, { replace: true, preventScrollReset: true })}>
              {c === k && <motion.span layoutId="seg-ativo" className="segmentado__pilula" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
              <span className="segmentado__texto">{rot}</span>
            </button>
          ))}
        </div>
      </div>

      <Distribuicao lista={completos} c={c} media={media} />

      <LayoutGroup>
        <div className="rank__cab" aria-hidden="true">
          <span /><span>Vereador</span><span>{CRITERIOS.find(([k]) => k === c)![1]}</span><span className="rank__cab-nota">Nota</span>
          <span className="rank__cab-pilares">{Object.values(CURTO).map((t) => <span key={t}>{t}</span>)}</span>
        </div>
        <ol className="rank">
          {completos.map((v, i) => <Linha key={v.slug} v={v} pos={posicoes[i]} c={c} i={i} />)}
        </ol>

        {parciais.length > 0 && (
          <>
            <h2 className="secao__titulo">Amostra parcial</h2>
            <p>Suplentes e licenciados com poucas sessões ou sem votações no painel. A nota existe, mas não dá para comparar com quem tem o ano inteiro, então eles ficam fora da ordem.</p>
            <ol className="rank rank--parcial">
              {parciais.map((v, i) => <Linha key={v.slug} v={v} pos={null} c={c} i={i} />)}
            </ol>
          </>
        )}
      </LayoutGroup>

      <ComoLer
        itens={[
          ["O que o índice soma", "Presença, participação nas votações, projetos e fiscalização, com pesos fixos e a conta aberta na página de cada vereador."],
          ["O que ele mede", "Atividade registrada em documento público."],
          ["O que ele não mede", "A qualidade das ideias e o trabalho que não deixa registro, como atendimento e articulação."],
        ]}
        link={{ ancora: "indice", rotulo: "Método completo" }}
      />
    </div>
  );
}
