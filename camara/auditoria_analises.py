"""Auditoria das analises de projeto: um segundo modelo le o documento e a analise e aponta frase errada,
sem base no texto, exagerada ou confusa, com o trecho do documento que mostra o problema e uma correcao.

    python -m camara.auditoria_analises [CHAVE ...]      (ex.: PL-092-2026)

Grava auditoria/<chave>.json. Nada e corrigido sozinho: quem decide e aplica e gente, com o documento na mao.
Tambem roda uma conferencia sem IA: todo numero (valor, percentual, prazo) da analise tem que aparecer no documento.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from . import analise as AN
from . import revisao_reportagens as RV

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "data"
SAIDA = RAIZ / "auditoria"

PROMPT = """Você é revisor de um site de transparência da Câmara de Cubatão (SP). Abaixo estão o DOCUMENTO oficial
de um projeto e a ANÁLISE em linguagem simples que outro modelo escreveu sobre ele. Confira a análise frase por frase
contra o documento e aponte SÓ os problemas reais:
- "errado": contradiz o documento (número, prazo, quem faz o quê, o que a lei permite ou proíbe)
- "sem_base": afirma algo que não está no documento
- "exagero": vai além do que o documento diz (ex.: "obriga" quando o texto "autoriza"; "remanejar" quando é "crédito suplementar")
- "confuso": a explicação simples ficou errada ou enganosa para um leigo
Não aponte estilo, nem frase correta. Se não houver problema, devolva lista vazia.

Responda só JSON:
{{"problemas": [{{"campo": "resumo|o_que_muda|quem_e_afetado|de_onde_sai_o_dinheiro|o_que_falta_definir|justificativa_do_autor|pontos_de_atencao|palavras_dificeis",
  "frase": "cópia exata da frase da análise", "tipo": "errado|sem_base|exagero|confuso",
  "explicacao": "por que está errado, em 1 frase", "trecho_documento": "cópia literal do documento que mostra o certo (ou \\"\\" se o documento não fala disso)",
  "correcao": "frase corrigida, simples, fiel ao documento (ou \\"\\" para apagar a frase)"}}]}}

ANÁLISE:
{analise}

DOCUMENTO ({fonte}):
{documento}
"""

RE_NUM = re.compile(r"(?:R\$\s*)?\d[\d.,]*\s*(?:%|por cento|dias|meses|anos|horas|minutos|milh[õo]es|mil)?")


def numeros_sem_base(analise: dict, texto: str) -> list[dict]:
    """Numero citado na analise que nao aparece no documento (nem por extenso simples)."""
    doc = RV._n(texto)
    doc_digitos = re.sub(r"[^0-9]", " ", texto)
    out = []

    def frases():
        for campo in ("resumo", "quem_e_afetado", "de_onde_sai_o_dinheiro", "justificativa_do_autor"):
            if analise.get(campo):
                yield campo, analise[campo]
        for campo in ("o_que_muda", "o_que_falta_definir"):
            for x in analise.get(campo) or []:
                yield campo, x
        for p in analise.get("pontos_de_atencao") or []:
            yield "pontos_de_atencao", p.get("ponto", "")

    for campo, f in frases():
        for n in re.findall(r"\d+(?:[.,]\d+)*", f):
            limpo = n.replace(".", "").replace(",", "")
            if len(limpo) < 2 and n not in ("1", "2", "3", "4", "5", "6", "7", "8", "9"):
                continue
            if len(limpo) == 1:
                continue  # numeros de 1 digito aparecem por extenso no texto oficial; deixa pro revisor
            achou = re.search(rf"(?<!\d){re.escape(limpo)}(?!\d)", re.sub(r"[.,]", "", doc_digitos)) or n in texto
            if not achou and not re.search(rf"\b{re.escape(n)}\b", doc):
                out.append({"campo": campo, "frase": f, "numero": n})
    return out


def auditar(chave: str, http) -> dict:
    a = json.loads((DADOS / "analises" / f"{chave}.json").read_text("utf-8"))
    mt = a["materia"]
    doc = AN.documento(DADOS, mt["tipo"], mt["numero"], mt.get("ano"), mt.get("ementa"))
    if not doc or doc.get("so_ementa"):
        return {"chave": chave, "pulado": "sem texto integral"}
    prompt = PROMPT.format(analise=json.dumps(a["analise"], ensure_ascii=False, indent=1), fonte=doc["fonte"],
                           documento=doc["texto"])
    bruto, modelo = RV._gemini(prompt, http)
    saida = AN._json(bruto)
    base = RV._n(doc["texto"])
    probs = []
    for p in saida.get("problemas") or []:
        t = str(p.get("trecho_documento") or "")
        p["trecho_achado"] = bool(t) and RV._n(t) in base
        probs.append(p)
    res = {"chave": chave, "modelo": modelo, "versao_prompt_analise": a.get("versao_prompt"),
           "problemas": probs, "numeros_sem_base": numeros_sem_base(a["analise"], doc["texto"])}
    SAIDA.mkdir(exist_ok=True)
    (SAIDA / f"{chave}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), "utf-8")
    print(f"  {chave}: {len(probs)} problema(s), {len(res['numeros_sem_base'])} numero(s) sem base ({modelo})")
    return res


def main(chaves: list[str]) -> None:
    import requests

    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("sem GEMINI_API_KEY")
    _, versao = AN._prompt()
    alvos = chaves or sorted(p.stem for p in (DADOS / "analises").glob("*.json")
                             if json.loads(p.read_text("utf-8")).get("versao_prompt") == versao)
    pausa = float(os.environ.get("PAUSA", "12"))
    for k in alvos:
        for tentativa in range(3):
            try:
                auditar(k, requests)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  ! {k} (tentativa {tentativa + 1}): {e!r}"[:200])
                if "429" not in str(e):
                    break
                time.sleep(60 * (tentativa + 1))  # cota por minuto do Gemini
        time.sleep(pausa)


if __name__ == "__main__":
    main(sys.argv[1:])
