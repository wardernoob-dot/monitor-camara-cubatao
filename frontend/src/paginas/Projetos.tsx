import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDados } from "../dados";
import { Situacao } from "../componentes";
import { semAcento, useTitulo } from "../util";
import { Destaque, DicaMateria } from "../explica";

const SITUACOES: [string, string][] = [
  ["lei", "Virou lei"],
  ["veto", "Vetado"],
  ["aprovado", "Aprovado pela Câmara"],
  ["andamento", "Em votação (etapas intermediárias)"],
  ["rejeitado", "Rejeitado"],
  ["pauta", "Sem votação registrada"],
];

export default function Projetos() {
  useTitulo("Projetos");
  const b = useDados();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const autor = params.get("autor") ?? "";
  const sit = params.get("situacao") ?? "";
  const destaque = params.get("destaque") === "1";
  const temaSel = params.get("tema") ?? "";
  const lista = useMemo(() => b.materias.filter((m) => m.lista), [b]);
  const temas = useMemo(() => [...new Set(lista.map((m) => m.tema))].sort((a, b) => a.localeCompare(b)), [lista]);
  const autores = useMemo(() => [...new Set(lista.map((m) => m.autoria))].sort((a, b) => a.localeCompare(b)), [lista]);
  const textos = useMemo(() => new Map(lista.map((m) => [m.slug, semAcento(`${m.titulo} ${m.assunto} ${m.autoria}`)])), [lista]);

  const termos = semAcento(q).split(/\s+/).filter(Boolean);
  const visiveis = lista.filter((m) =>
    (!autor || m.autoria === autor) && (!sit || m.situacao_cls === sit) && (!destaque || m.relevancia.nivel === "alta") &&
    (!temaSel || m.tema === temaSel) && termos.every((t) => textos.get(m.slug)!.includes(t)));

  function muda(chave: string, valor: string) {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    setParams(p, { replace: true });
  }

  return (
    <div className="pagina pagina--larga">
      <h1 className="titulo-pagina">Projetos</h1>
      <p className="lead">
        Projetos de lei, de resolução, de decreto legislativo e emendas à Lei Orgânica que passaram pela pauta ou foram publicados no site da Câmara em 2026.
      </p>
      <form className="busca" role="search" onSubmit={(e) => e.preventDefault()}>
        <label>Buscar
          <input type="search" value={q} placeholder="Número, assunto ou autor" autoComplete="off" onChange={(e) => muda("q", e.target.value)} />
        </label>
        <label>Autoria
          <select value={autor} onChange={(e) => muda("autor", e.target.value)}>
            <option value="">Todas</option>
            {autores.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label>Situação
          <select value={sit} onChange={(e) => muda("situacao", e.target.value)}>
            <option value="">Todas</option>
            {SITUACOES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </label>
        <label>Tema
          <select value={temaSel} onChange={(e) => muda("tema", e.target.value)}>
            <option value="">Todos</option>
            {temas.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="busca__marcar">
          <input type="checkbox" checked={destaque} onChange={(e) => muda("destaque", e.target.checked ? "1" : "")} /> Só os em destaque
        </label>
        <p className="busca__contagem" aria-live="polite">{visiveis.length} projeto{visiveis.length === 1 ? "" : "s"}</p>
      </form>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th scope="col">Projeto</th><th scope="col">Assunto</th><th scope="col">Autoria</th><th scope="col">Situação</th></tr></thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.slug}>
                <td className="tabela__projeto"><DicaMateria m={m}><Link to={`/projetos/${m.slug}`}>{m.titulo}</Link></DicaMateria> <Destaque m={m} compacto /></td>
                <td>{m.assunto}</td>
                <td>{m.autoria}</td>
                <td><Situacao m={m} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visiveis.length === 0 && <p className="nota">Nenhum projeto com esses filtros. Limpe a busca ou escolha outra situação.</p>}
      </div>
    </div>
  );
}
