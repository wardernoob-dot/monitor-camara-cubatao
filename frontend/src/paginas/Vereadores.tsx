import { Link, useSearchParams } from "react-router-dom";
import { useDados, type Vereador } from "../dados";
import { Avatar } from "../componentes";
import { useTitulo } from "../util";
import { IndiceMini, pctPilar } from "../indice";

type Ordem = "nome" | "indice" | "assiduidade" | "producao" | "fiscalizacao";
const ORDENS: [Ordem, string][] = [["nome", "Alfabética"], ["indice", "Índice"], ["assiduidade", "Assiduidade"], ["producao", "Produção"], ["fiscalizacao", "Fiscalização"]];
const valor = (v: Vereador, o: Ordem) => {
  if (o === "indice") return v.indice.nota;
  const p = v.indice.pilares.find((x) => x.id === o)!;
  return pctPilar(p);
};
function ordenar(lista: Vereador[], o: Ordem) {
  const r = [...lista];
  if (o === "nome") return r.sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR"));
  return r.sort((a, b) => Number(a.indice.parcial) - Number(b.indice.parcial) || valor(b, o) - valor(a, o) || a.exibicao.localeCompare(b.exibicao, "pt-BR"));
}

function Item({ v, compacto }: { v: Vereador; compacto?: boolean }) {
  const n = v.projetos.length;
  return (
    <li className="vereadores__item">
      <Link to={`/vereadores/${v.slug}`}>
        <Avatar v={v} tamanho={compacto ? "m" : "retrato"} />
        <span className="vereadores__nome">{v.exibicao}</span>
        {(v.nome !== v.exibicao || v.partido) && <span className="vereadores__civil">{v.nome !== v.exibicao ? v.nome : ""}{v.nome !== v.exibicao && v.partido ? ", " : ""}{v.partido ?? ""}</span>}
        <IndiceMini i={v.indice} />
        <span className="vereadores__nums">
          {compacto ? `${v.sessoes_total} ${v.sessoes_total === 1 ? "sessão registrada" : "sessões registradas"}` : `${v.total_votacoes} votações registradas, ${n} projeto${n === 1 ? "" : "s"} de autoria`}
        </span>
      </Link>
    </li>
  );
}

export default function Vereadores() {
  useTitulo("Vereadores");
  const { vereadores, atuais, meta } = useDados();
  const [params, setParams] = useSearchParams();
  const ordem = (ORDENS.some(([o]) => o === params.get("ordem")) ? params.get("ordem") : "nome") as Ordem;
  const outros = ordenar(vereadores.filter((v) => !v.em_exercicio), ordem);
  const lista = ordenar(atuais, ordem);
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Vereadores</h1>
      <p className="lead">
        Os {atuais.length} vereadores em exercício na Câmara Municipal de {meta.cidade}. Abra cada um para ver como votou, quantas vezes faltou e quais projetos apresentou.
      </p>
      <div className="filtros filtros--ordem" role="group" aria-label="Ordenar vereadores">
        <span className="filtros__rotulo">Ordenar por</span>
        {ORDENS.map(([o, rot]) => (
          <button key={o} type="button" aria-pressed={ordem === o}
            onClick={() => setParams(o === "nome" ? {} : { ordem: o }, { replace: true })}>{rot}</button>
        ))}
      </div>
      <p className="nota">
        A nota de 0 a 10 é o <Link to="/como-funciona#indice">Índice de Atuação</Link>: presença, participação nas votações, projetos e fiscalização, com a conta aberta na página de cada um.
        Mede atividade registrada em documento público, não a qualidade do mandato.
      </p>
      <ul className="vereadores">{lista.map((v) => <Item key={v.slug} v={v} />)}</ul>
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
