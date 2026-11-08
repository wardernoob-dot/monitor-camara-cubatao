import { CartaoIndice } from "../indice";
import { Secao } from "../secao";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { slugPartido, useDados, type Votacao, type Voto } from "../dados";
import { Avatar, Celula, Fonte, Legenda, LinkMateria, Metodo, Placar, ResultadoTag, Situacao, TagPartido, VotoTag } from "../componentes";
import { dataCurta, useTitulo, votouDiferente } from "../util";
import { Destaque, Dica, DicaMateria, EtapaComDica, Termo, naPratica } from "../explica";
import { useContador, useEntrou } from "../movimento";
import { Funil } from "../viz";

function Num({ valor, rotulo, sufixo = "" }: { valor: number; rotulo: string; sufixo?: string }) {
  const [ref, entrou] = useEntrou<HTMLDivElement>();
  const v = useContador(valor, entrou, 1000);
  return <div ref={ref}><dt>{rotulo}</dt><dd><span aria-hidden="true">{v}{sufixo}</span><span className="sr">{valor}{sufixo}</span></dd></div>;
}
import NaoEncontrado from "./NaoEncontrado";
import { Toc } from "../toc";

const TOC_VEREADOR = [
  ["indice", "Índice de atuação"],
  ["votos", "Como votou"],
  ["alinhamento", "Com quem vota igual"],
  ["prefeitura", "Posição da Prefeitura"],
  ["projetos", "Projetos de autoria"],
  ["requerimentos", "Requerimentos e moções"],
  ["presenca", "Presença nas sessões"],
] as const;

type Filtro = "todos" | "destaque" | "contra" | "semvoto";

export default function VereadorPagina() {
  const { slug = "" } = useParams();
  const b = useDados();
  const v = b.vereador.get(slug);
  useTitulo(v ? v.exibicao : "Vereador não encontrado");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [limite, setLimite] = useState(10);

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
            {v.partido && <> <TagPartido sigla={v.partido} /><sup><a href="#nota-partido" aria-label="Fonte do partido">1</a></sup></>}
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
        <Num valor={reqs.length} rotulo="requerimentos e moções aprovados" />
        {v.executivo.com + v.executivo.contra > 0 && (
          <Num valor={Math.round((100 * v.executivo.com) / (v.executivo.com + v.executivo.contra))} sufixo="%"
            rotulo={`dos votos na posição da Prefeitura (${v.executivo.contra} contra)`} />
        )}
      </dl>

      <div className="com-toc">
      <div className="sanfonas">
      <Secao id="indice" titulo="Índice de atuação" resumo={`${v.indice.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} de 10`} aberta>
        <CartaoIndice i={v.indice} nome={v.exibicao} />
      </Secao>

      {votos.length > 0 && (
        <Secao id="votos" titulo="Como votou" resumo={`${votos.length} votos`}>
          <div className="filtros" role="group" aria-label="Filtrar votos">
              {filtros.map(([f, nome, n]) => (
                <button key={f} type="button" aria-pressed={filtro === f} onClick={() => { setFiltro(f); setLimite(10); }}>{nome} ({n})</button>
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
                <button type="button" className="botao botao--fantasma" onClick={() => setLimite((l) => l + 10)}>
                  Mostrar mais {Math.min(10, visiveis.length - limite)} de {visiveis.length - limite} restantes
                </button>
              </div>
            )}
          </div>
          <h3 className="sub-titulo">Cada voto, do mais antigo ao mais recente</h3>
          <div className="faixa">
            {votos.map(({ ev, voto }) => <Celula key={ev.id} ev={ev} voto={voto} nome={v.exibicao} />)}
          </div>
          <Legenda />
          <p className="nota">
            Até agosto os votos vêm do <Termo chave="resumo">resumo oficial</Termo> de cada sessão, que não registra quem estava presente e não votou. A partir de setembro vêm do <Termo chave="painel">painel eletrônico</Termo> mostrado na transmissão, que registra.
          </p>
        </Secao>
      )}

      {alinhados.length > 0 && (
        <Secao id="alinhamento" titulo="Com quem vota igual" resumo={`mais igual: ${alinhados[0].nome}`}>
          <div className="duas-colunas">
            <div>
              <h3 className="sub-titulo">Vota mais igual a</h3>
              <Funil etapas={alinhados.slice(0, 4).map((x) => ({ rotulo: `${x.nome} (${x.iguais} de ${x.total})`, valor: Math.round((100 * x.iguais) / x.total) }))} max={100} sufixo="%" />
            </div>
            <div>
              <h3 className="sub-titulo">Vota mais diferente de</h3>
              <Funil etapas={[...alinhados].reverse().slice(0, 4).map((x) => ({ rotulo: `${x.nome} (${x.iguais} de ${x.total})`, valor: Math.round((100 * x.iguais) / x.total) }))} max={100} sufixo="%" />
            </div>
            <p className="nota">Porcentagem das votações do painel em que os dois votaram igual, contando só as que ambos votaram sim ou não.</p>
          </div>
        </Secao>
      )}

      {v.executivo.contra > 0 && (
        <Secao id="prefeitura" titulo="Quando votou contra a posição da Prefeitura" resumo={`${v.executivo.contra} ${v.executivo.contra === 1 ? "vez" : "vezes"}`}>
          <p className="nota">Projetos enviados pelo prefeito em que votou contra a aprovação, e vetos do prefeito em que votou para derrubar. <Metodo ancora="partidos">Como é contado</Metodo>.</p>
          <ul className="lista-simples">
            {v.executivo.contra_ids.map(b.votacao).reverse().map((ev) => (
              <li key={ev.id}><strong>{dataCurta(ev.data, true)}</strong> · <LinkMateria slug={ev.materia} /> · {ev.etapa_txt.toLowerCase()} · votou <VotoTag voto={ev.votos[v.slug]} /> · <ResultadoTag r={ev.resultado} /></li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao id="projetos" titulo="Projetos de autoria" resumo={`${projetos.length} projeto${projetos.length === 1 ? "" : "s"}`} aberta={projetos.length > 0 && projetos.length <= 6}>
        {projetos.length ? (
          <ul className="lista-projetos">
            {projetos.map((m) => (
              <li key={m.slug}><DicaMateria m={m}><LinkMateria slug={m.slug} /></DicaMateria> <Situacao m={m} /> <Destaque m={m} compacto /><p>{m.assunto}</p></li>
            ))}
          </ul>
        ) : (
          <p>Nenhum projeto de lei com autoria identificada nos documentos coletados.</p>
        )}
      </Secao>

      {reqs.length > 0 && (
        <Secao id="requerimentos" titulo="Requerimentos e moções aprovados" resumo={`${reqs.length}`}>
          <ul className="lista-projetos">
            {reqs.map((m) => <li key={m.slug}><DicaMateria m={m}><LinkMateria slug={m.slug} /></DicaMateria><p>{m.assunto}</p></li>)}
          </ul>
        </Secao>
      )}

      <Secao id="presenca" titulo="Presença nas sessões" resumo={`${v.presenca.sim ?? 0} de ${v.sessoes_total}`}>
        <p>
          Segundo os resumos oficiais de {v.sessoes_total} sessões em 2026: presente em {v.presenca.sim ?? 0}, falta justificada em{" "}
          {v.presenca.justificada ?? 0} e ausência sem justificativa em {v.presenca.ausente ?? 0}.
        </p>
      </Secao>
      </div>
      <Toc itens={TOC_VEREADOR} caminho={`/vereadores/${v.slug}`} />
      </div>

      {v.partido && (
        <p className="nota" id="nota-partido">
          <sup>1</sup> Partido conforme {v.partido_fonte}{v.partido_url && <> (<a href={v.partido_url} rel="noopener noreferrer">fonte</a>)</>}.
          {" "}<Link to={`/partidos/${slugPartido(v.partido)}`}>Ver o partido {v.partido} na Câmara</Link>.
        </p>
      )}
    </div>
  );
}
