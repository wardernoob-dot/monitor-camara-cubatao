import { useId, type ReactNode } from "react";

/* Guará de perfil, montado em peças. Anatomia feita a partir de fotos de guará real:
   cabeça pequena que se afina no bico, pescoço longo em S, bico longo, escuro e curvado,
   corpo de ovo, pernas compridas e rosadas, vermelho uniforme e ponta preta só nas asas.
   Gordinho só no corpo e no olho grande, para manter o jeito amigável.

   Para criar uma cena nova: acrescente uma linha em POSES (ângulos + adereço + cena).
   `espelho` faz qualquer pose olhar para a esquerda; os textos desenhados são desvirados sozinhos.
   As cores da ilustração ficam aqui; as cores dos cards ficam em insta.css. */

export const C = {
  coral: "#FF8B74", base: "#EB4A3A", fundo: "#C42F25", barriga: "#FFA996", rosto: "#F68C7B", perna: "#E26F5F",
  bico: "#2E2832", bicoLuz: "#6F6577", ponta: "#23242D", tinta: "#16202E", papel: "#FFFFFF", papelSombra: "#E7E3DA",
  azul: "#1F6A96", azulEscuro: "#13324A", sofa: "#5E86A3", sofaEscuro: "#3F6783", almofada: "#F1E3C8",
  madeira: "#D9B88F", madeiraEscura: "#A8825A", cinza: "#D8D8DE", verde: "#2E7D4F", vermelho: "#C4342B",
};

export type PosePerfil =
  | "andando" | "sofa" | "sofaDormindo" | "mesa" | "lupa" | "megafone" | "voando" | "apontando" | "placar"
  | "comemorando" | "urna" | "cafe" | "chuva" | "martelo" | "celular" | "duvida" | "pilha";

type Adereco = "lupa" | "megafone" | "xicara" | "celular" | "papel" | "guardaChuva" | "martelo";
type Cena = "sofa" | "mesa" | "placar" | "pilha" | "martelo" | "urna" | "chuva" | "duvida";

interface Ajuste {
  dy: number; giroCorpo: number; giroCabeca: number;
  asa: { tipo: "dobrada" | "erguida"; giro: number; escala?: number; dedo?: boolean; adereco?: Adereco };
  pernas: [number, number]; sentado?: boolean; olhar: [number, number]; palpebra: number;
  feliz?: boolean; dorme?: boolean; oculos?: boolean; cena?: Cena; rolo?: boolean;
  jornal?: { x: number; y: number; giro: number }; asaLonge?: boolean; confete?: boolean;
}

const POSES: Record<PosePerfil, Ajuste> = {
  andando:      { dy: 0, giroCorpo: -2, giroCabeca: -4, asa: { tipo: "dobrada", giro: 0 }, pernas: [-16, 14], olhar: [3, 1], palpebra: 5, rolo: true },
  sofa:         { dy: 40, giroCorpo: 0, giroCabeca: 30, asa: { tipo: "erguida", giro: 64, escala: 0.8 }, pernas: [0, 0], sentado: true, olhar: [4, 8], palpebra: 10, cena: "sofa", oculos: true, jornal: { x: 462, y: 262, giro: -8 } },
  sofaDormindo: { dy: 40, giroCorpo: 0, giroCabeca: 38, asa: { tipo: "dobrada", giro: -14 }, pernas: [0, 0], sentado: true, olhar: [0, 0], palpebra: 0, dorme: true, cena: "sofa", jornal: { x: 392, y: 352, giro: 10 } },
  mesa:         { dy: 0, giroCorpo: 0, giroCabeca: 22, asa: { tipo: "dobrada", giro: -8 }, pernas: [-3, 4], olhar: [4, 7], palpebra: 6, cena: "mesa", oculos: true },
  lupa:         { dy: 0, giroCorpo: 0, giroCabeca: 4, asa: { tipo: "erguida", giro: 78, adereco: "lupa" }, pernas: [-4, 5], olhar: [8, 2], palpebra: 2 },
  megafone:     { dy: 0, giroCorpo: 0, giroCabeca: -10, asa: { tipo: "erguida", giro: 88, adereco: "megafone" }, pernas: [-4, 5], olhar: [3, -2], palpebra: 2 },
  voando:       { dy: -50, giroCorpo: -10, giroCabeca: -10, asa: { tipo: "erguida", giro: -48, escala: 1.25 }, pernas: [74, 82], olhar: [4, -1], palpebra: 3, asaLonge: true },
  apontando:    { dy: 0, giroCorpo: 0, giroCabeca: -8, asa: { tipo: "erguida", giro: 78, dedo: true }, pernas: [-4, 5], olhar: [6, -3], palpebra: 2 },
  placar:       { dy: 0, giroCorpo: 0, giroCabeca: -6, asa: { tipo: "erguida", giro: 74, dedo: true }, pernas: [-4, 5], olhar: [7, -2], palpebra: 2, cena: "placar" },
  comemorando:  { dy: -28, giroCorpo: -4, giroCabeca: -16, asa: { tipo: "erguida", giro: -12 }, pernas: [-12, 12], olhar: [0, 0], palpebra: 0, feliz: true, confete: true },
  urna:         { dy: 0, giroCorpo: 0, giroCabeca: 10, asa: { tipo: "erguida", giro: 96, adereco: "papel" }, pernas: [-4, 5], olhar: [6, 5], palpebra: 3, cena: "urna" },
  cafe:         { dy: 0, giroCorpo: 0, giroCabeca: 2, asa: { tipo: "erguida", giro: 56, adereco: "xicara" }, pernas: [-3, 4], olhar: [2, 3], palpebra: 10 },
  chuva:        { dy: 0, giroCorpo: 0, giroCabeca: -2, asa: { tipo: "erguida", giro: 20, adereco: "guardaChuva" }, pernas: [-5, 5], olhar: [3, -2], palpebra: 3, cena: "chuva" },
  martelo:      { dy: 0, giroCorpo: 0, giroCabeca: -8, asa: { tipo: "erguida", giro: 24, adereco: "martelo" }, pernas: [-4, 5], olhar: [4, -1], palpebra: 2, cena: "martelo" },
  celular:      { dy: 0, giroCorpo: 0, giroCabeca: 20, asa: { tipo: "erguida", giro: 62, adereco: "celular" }, pernas: [-4, 5], olhar: [4, 7], palpebra: 6 },
  duvida:       { dy: 0, giroCorpo: 0, giroCabeca: 14, asa: { tipo: "dobrada", giro: 0 }, pernas: [-3, 4], olhar: [6, -4], palpebra: 0, cena: "duvida" },
  pilha:        { dy: 24, giroCorpo: 0, giroCabeca: 16, asa: { tipo: "dobrada", giro: 0 }, pernas: [0, 3], olhar: [8, 0], palpebra: 0, cena: "pilha" },
};

const OMBRO_D: [number, number] = [272, 300];
const BASE_PESCOCO: [number, number] = [346, 290];
const PESCOCO = "M326 292 C306 236 346 214 348 162 C349 138 368 120 388 108 L418 112 C404 128 386 142 384 164 C380 214 392 246 372 292Z";

/** Texto que não sai espelhado quando a pose é virada para a esquerda. */
function Texto({ esp, x, y, children, ...resto }: { esp?: boolean; x: number; y: number; children: ReactNode } & React.SVGProps<SVGTextElement>) {
  return <text x={0} y={0} transform={`translate(${x} ${y}) scale(${esp ? -1 : 1} 1)`} {...resto}>{children}</text>;
}

function AsaDobrada({ giro, grad }: { giro: number; grad: string }) {
  return (
    <g transform={`translate(${OMBRO_D[0]} ${OMBRO_D[1]}) rotate(${giro}) translate(${-OMBRO_D[0]} ${-OMBRO_D[1]})`}>
      <path d="M272 296 C300 300 330 330 318 372 C300 398 220 402 146 394 C170 366 198 330 232 304 C248 296 260 294 272 296Z" fill={`url(#${grad})`} />
      <path d="M262 304 C240 316 214 340 190 372" stroke="#fff" strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" fill="none" />
      <g fill={C.ponta}>
        <ellipse cx="150" cy="398" rx="40" ry="9.5" transform="rotate(-6 150 398)" />
        <ellipse cx="166" cy="384" rx="38" ry="9" transform="rotate(-18 166 384)" />
        <ellipse cx="188" cy="371" rx="32" ry="8" transform="rotate(-30 188 371)" />
      </g>
    </g>
  );
}

/** Braço comprido para gestos. Em 0 aponta para cima; positivo inclina para a frente. Os filhos ficam na ponta. */
function AsaErguida({ giro, escala = 1, dedo, grad, children, contra }: { giro: number; escala?: number; dedo?: boolean; grad: string; children?: ReactNode; contra?: boolean }) {
  return (
    <g transform={`translate(292 292) rotate(${giro}) scale(${escala})`}>
      <path d="M-20 4 C-38 -50 -26 -108 -4 -154 C8 -122 22 -52 22 4 C10 14 -8 14 -20 4Z" fill={`url(#${grad})`} />
      <path d="M-10 -6 C-20 -40 -16 -76 -6 -106" stroke="#fff" strokeOpacity=".28" strokeWidth="5" strokeLinecap="round" fill="none" />
      <g fill={C.ponta} transform="translate(6 0)">
        <path d="M-26 -118 C-36 -140 -30 -164 -18 -176 C-8 -162 -6 -138 -8 -118Z" />
        <path d="M-10 -122 C-14 -148 -6 -176 6 -188 C16 -170 14 -142 8 -118Z" />
        <path d="M6 -120 C10 -142 22 -164 34 -168 C36 -150 28 -130 20 -116Z" />
      </g>
      {dedo && <path d="M4 -178 C2 -206 8 -226 16 -240 C24 -224 24 -204 20 -178Z" fill={C.ponta} />}
      {children && <g transform={`translate(4 -176) ${contra ? `rotate(${-giro})` : ""}`}>{children}</g>}
    </g>
  );
}

/* adereços: desenhados com a origem na ponta da asa */
const Lupa = () => (
  <g>
    <path d="M0 0 L0 -40" stroke={C.tinta} strokeWidth="9" strokeLinecap="round" />
    <circle cx="0" cy="-82" r="42" fill="#fff" fillOpacity=".35" stroke={C.azulEscuro} strokeWidth="10" />
    <path d="M-22 -96 A26 26 0 0 1 -4 -112" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".9" />
  </g>
);
const Megafone = () => (
  <g transform="translate(0 6)">
    <path d="M-14 0 L14 0 L22 -26 L-22 -26Z" fill={C.azulEscuro} />
    <path d="M-22 -26 L22 -26 L52 -104 L-52 -104Z" fill={C.azul} />
    <ellipse cx="0" cy="-104" rx="52" ry="11" fill={C.azulEscuro} />
    <ellipse cx="0" cy="-104" rx="40" ry="7" fill="#0c1f2f" />
    <path d="M-30 -40 L-18 -90" stroke="#fff" strokeOpacity=".3" strokeWidth="5" strokeLinecap="round" />
  </g>
);
const Xicara = () => (
  <g transform="translate(0 6) rotate(8)">
    <path d="M-8 -60 q-8 -12 0 -24 q8 -12 0 -24 M10 -60 q-8 -12 0 -24 q8 -12 0 -24" stroke="#9aa4b2" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".55" />
    <path d="M24 -44 a16 16 0 0 1 0 30" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
    <rect x="-26" y="-56" width="52" height="56" rx="12" fill="#fff" stroke={C.papelSombra} strokeWidth="2" />
    <rect x="-26" y="-34" width="52" height="12" fill={C.azul} />
    <ellipse cx="0" cy="-56" rx="26" ry="6" fill="#6b4a36" />
  </g>
);
const Celular = () => (
  <g transform="translate(0 4)">
    <rect x="-18" y="-70" width="36" height="70" rx="9" fill={C.tinta} />
    <rect x="-14" y="-64" width="28" height="58" rx="5" fill="#9CCBE6" />
    <rect x="-10" y="-56" width="20" height="6" rx="3" fill="#fff" opacity=".9" />
    <rect x="-10" y="-44" width="14" height="5" rx="2.5" fill="#fff" opacity=".7" />
    <circle cx="0" cy="-22" r="7" fill={C.vermelho} opacity=".85" />
  </g>
);
const PapelUrna = () => (
  <g transform="translate(0 2) rotate(10)">
    <rect x="-24" y="-64" width="48" height="64" rx="4" fill={C.papelSombra} transform="translate(3 3)" />
    <rect x="-24" y="-64" width="48" height="64" rx="4" fill="#fff" />
    <rect x="-16" y="-54" width="32" height="6" rx="3" fill={C.tinta} />
    {[-40, -30, -20].map((y) => <rect key={y} x="-16" y={y} width="32" height="4" rx="2" fill="#C9C9C9" />)}
  </g>
);
const GuardaChuva = () => (
  <g>
    <path d="M0 0 L0 -150" stroke={C.tinta} strokeWidth="6" strokeLinecap="round" />
    <path d="M0 0 v8 a9 9 0 0 1 -18 0" stroke={C.tinta} strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M-135 -150 C-125 -255 125 -255 135 -150 Q112 -170 90 -150 Q68 -170 45 -150 Q22 -170 0 -150 Q-22 -170 -45 -150 Q-68 -170 -90 -150 Q-112 -170 -135 -150Z" fill={C.azul} />
    <path d="M-45 -150 C-52 -220 -20 -250 0 -252 C20 -250 52 -220 45 -150 Q22 -170 0 -150 Q-22 -170 -45 -150Z" fill="#fff" opacity=".9" />
    <path d="M-110 -190 C-92 -226 -60 -240 -34 -244" stroke="#fff" strokeOpacity=".3" strokeWidth="6" strokeLinecap="round" fill="none" />
    <circle cx="0" cy="-254" r="6" fill={C.tinta} />
  </g>
);
const Martelo = () => (
  <g transform="rotate(12)">
    <rect x="-5" y="-96" width="10" height="96" rx="4" fill={C.madeira} />
    <rect x="-36" y="-130" width="72" height="38" rx="9" fill={C.madeiraEscura} />
    <rect x="-36" y="-118" width="72" height="8" fill={C.madeira} opacity=".55" />
    <rect x="-40" y="-130" width="8" height="38" rx="3" fill={C.tinta} opacity=".7" />
    <rect x="32" y="-130" width="8" height="38" rx="3" fill={C.tinta} opacity=".7" />
  </g>
);

function Aderecos({ tipo }: { tipo?: Adereco }) {
  switch (tipo) {
    case "lupa": return <Lupa />;
    case "megafone": return <Megafone />;
    case "xicara": return <Xicara />;
    case "celular": return <Celular />;
    case "papel": return <PapelUrna />;
    case "guardaChuva": return <GuardaChuva />;
    case "martelo": return <Martelo />;
    default: return null;
  }
}
/* lupa e megafone acompanham a direção do braço; o resto fica em pé na tela */
const SEGUE: Adereco[] = ["lupa", "megafone"];

function Perna({ giro, quadril, atras, sentada }: { giro: number; quadril: [number, number]; atras?: boolean; sentada?: boolean }) {
  const [x, y] = quadril;
  if (sentada) {
    return (
      <g>
        <path d={`M${x} ${y} L${x + 74} ${y + 8} L${x + 82} ${y + 72}`} stroke={C.perna} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={`M${x + 82} ${y + 72} L${x + 112} ${y + 78} M${x + 82} ${y + 72} L${x + 102} ${y + 88} M${x + 82} ${y + 72} L${x + 68} ${y + 84}`} stroke={C.perna} strokeWidth="7" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  return (
    <g transform={`rotate(${giro} ${x} ${y})`} opacity={atras ? 0.92 : 1}>
      <path d={`M${x} ${y} L${x + 4} ${y + 72} L${x - 4} ${y + 136}`} stroke={C.perna} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M${x - 4} ${y + 136} L${x + 30} ${y + 140} M${x - 4} ${y + 136} L${x + 18} ${y + 150} M${x - 4} ${y + 136} L${x - 20} ${y + 148}`} stroke={C.perna} strokeWidth="7" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Jornal({ x, y, giro, esp }: { x: number; y: number; giro: number; esp?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${esp ? -1 : 1} 1)`}>
      <rect x="-64" y="-50" width="128" height="100" rx="9" fill={C.papelSombra} transform="translate(4 6)" />
      <rect x="-64" y="-50" width="128" height="100" rx="9" fill={C.papel} />
      <path d="M-64 -41 a9 9 0 0 1 9 -9 h110 a9 9 0 0 1 9 9 v16 h-128z" fill={C.tinta} />
      <text x="0" y="-33" textAnchor="middle" fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="600" fontSize="12" letterSpacing="1.8" fill="#fff">VOTO A VOTO</text>
      <rect x="-52" y="-14" width="62" height="10" rx="3" fill={C.tinta} />
      <rect x="-52" y="2" width="42" height="10" rx="3" fill={C.tinta} />
      <rect x="18" y="-14" width="34" height="26" rx="5" fill={C.azul} opacity=".85" />
      {[24, 34, 44].map((yy) => <rect key={yy} x="-52" y={yy} width={yy === 44 ? 58 : 104} height="4" rx="2" fill="#C9C9C9" />)}
    </g>
  );
}

const Rolo = () => (
  <g transform="rotate(-24 300 330)">
    <rect x="236" y="320" width="128" height="26" rx="8" fill={C.papelSombra} transform="translate(3 4)" />
    <rect x="236" y="320" width="128" height="26" rx="8" fill={C.papel} />
    <rect x="236" y="320" width="22" height="26" rx="8" fill={C.tinta} />
    <rect x="278" y="332" width="60" height="4" rx="2" fill="#C9C9C9" />
  </g>
);

/* ---------------------------------------------------------------- cenas */
const SOFAS = {
  azul: { encosto: C.sofaEscuro, assento: C.sofa, almofadaAssento: "#7EA3BD", linha: C.sofaEscuro, frente: C.sofaEscuro, almofada: C.almofada },
  creme: { encosto: "#D9C9A6", assento: "#EFE4CE", almofadaAssento: "#FBF4E4", linha: "#B7A580", frente: "#D9C9A6", almofada: "#E9786B" },
};
type SofaCor = keyof typeof SOFAS;

function CenaTras({ tipo, sofaCor = "azul" }: { tipo?: Cena; sofaCor?: SofaCor }) {
  const sf = SOFAS[sofaCor];
  if (tipo === "sofa")
    return (
      <g>
        <ellipse cx="270" cy="560" rx="270" ry="16" fill={C.tinta} opacity=".14" />
        <rect x="-6" y="250" width="116" height="270" rx="40" fill={sf.encosto} />
        <rect x="-6" y="440" width="540" height="84" rx="34" fill={sf.assento} />
        <rect x="20" y="430" width="470" height="40" rx="20" fill={sf.almofadaAssento} />
        <path d="M40 470 h430" stroke={sf.linha} strokeOpacity=".35" strokeWidth="3" />
        <rect x="64" y="518" width="26" height="40" rx="8" fill={C.tinta} opacity=".75" />
        <rect x="450" y="518" width="26" height="40" rx="8" fill={C.tinta} opacity=".75" />
        <rect x="60" y="300" width="84" height="110" rx="30" fill={sf.almofada} transform="rotate(-8 100 355)" />
      </g>
    );
  if (tipo === "placar")
    return (
      <g>
        <rect x="548" y="236" width="12" height="304" rx="5" fill={C.madeiraEscura} />
        <ellipse cx="554" cy="546" rx="62" ry="10" fill={C.tinta} opacity=".16" />
        <rect x="448" y="16" width="212" height="226" rx="18" fill={C.azulEscuro} />
        <rect x="458" y="26" width="192" height="206" rx="12" fill="#1c4562" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(0 ${i * 48})`}>
            <circle cx="490" cy="64" r="17" fill={i === 3 ? C.vermelho : C.verde} />
            {i === 3 ? (
              <path d="M483 57 L497 71 M497 57 L483 71" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            ) : (
              <path d="M482 64 L488 70 L499 58" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
            <rect x="518" y="58" width={i % 2 ? 100 : 124} height="12" rx="6" fill="#fff" opacity=".85" />
          </g>
        ))}
      </g>
    );
  return null;
}

function CenaFrente({ tipo, esp, sofaCor = "azul" }: { tipo?: Cena; esp?: boolean; sofaCor?: SofaCor }) {
  if (tipo === "sofa") return <rect x="470" y="400" width="86" height="124" rx="38" fill={SOFAS[sofaCor].frente} />;
  if (tipo === "mesa")
    return (
      <g>
        <ellipse cx="520" cy="548" rx="140" ry="12" fill={C.tinta} opacity=".14" />
        <rect x="430" y="346" width="12" height="196" rx="4" fill={C.madeiraEscura} />
        <rect x="596" y="346" width="12" height="196" rx="4" fill={C.madeiraEscura} />
        <rect x="408" y="330" width="224" height="20" rx="9" fill={C.madeira} />
        <rect x="408" y="344" width="224" height="6" rx="3" fill={C.madeiraEscura} opacity=".45" />
        {/* notebook visto de lado: base e tela */}
        <rect x="446" y="314" width="132" height="16" rx="6" fill={C.cinza} />
        <rect x="570" y="206" width="14" height="116" rx="5" fill={C.cinza} transform="rotate(10 577 322)" />
        <circle cx="580" cy="262" r="9" fill="#fff" opacity=".9" transform="rotate(10 577 322)" />
        {/* caneca */}
        <rect x="604" y="300" width="22" height="30" rx="6" fill="#fff" stroke={C.papelSombra} />
      </g>
    );
  if (tipo === "urna")
    return (
      <g>
        <ellipse cx="540" cy="548" rx="100" ry="11" fill={C.tinta} opacity=".16" />
        <rect x="462" y="360" width="156" height="180" rx="16" fill={C.azul} />
        <rect x="462" y="360" width="156" height="34" rx="12" fill={C.azulEscuro} />
        <rect x="496" y="372" width="88" height="10" rx="5" fill="#0c1f2f" />
        <Texto esp={esp} x={540} y={462} textAnchor="middle" fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="700" fontSize="32" letterSpacing="3" fill="#fff">VOTO</Texto>
        <path d="M486 492 H594" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  if (tipo === "pilha")
    return (
      <g>
        <ellipse cx="350" cy="548" rx="150" ry="12" fill={C.tinta} opacity=".16" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={262 + (i % 2 ? 6 : -4) + (i === 4 ? 8 : 0)} y={514 - i * 21} width="200" height="23" rx="5" fill="#fff" stroke="#D9D4C8" strokeWidth="1.5" transform={`rotate(${i % 3 === 0 ? -1.5 : i % 3 === 1 ? 1.2 : 0} 362 ${520 - i * 21})`} />
        ))}
        <rect x="350" y="356" width="40" height="12" rx="4" fill={C.vermelho} />
        <rect x="470" y="250" width="60" height="78" rx="4" fill="#fff" stroke="#D9D4C8" transform="rotate(14 500 290)" />
        <rect x="236" y="214" width="56" height="72" rx="4" fill="#fff" stroke="#D9D4C8" transform="rotate(-16 264 250)" />
      </g>
    );
  if (tipo === "martelo")
    return (
      <g>
        <ellipse cx="520" cy="548" rx="130" ry="11" fill={C.tinta} opacity=".14" />
        <rect x="414" y="452" width="210" height="18" rx="8" fill={C.madeira} />
        <rect x="430" y="468" width="12" height="76" rx="4" fill={C.madeiraEscura} />
        <rect x="596" y="468" width="12" height="76" rx="4" fill={C.madeiraEscura} />
        <rect x="486" y="422" width="82" height="32" rx="8" fill={C.madeiraEscura} />
        <path d="M468 420 l-18 -14 M526 408 v-22 M584 420 l18 -14" stroke={C.azul} strokeWidth="5" strokeLinecap="round" opacity=".8" />
      </g>
    );
  if (tipo === "chuva")
    return (
      <g>
        <ellipse cx="260" cy="548" rx="170" ry="14" fill={C.azul} opacity=".16" />
        {Array.from({ length: 26 }).map((_, i) => {
          const x = (i * 59) % 640;
          const y = (i * 103) % 520 - 60;
          return <path key={i} d={`M${x} ${y} l-9 26`} stroke={C.azul} strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" />;
        })}
      </g>
    );
  if (tipo === "duvida")
    return (
      <g>
        <circle cx="548" cy="-4" r="50" fill="#fff" />
        <path d="M514 34 L502 74 L542 46Z" fill="#fff" />
        <Texto esp={esp} x={548} y={20} textAnchor="middle" fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="700" fontSize="72" fill={C.azul}>?</Texto>
      </g>
    );
  return null;
}

export function MascotePerfil({ pose = "andando", espelho = false, tamanho = 420, className = "", sofaCor = "azul" }: { pose?: PosePerfil; espelho?: boolean; tamanho?: number; className?: string; sofaCor?: SofaCor }) {
  const id = useId().replace(/:/g, "");
  const p = POSES[pose];
  const [ox, oy] = p.olhar;
  const corpo = `url(#${id}-corpo)`;
  const olho = { x: 418, y: 94 };
  const seguir = p.asa.adereco ? SEGUE.includes(p.asa.adereco) : false;

  return (
    <svg className={className} viewBox="-20 -90 700 690" width={tamanho} height={(tamanho * 690) / 700} fill="none" role="img" aria-label="Guará-vermelho, mascote do Voto a Voto">
      <defs>
        <radialGradient id={`${id}-corpo`} cx="40%" cy="25%" r="90%">
          <stop offset="0" stopColor={C.coral} /><stop offset=".5" stopColor={C.base} /><stop offset="1" stopColor={C.fundo} />
        </radialGradient>
        <linearGradient id={`${id}-bico`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#4A4252" /><stop offset="1" stopColor={C.bico} />
        </linearGradient>
        <radialGradient id={`${id}-sombra`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={C.tinta} stopOpacity=".28" /><stop offset="1" stopColor={C.tinta} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-olho`}><circle cx={olho.x} cy={olho.y} r="15" /></clipPath>
      </defs>

      <g transform={espelho ? "translate(620 0) scale(-1 1)" : undefined}>
        {p.cena === "sofa" || p.cena === "placar" ? <CenaTras tipo={p.cena} sofaCor={sofaCor} /> : null}
        {!p.cena?.match(/sofa/) && pose !== "voando" && <ellipse cx="270" cy="548" rx="150" ry="13" fill={`url(#${id}-sombra)`} />}

        <g transform={`translate(0 ${p.dy}) rotate(${p.giroCorpo} 240 340)`}>
          <Perna giro={p.pernas[1]} quadril={[290, 404]} atras sentada={p.sentado} />
          <path d="M126 338 C98 350 78 378 64 404 C100 398 130 386 146 366Z" fill={C.fundo} />
          {p.asaLonge && <AsaErguida giro={p.asa.giro + 26} escala={(p.asa.escala ?? 1) * 0.94} grad={`${id}-corpo`} />}
          <Perna giro={p.pernas[0]} quadril={[240, 404]} sentada={p.sentado} />

          <path d="M118 352 C108 288 186 246 266 252 C344 258 388 300 372 350 C356 398 262 420 186 408 C146 402 124 382 118 352Z" fill={corpo} />
          <ellipse cx="296" cy="352" rx="62" ry="38" fill={C.barriga} opacity=".42" transform="rotate(-8 296 352)" />
          <g stroke="#fff" strokeOpacity=".3" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M276 340 q10 10 20 0 M308 334 q10 10 20 0 M290 366 q10 10 20 0 M322 358 q8 8 16 0" />
          </g>

          {/* pescoço em S, cabeça pequena e bico longo: gira na base do pescoço */}
          <g transform={`rotate(${p.giroCabeca} ${BASE_PESCOCO[0]} ${BASE_PESCOCO[1]})`}>
            <path d={PESCOCO} fill={corpo} />
            <path d="M338 292 C320 240 352 222 358 168" stroke={C.coral} strokeOpacity=".4" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M372 288 C384 244 372 226 374 172" stroke={C.fundo} strokeOpacity=".3" strokeWidth="9" strokeLinecap="round" fill="none" />
            <ellipse cx="404" cy="98" rx="34" ry="30" fill={corpo} />
            <ellipse cx="418" cy="104" rx="21" ry="17" fill={C.rosto} opacity=".8" />
            <path d="M428 84 C470 78 508 106 518 170 C522 198 518 218 512 230 C500 192 470 130 432 112Z" fill={`url(#${id}-bico)`} />
            <path d="M436 88 C466 86 492 106 506 140" stroke={C.bicoLuz} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
            {p.feliz ? (
              <path d="M404 98 Q418 74 434 98" stroke={C.tinta} strokeWidth="7" strokeLinecap="round" fill="none" />
            ) : p.dorme ? (
              <path d="M404 92 Q418 106 434 92" stroke={C.tinta} strokeWidth="6" strokeLinecap="round" fill="none" />
            ) : (
              <g>
                <circle cx={olho.x} cy={olho.y} r="15" fill="#fff" />
                <circle cx={olho.x + ox} cy={olho.y + oy} r="8.5" fill={C.tinta} />
                <circle cx={olho.x + ox + 3} cy={olho.y + oy - 3.5} r="3" fill="#fff" />
                <g clipPath={`url(#${id}-olho)`}><rect x="396" y="76" width="44" height={p.palpebra} fill={C.base} /></g>
                <circle cx={olho.x} cy={olho.y} r="15" fill="none" stroke={C.fundo} strokeOpacity=".25" strokeWidth="1.5" />
                <path d="M402 76 Q418 66 434 78" stroke={C.fundo} strokeOpacity=".75" strokeWidth="5" strokeLinecap="round" fill="none" />
              </g>
            )}
            {p.oculos && (
              <g stroke={C.tinta} strokeWidth="4" fill="#fff" fillOpacity=".25">
                <circle cx={olho.x} cy={olho.y} r="21" />
                <path d="M397 90 L376 84" fill="none" strokeLinecap="round" />
                <path d="M439 100 L444 106" fill="none" strokeLinecap="round" />
              </g>
            )}
          </g>

          {p.rolo && <Rolo />}
          {p.jornal && <Jornal {...p.jornal} esp={espelho} />}

          {p.asa.tipo === "dobrada" ? (
            <AsaDobrada giro={p.asa.giro} grad={`${id}-corpo`} />
          ) : (
            <AsaErguida giro={p.asa.giro} escala={p.asa.escala} dedo={p.asa.dedo} grad={`${id}-corpo`} contra={!seguir}>
              <Aderecos tipo={p.asa.adereco} />
            </AsaErguida>
          )}
        </g>

        <CenaFrente tipo={p.cena} esp={espelho} sofaCor={sofaCor} />
        {p.dorme && (
          <g fill={C.azul} fontFamily="'Geist Sans', system-ui, sans-serif" fontWeight="700">
            <Texto esp={espelho} x={470} y={150} fontSize="40" opacity=".9">z</Texto>
            <Texto esp={espelho} x={505} y={116} fontSize="52" opacity=".75">z</Texto>
            <Texto esp={espelho} x={548} y={74} fontSize="64" opacity=".55">Z</Texto>
          </g>
        )}
        {p.confete &&
          [[90, 150, C.azul], [150, 60, C.base], [430, 40, C.azul], [520, 130, C.base], [70, 300, C.base], [540, 290, C.azul], [270, 20, "#6B7280"]].map(([x, y, cor], i) => (
            <rect key={i} x={x as number} y={y as number} width="12" height="22" rx="3" fill={cor as string} transform={`rotate(${i * 41} ${x} ${y})`} opacity=".9" />
          ))}
      </g>
    </svg>
  );
}
