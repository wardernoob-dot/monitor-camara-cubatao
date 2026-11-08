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

/** Paisagem do hero: Serra do Mar ao fundo, manguezal, água e guarás. Camadas em paralaxe com a rolagem. */
export function Paisagem() {
  const reduz = useReducedMotion();
  const { scrollY } = useScroll();
  const longe = useTransform(scrollY, [0, 600], [0, 36]);
  const meio = useTransform(scrollY, [0, 600], [0, 70]);
  const perto = useTransform(scrollY, [0, 600], [0, 110]);
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
        </defs>
        <circle cx="1010" cy="190" r="210" fill="url(#sol-halo)" />
        <circle cx="1010" cy="190" r="46" fill="var(--sol)" />
        <g className="lua-crateras" fill="#8fa0c8" fillOpacity=".28">
          <circle cx="994" cy="176" r="9" /><circle cx="1024" cy="170" r="6" /><circle cx="1012" cy="196" r="12" /><circle cx="988" cy="200" r="5" />
        </g>
        <motion.g style={p(longe)}>
          <path transform="translate(0 300) scale(1 .62) translate(0 -300)" d="M0 150 C80 120 140 96 210 112 C290 130 330 70 420 64 C520 58 560 108 650 120 C740 132 790 84 880 80 C980 76 1020 128 1110 132 C1210 136 1260 92 1340 98 C1390 102 1420 118 1440 124 V300 H0Z" fill="var(--serra-3)" />
        </motion.g>
        <motion.g style={p(meio)}>
          <path transform="translate(0 300) scale(1 .62) translate(0 -300)" d="M0 196 C90 170 170 150 260 166 C360 184 420 132 520 128 C620 124 680 176 780 176 C880 176 940 132 1040 136 C1150 140 1210 184 1320 176 C1380 172 1415 160 1440 156 V300 H0Z" fill="var(--serra-2)" />
        </motion.g>
        <motion.g style={p(perto)}>
          <path d="M0 232 C60 222 110 214 160 220 C200 202 250 198 292 214 C334 196 392 196 430 216 C480 204 540 204 580 222 C640 206 700 206 742 222 C800 204 870 206 914 224 C972 208 1036 208 1078 224 C1130 208 1196 210 1236 226 C1300 214 1370 214 1440 230 V300 H0Z" fill="var(--mangue)" />
        </motion.g>
      </svg>
      <motion.div className="paisagem__aves" style={reduz ? undefined : { y: aves }}>
        <GuaraVoo tamanho={58} atraso={0} className="ave ave--1" />
        <GuaraVoo tamanho={40} atraso={-0.35} className="ave ave--2" />
        <GuaraVoo tamanho={46} atraso={-0.7} className="ave ave--3" />
        <GuaraVoo tamanho={30} atraso={-0.2} className="ave ave--4" />
        <GuaraVoo tamanho={34} atraso={-0.55} className="ave ave--5" />
      </motion.div>
    </div>
  );
}
