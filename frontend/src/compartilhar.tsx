import { useState } from "react";

/** Endereço de compartilhamento: página estática com prévia (foto, título) que redireciona para o app.
 *  tipo: "r" reportagem, "v" vereador, "p" projeto. Funciona no Surge e no GitHub Pages. */
export function enderecoDeCompartilhar(tipo: "r" | "v" | "p", id: string): string {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
  return `${base}${tipo}/${id}/`;
}

export function Compartilhar({ tipo, id, titulo }: { tipo: "r" | "v" | "p"; id: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = enderecoDeCompartilhar(tipo, id);
  const copiar = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch { /* a pessoa cancelou ou o navegador bloqueou: o link do WhatsApp ao lado continua valendo */ }
  };
  return (
    <div className="compartilhar">
      <span className="compartilhar__rot">Compartilhar</span>
      <a className="compartilhar__botao compartilhar__botao--zap" href={`https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <button type="button" className="compartilhar__botao" onClick={copiar}>{copiado ? "Link copiado" : "Copiar link"}</button>
      <span className="sr" role="status">{copiado ? "Link copiado" : ""}</span>
    </div>
  );
}
