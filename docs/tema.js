// Aplica o tema salvo antes da primeira pintura, para a página não piscar. Arquivo próprio porque o CSP bloqueia script inline.
try {
  var t = localStorage.getItem("votoavoto-tema");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-tema", t);
} catch (e) { /* sem localStorage: segue o sistema */ }
