// Filtros das tabelas: votos do vereador e lista de projetos. Sem dependências.
(function () {
  function semAcento(t) { return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  document.querySelectorAll("[data-filtro-alvo]").forEach(function (grupo) {
    var tabela = document.getElementById(grupo.dataset.filtroAlvo);
    if (!tabela) return;
    grupo.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-filtro]");
      if (!b) return;
      grupo.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var f = b.dataset.filtro;
      tabela.querySelectorAll("tbody tr").forEach(function (tr) {
        var v = tr.dataset.voto, ok = f === "todos" || (f === "nao" && v === "nao") || (f === "contra" && tr.dataset.contra) ||
          (f === "semvoto" && (v === "branco" || v === "ausente"));
        tr.hidden = !ok;
      });
    });
  });

  document.querySelectorAll("form[data-busca]").forEach(function (form) {
    var tabela = document.getElementById(form.dataset.busca);
    if (!tabela) return;
    var linhas = Array.prototype.slice.call(tabela.querySelectorAll("tbody tr"));
    linhas.forEach(function (tr) { tr._t = semAcento(tr.textContent); });
    var contagem = form.querySelector("[data-contagem]");
    function aplicar() {
      var q = semAcento(form.q.value).trim().split(/\s+/).filter(Boolean);
      var autor = form.autor.value, sit = form.sit.value, n = 0;
      linhas.forEach(function (tr) {
        var ok = (!autor || tr.dataset.autor === autor) && (!sit || tr.dataset.sit === sit) &&
          q.every(function (p) { return tr._t.indexOf(p) >= 0; });
        tr.hidden = !ok;
        if (ok) n++;
      });
      if (contagem) contagem.textContent = n;
    }
    form.addEventListener("input", aplicar);
    form.addEventListener("change", aplicar);
    var p = new URLSearchParams(location.search);
    if (p.get("autor")) { form.autor.value = p.get("autor"); aplicar(); }
  });
})();
