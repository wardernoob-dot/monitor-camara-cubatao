import "@fontsource/geist-sans/700.css";
import { Guara } from "../guara";
import { Guara3D } from "./Guara3D";
import "./insta.css";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function dataCurta(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  return { dia, d, mes: MESES[m - 1], curta: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`, extenso: `${d} ${MESES[m - 1]}` };
}

const Check = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#9CC9E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" />
  </svg>
);

/* Capa 1: estrutura das referências (Easy English): fundo azul em duas camadas, painel de texto de cantos retos,
   etiqueta no topo, título + destaque, subtítulo, lista com ícones, botão retangular, rodapé em 3 itens e
   mascote que atravessa a borda do painel. */
export function Capa1({ data, projetos, sessao }: { data: string; projetos: number; sessao?: number }) {
  const { dia, d, mes, curta } = dataCurta(data);
  const ano = data.slice(0, 4);
  const plural = projetos === 1 ? "projeto votado" : "projetos votados";
  return (
    <div className="insta insta-card c1" aria-label={`Capa: o que a Câmara votou na ${dia}, ${curta}`}>
      <div className="c1-luz" />
      <header className="c1-topo">
        <span className="c1-topo__marca"><Guara tamanho={44} /><span><b>Voto a voto</b><small>Câmara de Cubatão</small></span></span>
        <span className="c1-topo__dia"><b>{d} <em>{mes}</em></b><small>{dia === "sábado" || dia === "domingo" ? dia : `${dia}-feira`} · {ano}</small></span>
      </header>

      <div className="c1-painel">
        <div className="c1-nova">{sessao ? `SESSÃO ${sessao}` : "SESSÃO"}</div>
        <h1 className="c1-titulo">
          O que a<br />Câmara<br /><em>votou</em>
        </h1>
        <p className="c1-sub">{projetos} {plural}</p>
        <div className="c1-botao">Deslize para ver <span>→</span></div>
      </div>

      <div className="c1-mascote"><span className="c1-chao" /><Guara3D pose="encostado" espelho largura={620} altura={860} /></div>

      <div className="c1-rodape">
        <span><small>Fonte dos votos</small>Resumo oficial e painel</span>
        <span><small>Todos os projetos</small>votoavoto.surge.sh</span>
      </div>
    </div>
  );
}
