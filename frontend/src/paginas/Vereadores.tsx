import { Link } from "react-router-dom";
import { useDados, type Vereador } from "../dados";
import { Avatar } from "../componentes";
import { useTitulo } from "../util";

function Item({ v, compacto }: { v: Vereador; compacto?: boolean }) {
  const n = v.projetos.length;
  return (
    <li className="vereadores__item">
      <Link to={`/vereadores/${v.slug}`}>
        <Avatar v={v} tamanho={compacto ? "m" : "retrato"} />
        <span className="vereadores__nome">{v.exibicao}</span>
        <span className="vereadores__civil">{v.nome}{v.partido ? `, ${v.partido}` : ""}</span>
        <span className="vereadores__nums">
          {compacto ? `${v.sessoes_total} sessões registradas` : `${v.total_votacoes} votações registradas, ${n} projeto${n === 1 ? "" : "s"} de autoria`}
        </span>
      </Link>
    </li>
  );
}

export default function Vereadores() {
  useTitulo("Vereadores");
  const { vereadores, atuais, meta } = useDados();
  const outros = vereadores.filter((v) => !v.em_exercicio);
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Vereadores</h1>
      <p className="lead">
        Os {atuais.length} vereadores em exercício na Câmara Municipal de {meta.cidade}. Abra cada um para ver como votou, quantas vezes faltou e quais projetos apresentou.
      </p>
      <ul className="vereadores">{atuais.map((v) => <Item key={v.slug} v={v} />)}</ul>
      {outros.length > 0 && (
        <>
          <h2 className="secao__titulo">Também exerceram mandato em 2026</h2>
          <p>Titulares licenciados ou suplentes que participaram de sessões neste ano.</p>
          <ul className="vereadores vereadores--compacto">{outros.map((v) => <Item key={v.slug} v={v} compacto />)}</ul>
        </>
      )}
    </div>
  );
}
