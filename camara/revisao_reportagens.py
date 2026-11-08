"""Revisao das reportagens pelo Gemini: reescreve com mais detalhe e linguagem simples, A PARTIR DOS DOCUMENTOS.

    python -m camara.revisao_reportagens [id ...]

Para cada reportagens/<id>.md junta as fontes (texto integral de cada projeto em data/texto, oficio de veto,
leis e noticias guardadas em reportagens/fontes/, e a tramitacao tirada dos resumos/painel), pede ao Gemini
um texto novo em JSON onde CADA paragrafo e item traz o trecho literal do documento que o sustenta, e confere
cada trecho no documento. O resultado vai para reportagens/revisao/<id>.md (sempre status: rascunho) e
reportagens/revisao/<id>.conferencia.md (cada frase com a fonte e se o trecho foi achado).

A IA nao e fonte: o texto so vai para o site depois de conferido por gente e aprovado pelo dono do projeto.
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from . import analise as AN
from . import reportagens as RP

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "data"
SAIDA = RP.PASTA / "revisao"
FONTES = RP.PASTA / "fontes"
VERSAO_PROMPT = "2026-11-08"

# arquivos de reportagens/fontes/ que valem para cada reportagem (alem dos projetos e oficios ligados)
FONTES_EXTRAS = {
    "estacionamento-rotativo": ["lei-4451-2026.txt"],
    "remanejamento-orcamento": ["lei-4481-2026.txt", "lei-4487-2026.txt", "noticia-camara-2026-10-21.txt"],
    "emprestimo-caixa": ["noticia-camara-2026-10-21.txt"],
    "bets": ["lei-4484-2026.txt"],
}

PROMPT = """Você escreve para o site "Voto a voto", que explica a Câmara Municipal de Cubatão (SP) para moradores comuns,
muitos com pouca escolaridade. Reescreva a reportagem abaixo deixando-a COMPLETA e DETALHADA, usando SOMENTE os documentos
fornecidos.

COMO ESCREVER
- Português simples, frases curtas (até 20 palavras), voz ativa, como quem explica para um vizinho.
- Toda palavra técnica ou jurídica ganha explicação na primeira vez, entre parênteses ou na frase seguinte
  (ex.: "crédito suplementar (dinheiro a mais para uma despesa que já estava no orçamento)").
- Traga TODOS os detalhes úteis que estão nos documentos: o que muda na prática, para quem, desde quando, valores,
  prazos, exceções, quem decide o quê, o que fica para decreto ou regulamento, garantias, riscos que o próprio texto
  aponta, o que o autor disse na justificativa (sempre atribuindo: "Segundo o prefeito..."), o que diz o veto, o que
  ainda não foi definido e o que acontece a seguir.
- Exemplo concreto só quando sair direto do documento. Não invente números, ruas, preços, datas ou nomes.
- Sem opinião, sem adjetivo sobre pessoas, sem dizer se o projeto é bom ou ruim, sem "polêmico", sem torcida.
- NÃO liste como cada vereador votou nem nomes de quem votou a favor ou contra: o site mostra isso ao lado, direto do
  dado oficial. Pode citar o placar e a data que estão na TRAMITAÇÃO.
- Entre 700 e 1300 palavras no corpo.

ESTRUTURA SUGERIDA (use só as seções que os documentos permitem preencher; pode renomear):
"Em poucas palavras", "O que muda na prática", "Quem é afetado", "De onde sai o dinheiro / quanto custa",
"O que ainda não foi definido", "O que o autor disse para justificar", "Como foi a votação", "O que acontece agora",
"Palavras difíceis" (glossário curto).

PROVA (obrigatório)
- Cada parágrafo e cada item de lista tem "fontes": uma lista com {{"doc": <id do documento>, "trecho": <cópia LITERAL
  de 8 a 40 palavras do documento, sem mudar nenhuma letra>}} que sustenta o que foi dito.
- Explicação de palavra difícil (glossário) pode ficar sem fonte só se for definição geral, sem fato sobre Cubatão.
- Se um fato não está nos documentos, não escreva.

FORMATO DA RESPOSTA: só JSON, assim:
{{"manchete": "até 80 caracteres, no estilo do site: o impacto direto na vida do morador, como ele sentiria (ex.: 'Estacionar na rua vai ser pago em parte de Cubatão a partir de 2027', 'Prefeito pode mexer em até 19% do orçamento sem pedir nova lei à Câmara'); fato verdadeiro, sem acusação nem adjetivo",
  "linha_fina": "até 200 caracteres",
  "blocos": [
    {{"tipo": "h", "texto": "Título da seção"}},
    {{"tipo": "p", "texto": "Parágrafo.", "fontes": [{{"doc": "...", "trecho": "..."}}]}},
    {{"tipo": "ul", "itens": [{{"texto": "Item.", "fontes": [{{"doc": "...", "trecho": "..."}}]}}]}}
  ],
  "lacunas": ["o que os documentos não respondem e o morador gostaria de saber"]}}

REPORTAGEM ATUAL (rascunho a melhorar):
{atual}

DOCUMENTOS (id entre colchetes):
{docs}
"""


def _n(t: str) -> str:
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[“”\"'´`‘’]", "", t)
    t = re.sub(r"-\s*\n\s*", "", t)          # palavra quebrada no fim da linha do PDF
    return re.sub(r"[^a-z0-9%$]+", " ", t).strip()


def _texto_por_url(idx: dict, url: str | None) -> str:
    if not url:
        return ""
    meta = idx.get(url) or next((m for u, m in idx.items() if u.rstrip("/") == url.rstrip("/")), None)
    sha = str((meta or {}).get("sha256") or "")
    if not AN.RE_SHA256.match(sha):
        return ""
    for suf in (".ocr.txt", ".txt"):
        p = DADOS / "texto" / f"{sha}{suf}"
        if p.exists() and len(p.read_text("utf-8").strip()) > 200:
            return p.read_text("utf-8")
    return ""


def _tramitacao(m: dict, votacoes: list[dict]) -> str:
    linhas = [f"{m['titulo']}: {m['assunto']}", f"Autoria: {m['autoria']}", f"Situação: {m['situacao']}"]
    if m.get("lei"):
        linhas.append(f"Virou a Lei {m['lei']['numero']}, publicada em {m['lei']['data']}")
    for ev in votacoes:
        if ev["materia"] != m["slug"]:
            continue
        placar = f", {ev['sim']} votos Sim e {ev['nao']} votos Não" if ev.get("sim") is not None else ""
        sentido = " (nesta votação, votar Sim era ser contra o projeto)" if ev.get("sentido") == "inverso" else ""
        linhas.append(f"{ev['data']}: {ev['etapa_txt']}, resultado {ev.get('resultado') or 'sem resultado registrado'}"
                      f"{placar}{sentido}. {ev.get('detalhe') or ''}".strip())
    return "\n".join(linhas)


def montar_fontes(rid: str, projetos: list[str]) -> dict[str, str]:
    """{id do documento: texto}. Dado do site (dados.json) + data/texto + reportagens/fontes."""
    pacote = json.loads((RAIZ / "docs" / "data" / "dados.json").read_text("utf-8"))
    mats = {m["slug"]: m for m in pacote["materias"]}
    idx = json.loads((DADOS / "indice.json").read_text("utf-8"))
    docs: dict[str, str] = {}
    for slug in projetos:
        m = mats[slug]
        docs[f"tramitacao-{slug}"] = _tramitacao(m, pacote["votacoes"])
        t = _texto_por_url(idx, m.get("documento"))
        if t:
            docs[f"projeto-{slug}"] = t
        if m.get("veto") and m["veto"].get("url"):
            tv = _texto_por_url(idx, m["veto"]["url"])
            if tv:
                docs[f"veto-{slug}"] = tv
    for arq in FONTES_EXTRAS.get(rid, []):
        docs[Path(arq).stem] = (FONTES / arq).read_text("utf-8")
    return docs


def _ocr_se_faltar(projetos: list[str], http) -> None:
    """Projeto escaneado sem texto (ex.: PL 190/2025): transcreve o PDF uma vez (fica em data/texto/<sha>.ocr.txt)."""
    pacote = json.loads((RAIZ / "docs" / "data" / "dados.json").read_text("utf-8"))
    mats = {m["slug"]: m for m in pacote["materias"]}
    idx = json.loads((DADOS / "indice.json").read_text("utf-8"))
    for slug in projetos:
        url = mats[slug].get("documento")
        meta = idx.get(url or "")
        if not meta or _texto_por_url(idx, url) or (meta.get("paginas") or 0) > 40:
            continue
        try:
            AN.transcrever_pdf(DADOS, url, meta["sha256"], http=http)
            print(f"  OCR de {slug}: ok")
        except Exception as e:  # noqa: BLE001
            print(f"  OCR de {slug} falhou: {e}")


def _gemini(prompt: str, http) -> tuple[str, str]:
    from .cabecalho import GEMINI

    chave = os.environ["GEMINI_API_KEY"]
    r = http.get(f"{GEMINI}/models", params={"pageSize": 200}, headers={"x-goog-api-key": chave}, timeout=30)
    r.raise_for_status()
    nomes = [x["name"].split("/", 1)[1] for x in r.json().get("models", [])
             if "generateContent" in x.get("supportedGenerationMethods", [])]
    estaveis = [n for n in nomes if not re.search(r"preview|exp|image|tts|live|audio|embedding|pro", n)]
    chave_ord = lambda n: [int(x) for x in re.findall(r"\d+", n)]  # noqa: E731
    ordem = sorted((n for n in estaveis if re.search(r"flash$|flash-latest$", n)), key=chave_ord, reverse=True) + \
        sorted((n for n in estaveis if "flash-lite" in n), key=chave_ord, reverse=True)
    if os.environ.get("MODELO_GEMINI"):
        ordem.insert(0, os.environ["MODELO_GEMINI"])
    corpo = {"contents": [{"parts": [{"text": prompt}]}],
             "generationConfig": {"temperature": 0.3, "response_mime_type": "application/json"}}
    erros = []
    for modelo in ordem[:4]:
        r = http.post(f"{GEMINI}/models/{modelo}:generateContent", headers={"x-goog-api-key": chave}, json=corpo, timeout=300)
        if r.status_code != 200:
            erros.append(f"{modelo}: HTTP {r.status_code}")
            continue
        try:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"], modelo
        except Exception:  # noqa: BLE001
            erros.append(f"{modelo}: sem texto")
    raise RuntimeError("Gemini: " + " | ".join(erros))


def conferir(saida: dict, docs: dict[str, str]) -> tuple[list[dict], list[dict]]:
    """Devolve (blocos no formato do site, relatorio). Bloco sem nenhum trecho achado sai do texto."""
    base = {k: _n(v) for k, v in docs.items()}
    blocos, rel = [], []

    def checa(fontes) -> list[dict]:
        out = []
        for f in fontes or []:
            doc, trecho = str(f.get("doc") or ""), str(f.get("trecho") or "")
            tn = _n(trecho)
            achou = bool(tn) and len(tn) >= 15 and doc in base and tn in base[doc]
            if not achou and len(tn) >= 15:  # citou o documento errado mas o trecho existe em outro
                doc2 = next((k for k, v in base.items() if tn in v), None)
                if doc2:
                    doc, achou = doc2, True
            out.append({"doc": doc, "trecho": trecho, "achou": achou})
        return out

    titulo_atual = ""
    for b in saida.get("blocos") or []:
        tipo = b.get("tipo")
        if tipo == "h":
            titulo_atual = str(b.get("texto") or "").strip()
            blocos.append({"t": "h", "x": titulo_atual})
        elif tipo == "p":
            txt = str(b.get("texto") or "").strip()
            fs = checa(b.get("fontes"))
            glossario = re.search(r"(?i)palavras dif|gloss", titulo_atual)
            ok = any(f["achou"] for f in fs) or (glossario and not fs)
            rel.append({"secao": titulo_atual, "texto": txt, "fontes": fs, "mantido": bool(ok)})
            if txt and ok:
                blocos.append({"t": "p", "x": txt})
        elif tipo == "ul":
            itens = []
            for it in b.get("itens") or []:
                txt = str(it.get("texto") or "").strip()
                fs = checa(it.get("fontes"))
                glossario = re.search(r"(?i)palavras dif|gloss", titulo_atual)
                ok = any(f["achou"] for f in fs) or (glossario and not fs)
                rel.append({"secao": titulo_atual, "texto": txt, "fontes": fs, "mantido": bool(ok)})
                if txt and ok:
                    itens.append(txt)
            if itens:
                blocos.append({"t": "ul", "x": itens})
    # titulo sem nada embaixo sai
    limpos = [b for i, b in enumerate(blocos) if b["t"] != "h" or (i + 1 < len(blocos) and blocos[i + 1]["t"] != "h")]
    return limpos, rel


def _md_corpo(blocos: list[dict]) -> str:
    partes = []
    for b in blocos:
        if b["t"] == "h":
            partes.append(f"## {b['x']}")
        elif b["t"] == "p":
            partes.append(b["x"])
        else:
            partes.append("\n".join(f"- {x}" for x in b["x"]))
    return "\n\n".join(partes) + "\n"


def revisar(rid: str, http=None) -> dict:
    import requests

    http = http or requests
    arq = RP.PASTA / f"{rid}.md"
    r = RP.ler(arq)
    _ocr_se_faltar(r["projetos"], http)
    docs = montar_fontes(rid, r["projetos"])
    atual = arq.read_text("utf-8").split("\n---\n", 1)[1]
    lista = "\n\n".join(f"[{k}]\n{v.strip()}" for k, v in docs.items())
    prompt = PROMPT.format(atual=f"Manchete: {r['manchete']}\nLinha fina: {r['linha_fina']}\n\n{atual}", docs=lista)
    bruto, modelo = _gemini(prompt, http)
    saida = AN._json(bruto)
    blocos, rel = conferir(saida, docs)

    # links de documento que ja estavam no texto (secao Documentos) continuam
    docs_md = re.search(r"(?s)## Documentos\n(.*)$", atual)
    corpo = _md_corpo(blocos) + (f"\n## Documentos\n{docs_md.group(1).rstrip()}\n" if docs_md else "")
    cab = arq.read_text("utf-8").split("\n---\n", 1)[0] + "\n"
    cab = re.sub(r"(?m)^status: .*$", "status: rascunho", cab)
    # manchete e linha fina ficam as do arquivo (escolha editorial do dono do projeto); a sugestao vai pra conferencia
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / f"{rid}.md").write_text(cab + "---\n" + corpo, "utf-8")

    ok = sum(1 for x in rel if x["mantido"])
    linhas = [f"# Conferência: {rid}", "",
              f"Modelo: {modelo} · prompt {VERSAO_PROMPT} · documentos: {', '.join(docs)}",
              f"Frases mantidas: {ok} de {len(rel)} (sem trecho achado no documento = fora do texto).", "",
              f"Sugestão de manchete (não aplicada): {saida.get('manchete', '')}",
              f"Sugestão de linha fina (não aplicada): {saida.get('linha_fina', '')}", ""]
    for x in rel:
        linhas.append(f"- {'OK ' if x['mantido'] else 'FORA'} [{x['secao']}] {x['texto']}")
        for f in x["fontes"]:
            linhas.append(f"    - {'achado' if f['achou'] else 'NAO ACHADO'} em `{f['doc']}`: \"{f['trecho']}\"")
    if saida.get("lacunas"):
        linhas += ["", "## O que os documentos não respondem", *[f"- {l}" for l in saida["lacunas"]]]
    (SAIDA / f"{rid}.conferencia.md").write_text("\n".join(linhas) + "\n", "utf-8")
    print(f"  {rid}: {ok}/{len(rel)} frases conferidas ({modelo})")
    return {"id": rid, "mantidas": ok, "total": len(rel), "modelo": modelo}


def main(ids: list[str]) -> None:
    import time

    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("sem GEMINI_API_KEY")
    alvos = ids or [p.stem for p in sorted(RP.PASTA.glob("*.md")) if not p.name.upper().startswith("LEIA")]
    for rid in alvos:
        revisar(rid)
        time.sleep(5)


if __name__ == "__main__":
    main(sys.argv[1:])
