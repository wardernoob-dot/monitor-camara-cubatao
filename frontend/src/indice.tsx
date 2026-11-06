import { Link } from "react-router-dom";
import type { Indice, PilarIndice } from "./dados";

const fmt = (n: number, casas = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const CURTO: Record<string, string> = { assiduidade: "Assiduidade", participacao: "Participação", producao: "Produção", fiscalizacao: "Fiscalização" };

export const pctPilar = (p: PilarIndice) => (p.max ? p.pontos / p.max : 0);

/** Nota em destaque + 4 barrinhas, para os cards da lista. */
export function IndiceMini({ i }: { i: Indice }) {
  return (
    <span className="indice-mini">
      <span className="indice-mini__nota">
        <strong>{fmt(i.nota)}</strong>
        <span> / 10</span>
        {i.parcial && <span className="selo-cinza">Amostra parcial</span>}
      </span>
      <span className="indice-mini__barras" aria-hidden="true">
        {i.pilares.map((p) => (
          <span key={p.id} className={`indice-mini__barra${p.nao_se_aplica ? " indice-mini__barra--na" : ""}`} title={`${CURTO[p.id]}: ${p.nao_se_aplica ? "não se aplica" : `${fmt(p.pontos)} de ${p.max}`}`}>
            <span style={{ width: `${p.nao_se_aplica ? 0 : 100 * pctPilar(p)}%` }} />
          </span>
        ))}
      </span>
      <span className="sr">
        Índice de atuação {fmt(i.nota)} de 10.{" "}
        {i.pilares.map((p) => `${CURTO[p.id]}: ${p.nao_se_aplica ? "não se aplica" : `${fmt(p.pontos)} de ${p.max}`}`).join("; ")}
      </span>
    </span>
  );
}

/** Card completo da página do vereador, com a memória de cálculo. */
export function CartaoIndice({ i, nome }: { i: Indice; nome: string }) {
  return (
    <section aria-labelledby="indice" className="indice">
      <h2 id="indice" className="secao__titulo">Índice de atuação</h2>
      <div className="indice__topo">
        <p className="indice__nota"><strong>{fmt(i.nota)}</strong><span> / 10</span></p>
        <p className="indice__media">
          Média da Câmara: {fmt(i.media_camara)}
          {i.parcial && <><br /><span className="selo-cinza">Amostra parcial</span> poucas sessões ou sem votações no painel no período; compare com cuidado.</>}
        </p>
      </div>
      <ul className="indice__pilares">
        {i.pilares.map((p) => (
          <li key={p.id} className="indice__pilar">
            <p className="indice__pilar-nome">
              <span>{p.nome}</span>
              <span className="indice__pilar-pts">{p.nao_se_aplica ? "não se aplica" : `${fmt(p.pontos)} de ${p.max}`}</span>
            </p>
            {!p.nao_se_aplica && (
              <span className="indice__trilho" aria-hidden="true">
                <span className="indice__barra" style={{ width: `${100 * pctPilar(p)}%` }} />
                <span className="indice__marca" style={{ left: `${(100 * p.media_camara) / p.max}%` }} title={`Média da Câmara: ${fmt(p.media_camara)}`} />
              </span>
            )}
            {p.nao_se_aplica && (
              <p className="nota">
                {i.presidente && p.id === "participacao"
                  ? `${nome} preside as sessões e, no painel, quase sempre aparece presente sem voto, o que é esperado de quem conduz a votação. Por isso este pilar não conta; o peso dele é redistribuído entre os outros.`
                  : "Sem votações do painel no período em que exerceu mandato. O peso deste pilar é redistribuído entre os outros."}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="indice__legenda"><span className="indice__marca indice__marca--legenda" aria-hidden="true" /> traço = média da Câmara</p>
      <details className="indice__memoria">
        <summary>Ver a memória de cálculo</summary>
        {i.pilares.map((p) => (
          <div key={p.id} className="indice__memoria-pilar">
            <h3>{p.nome} {p.nao_se_aplica ? "(não entra na nota)" : `(${fmt(p.pontos, 2)} de ${p.max})`}</h3>
            <ul className="lista-simples">
              {p.itens.map((it) => (
                <li key={it.nome}>
                  <strong>{it.nome}</strong>{" "}
                  {it.nao_se_aplica || p.nao_se_aplica ? "" : `${fmt(it.pontos, 2)} de ${it.max}. `}
                  <span className="indice__conta">{it.conta}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="nota">
          Nota = 10 × pontos obtidos ÷ pontos possíveis ({i.pontos_validos} neste caso). Método completo em <Link to="/como-funciona#indice">Como funciona</Link>.
        </p>
      </details>
      <p className="nota">
        O índice mede atividade registrada (presença, voto, projetos, requerimentos), não a qualidade nem o mérito do que cada vereador defende.
        Trabalho de bairro, atendimento e articulação política não aparecem em documento público e ficam de fora.
      </p>
    </section>
  );
}
