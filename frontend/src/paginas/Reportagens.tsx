import { Link } from "react-router-dom";
import { useDados } from "../dados";
import { classeSituacao, situacaoCurta } from "../reportagens";
import { dataExtenso, useTitulo } from "../util";

export default function Reportagens() {
  useTitulo("O que muda");
  const b = useDados();
  const itens = b.reportagens ?? [];
  return (
    <div className="pagina">
      <p className="selo-pagina">O que muda</p>
      <h1 className="titulo-pagina">O que muda pra você</h1>
      <p className="lead">Projetos e leis que afetam o dia a dia de Cubatão, explicados em linguagem simples a partir dos documentos oficiais. Quem propôs e como cada vereador votou aparecem em cada uma.</p>
      {itens.length === 0 ? <p>Nenhum texto publicado ainda.</p> : (
        <ul className="rp-lista">
          {itens.map((r) => {
            const m = b.materia.get(r.projetos[0]);
            return (
              <li key={r.id} className="rp-lista__item">
                <img className="rp-lista__foto" src={`./${r.foto.p}`} alt="" loading="lazy" decoding="async" />
                <div className="rp-lista__txt">
                  <p className="rp-lista__topo">
                    {r.chapeu && <span className="rp__chapeu">{r.chapeu}</span>}
                    {m && <span className={`rp__sit rp__sit--${classeSituacao(m)}`}>{situacaoCurta(m)}</span>}
                  </p>
                  <h2 className="rp-lista__manchete"><Link to={`/o-que-muda/${r.id}`} className="esticado">{r.manchete}</Link></h2>
                  <p className="rp-lista__fina">{r.linha_fina}</p>
                  <p className="rp-lista__data">Revisada em {dataExtenso(r.data)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
