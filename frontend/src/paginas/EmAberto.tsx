import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDados } from "../dados";
import { dataExtenso, useTitulo } from "../util";

const hoje = () => new Date().toISOString().slice(0, 10);
const dias = (de: string) => Math.max(0, Math.round((Date.parse(hoje()) - Date.parse(de)) / 86400000));

export default function EmAberto() {
  useTitulo("Em aberto");
  const b = useDados();
  const g = useMemo(() => {
    const ms = b.materias.filter((m) => m.lista);
    return {
      vetos: ms.filter((m) => m.veto && !m.veto.resultado && m.tipo !== "VETO").sort((x, y) => (x.veto!.data_oficio ?? "").localeCompare(y.veto!.data_oficio ?? "")),
      sancao: ms.filter((m) => m.situacao_cls === "aprovado" && ["PL", "PLC"].includes(m.tipo) && !m.lei && !m.veto).sort((x, y) => x.ultima_data.localeCompare(y.ultima_data)),
      regul: ms.filter((m) => m.lei?.depende?.length).sort((x, y) => x.lei!.data.localeCompare(y.lei!.data)),
    };
  }, [b]);
  const vencidas = g.regul.filter((m) => m.lei!.depende!.some((d) => d.vence && d.vence < hoje()));

  return (
    <div className="pagina">
      <p className="selo-pagina">Em aberto</p>
      <h1 className="titulo-pagina">O que ficou pendente</h1>
      <p className="lead">Coisas que os documentos mostram que ainda faltam: veto esperando votação, projeto aprovado esperando o prefeito, e lei que manda regulamentar algo depois. O site mostra o que a lei pede; ele <strong>não sabe</strong> se o decreto ou regulamento já saiu, porque não acompanha os decretos da Prefeitura.</p>

      <dl className="numeros aberto-nums">
        <div><dt>vetos sem votação da Câmara</dt><dd>{g.vetos.length}</dd></div>
        <div><dt>aprovados esperando o prefeito</dt><dd>{g.sancao.length}</dd></div>
        <div><dt>leis que pedem regulamentação</dt><dd>{g.regul.length}</dd></div>
        <div><dt>com prazo de regulamentação já passado</dt><dd>{vencidas.length}</dd></div>
      </dl>

      <section className="aberto" aria-labelledby="ab-vetos">
        <h2 id="ab-vetos">Vetos que a Câmara ainda não votou</h2>
        <p className="aberto__explica">O prefeito vetou o projeto, inteiro ou em parte. A Câmara precisa votar se mantém ou derruba o veto. Aqui estão os vetos para os quais o site não achou votação nos resumos nem no painel.</p>
        {g.vetos.length === 0 ? <p>Nenhum no momento.</p> : (
          <ul className="aberto__lista">
            {g.vetos.map((m) => (
              <li key={m.slug}>
                <Link to={`/projetos/${m.slug}`}><strong>{m.titulo}</strong></Link>: {m.explicacao?.texto.split(". ")[0] ?? m.assunto}.
                <span className="aberto__meta"> Veto {m.veto!.alcance}{m.veto!.data_oficio ? `, comunicado em ${dataExtenso(m.veto!.data_oficio)} (há ${dias(m.veto!.data_oficio)} dias)` : ""}.{m.veto!.url && <> <a href={m.veto!.url} rel="noopener">Ofício do veto</a></>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="aberto" aria-labelledby="ab-sancao">
        <h2 id="ab-sancao">Aprovados pela Câmara, sem lei nem veto registrados</h2>
        <p className="aberto__explica">Depois da aprovação, o prefeito sanciona (vira lei) ou veta. Aqui estão os que o site ainda não encontrou no Diário Oficial nem nos ofícios de veto. Pode ser que a publicação exista e a leitura automática não tenha ligado ao projeto.</p>
        {g.sancao.length === 0 ? <p>Nenhum no momento.</p> : (
          <ul className="aberto__lista">
            {g.sancao.map((m) => (
              <li key={m.slug}>
                <Link to={`/projetos/${m.slug}`}><strong>{m.titulo}</strong></Link>: {m.explicacao?.texto.split(". ")[0] ?? m.assunto}.
                <span className="aberto__meta"> Última votação em {dataExtenso(m.ultima_data)} (há {dias(m.ultima_data)} dias).</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="aberto" aria-labelledby="ab-regul">
        <h2 id="ab-regul">Leis que mandam regulamentar ou definir algo depois</h2>
        <p className="aberto__explica">Os trechos abaixo são cópia da lei publicada. Quando a lei dá prazo, a data é calculada a partir da publicação.</p>
        {g.regul.length === 0 ? <p>Nenhuma no momento.</p> : (
          <ul className="aberto__lista aberto__lista--leis">
            {g.regul.map((m) => (
              <li key={m.slug}>
                <p><Link to={`/projetos/${m.slug}`}><strong>Lei {m.lei!.numero}</strong></Link> ({m.titulo}), publicada em {dataExtenso(m.lei!.data)}: {m.explicacao?.texto.split(". ")[0] ?? m.assunto}.</p>
                <ul>
                  {m.lei!.depende!.map((d, i) => (
                    <li key={i}>
                      <blockquote className="trecho">“{d.trecho}”</blockquote>
                      {d.vence && <span className={`aberto__prazo${d.vence < hoje() ? " aberto__prazo--passou" : ""}`}>Prazo de {d.prazo_dias} dias: {d.vence < hoje() ? `venceu em ${dataExtenso(d.vence)}` : `vai até ${dataExtenso(d.vence)}`}.</span>}
                    </li>
                  ))}
                </ul>
                {m.lei!.url && <a href={m.lei!.url} rel="noopener">Texto da lei no Diário Oficial</a>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
