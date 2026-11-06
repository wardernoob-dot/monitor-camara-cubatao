import { Link, useSearchParams } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useDados, type Vereador } from "../dados";
import { Avatar } from "../componentes";
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
      <Link to={`/vereadores/${v.slug}`} className="rank__quem">
        <Avatar v={v} tamanho="m" />
        <span>
          <span className="rank__nome">{v.exibicao}</span>
          <span className="rank__partido">
            {[v.partido, v.cargo === "presidente" ? "presidente da Câmara" : null].filter(Boolean).join(" · ")}
            {v.indice.parcial && <span className="selo-cinza rank__selo">Amostra parcial</span>}
          </span>
        </span>
      </Link>
      <span className="rank__barra" aria-hidden="true">
        <motion.span className="rank__cheio" initial={reduz ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: reduz ? 0 : Math.min(i, 10) * 0.035, ease: EASE }}>
          {c === "indice"
            ? v.indice.pilares.filter((pl) => !pl.nao_se_aplica && pl.pontos > 0).map((pl) => (
                <span key={pl.id} className={`rank__seg pilar--${pl.id}`} style={{ width: `${(100 * pl.pontos) / v.indice.pontos_validos}%` }}
                  title={`${CURTO[pl.id]}: ${fmt(pl.pontos)} de ${pl.max}`} />
              ))
            : val != null && <span className={`rank__seg pilar--${c}`} style={{ width: `${100 * val}%` }} />}
        </motion.span>
      </span>
      <span className="rank__nota">
        {val == null ? <span className="rank__na">não se aplica</span>
          : c === "indice" ? <><strong>{fmt(v.indice.nota)}</strong><span>/10</span></>
          : <><strong>{fmt(p!.pontos)}</strong><span>/{p!.max}</span></>}
      </span>
      <span className="rank__pilares" aria-hidden="true">
        {v.indice.pilares.map((pl) => (
          <span key={pl.id} className={`rank__pilar pilar--${pl.id} ${pl.id === c ? "rank__pilar--foco" : ""} ${c !== "indice" && pl.id !== c ? "rank__pilar--apagado" : ""}`} title={`${CURTO[pl.id]}: ${pl.nao_se_aplica ? "não se aplica" : `${fmt(pl.pontos)} de ${pl.max}`}`}>
            <span className="rank__pilar-nome">{CURTO[pl.id]}</span>
            <span className="rank__pilar-trilho"><span style={{ width: `${pl.nao_se_aplica ? 0 : 100 * pctPilar(pl)}%` }} /></span>
          </span>
        ))}
      </span>
    </motion.li>
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
      <h1 className="titulo-pagina">Ranking</h1>
      <p className="lead">
        Vereadores em exercício ordenados pelo Índice de Atuação, <span className="sem-quebra">de 0 a 10.</span>
        <br />Média da Câmara: <strong>{fmt(media)}</strong>.
      </p>

      <div className="filtros filtros--ordem" role="group" aria-label="Ordenar por">
        <span className="filtros__rotulo">Ordenar por</span>
        {CRITERIOS.map(([k, rot]) => (
          <button key={k} type="button" aria-pressed={c === k}
            onClick={() => setParams(k === "indice" ? {} : { por: k }, { replace: true, preventScrollReset: true })}>{rot}</button>
        ))}
      </div>

      <ul className="legenda legenda--pilares" aria-label="Cores dos pilares">
        {(["assiduidade", "participacao", "producao", "fiscalizacao"] as const).map((k) => (
          <li key={k}><span className={`ponto pilar--${k}`} aria-hidden="true" /> {CURTO[k]}</li>
        ))}
      </ul>

      <LayoutGroup>
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

      <aside className="rank__aviso">
        <p><strong>Como ler.</strong> O índice soma presença, participação nas votações, projetos e fiscalização, com pesos fixos e a conta aberta na página de cada vereador. Mede atividade registrada em documento público, não a qualidade das ideias nem trabalho que não deixa registro, como atendimento e articulação.</p>
        <p>Método completo em <Link to="/como-funciona#indice">Como funciona</Link>.</p>
      </aside>
    </div>
  );
}
