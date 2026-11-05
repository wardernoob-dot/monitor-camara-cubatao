import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** true depois que o elemento entra na tela (uma vez so). */
export function useEntrou<T extends Element>(margem = "-15% 0px") {
  const ref = useRef<T>(null);
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || entrou) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setEntrou(true), { rootMargin: margem });
    io.observe(el);
    return () => io.disconnect();
  }, [entrou, margem]);
  return [ref, entrou] as const;
}

/** Laco de animacao num canvas que para quando sai da tela, quando a aba some e sob reduced-motion. */
/** desenha() devolve false quando terminou (para o laco ate a proxima mudanca em deps). */
export function useLacoCanvas(desenha: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void | boolean, ativo = true, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduz = useReducedMotion();
  const desenhaRef = useRef(desenha);
  desenhaRef.current = desenha;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visivel = true;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const ajusta = () => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajusta();
    const quadro = () => {
      const r = cv.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      const segue = desenhaRef.current(ctx, r.width, r.height, t);
      t++;
      if (segue !== false && !reduz && ativo && visivel && !document.hidden) raf = requestAnimationFrame(quadro);
    };
    const io = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visivel) raf = requestAnimationFrame(quadro);
    });
    io.observe(cv);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visivel) raf = requestAnimationFrame(quadro);
    };
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(() => { ajusta(); if (reduz || !ativo) quadro(); });
    ro.observe(cv);
    quadro();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduz, ativo, ...deps]);
  return ref;
}

/** Numero que rola de 0 ate o alvo quando aparece. */
export function useContador(alvo: number, ligado: boolean, ms = 1200) {
  const reduz = useReducedMotion();
  const [v, setV] = useState(reduz ? alvo : 0);
  useEffect(() => {
    if (reduz) return setV(alvo);
    if (!ligado) return;
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ligado, ms, reduz]);
  return v;
}
