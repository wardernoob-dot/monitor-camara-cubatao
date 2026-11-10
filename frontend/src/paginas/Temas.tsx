import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDados, type Materia, type Votacao } from "../dados";
import { Avatar, Fonte } from "../componentes";
import { ladosDaVotacao } from "../reportagens";
import { dataCurta, useTitulo } from "../util";

/** Votação que decide o projeto: a última com votos nominais que não é parecer nem emenda (senão, a última com votos). */
function decisiva(evs: Votacao[]): Votacao | null {
  const com = evs.filter((e) => Object.keys(e.votos).length > 0);
  const merito = com.filter((e) => e.sentido === "direto");
  return merito[merito.length - 1] ?? com[com.length - 1] ?? null;
}

export default function Temas() {
  useTitulo("Votos por tema");
  const b = useDados();
  const [params, setParams] = useSearchParams();
  const porTema = useMemo(() => {
    const g = new Map<string, { m: Materia; ev: Votacao }[]>();
    for (const m of b.materias) {
      if (!m.lista || !["PL", "PLC", "PELOM", "PR", "PDL", "VETO"].includes(m.tipo)) continue;
      const ev = decisiva(m.eventos.map(b.votacao));
      if (!ev) continue;
      g.set(m.tema, [...(g.get(m.tema) ?? []), { m, ev }]);
    }
    return [...g.entries()].sort((a, c) => c[1].length - a[1].length);
  }, [b]);
  const tema = params.get("tema") ?? porTema[0]?.[0] ?? "";
  const itens = (porTema.find(([t]) => t === tema)?.[1] ?? []).slice().sort((a, c) => c.ev.data.localeCompare(a.ev.data));

  return (
    <div className="pagina pagina--larga">
      <p className="selo-pagina">Votos por tema</p>
      <h1 className="titulo-pagina">Como votaram no que importa pra você</h1>
      <p className="lead">Escolha um assunto e veja, projeto por projeto, quem votou a favor e quem votou contra. Só entram projetos com voto de cada vereador registrado. A ordem é a data da votação, não há nota nem classificação por voto.</p>
      <div className="chips" role="group" aria-label="Escolher o tema">
        {porTema.map(([t, l]) => (
          <button key={t} type="button" aria-pressed={t === tema} onClick={() => setParams({ tema: t }, { replace: true })}>
            {t} <span>{l.length}</span>
          </button>
        ))}
      </div>
      {itens.length === 0 ? <p>Nenhum projeto com voto registrado neste tema.</p> : (
        <ul className="temas">
          {itens.map(({ m, ev }) => {
            const { favor, contra } = ladosDaVotacao(b, ev);
            const veto = m.tipo === "VETO";
            return (
              <li key={m.slug} className="tema-item">
                <div className="tema-item__cab">
                  <Link to={`/projetos/${m.slug}`} className="tema-item__id">{m.titulo}</Link>
                  <span className={`sit sit--${m.situacao_cls}`}>{m.situacao}</span>
                </div>
                <p className="tema-item__txt">{m.explicacao?.texto ?? m.assunto}</p>
                <div className="rp-placar tema-item__placar">
                  <div className="rp-placar__lado rp-placar__lado--favor">
                    <span className="rp-placar__rot"><strong>{favor.length}</strong> {veto ? "votaram Sim (manter o veto)" : "a favor do projeto"}</span>
                    <ul className="rp-rostos">{favor.map((v) => <li key={v.slug} className="rp-rosto" title={v.exibicao}><Link to={`/vereadores/${v.slug}`}><Avatar v={v} tamanho="m" /></Link><span className="rp-rosto__nome">{v.exibicao.replace(/^Dr\. /, "")}</span></li>)}</ul>
                  </div>
                  <div className="rp-placar__lado rp-placar__lado--contra">
                    {contra.length ? (
                      <>
                        <span className="rp-placar__rot"><strong>{contra.length}</strong> {veto ? "votaram Não (derrubar o veto)" : "contra"}</span>
                        <ul className="rp-rostos">{contra.map((v) => <li key={v.slug} className="rp-rosto" title={v.exibicao}><Link to={`/vereadores/${v.slug}`}><Avatar v={v} tamanho="m" /></Link><span className="rp-rosto__nome">{v.exibicao.replace(/^Dr\. /, "")}</span></li>)}</ul>
                      </>
                    ) : <span className="rp-placar__rot rp-placar__nenhum">nenhum voto contra registrado</span>}
                  </div>
                </div>
                <p className="nota">{ev.etapa_txt}, {dataCurta(ev.data, true)}. Fonte: <Fonte ev={ev} />{ev.fonte === "resumo" ? ". O resumo oficial só lista quem votou; quem não aparece não consta" : ""}.</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
