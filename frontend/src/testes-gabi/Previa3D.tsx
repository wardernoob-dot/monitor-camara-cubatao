import { Guara3D, type Pose3D } from "./Guara3D";

/* Só no `npm run dev`: #/insta/mascote3d mostra o guará 3D. */
const POSES: Pose3D[] = ["sofa", "parado", "acenando", "lendo", "comemorando"];

export default function Previa3D() {
  return (
    <div style={{ background: "#F4F1EA", padding: 24, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, justifyItems: "center" }}>
      {POSES.map((p) => (
        <figure key={p} style={{ margin: 0, textAlign: "center" }}>
          <Guara3D pose={p} largura={560} altura={520} />
          <figcaption style={{ color: "#6B7280", fontSize: 14 }}>{p}</figcaption>
        </figure>
      ))}
    </div>
  );
}
