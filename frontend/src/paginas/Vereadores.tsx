import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useDados, type Vereador } from "../dados";
import { Avatar, NotaMetodo, TagPartido } from "../componentes";
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
      <div className="vereadores__card" onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}>
        <Avatar v={v} tamanho={compacto ? "m" : "retrato"} />
        <Link to={`/vereadores/${v.slug}`} className="vereadores__nome esticado">{v.exibicao}</Link>
        {(v.nome !== v.exibicao || v.partido) && (
          <span className="vereadores__civil">{v.nome !== v.exibicao ? v.nome : ""} <TagPartido sigla={v.partido} /></span>
        )}
        <IndiceMini i={v.indice} />
        {compacto ? (
          <span className="vereadores__nums">{`${v.sessoes_total} ${v.sessoes_total === 1 ? "sessão registrada" : "sessões registradas"}`}</span>
        ) : (
          <dl className="vereadores__stats">
            <div><dt>presença</dt><dd>{v.sessoes_total ? Math.round((100 * (v.presenca.sim ?? 0)) / v.sessoes_total) : 0}%</dd></div>
            <div><dt>{n === 1 ? "projeto" : "projetos"}</dt><dd>{n}</dd></div>
            <div><dt>{v.leis === 1 ? "virou lei" : "viraram lei"}</dt><dd>{v.leis}</dd></div>
          </dl>
        )}
      </div>
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
      <p className="selo-pagina">Quem são</p>
      <h1 className="titulo-pagina">Vereadores</h1>
      <p className="lead">
        Os {atuais.length} vereadores em exercício na Câmara Municipal de {meta.cidade}. Abra cada um para ver como votou, quantas vezes faltou e quais projetos apresentou.
      </p>
      <div className="rank__controle">
        <span className="filtros__rotulo">Ordenar por</span>
        <div className="segmentado" role="group" aria-label="Ordenar vereadores">
          {ORDENS.map(([o, rot]) => (
            <button key={o} type="button" aria-pressed={ordem === o}
              onClick={() => setParams(o === "nome" ? {} : { ordem: o }, { replace: true, preventScrollReset: true })}>
              {ordem === o && <motion.span layoutId="seg-ver" className="segmentado__pilula" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
              <span className="segmentado__texto">{rot}</span>
            </button>
          ))}
        </div>
      </div>
      <NotaMetodo ancora="indice" rotulo="Como é calculado">
        A nota de 0 a 10 é o Índice de Atuação: presença, participação nas votações, projetos e fiscalização, com a conta aberta na página de cada um.
        Mede atividade registrada em documento público, não a qualidade do mandato.
      </NotaMetodo>
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
