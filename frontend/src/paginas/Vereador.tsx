import { CartaoIndice } from "../indice";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDados, type Votacao, type Voto } from "../dados";
import { Avatar, Celula, Fonte, Legenda, LinkMateria, Placar, ResultadoTag, Situacao, VotoTag } from "../componentes";
import { dataCurta, useTitulo, votouDiferente } from "../util";
import { Destaque, Dica, DicaMateria, EtapaComDica, naPratica } from "../explica";
import { useContador, useEntrou } from "../movimento";
import { Funil } from "../viz";

function Num({ valor, rotulo, sufixo = "" }: { valor: number; rotulo: string; sufixo?: string }) {
  const [ref, entrou] = useEntrou<HTMLDivElement>();
  const v = useContador(valor, entrou, 1000);
  return <div ref={ref}><dt>{rotulo}</dt><dd><span aria-hidden="true">{v}{sufixo}</span><span className="sr">{valor}{sufixo}</span></dd></div>;
}
import NaoEncontrado from "./NaoEncontrado";

type Filtro = "todos" | "destaque" | "contra" | "semvoto";

export default function VereadorPagina() {
  const { slug = "" } = useParams();
  const b = useDados();
  const v = b.vereador.get(slug);
  useTitulo(v ? v.exibicao : "Vereador não encontrado");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [limite, setLimite] = useState(30);

  const votos = useMemo(() => {
    if (!v) return [];
    return b.votacoes
      .filter((ev) => ev.votos[v.slug])
      .map((ev) => ({ ev, voto: ev.votos[v.slug] as Voto, contra: votouDiferente(ev.votos[v.slug], ev.resultado) }));
  }, [b, v]);

  const alinhados = useMemo(() => {
    if (!v) return [];
    return b.atuais.filter((o) => o.slug !== v.slug).map((o) => {
      let iguais = 0, total = 0;
      for (const ev of b.votacoes) {
        if (ev.fonte !== "painel") continue;
        const x = ev.votos[v.slug], y = ev.votos[o.slug];
        if ((x === "SIM" || x === "NAO") && (y === "SIM" || y === "NAO")) { total++; if (x === y) iguais++; }
      }
      return { nome: o.exibicao, iguais, total };
    }).filter((x) => x.total >= 10).sort((a, c) => c.iguais / c.total - a.iguais / a.total);
  }, [b, v]);

  if (!v) return <NaoEncontrado />;

  const recentes = [...votos].reverse();
  const visiveis = recentes.filter(({ ev, voto, contra }) =>
    filtro === "todos" || (filtro === "destaque" && b.materia.get(ev.materia)?.relevancia.nivel === "alta") || (filtro === "contra" && contra) ||
    (filtro === "semvoto" && (voto === "BRANCO" || voto === "AUSENTE")));
  const projetos = v.projetos.map((s) => b.materia.get(s)!).filter(Boolean);
  const reqs = v.requerimentos.map((s) => b.materia.get(s)!).filter(Boolean);
  const filtros: [Filtro, string, number][] = [
    ["todos", "Todos", votos.length],
    ["destaque", "Projetos em destaque", votos.filter(({ ev }) => b.materia.get(ev.materia)?.relevancia.nivel === "alta").length],
    ["contra", "Diferente do resultado", v.contra_resultado],
    ["semvoto", "Não votou ou ausente", v.contagem.BRANCO + v.contagem.AUSENTE],
  ];

  return (
    <div className="pagina">
      <p className="migalha"><Link to="/vereadores">Vereadores</Link></p>
      <header className="perfil">
        <Avatar v={v} tamanho="g" />
        <div>
          <h1 className="titulo-pagina">{v.exibicao}</h1>
          <p className="perfil__civil">
            {v.nome}
            {v.partido && <>, {v.partido}<sup><a href="#nota-partido" aria-label="Fonte do partido">1</a></sup></>}
            {!v.em_exercicio && ". Não está entre os 15 em exercício hoje"}
          </p>
          {v.cargo && (
            <p className="perfil__cargo">
              {v.cargo === "presidente" ? "Presidente" : "Vice-presidente"} da Câmara, conforme ofícios e projetos de 2026
              {v.cargo === "presidente" && ". Conduz as sessões; o Regimento Interno define em que casos o presidente vota"}.
            </p>
          )}
        </div>
      </header>

      <dl className="numeros">
        <Num valor={v.sessoes_total ? Math.round((100 * (v.presenca.sim ?? 0)) / v.sessoes_total) : 0} rotulo="% de presença nas sessões" sufixo="%" />
        <Num valor={v.faltas} rotulo="faltas (justificadas ou não)" />
        <Num valor={projetos.length} rotulo="projetos de lei apresentados" />
        <Num valor={v.leis} rotulo="viraram lei" />
        <Num valor={v.contra_resultado} rotulo="votou diferente do resultado final" />
        <Num valor={v.contagem.BRANCO} rotulo="vezes presente sem votar (desde set.)" />
      </dl>

      <CartaoIndice i={v.indice} nome={v.exibicao} />

      {alinhados.length > 0 && (
        <section aria-labelledby="alinh" className="duas-colunas">
          <div>
            <h2 id="alinh" className="secao__titulo">Vota mais igual a</h2>
            <Funil etapas={alinhados.slice(0, 4).map((x) => ({ rotulo: `${x.nome} (${x.iguais} de ${x.total})`, valor: Math.round((100 * x.iguais) / x.total) }))} max={100} sufixo="%" />
          </div>
          <div>
            <h2 className="secao__titulo">Vota mais diferente de</h2>
            <Funil etapas={[...alinhados].reverse().slice(0, 4).map((x) => ({ rotulo: `${x.nome} (${x.iguais} de ${x.total})`, valor: Math.round((100 * x.iguais) / x.total) }))} max={100} sufixo="%" />
          </div>
          <p className="nota">Porcentagem das votações do painel em que os dois votaram igual, contando só as que ambos votaram sim ou não.</p>
        </section>
      )}

      {votos.length > 0 && (
        <>
          <section aria-labelledby="faixa">
            <h2 id="faixa" className="secao__titulo">Cada voto, do mais antigo ao mais recente</h2>
            <div className="faixa">
              {votos.map(({ ev, voto }) => <Celula key={ev.id} ev={ev} voto={voto} nome={v.exibicao} />)}
            </div>
            <Legenda />
            <p className="nota">
              Até agosto os votos vêm do resumo oficial de cada sessão, que não registra quem estava presente e não votou. A partir de setembro vêm do painel eletrônico mostrado na transmissão, que registra.
            </p>
          </section>

          <section aria-labelledby="votos">
            <h2 id="votos" className="secao__titulo">Votos</h2>
            <div className="filtros" role="group" aria-label="Filtrar votos">
              {filtros.map(([f, nome, n]) => (
                <button key={f} type="button" aria-pressed={filtro === f} onClick={() => { setFiltro(f); setLimite(30); }}>{nome} ({n})</button>
              ))}
            </div>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th scope="col">Data</th><th scope="col">Projeto</th><th scope="col">Etapa</th><th scope="col">Voto</th><th scope="col">Resultado</th><th scope="col">Fonte</th></tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, limite).map(({ ev, voto, contra }: { ev: Votacao; voto: Voto; contra: boolean }) => (
                    <tr key={ev.id}>
                      <td className="tabela__data">{dataCurta(ev.data, true)}</td>
                      <td>
                        {(() => { const mt = b.materia.get(ev.materia); return mt ? <><DicaMateria m={mt}><LinkMateria slug={ev.materia} /></DicaMateria> <Destaque m={mt} compacto /><span className="tabela__assunto">{mt.assunto}</span></> : null; })()}
                      </td>
                      <td><EtapaComDica ev={ev} tipo={b.materia.get(ev.materia)?.tipo} /></td>
                      <td>
                        <VotoTag voto={voto} />
                        {naPratica(ev.sentido, voto) && <span className="na-pratica">na prática: {naPratica(ev.sentido, voto)}</span>}
                        {contra && <> <Dica rotulo="O que é votar diferente do resultado" conteudo="O voto foi para o lado que perdeu: votou sim e a proposta foi rejeitada, ou votou não e foi aprovada."><span className="marca-contra">diferente do resultado</span></Dica></>}
                      </td>
                      <td><ResultadoTag r={ev.resultado} />{Object.keys(ev.votos).length > 0 && <> <Placar ev={ev} /></>}</td>
                      <td className="tabela__fonte"><Fonte ev={ev} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visiveis.length === 0 && <p className="nota">Nenhum voto neste filtro.</p>}
              {visiveis.length > limite && (
                <div className="mais">
                  <button type="button" className="botao botao--fantasma" onClick={() => setLimite((l) => l + 30)}>
                    Mostrar mais {Math.min(30, visiveis.length - limite)} de {visiveis.length - limite} restantes
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="projetos">
        <h2 id="projetos" className="secao__titulo">Projetos de autoria</h2>
        {projetos.length ? (
          <ul className="lista-projetos">
            {projetos.map((m) => (
              <li key={m.slug}><DicaMateria m={m}><LinkMateria slug={m.slug} /></DicaMateria> <Situacao m={m} /> <Destaque m={m} compacto /><p>{m.assunto}</p></li>
            ))}
          </ul>
        ) : (
          <p>Nenhum projeto de lei com autoria identificada nos documentos coletados. Projetos em PDF escaneado podem estar sem autoria reconhecida.</p>
        )}
      </section>

      {reqs.length > 0 && (
        <section aria-labelledby="reqs">
          <h2 id="reqs" className="secao__titulo">Requerimentos e moções aprovados</h2>
          <ul className="lista-projetos">
            {reqs.map((m) => <li key={m.slug}><DicaMateria m={m}><LinkMateria slug={m.slug} /></DicaMateria><p>{m.assunto}</p></li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="presenca">
        <h2 id="presenca" className="secao__titulo">Presença nas sessões</h2>
        <p>
          Segundo os resumos oficiais de {v.sessoes_total} sessões em 2026: presente em {v.presenca.sim ?? 0}, falta justificada em{" "}
          {v.presenca.justificada ?? 0} e ausência sem justificativa em {v.presenca.ausente ?? 0}.
        </p>
      </section>

      {v.partido && <p className="nota" id="nota-partido"><sup>1</sup> Partido conforme {v.partido_fonte}.</p>}
    </div>
  );
}
