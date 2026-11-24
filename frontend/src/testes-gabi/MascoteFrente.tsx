import { useId, type ReactNode } from "react";
import { C } from "./MascotePerfil";

/* Guará de frente, com a mesma anatomia do perfil: cabeça pequena, pescoço fino em S, bico longo escuro
   descendo à frente do peito, corpo de ovo, pernas compridas, ponta preta só nas asas.
   Poses em PF; sofá de frente é uma cena. */

export type PoseFrente = "parado" | "acenando" | "jornal" | "comemorando" | "lupa" | "cafe" | "sofa";

interface Aj { dy: number; asaE: number | null; asaD: number | null; adereco?: "lupa" | "xicara"; olhar: [number, number]; palpebra: number; feliz?: boolean; jornal?: boolean; sofa?: boolean; confete?: boolean; cabeca: number }
const PF: Record<PoseFrente, Aj> = {
  parado:      { dy: 0, asaE: null, asaD: null, olhar: [0, 0], palpebra: 3, cabeca: 0 },
  acenando:    { dy: 0, asaE: null, asaD: -150, olhar: [0, 0], palpebra: 2, cabeca: -4 },
  jornal:      { dy: 0, asaE: null, asaD: null, olhar: [0, 8], palpebra: 10, jornal: true, cabeca: 6 },
  comemorando: { dy: -20, asaE: 150, asaD: -150, olhar: [0, 0], palpebra: 0, feliz: true, confete: true, cabeca: 0 },
  lupa:        { dy: 0, asaE: null, asaD: -124, adereco: "lupa", olhar: [-3, 0], palpebra: 2, cabeca: 4 },
  cafe:        { dy: 0, asaE: null, asaD: -64, adereco: "xicara", olhar: [0, 3], palpebra: 10, cabeca: -3 },
  sofa:        { dy: 62, asaE: null, asaD: null, olhar: [0, 8], palpebra: 10, jornal: true, sofa: true, cabeca: 6 },
};

/** Asa levantada de frente. Origem no ombro; 0 = para baixo; negativo abre para a direita. */
function Asa({ x, y, giro, espelho, grad, children }: { x: number; y: number; giro: number; espelho?: boolean; grad: string; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${espelho ? -1 : 1} 1)`}>
      <path d="M-18 -4 C-38 40 -28 100 -6 150 C8 116 24 50 22 -2 C10 -12 -8 -12 -18 -4Z" fill={`url(#${grad})`} />
      <path d="M-8 6 C-18 40 -14 78 -6 104" stroke="#fff" strokeOpacity=".26" strokeWidth="5" strokeLinecap="round" fill="none" />
      <g fill={C.ponta}>
        <path d="M-24 118 C-34 138 -30 160 -18 170 C-8 158 -6 136 -8 118Z" />
        <path d="M-8 122 C-12 146 -4 172 6 182 C16 166 14 142 8 118Z" />
        <path d="M8 120 C12 140 22 160 32 160 C34 144 28 128 20 114Z" />
      </g>
      {children}
    </g>
  );
}

function AsaParada({ lado, grad }: { lado: "e" | "d"; grad: string }) {
  return (
    <g transform={lado === "d" ? "translate(460 0) scale(-1 1)" : undefined}>
      <path d="M152 296 C112 322 108 412 148 456 C164 424 172 352 172 306Z" fill={`url(#${grad})`} />
      <path d="M150 316 C136 346 134 386 144 418" stroke="#fff" strokeOpacity=".24" strokeWidth="5" strokeLinecap="round" fill="none" />
      <g fill={C.ponta}>
        <ellipse cx="136" cy="446" rx="9" ry="30" transform="rotate(10 136 446)" />
        <ellipse cx="150" cy="454" rx="9" ry="30" transform="rotate(4 150 454)" />
        <ellipse cx="164" cy="448" rx="8" ry="26" transform="rotate(-4 164 448)" />
      </g>
    </g>
  );
}

function Sofa({ frente }: { frente?: boolean }) {
  if (!frente)
    return (
      <g>
        <ellipse cx="230" cy="590" rx="250" ry="16" fill={C.tinta} opacity=".14" />
        <rect x="20" y="250" width="420" height="260" rx="60" fill={C.sofaEscuro} />
        <rect x="100" y="300" width="96" height="110" rx="30" fill={C.almofada} transform="rotate(-10 148 355)" />
        <rect x="270" y="310" width="90" height="100" rx="28" fill="#E3B6A3" transform="rotate(9 315 360)" />
      </g>
    );
  return (
    <g>
      <rect x="70" y="480" width="320" height="86" rx="34" fill={C.sofa} />
      <rect x="86" y="470" width="288" height="34" rx="17" fill="#7EA3BD" />
      <rect x="-14" y="380" width="96" height="190" rx="42" fill={C.sofaEscuro} />
      <rect x="378" y="380" width="96" height="190" rx="42" fill={C.sofaEscuro} />
      <rect x="40" y="566" width="30" height="36" rx="8" fill={C.tinta} opacity=".75" />
      <rect x="390" y="566" width="30" height="36" rx="8" fill={C.tinta} opacity=".75" />
    </g>
  );
}

export function MascoteFrente({ pose = "parado", tamanho = 380, className = "" }: { pose?: PoseFrente; tamanho?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const p = PF[pose];
  const [ox, oy] = p.olhar;
  const corpo = `url(#${id}-corpo)`;

  return (
    <svg className={className} viewBox="-30 -50 520 680" width={tamanho} height={(tamanho * 680) / 520} fill="none" role="img" aria-label="Guará-vermelho de frente, mascote do Voto a Voto">
      <defs>
        <radialGradient id={`${id}-corpo`} cx="38%" cy="22%" r="95%">
          <stop offset="0" stopColor={C.coral} /><stop offset=".5" stopColor={C.base} /><stop offset="1" stopColor={C.fundo} />
        </radialGradient>
        <linearGradient id={`${id}-bico`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#4A4252" /><stop offset="1" stopColor={C.bico} />
        </linearGradient>
        <radialGradient id={`${id}-sombra`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={C.tinta} stopOpacity=".28" /><stop offset="1" stopColor={C.tinta} stopOpacity="0" />
        </radialGradient>
      </defs>

      {p.sofa ? <Sofa /> : <ellipse cx="230" cy="580" rx="130" ry="13" fill={`url(#${id}-sombra)`} />}

      <g transform={`translate(0 ${p.dy})`}>
        {/* pernas compridas */}
        {!p.sofa && (
          <g stroke={C.perna} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M202 440 L204 506 L198 566 M198 566 L174 578 M198 566 L198 582 M198 566 L222 578" />
            <path d="M258 440 L256 506 L262 566 M262 566 L286 578 M262 566 L262 582 M262 566 L238 578" />
          </g>
        )}

        {p.asaE !== null && <Asa x={150} y={306} giro={p.asaE} grad={`${id}-corpo`} />}

        <ellipse cx="230" cy="364" rx="106" ry="100" fill={corpo} />
        <ellipse cx="230" cy="396" rx="64" ry="58" fill={C.barriga} opacity=".4" />
        <g stroke="#fff" strokeOpacity=".28" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M190 372 q10 10 20 0 M222 364 q10 10 20 0 M254 372 q10 10 20 0 M206 404 q10 10 20 0 M240 404 q10 10 20 0" />
        </g>

        {p.asaE === null && <AsaParada lado="e" grad={`${id}-corpo`} />}
        {p.asaD === null && <AsaParada lado="d" grad={`${id}-corpo`} />}

        {/* pescoço fino em S */}
        <g transform={`rotate(${p.cabeca} 230 300)`}>
          <path d="M204 304 C194 252 218 224 214 172 C213 152 216 132 220 118 L244 118 C247 132 249 152 247 172 C243 224 268 252 256 304Z" fill={corpo} />
          <path d="M212 300 C204 256 224 232 222 180" stroke={C.coral} strokeOpacity=".4" strokeWidth="7" strokeLinecap="round" fill="none" />
          <ellipse cx="230" cy="100" rx="42" ry="36" fill={corpo} />
          <ellipse cx="230" cy="108" rx="31" ry="22" fill={C.rosto} opacity=".75" />
          {p.feliz ? (
            <g stroke={C.tinta} strokeWidth="6.5" strokeLinecap="round" fill="none">
              <path d="M198 100 Q212 80 226 100" /><path d="M234 100 Q248 80 262 100" />
            </g>
          ) : (
            [212, 248].map((cx) => (
              <g key={cx}>
                <clipPath id={`${id}-o${cx}`}><circle cx={cx} cy="96" r="13" /></clipPath>
                <circle cx={cx} cy="96" r="13" fill="#fff" />
                <circle cx={cx + ox} cy={96 + oy} r="7.5" fill={C.tinta} />
                <circle cx={cx + ox + 2.5} cy={96 + oy - 3} r="2.6" fill="#fff" />
                <g clipPath={`url(#${id}-o${cx})`}><rect x={cx - 14} y="80" width="28" height={p.palpebra} fill={C.base} /></g>
                <circle cx={cx} cy="96" r="13" fill="none" stroke={C.fundo} strokeOpacity=".25" strokeWidth="1.5" />
              </g>
            ))
          )}
          {!p.feliz && (
            <g stroke={C.fundo} strokeOpacity=".7" strokeWidth="4.5" strokeLinecap="round" fill="none">
              <path d="M198 80 Q212 72 224 78" /><path d="M236 78 Q248 72 262 80" />
            </g>
          )}
          {/* bico longo descendo, ligeiramente curvo */}
          <path d="M219 112 C215 162 221 216 239 282 C241 288 245 288 246 282 C252 216 246 162 241 112Z" fill={`url(#${id}-bico)`} />
          <path d="M224 118 C222 160 227 204 238 250" stroke={C.bicoLuz} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".75" />
        </g>

        {p.jornal && (
          <g transform="rotate(-3 230 420)">
            <rect x="148" y="338" width="164" height="124" rx="10" fill={C.papelSombra} transform="translate(5 7)" />
            <rect x="148" y="338" width="164" height="124" rx="10" fill="#fff" />
            <path d="M148 348 a10 10 0 0 1 10 -10 h144 a10 10 0 0 1 10 10 v20 h-164z" fill={C.tinta} />
            <text x="230" y="358" textAnchor="middle" fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="600" fontSize="14" letterSpacing="2.4" fill="#fff">VOTO A VOTO</text>
            <rect x="162" y="380" width="84" height="12" rx="4" fill={C.tinta} />
            <rect x="162" y="398" width="56" height="12" rx="4" fill={C.tinta} />
            <rect x="256" y="380" width="44" height="34" rx="6" fill={C.azul} opacity=".85" />
            {[424, 436, 448].map((y) => <rect key={y} x="162" y={y} width={y === 448 ? 78 : 136} height="5" rx="2.5" fill="#C9C9C9" />)}
          </g>
        )}
        {p.jornal && (
          <g>
            <Asa x={150} y={330} giro={34} grad={`${id}-corpo`} />
            <Asa x={310} y={330} giro={-34} espelho grad={`${id}-corpo`} />
          </g>
        )}

        {p.asaD !== null && (
          <Asa x={312} y={306} giro={p.asaD} espelho grad={`${id}-corpo`}>
            {p.adereco === "lupa" && (
              <g transform="translate(0 176) rotate(180)">
                <path d="M0 0 L0 -40" stroke={C.tinta} strokeWidth="9" strokeLinecap="round" />
                <circle cx="0" cy="-82" r="44" fill="#fff" fillOpacity=".35" stroke={C.azulEscuro} strokeWidth="10" />
                <path d="M-22 -96 A26 26 0 0 1 -4 -112" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
              </g>
            )}
            {p.adereco === "xicara" && (
              <g transform="translate(0 176) rotate(150)">
                <path d="M-8 -60 q-8 -12 0 -24 q8 -12 0 -24 M10 -60 q-8 -12 0 -24 q8 -12 0 -24" stroke="#9aa4b2" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".55" />
                <rect x="-26" y="-56" width="52" height="56" rx="12" fill="#fff" stroke={C.papelSombra} strokeWidth="2" />
                <rect x="-26" y="-34" width="52" height="12" fill={C.azul} />
                <ellipse cx="0" cy="-56" rx="26" ry="6" fill="#6b4a36" />
              </g>
            )}
          </Asa>
        )}
      </g>

      {p.sofa && <Sofa frente />}
      {p.confete &&
        [[40, 150, C.azul], [96, 40, C.base], [380, 40, C.azul], [430, 150, C.base], [20, 330, C.base], [450, 320, C.azul], [230, -20, "#6B7280"]].map(([x, y, cor], i) => (
          <rect key={i} x={x as number} y={y as number} width="12" height="22" rx="3" fill={cor as string} transform={`rotate(${i * 41} ${x} ${y})`} opacity=".9" />
        ))}
    </svg>
  );
}
