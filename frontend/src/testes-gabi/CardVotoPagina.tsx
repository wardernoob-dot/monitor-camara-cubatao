import { useParams, useSearchParams } from "react-router-dom";
import { useDados, votacaoDecisiva } from "../dados";
import { CardVoto, type Variante } from "./CardVoto";
import "./insta.css";

/* Só no `npm run dev`: #/insta/voto/<slug-da-materia>?v=1|2|3&escala=0.55 */
export default function CardVotoPagina() {
  const { slug = "" } = useParams();
  const [q] = useSearchParams();
  const escala = Number(q.get("escala")) || 0.55;
  const v = (Number(q.get("v")) || 1) as Variante;
  const b = useDados();
  const m = b.materia.get(slug);
  const votacao = m ? votacaoDecisiva(b, m) : null;
  if (!m || !votacao) return <p style={{ padding: 24 }}>Sem votação decisiva para {slug}.</p>;
  return (
    <div className="insta-palco">
      <div className="insta-palco__moldura" style={{ width: 1080 * escala, height: 1350 * escala }}>
        <div className="insta-palco__card" style={{ transform: `scale(${escala})` }}>
          <CardVoto variante={v} data={votacao.data} m={m} votacao={votacao} ver={b.vereador} />
        </div>
      </div>
    </div>
  );
}
