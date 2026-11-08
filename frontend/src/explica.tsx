import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Materia, Votacao, Voto } from "./dados";

/* ------------------------------------------------------------------ dica (hover, foco e toque) */
export function Dica({ conteudo, children, rotulo = "Explicação" }: { conteudo: ReactNode; children: ReactNode; rotulo?: string }) {
  const [aberta, setAberta] = useState(false);
  const [desloca, setDesloca] = useState(0);
  const id = useId();
  const caixa = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const fecha = useRef<number>(0);

  useLayoutEffect(() => {
    if (!aberta || !pop.current) return;
    const r = pop.current.getBoundingClientRect();
    const sobra = window.innerWidth - 12 - r.right;
    setDesloca(sobra < 0 ? sobra : r.left < 12 ? 12 - r.left : 0);
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberta]);

  const abertaEm = useRef(0);
  const abre = () => { window.clearTimeout(fecha.current); if (!aberta) { abertaEm.current = Date.now(); setDesloca(0); } setAberta(true); };
  const fechaLogo = () => { fecha.current = window.setTimeout(() => setAberta(false), 120); };

  return (
    <span ref={caixa} className="dica" onMouseEnter={abre} onMouseLeave={fechaLogo} onFocus={abre} onBlur={fechaLogo}>
      <span aria-describedby={aberta ? id : undefined}>{children}</span>
      <button type="button" className="dica__botao" aria-label={rotulo} aria-expanded={aberta}
        onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          // no toque o foco ja abriu: o clique logo em seguida nao pode fechar
          if (Date.now() - abertaEm.current < 400) return;
          setAberta((a) => !a);
        }}>
        <span aria-hidden="true">i</span>
      </button>
      {aberta && (
        <span ref={pop} id={id} role="tooltip" className="dica__pop" style={{ transform: `translateX(${desloca}px)` }}
          onMouseEnter={abre} onMouseLeave={fechaLogo}>
          {conteudo}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ explicacao simples do projeto */
export function DicaMateria({ m, children }: { m: Materia; children: ReactNode }) {
  if (!m.explicacao) return <>{children}</>;
  return (
    <Dica rotulo={`O que é ${m.titulo}`} conteudo={
      <>
        <strong className="dica__titulo">Em palavras simples</strong>
        {m.explicacao.texto}
        <span className="dica__fonte">Texto de IA ({m.explicacao.modelo}) feito só com {m.explicacao.base}.</span>
      </>}>
      {children}
    </Dica>
  );
}

/* ------------------------------------------------------------------ glossario das etapas */
export function explicaEtapa(etapa: string, tipo?: string): string {
  const t = etapa.toLowerCase();
  if (tipo === "VETO") return "Votação do veto do prefeito. A Câmara decide se mantém o veto (a parte vetada não vale) ou se derruba o veto (o texto aprovado pela Câmara volta a valer).";
  if (t.includes("parecer")) {
    let s = "Parecer é a opinião de uma comissão de vereadores sobre o projeto, votada antes do projeto em si.";
    if (t.includes("contr")) s += " Este parecer é contrário: votar SIM é concordar que o projeto não deve seguir; votar NÃO é a favor de o projeto seguir.";
    else if (t.includes("favor")) s += " Este parecer é favorável: votar SIM é a favor de o projeto seguir.";
    if (t.includes("separado")) s += " “Em separado” quer dizer que é a opinião de parte da comissão, diferente da maioria.";
    if (t.includes("conjunto")) s += " “Em conjunto” quer dizer que mais de uma comissão deu o parecer junta.";
    if (t.includes("emenda")) s += " Aqui o parecer é sobre uma emenda, uma mudança proposta no texto.";
    return s;
  }
  if (t.includes("emenda")) return "Emenda é uma mudança proposta no texto do projeto. Votar SIM aprova a mudança; o projeto ainda é votado depois.";
  if (t.startsWith("1")) return "Primeira votação do projeto. Projetos de lei passam por duas votações; aprovar aqui ainda não é a aprovação final.";
  if (t.startsWith("2")) return "Segunda e última votação do projeto na Câmara. Aprovado aqui, vai para o prefeito sancionar (virar lei) ou vetar.";
  if (t.includes("única")) return "Votação única: este tipo de proposição é decidido numa votação só.";
  if (t.includes("redação final")) return "Confirmação do texto final, com as emendas aprovadas, antes de ir para o prefeito.";
  if (tipo === "RQ") return "Requerimento é um pedido formal, em geral à Prefeitura ou a outro órgão (informações, providências, criação de comissão). Não cria lei.";
  if (tipo === "MOCAO") return "Moção é uma manifestação da Câmara (aplauso, apoio, repúdio, pesar). Não cria lei nem obriga ninguém.";
  return "Votação em plenário.";
}

export function EtapaComDica({ ev, tipo }: { ev: Votacao; tipo?: string }) {
  return <Dica rotulo={`O que é ${ev.etapa_txt}`} conteudo={explicaEtapa(ev.etapa_txt, tipo)}>{ev.etapa_txt}</Dica>;
}

/** O que o voto significa para o projeto (só quando não é óbvio). */
export function naPratica(sentido: Votacao["sentido"], voto: Voto): string | null {
  if (voto !== "SIM" && voto !== "NAO") return null;
  if (sentido === "inverso") return voto === "SIM" ? "contra o projeto seguir" : "a favor do projeto seguir";
  if (sentido === "emenda") return voto === "SIM" ? "a favor da mudança no texto" : "contra a mudança no texto";
  return null;
}

/* ------------------------------------------------------------------ selo de destaque */
export function Destaque({ m, compacto = false }: { m: Materia; compacto?: boolean }) {
  if (m.relevancia.nivel !== "alta") return null;
  return (
    <Dica rotulo={`Por que ${m.titulo} está em destaque`} conteudo={
      <>
        <strong className="dica__titulo">Por que está em destaque</strong>
        <ul className="dica__lista">{m.relevancia.motivos.map((x) => <li key={x}>{x}</li>)}</ul>
        <span className="dica__fonte">Critérios fixos e públicos, iguais para todos os projetos. Não diz se o projeto é bom ou ruim.</span>
      </>}>
      <span className={`selo${compacto ? " selo--compacto" : ""}`}>Atenção</span>
    </Dica>
  );
}

/* ------------------------------------------------------------------ glossario de termos (palavra com sublinhado pontilhado e explicacao curta) */
const TERMOS = {
  veto: ["Veto", "O prefeito pode vetar, no todo ou em parte, um projeto aprovado pela Câmara. O veto volta para a Câmara, que mantém o veto (a parte vetada não vale) ou o derruba (o texto aprovado volta a valer)."],
  parecer: ["Parecer", "Opinião de uma comissão de vereadores sobre o projeto, votada antes do projeto em si."],
  ementa: ["Ementa", "O resumo de uma linha que abre cada projeto e diz o que ele muda."],
  sha256: ["SHA-256", "Um código calculado a partir do conteúdo do arquivo. Se o documento mudar, o código muda, e assim dá para provar se ele foi alterado depois de publicado."],
  painel: ["Painel eletrônico", "A tela da transmissão que mostra o voto de cada vereador. O site lê a cor de cada quadrado do painel, sem IA."],
  resumo: ["Resumo oficial", "Documento da Câmara com o resumo de cada sessão. Lista quem votou, mas não quem estava presente e não votou."],
  diario: ["Diário Oficial", "Publicação em que a Prefeitura divulga leis e atos oficiais. É onde se confirma que um projeto virou lei."],
  loa: ["Lei Orgânica", "A lei básica do município, que organiza o poder público local."],
  indice: ["Índice de Atuação", "Nota de 0 a 10 que resume atividade registrada em documento público: presença, participação nas votações, projetos e fiscalização. Não mede a qualidade das ideias nem o trabalho que não deixa registro."],
  posicao: ["Posição da Prefeitura", "Conta só votações em que ela tem lado claro: projetos enviados pelo prefeito (votar pela aprovação) e vetos do prefeito (votar por manter o veto). Votar diferente não é bom nem ruim."],
  bancada: ["Bancada unida", "A parte dos votos que acompanhou a maioria do próprio partido, nas votações em que dois ou mais membros votaram."],
} as const;
export type ChaveTermo = keyof typeof TERMOS;

/** Palavra do texto com explicação curta ao passar o mouse, focar ou tocar. Os termos ficam em TERMOS. */
export function Termo({ chave, children }: { chave: ChaveTermo; children: ReactNode }) {
  const [titulo, texto] = TERMOS[chave];
  return (
    <Dica rotulo={`O que é: ${titulo}`} conteudo={<><strong className="dica__titulo">{titulo}</strong>{texto}</>}>
      {children}
    </Dica>
  );
}
