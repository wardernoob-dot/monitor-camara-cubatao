import type { CSSProperties } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/* Identidade visual: o guará-vermelho e a paisagem de Cubatão (Serra do Mar, manguezal e água).
   O vermelho do guará (--guara) é só da ilustração e da marca. Os vermelhos de "não", veto e falta continuam sendo os de estado. */

/** Guará em pé (marca). */
export function Guara({ tamanho = 28, className = "" }: { tamanho?: number; className?: string }) {
  return (
    <svg className={`guara ${className}`} viewBox="0 0 48 48" width={tamanho} height={tamanho} fill="none" aria-hidden="true">
      <path d="M12 31l-8 5" stroke="var(--guara)" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="22" cy="29" rx="12" ry="7.4" transform="rotate(-10 22 29)" fill="var(--guara)" />
      <path d="M29 24c7-1 8-9 5-13" stroke="var(--guara)" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="34.4" cy="9.6" r="2.7" fill="var(--guara)" />
      <path d="M36.4 10.6c4.6.2 7.2 3 8.2 8" stroke="var(--guara-bico)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 36l-1 9M25 36.4l1 8.6" stroke="var(--guara-bico)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 26c3 1 6 1 8-1" stroke="var(--guara-ponta)" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/** Guará em voo; as asas batem por CSS (.guara-asa). */
export function GuaraVoo({ tamanho = 48, atraso = 0, className = "", style }: { tamanho?: number; atraso?: number; className?: string; style?: CSSProperties }) {
  const est = { ["--atraso" as string]: `${atraso}s` } as CSSProperties;
  return (
    <svg className={`guara-voo ${className}`} viewBox="0 0 64 40" width={tamanho} height={(tamanho * 40) / 64} fill="none" aria-hidden="true" style={{ ...est, ...style }}>
      <path d="M22 22.5L6 27" stroke="var(--guara-bico)" strokeWidth="1.3" strokeLinecap="round" />
      <g className="guara-asa guara-asa--longe">
        <path d="M31 21C27 14 21 9 12 7c3 6 7 12 14 16z" fill="var(--guara-sombra)" />
      </g>
      <ellipse cx="32" cy="22" rx="11" ry="3.8" fill="var(--guara)" />
      <path d="M41 21c7 0 10-2 12-6" stroke="var(--guara)" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="53.4" cy="14.4" r="2" fill="var(--guara)" />
      <path d="M55 14.8c3.4.4 5 2.6 5.6 5.4" stroke="var(--guara-bico)" strokeWidth="1.4" strokeLinecap="round" />
      <g className="guara-asa">
        <path d="M30 21C25 13 19 8 9 5c3 7 8 14 16 18z" fill="var(--guara)" />
        <path d="M9 5c5 1.6 8.6 4.2 11 7.600C16 10.4 12.6 8 9 5z" fill="var(--guara-ponta)" />
      </g>
    </svg>
  );
}

/* Serra do Mar: cordilheiras geradas por ruído determinístico (sempre iguais). Cada camada tem cumes naturais e some na neblina. */
function sorteio(semente: number) {
  let a = semente | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ruido(semente: number, escala: number) {
  const r = sorteio(semente);
  const pts = Array.from({ length: Math.ceil(1440 / escala) + 3 }, () => r());
  return (x: number) => {
    const u = x / escala;
    const i = Math.floor(u);
    const f = u - i;
    const s = f * f * (3 - 2 * f);
    return pts[i] * (1 - s) + pts[i + 1] * s;
  };
}
function cordilheira(semente: number, base: number, amp: number, sela?: { x: number; fundo: number; larg: number }, detalhe = 1) {
  const n1 = ruido(semente, 300), n2 = ruido(semente + 1, 120), n3 = ruido(semente + 2, 46);
  const cume = (v: number) => 1 - Math.abs(2 * v - 1);
  let d = "M0 300";
  for (let x = 0; x <= 1440; x += 6) {
    let y = base - amp * (0.55 * cume(n1(x)) + 0.3 * cume(n2(x)) + 0.15 * detalhe * n3(x));
    if (sela) y += sela.fundo * Math.exp(-(((x - sela.x) / sela.larg) ** 2));
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L1440 300Z`;
}
const SERRAS = [
  cordilheira(11, 236, 44, { x: 1010, fundo: 30, larg: 130 }),
  cordilheira(23, 256, 22, undefined, 0.2),
];

/** Paisagem do hero: Serra do Mar ao fundo, manguezal, água e guarás. Camadas em paralaxe com a rolagem. */
export function Paisagem() {
  const reduz = useReducedMotion();
  const { scrollY } = useScroll();
  const longe = useTransform(scrollY, [0, 600], [0, 36]);
  const meio = useTransform(scrollY, [0, 600], [0, 70]);
  const aves = useTransform(scrollY, [0, 600], [0, -40]);
  const p = (m: typeof longe) => (reduz ? undefined : { y: m });

  return (
    <div className="paisagem" aria-hidden="true">
      <svg className="paisagem__svg" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" fill="none">
        <defs>
          <radialGradient id="sol-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--sol-halo)" stopOpacity=".85" />
            <stop offset=".45" stopColor="var(--sol-halo)" stopOpacity=".3" />
            <stop offset="1" stopColor="var(--sol-halo)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--m1)" />
            <stop offset=".85" stopColor="var(--neblina)" stopOpacity=".95" />
          </linearGradient>
          <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--m3)" />
            <stop offset=".85" stopColor="var(--base-frente)" />
          </linearGradient>
        </defs>
        <circle cx="1010" cy="234" r="150" fill="url(#sol-halo)" opacity=".7" />
        <circle cx="1010" cy="236" r="32" fill="var(--sol)" />
        <g className="lua-crateras" fill="#8fa0c8" fillOpacity=".28">
          <circle cx="1001" cy="226" r="6" /><circle cx="1019" cy="222" r="4" /><circle cx="1011" cy="242" r="8" />
        </g>
        <motion.g style={p(longe)}>
          <path d={SERRAS[0]} fill="url(#m1)" />
        </motion.g>
        <motion.g style={p(meio)}>
          <path d={SERRAS[1]} fill="url(#m3)" />
        </motion.g>
      </svg>
      <motion.div className="paisagem__aves" style={reduz ? undefined : { y: aves }}>
        <GuaraVoo tamanho={44} atraso={0} className="ave ave--1" />
        <GuaraVoo tamanho={30} atraso={-0.35} className="ave ave--2" />
        <GuaraVoo tamanho={36} atraso={-0.7} className="ave ave--3" />
        <GuaraVoo tamanho={28} atraso={-0.2} className="ave ave--4" />
        <GuaraVoo tamanho={32} atraso={-0.55} className="ave ave--5" />
      </motion.div>
    </div>
  );
}
