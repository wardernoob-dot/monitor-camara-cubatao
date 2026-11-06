import { Link } from "react-router-dom";
import type { Materia } from "./dados";
import { dataExtenso } from "./util";

const FUNDAMENTO: Record<string, string> = {
  competencia_ou_iniciativa: "Quem pode propor (competência ou iniciativa)",
  inconstitucionalidade: "Inconstitucionalidade",
  custo_ou_orcamento: "Custo ou orçamento",
  interesse_publico: "Interesse público",
  tecnica_ou_redacao: "Técnica ou redação do texto",
  outro: "Outro",
};

/** "Veto do prefeito: o que diz o ofício". Aparece no PL vetado e na página do veto. */
export default function BlocoVeto({ m }: { m: Materia }) {
  const v = m.veto!;
  const l = v.leitura;
  const status =
    v.resultado === "veto_mantido" ? ["mantido", `Câmara manteve o veto${v.data ? ` em ${dataExtenso(v.data)}` : ""}`]
    : v.resultado === "veto_derrubado" ? ["derrubado", `Câmara derrubou o veto${v.data ? ` em ${dataExtenso(v.data)}` : ""}`]
    : ["", "Câmara ainda não votou o veto"];
  const ehPaginaDoVeto = m.tipo === "VETO";

  return (
    <section className="veto" aria-labelledby="veto-tit">
      <h2 id="veto-tit" className="secao__titulo">Veto do prefeito: o que diz o ofício</h2>
      <p className="veto__status">
        <span className="veto__pilula">Veto {v.alcance}</span>
        <span className={`veto__pilula${status[0] ? ` veto__pilula--${status[0]}` : ""}`}>{status[1]}</span>
      </p>
      <p className="veto__meta">
        {v.oficio ?? "Ofício do prefeito"}
        {v.data_oficio && `, de ${dataExtenso(v.data_oficio)}`}
        {v.url && <>. <a href={v.url} rel="noopener">Ler o ofício (PDF)</a></>}
        {!ehPaginaDoVeto && v.pagina && <>. <Link to={`/projetos/${v.pagina}`}>Ver como cada vereador votou o veto</Link></>}
        .
      </p>

      {l ? (
        <>
          <p className="analise__aviso">
            Resumo feito por inteligência artificial ({l.modelo}) lendo só o {l.fonte}. Mostra o que o prefeito alega, sem dizer se ele tem razão.
          </p>
          <p>{l.resumo}</p>
          {l.o_que_foi_vetado.length > 0 && (
            <>
              <h3>O que foi vetado</h3>
              <ul className="lista-simples">{l.o_que_foi_vetado.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </>
          )}
          {l.razoes.length > 0 && (
            <>
              <h3>Por que o prefeito vetou{l.fundamento && FUNDAMENTO[l.fundamento] ? `: ${FUNDAMENTO[l.fundamento].toLowerCase()}` : ""}</h3>
              <ul className="lista-simples">
                {l.razoes.map((r, i) => (
                  <li key={i}>{r.razao}{r.trecho && <blockquote className="trecho">“{r.trecho}”</blockquote>}</li>
                ))}
              </ul>
              <p className="nota">Cada trecho entre aspas foi conferido palavra por palavra contra o texto do ofício.</p>
            </>
          )}
          {l.limitacoes && <p className="nota">{l.limitacoes}</p>}
        </>
      ) : (
        <p className="nota">
          {v.url
            ? "O resumo do ofício ainda não foi gerado (o documento é escaneado e passa por leitura automática na próxima coleta). Enquanto isso, o PDF original está no link acima."
            : "O ofício com a justificativa do veto ainda não foi localizado no site da Câmara."}
        </p>
      )}
    </section>
  );
}
