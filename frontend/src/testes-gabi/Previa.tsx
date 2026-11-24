import { MascotePerfil, type PosePerfil } from "./MascotePerfil";
import { MascoteFrente, type PoseFrente } from "./MascoteFrente";

/* Só no `npm run dev`: #/insta/mascote mostra todas as poses sobre o fundo do Instagram.
   Perfil: alterna olhando para a direita e para a esquerda (espelho). */
const PERFIL: PosePerfil[] = [
  "sofa", "sofaDormindo", "mesa", "andando", "lupa", "megafone", "voando", "apontando", "placar",
  "comemorando", "urna", "cafe", "chuva", "martelo", "celular", "duvida", "pilha",
];
const FRENTE: PoseFrente[] = ["parado", "acenando", "jornal", "sofa", "comemorando", "lupa", "cafe"];

const anel = { position: "absolute" as const, inset: "12% 10% 4%", borderRadius: "50%", background: "radial-gradient(circle, #e7e2d6 0 55%, transparent 56%)" };
const grade = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, justifyItems: "center" } as const;
const titulo = { margin: "36px 0 12px", color: "#16202E", fontFamily: "system-ui" } as const;

export default function Previa() {
  return (
    <div style={{ background: "#F4F1EA", padding: 32 }}>
      <h2 style={{ ...titulo, marginTop: 0 }}>Perfil ({PERFIL.length} poses, alternando direita e esquerda)</h2>
      <div style={grade}>
        {PERFIL.map((p, i) => (
          <figure key={p} style={{ position: "relative", margin: 0, textAlign: "center" }}>
            <div style={anel} />
            <div style={{ position: "relative" }}><MascotePerfil pose={p} espelho={i % 2 === 1} tamanho={330} /></div>
            <figcaption style={{ color: "#6B7280", fontSize: 14 }}>{p}{i % 2 === 1 ? " (←)" : " (→)"}</figcaption>
          </figure>
        ))}
      </div>
      <h2 style={titulo}>De frente ({FRENTE.length} poses)</h2>
      <div style={grade}>
        {FRENTE.map((p) => (
          <figure key={p} style={{ position: "relative", margin: 0, textAlign: "center" }}>
            <div style={anel} />
            <div style={{ position: "relative" }}><MascoteFrente pose={p} tamanho={300} /></div>
            <figcaption style={{ color: "#6B7280", fontSize: 14 }}>{p}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
