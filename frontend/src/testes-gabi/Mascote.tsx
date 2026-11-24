import { useId } from "react";

/* Mascote do Instagram: o guará-vermelho gordinho (versão 3).
   O que faz parecer guará: bico longo, fino e curvado para baixo (claro, com ponta escura),
   pernas finas e compridas, pescoço visível, degradê de coral para vermelho e ponta preta nas asas e no rabo.
   O que faz ser engraçado: pálpebras, sobrancelhas que mudam por pose e covinhas de sorriso.
   Poses: jornal (capa), acenando, apontando, comemorando.
   As cores da ilustração ficam aqui; as cores dos cards ficam em insta.css. */

export type PoseMascote = "jornal" | "acenando" | "apontando" | "comemorando";

export const C = {
  coral: "#FF8F78",
  base: "#EA4B3B",
  fundo: "#C73328",
  barriga: "#FFB4A0",
  perna: "#D9604F",
  bicoClaro: "#F8DCCB",
  bicoMeio: "#E8AC97",
  bicoPonta: "#3A2B33",
  ponta: "#23242D",
  tinta: "#16202E",
  papel: "#FFFFFF",
  papelSombra: "#E7E3DA",
  azul: "#1F6A96",
};

/** Asa-braço. A origem (0,0) é o ombro; em repouso ela cai para baixo (+y). `giro` negativo abre para a direita. */
function Asa({ x, y, giro, espelho = false, dedo = false }: { x: number; y: number; giro: number; espelho?: boolean; dedo?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${espelho ? -1 : 1} 1)`}>
      <path d="M0 -6 C30 4 34 66 10 108 C-6 92 -26 40 -12 4 C-9 -4 -4 -6 0 -6Z" fill="url(#m-corpo)" />
      {/* três penas escuras de ponta arredondada, em leque */}
      <g fill={C.ponta}>
        <path d="M-17 80 C-27 98 -25 114 -15 120 C-6 114 -4 98 -7 82Z" />
        <path d="M-6 82 C-9 102 -4 122 5 128 C13 120 14 100 10 82Z" />
        <path d="M8 82 C12 98 20 112 29 108 C30 96 24 86 19 78Z" />
      </g>
      <path d="M-6 8 C-14 30 -14 50 -9 64" stroke="#fff" strokeOpacity=".24" strokeWidth="5" strokeLinecap="round" />
      {dedo && <path d="M-4 112 C-8 134 -3 152 5 166 C13 152 15 132 11 112Z" fill={C.ponta} />}
    </g>
  );
}

/** Pálpebra: tampa o alto do olho e dá personalidade (sonolento, esperto, curioso). */
function Olhos({ feliz, olhar, palpebra, sobrancelha }: { feliz?: boolean; olhar: [number, number]; palpebra: number; sobrancelha: "curiosa" | "alegre" | "alerta" }) {
  const id = useId().replace(/:/g, "");
  if (feliz) {
    return (
      <g fill="none" stroke={C.tinta} strokeWidth="8" strokeLinecap="round">
        <path d="M146 124 Q168 98 190 124" />
        <path d="M210 124 Q232 98 254 124" />
      </g>
    );
  }
  const [ox, oy] = olhar;
  const sob =
    sobrancelha === "curiosa"
      ? ["M146 90 Q166 78 188 84", "M212 76 Q232 62 256 74"]
      : sobrancelha === "alerta"
        ? ["M146 78 Q166 66 188 76", "M212 76 Q234 66 254 78"]
        : ["M146 86 Q166 74 188 82", "M212 82 Q234 74 254 86"];
  return (
    <g>
      {[168, 232].map((cx) => (
        <g key={cx}>
          <clipPath id={`${id}-${cx}`}><circle cx={cx} cy="120" r="27" /></clipPath>
          <circle cx={cx} cy="120" r="27" fill="#fff" />
          <circle cx={cx + ox} cy={120 + oy} r="13.5" fill={C.tinta} />
          <circle cx={cx + ox + 5} cy={120 + oy - 6} r="5" fill="#fff" />
          <circle cx={cx + ox - 5} cy={120 + oy + 6} r="2" fill="#fff" opacity=".8" />
          <g clipPath={`url(#${id}-${cx})`}>
            <rect x={cx - 30} y="88" width="60" height={palpebra} fill={C.base} />
            <line x1={cx - 30} x2={cx + 30} y1={88 + palpebra} y2={88 + palpebra} stroke={C.fundo} strokeWidth="3" opacity=".5" />
          </g>
          <circle cx={cx} cy="120" r="27" fill="none" stroke={C.fundo} strokeOpacity=".2" strokeWidth="2" />
        </g>
      ))}
      <g stroke={C.fundo} strokeWidth="5.5" strokeLinecap="round" opacity=".7" fill="none">
        <path d={sob[0]} />
        <path d={sob[1]} />
      </g>
    </g>
  );
}

function Jornal() {
  return (
    <g transform="rotate(-2.5 200 360)">
      <rect x="112" y="286" width="176" height="146" rx="10" fill={C.papelSombra} transform="translate(5 7)" />
      <rect x="112" y="286" width="176" height="146" rx="10" fill={C.papel} />
      <path d="M112 296 a10 10 0 0 1 10 -10 h156 a10 10 0 0 1 10 10 v20 h-176z" fill={C.tinta} />
      <text x="200" y="308" textAnchor="middle" fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="600" fontSize="16" letterSpacing="2.5" fill="#fff">
        VOTO A VOTO
      </text>
      <rect x="126" y="330" width="92" height="13" rx="4" fill={C.tinta} />
      <rect x="126" y="350" width="60" height="13" rx="4" fill={C.tinta} />
      <rect x="228" y="330" width="48" height="38" rx="6" fill={C.azul} opacity=".85" />
      {[382, 396, 410].map((y) => (
        <rect key={y} x="126" y={y} width={y === 410 ? 84 : 148} height="6" rx="3" fill="#C9C9C9" />
      ))}
    </g>
  );
}

/** Rabo em leque: três penas com a ponta escura. */
function Rabo() {
  return (
    <g transform="translate(290 344)">
      {[
        [-14, 96],
        [14, 104],
        [42, 92],
      ].map(([giro, comp], i) => (
        <g key={i} transform={`rotate(${giro})`}>
          <path d={`M0 -8 C${comp * 0.35} -22 ${comp * 0.85} -16 ${comp} 2 C${comp * 0.8} 18 ${comp * 0.35} 14 0 8Z`} fill={i === 1 ? "url(#m-corpo)" : C.fundo} />
          <path d={`M${comp * 0.72} -9 C${comp * 0.88} -13 ${comp * 0.98} -6 ${comp} 2 C${comp * 0.94} 10 ${comp * 0.84} 14 ${comp * 0.72} 12Z`} fill={C.ponta} />
        </g>
      ))}
    </g>
  );
}

export function Mascote({ pose = "jornal", tamanho = 400, className = "" }: { pose?: PoseMascote; tamanho?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const feliz = pose === "comemorando";
  const olhar: [number, number] = pose === "jornal" ? [0, 9] : pose === "apontando" ? [9, -5] : [0, 0];
  const palpebra = pose === "jornal" ? 17 : pose === "acenando" ? 8 : 4;
  const sobrancelha = pose === "jornal" ? "curiosa" : pose === "apontando" ? "alerta" : "alegre";

  return (
    <svg className={className} viewBox="-30 0 460 480" width={tamanho} height={(tamanho * 480) / 460} fill="none" role="img" aria-label="Guará-vermelho, mascote do Voto a Voto">
      <defs>
        <radialGradient id="m-corpo" cx="32%" cy="22%" r="95%">
          <stop offset="0" stopColor={C.coral} />
          <stop offset=".5" stopColor={C.base} />
          <stop offset="1" stopColor={C.fundo} />
        </radialGradient>
        <linearGradient id={`${id}-bico`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bicoClaro} />
          <stop offset=".5" stopColor={C.bicoMeio} />
          <stop offset=".9" stopColor={C.bicoPonta} />
        </linearGradient>
        <radialGradient id={`${id}-sombra`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={C.tinta} stopOpacity=".28" />
          <stop offset="1" stopColor={C.tinta} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="460" rx="124" ry="14" fill={`url(#${id}-sombra)`} />

      {/* pernas finas e compridas, com pés de três dedos */}
      <g stroke={C.perna} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M168 376 L164 452" />
        <path d="M232 376 L236 452" />
        <path d="M164 452 L138 458 M164 452 L156 464 M164 452 L174 464" strokeWidth="8" />
        <path d="M236 452 L262 458 M236 452 L244 464 M236 452 L226 464" strokeWidth="8" />
      </g>

      <Rabo />

      {pose === "comemorando" && <Asa x={104} y={268} giro={148} />}

      {/* corpo, pescoço e barriga */}
      <ellipse cx="200" cy="300" rx="112" ry="100" fill="url(#m-corpo)" />
      <ellipse cx="200" cy="196" rx="52" ry="46" fill="url(#m-corpo)" />
      <ellipse cx="200" cy="326" rx="70" ry="62" fill={C.barriga} opacity=".5" />
      <g stroke="#fff" strokeOpacity=".28" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M158 304 q10 10 20 0 M190 296 q10 10 20 0 M222 304 q10 10 20 0" />
        <path d="M172 334 q10 10 20 0 M206 334 q10 10 20 0" />
      </g>

      {/* sombra da cabeça no pescoço */}
      <ellipse cx="200" cy="204" rx="58" ry="13" fill={C.fundo} opacity=".35" />

      {/* cabeça */}
      <circle cx="200" cy="124" r="76" fill="url(#m-corpo)" />
      <ellipse cx="160" cy="70" rx="34" ry="15" fill="#fff" opacity=".18" transform="rotate(-22 160 70)" />

      {/* bochechas e covinhas de sorriso */}
      <circle cx="130" cy="158" r="15" fill={C.barriga} opacity=".7" />
      <circle cx="270" cy="158" r="15" fill={C.barriga} opacity=".7" />
      <g stroke={C.fundo} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity=".6">
        <path d="M162 160 Q164 178 178 184" />
        <path d="M238 160 Q236 178 222 184" />
      </g>

      <Olhos feliz={feliz} olhar={olhar} palpebra={palpebra} sobrancelha={sobrancelha} />

      {/* bico longo, fino e curvado para baixo: a marca do guará */}
      <g>
        <path d="M182 142 Q200 128 218 142 C226 178 232 232 236 270 C237 282 233 290 228 292 C214 262 196 206 182 142Z" fill={`url(#${id}-bico)`} />
        <path d="M190 146 Q200 140 210 146" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" />
        <path d="M205 170 C214 206 222 244 226 276" stroke={C.bicoPonta} strokeWidth="2.5" strokeLinecap="round" opacity=".22" />
        <ellipse cx="194" cy="155" rx="2.6" ry="1.8" fill={C.bicoPonta} opacity=".4" />
        <ellipse cx="207" cy="155" rx="2.6" ry="1.8" fill={C.bicoPonta} opacity=".4" />
      </g>

      {pose === "jornal" && (
        <>
          <Jornal />
          <Asa x={110} y={272} giro={18} />
          <Asa x={290} y={272} giro={-18} espelho />
        </>
      )}
      {pose === "acenando" && (
        <>
          <Asa x={104} y={274} giro={14} />
          <Asa x={296} y={268} giro={-152} espelho />
        </>
      )}
      {pose === "apontando" && (
        <>
          <Asa x={104} y={274} giro={14} />
          <Asa x={296} y={268} giro={-128} espelho dedo />
          <path d="M372 150 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5z" fill={C.azul} opacity=".85" />
        </>
      )}
      {pose === "comemorando" && (
        <>
          <Asa x={296} y={268} giro={-148} espelho />
          {[
            [56, 110, C.azul],
            [338, 90, C.base],
            [40, 230, C.base],
            [352, 220, C.azul],
            [120, 36, "#6B7280"],
            [290, 30, C.azul],
          ].map(([x, y, cor], i) => (
            <rect key={i} x={x as number} y={y as number} width="12" height="22" rx="3" fill={cor as string} transform={`rotate(${i * 37} ${x} ${y})`} opacity=".9" />
          ))}
        </>
      )}
    </svg>
  );
}
