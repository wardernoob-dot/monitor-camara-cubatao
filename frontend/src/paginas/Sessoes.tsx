import { Link } from "react-router-dom";
import { useDados } from "../dados";
import { dataExtenso, nomeSessao, useTitulo } from "../util";

export default function Sessoes() {
  useTitulo("Sessões");
  const { dias } = useDados();
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Sessões</h1>
      <p className="lead">Cada dia em que a Câmara votou alguma coisa em 2026. Ordinárias e extraordinárias do mesmo dia aparecem juntas.</p>
      <ol className="lista-dias">
        {dias.map((d) => (
          <li key={d.data}>
            <Link to={`/sessoes/${d.data}`}>{dataExtenso(d.data)}</Link>
            <span className="lista-dias__info">
              {d.sessoes.map((s) => `${s.numero}ª ${nomeSessao(s.tipo)}`).join(", ")}
              {d.materias.length > 0 && `; ${d.materias.length} ${d.materias.length === 1 ? "item votado" : "itens votados"}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
