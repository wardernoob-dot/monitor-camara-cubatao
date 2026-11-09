import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDados, type Materia } from "../dados";
import { TagPartido } from "../componentes";
import { dataExtenso, useTitulo } from "../util";

const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = () => new Date().toISOString().slice(0, 10);

function Autor({ m }: { m: Materia }) {
  const b = useDados();
  const autores = m.autores.map((s) => b.vereador.get(s)).filter(Boolean);
  if (!autores.length) return <>{/prefeit/i.test(m.autoria) ? `Prefeito (${b.executivo?.nome ?? "Prefeitura"})` : m.autoria}</>;
  return <>{autores.map((v, i) => <span key={v!.slug}>{i > 0 && ", "}<Link to={`/vereadores/${v!.slug}`}>{v!.exibicao}</Link> <TagPartido sigla={v!.partido} /></span>)}</>;
}

export default function Leis() {
  useTitulo("Leis de 2026");
  const b = useDados();
  const [simbolicas, setSimbolicas] = useState(false);
  const leis = useMemo(() => b.materias.filter((m) => m.lei).sort((x, y) => y.lei!.data.localeCompare(x.lei!.data)), [b]);
  const visiveis = leis.filter((m) => simbolicas || m.impacto.faixa !== "simbolico");
  const futuras = leis.filter((m) => (m.lei!.vigencia?.data ?? m.lei!.data) > hoje())
    .sort((x, y) => x.lei!.vigencia!.data.localeCompare(y.lei!.vigencia!.data));
  const meses = useMemo(() => {
    const g = new Map<string, Materia[]>();
    visiveis.forEach((m) => { const k = m.lei!.data.slice(0, 7); g.set(k, [...(g.get(k) ?? []), m]); });
    return [...g.entries()];
  }, [visiveis]);
  const nSimb = leis.length - leis.filter((m) => m.impacto.faixa !== "simbolico").length;

  return (
    <div className="pagina">
      <p className="selo-pagina">O que mudou na cidade</p>
      <h1 className="titulo-pagina">Leis de 2026</h1>
      <p className="lead">Projetos que passaram pela Câmara e viraram lei no Diário Oficial, do mais recente para o mais antigo. A data em que cada lei começa a valer vem do texto da própria lei.</p>

      {futuras.length > 0 && (
        <section className="leis-futuras" aria-labelledby="futuras-t">
          <h2 id="futuras-t">Já são lei, mas ainda vão começar a valer</h2>
          <ul>
            {futuras.map((m) => (
              <li key={m.slug}>
                <strong>{dataExtenso(m.lei!.vigencia!.data)}</strong>: <Link to={`/projetos/${m.slug}`}>Lei {m.lei!.numero}</Link>. {m.explicacao?.texto.split(". ")[0] ?? m.assunto}.
                <span className="leis__trecho">Na lei: “{m.lei!.vigencia!.trecho}”</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="leis__filtro"><input type="checkbox" checked={simbolicas} onChange={(e) => setSimbolicas(e.target.checked)} /> Mostrar também homenagens, datas comemorativas e nomes de lugares ({nSimb})</label>

      {meses.map(([k, lista]) => (
        <section key={k} className="leis-mes" aria-labelledby={`mes-${k}`}>
          <h2 id={`mes-${k}`} className="leis-mes__titulo">{MES[Number(k.slice(5)) - 1]} de {k.slice(0, 4)} <span>{lista.length} {lista.length === 1 ? "lei" : "leis"}</span></h2>
          <ol className="leis">
            {lista.map((m) => {
              const v = m.lei!.vigencia;
              return (
                <li key={m.slug} className="lei-item">
                  <p className="lei-item__cab">
                    <Link to={`/projetos/${m.slug}`} className="lei-item__n">Lei {m.lei!.numero}</Link>
                    <span className="lei-item__data">publicada em {dataExtenso(m.lei!.data)}</span>
                    <span className="lei-item__tema">{m.tema}</span>
                  </p>
                  <p className="lei-item__txt">{m.explicacao?.texto ?? m.assunto}</p>
                  <p className="lei-item__rodape">
                    <span>Veio do {m.titulo}, de <Autor m={m} />.</span>
                    {v && v.data !== m.lei!.data && <span> Vale a partir de <strong>{dataExtenso(v.data)}</strong>.</span>}
                    {m.veto && <span> O prefeito vetou parte ({m.veto.resultado === "veto_mantido" ? "veto mantido" : m.veto.resultado === "veto_derrubado" ? "veto derrubado" : "falta a Câmara votar o veto"}).</span>}
                    {!!m.lei!.depende?.length && <span> <Link to="/em-aberto">Ainda depende de regulamentação</Link>.</span>}
                    {m.lei!.url && <> <a href={m.lei!.url} rel="noopener">Texto no Diário Oficial</a></>}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
