"""Explicacao em linguagem simples de cada materia, para a dica que aparece ao passar o mouse.

So reescreve a ementa oficial (e a autoria): nao acrescenta fato. Vai em lote (ate 20 por chamada)
pro Gemini no plano gratuito; cache por hash da ementa em data/explicacoes.json.
Projetos com analise completa (camara/analise.py) usam o resumo da analise, que e conferido com o texto.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path

LOTE = 20
PROMPT = """Você vai reescrever, em linguagem simples, a descrição oficial de proposições da Câmara Municipal de Cubatão (SP)
para moradores sem formação jurídica.

REGRAS
- Use SOMENTE o texto de cada item. Não acrescente fatos, números, nomes ou consequências que não estejam ali.
- 1 ou 2 frases, no máximo 40 palavras por item. Frases curtas, sem juridiquês; explique siglas se aparecerem.
- Comece pelo que a proposição faz ("Cria...", "Muda...", "Pede à Prefeitura...", "Homenageia...").
- Não diga se é bom ou ruim.
- Se a descrição estiver cortada ou confusa demais para entender, responda exatamente: "A descrição oficial está incompleta."
- Responda só com JSON: {"itens": [{"id": "...", "texto": "..."}]}

ITENS
"""


def _hash(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()[:12]


def _gemini(prompt: str, http) -> tuple[str, str]:
    from .cabecalho import GEMINI, _modelos_gemini

    chave = os.environ["GEMINI_API_KEY"]
    corpo = {"contents": [{"parts": [{"text": prompt}]}],
             "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}}
    erros = []
    for modelo in _modelos_gemini(chave, http)[:5]:
        r = http.post(f"{GEMINI}/models/{modelo}:generateContent", params={"key": chave}, json=corpo, timeout=180)
        if r.status_code != 200:
            erros.append(f"{modelo}: HTTP {r.status_code}")
            continue
        try:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"], modelo
        except Exception:  # noqa: BLE001
            erros.append(f"{modelo}: sem texto")
    raise RuntimeError("Gemini: " + " | ".join(erros))


def carregar(dados: Path) -> dict:
    p = Path(dados) / "explicacoes.json"
    return json.loads(p.read_text("utf-8")) if p.exists() else {}


def gerar(dados: Path, itens: list[dict], limite: int = 200, pausa: float = 4.0, http=None) -> dict:
    """itens: [{id, tipo, titulo, autoria, ementa}] -> atualiza data/explicacoes.json {id: {hash, texto, modelo}}."""
    import requests

    dados = Path(dados)
    cache = carregar(dados)
    pend = [i for i in itens if i.get("ementa") and len(i["ementa"]) > 20
            and cache.get(i["id"], {}).get("hash") != _hash(i["ementa"])][:limite]
    rel = {"novas": 0, "erros": []}
    if not pend or not os.environ.get("GEMINI_API_KEY"):
        print(f"  explicacoes: {len(pend)} pendente(s), {'sem chave' if pend else 'nada a fazer'}")
        return rel
    http = http or requests
    for n in range(0, len(pend), LOTE):
        lote = pend[n:n + LOTE]
        texto = PROMPT + "\n".join(
            json.dumps({"id": i["id"], "tipo": i["tipo"], "titulo": i["titulo"], "autoria": i.get("autoria") or "",
                        "descricao_oficial": i["ementa"]}, ensure_ascii=False) for i in lote)
        try:
            if n:
                time.sleep(pausa)
            bruto, modelo = _gemini(texto, http)
            t = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto.strip())
            resp = {x["id"]: str(x.get("texto") or "").strip() for x in json.loads(t[t.find("{"): t.rfind("}") + 1])["itens"]}
        except Exception as e:  # noqa: BLE001
            rel["erros"].append(repr(e)[:200])
            print(f"  ! explicacoes: {e!r}"[:200])
            continue
        for i in lote:
            txt = resp.get(i["id"], "")
            if not txt or len(txt.split()) > 60:
                continue
            cache[i["id"]] = {"hash": _hash(i["ementa"]), "texto": txt, "modelo": modelo}
            rel["novas"] += 1
    (dados / "explicacoes.json").write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True), "utf-8")
    print(f"  explicacoes: {rel['novas']} nova(s); {len(rel['erros'])} erro(s)")
    return rel
