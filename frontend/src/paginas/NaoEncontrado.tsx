import { Link } from "react-router-dom";
import { useTitulo } from "../util";

export default function NaoEncontrado() {
  useTitulo("Página não encontrada");
  return (
    <div className="pagina">
      <h1 className="titulo-pagina">Página não encontrada</h1>
      <p className="lead">Esse endereço não existe ou o projeto ainda não foi coletado.</p>
      <p><Link to="/">Voltar para o início</Link> ou <Link to="/projetos">buscar um projeto</Link>.</p>
    </div>
  );
}
