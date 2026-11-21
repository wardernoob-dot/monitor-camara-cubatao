import { Link } from "react-router-dom";
import { useDados } from "../dados";
import { useTitulo } from "../util";

/** "Quem faz": responde a primeira dúvida do visitante ("isso é de político?"). Sem nome de pessoa: assina a equipe. */
export default function QuemFaz() {
  useTitulo("Quem faz o Voto a voto");
  const { meta } = useDados();
  const c = meta.contato;
  return (
    <div className="pagina">
      <p className="selo-pagina">Sobre</p>
      <h1 className="titulo-pagina">Quem faz o Voto a voto</h1>
      <p className="lead">Somos moradores de Cubatão. Fazemos o site porque as decisões da Câmara são públicas, mas difíceis de achar e de entender.</p>

      <div className="texto quem-faz">
        <h2>Sem lado</h2>
        <p>O Voto a voto não tem vínculo com a Câmara, com a Prefeitura, com partidos nem com vereadores. Não apoiamos candidato e não dizemos em quem votar. Mostramos o que cada um fez, com o documento do lado, e você tira as suas conclusões.</p>

        <h2>De onde vem cada informação</h2>
        <p>Um programa baixa todo dia o que a Câmara publica (pautas, resumos das sessões, projetos, vetos) e lê o painel de votação da transmissão no YouTube. Cada voto mostra de onde veio. Quando o painel e o resumo oficial não batem, a diferença aparece na tela.</p>
        <p>A inteligência artificial só ajuda a explicar o texto dos projetos em palavras simples. Ela nunca decide como alguém votou. Os textos da seção <Link to="/o-que-muda">O que muda</Link> são escritos e revisados por gente antes de ir ao ar.</p>

        <h2>Tudo aberto</h2>
        <p>O código e os dados ficam públicos: qualquer pessoa pode conferir a conta, baixar os números ou apontar um erro. O método completo está em <Link to="/como-funciona">Como funciona</Link>.</p>

        <h2>Achou um erro?</h2>
        <p>A leitura automática pode errar. Em toda página tem um botão "Achou um erro nesta página? Avise", com o texto pronto.
          {c?.email && <> Ou escreva para <a href={`mailto:${c.email}`}>{c.email}</a>.</>}
          {" "}A gente confere no documento oficial e corrige.</p>

        {(c?.instagram || c?.canal_whatsapp) && (
          <>
            <h2>Acompanhe</h2>
            <p>
              {c.canal_whatsapp && <a href={c.canal_whatsapp} rel="noopener noreferrer">Canal no WhatsApp</a>}
              {c.canal_whatsapp && c.instagram && " · "}
              {c.instagram && <a href={c.instagram} rel="noopener noreferrer">Instagram</a>}
            </p>
          </>
        )}
        <p className="quem-faz__assina">Equipe do Voto a voto</p>
      </div>
    </div>
  );
}
