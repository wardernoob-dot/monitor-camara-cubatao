import { useParams, useSearchParams } from "react-router-dom";
import { useDados } from "../dados";
import { Capa1 } from "./Capa1";
import "./insta.css";

/* Só no `npm run dev`: #/insta/capa/AAAA-MM-DD mostra a capa 1 com dados reais. ?escala=1 mostra em tamanho real. */
const NAO_PROJETO = /^(mocao|rq|requerimento|relatorio)/i;

export default function Capa1Pagina() {
  const { data = "" } = useParams();
  const [q] = useSearchParams();
  const escala = Number(q.get("escala")) || 0.55;
  const dia = useDados().dias.find((d) => d.data === data);
  if (!dia) return <p style={{ padding: 24 }}>Sem sessão em {data}.</p>;
  const projetos = dia.materias.filter((id) => !NAO_PROJETO.test(id)).length;
  return (
    <div className="insta-palco">
      <div className="insta-palco__moldura" style={{ width: 1080 * escala, height: 1350 * escala }}>
        <div className="insta-palco__card" style={{ transform: `scale(${escala})` }}>
          <Capa1 data={dia.data} projetos={projetos} sessao={dia.sessoes[0]?.numero} />
        </div>
      </div>
    </div>
  );
}
