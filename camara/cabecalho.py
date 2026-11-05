"""Identifica O QUE esta em votacao lendo o cabecalho do painel.

O texto do cabecalho tem ~5 px de altura nas miniaturas: OCR comum nao le, modelo de visao le.
Uma chamada por sessao: todos os cabecalhos ampliados numa tira so.
O modelo SO transcreve texto; o voto de cada vereador continua vindo da cor do pixel.
A transcricao e conferida por regex; o que nao passar fica marcado como nao identificado.

Backend: GitHub Models (gratuito no Actions com o GITHUB_TOKEN e a permissao `models: read`).
"""
from __future__ import annotations

import base64
import io
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw

ENDPOINT = "https://models.github.ai/inference/chat/completions"
MODELO = os.environ.get("MODELO_CABECALHO", "openai/gpt-4.1")

PROMPT = (
    "A imagem tem {n} faixas numeradas, cada uma com o cabecalho de um painel de votacao da "
    "Camara Municipal de Cubatao. Para cada faixa, transcreva exatamente:\n"
    "- 'situacao': a palavra colorida no topo (APROVADO ou REJEITADO), ou vazio se nao houver;\n"
    "- 'sessao': a linha do meio (ex.: '37ª SESSÃO');\n"
    "- 'em_votacao': o texto completo que vem depois de 'Em votação:'.\n"
    "Transcreva letra por letra, sem corrigir, completar ou adivinhar. Se um trecho estiver "
    "ilegivel, escreva [?] no lugar dele.\n"
    'Responda so com JSON: {{"faixas": [{{"n": 1, "situacao": "", "sessao": "", "em_votacao": ""}}]}}'
)

RE_TIPO = re.compile(
    r"\b(PLC|PL|PR|PDL|PELOM|RQ|Requerimento|Mo[çc][ãa]o|Veto|Relat[óo]rio(?: Final)?|Parecer|"
    r"Of[íi]cio|Emenda|Indica[çc][ãa]o)\b\.?", re.I)
RE_NUM = re.compile(r"^\W*(?:n[º°o]?\.?\s*)?(\d[\d\.]{0,6})(?:\s*/\s*(\d{4}))?", re.I)
RE_TURNO = re.compile(r"(1ª|2ª|[12]\s*[ªa°o])\s*Discuss[ãa]o|Discuss[ãa]o [ÚU]nica|Reda[çc][ãa]o Final", re.I)
RE_PARECER = re.compile(r"Parecer\s+(Favor[áa]vel|Contr[áa]rio)(?:\s+em\s+Separado)?", re.I)
RE_AUTOR = re.compile(r"Autor(?:ia)?\s*:\s*(.+)$", re.I)
TIPO_CANON = {"requerimento": "RQ", "rq": "RQ", "pl": "PL", "plc": "PLC", "pr": "PR", "pdl": "PDL",
              "pelom": "PELOM", "veto": "VETO", "parecer": "PARECER", "emenda": "EMENDA",
              "oficio": "OFICIO", "ofício": "OFICIO"}


def tira(cabecalhos: list[np.ndarray], escala: int = 3) -> bytes:
    """Empilha os cabecalhos (cortes 32x300 das miniaturas) ampliados e numerados. Retorna PNG."""
    faixas = []
    for c in cabecalhos:
        im = Image.fromarray(c.astype(np.uint8))
        faixas.append(im.resize((im.width * escala, im.height * escala), Image.LANCZOS))
    w = max(f.width for f in faixas)
    rot = 18
    out = Image.new("RGB", (w, sum(f.height + rot for f in faixas)), (255, 255, 255))
    d = ImageDraw.Draw(out)
    y = 0
    for i, f in enumerate(faixas, 1):
        d.text((4, y + 2), f"FAIXA {i}", fill=(200, 0, 0))
        out.paste(f, (0, y + rot))
        y += f.height + rot
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def corte_cabecalho(miniatura: np.ndarray) -> np.ndarray:
    return miniatura[14:46, 10:310]


def transcrever(png: bytes, n: int, token: str | None = None, http=None) -> list[dict]:
    import requests

    token = token or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("sem GITHUB_TOKEN para o GitHub Models")
    http = http or requests
    corpo = {
        "model": MODELO,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT.format(n=n)},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(png).decode()}},
        ]}],
    }
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json",
               "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"}
    url, trilha = ENDPOINT, []
    for _ in range(4):  # segue redirect mantendo POST e corpo (requests transformaria em GET)
        r = http.post(url, json=corpo, timeout=120, headers=headers, allow_redirects=False)
        trilha.append(f"{r.status_code} {url}")
        if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
            from urllib.parse import urljoin
            url = urljoin(url, r.headers["location"])
            continue
        break
    if r.status_code == 200 and not r.headers.get("content-type", "").startswith("application/json"):
        raise RuntimeError(f"GitHub Models respondeu sem JSON ({' -> '.join(trilha)}; "
                           f"content-type={r.headers.get('content-type')}): {r.text[:120]!r}")
    if r.status_code != 200:
        raise RuntimeError(f"GitHub Models HTTP {r.status_code}: {r.text[:200]}")
    try:
        texto = r.json()["choices"][0]["message"]["content"] or ""
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"resposta inesperada do GitHub Models: {r.text[:300]!r}") from e
    return _faixas(texto)


def _faixas(texto: str) -> list[dict]:
    """Aceita JSON puro, JSON dentro de bloco ```json``` ou com texto em volta."""
    t = texto.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    ini, fim = t.find("{"), t.rfind("}")
    if ini < 0 or fim < 0:
        raise RuntimeError(f"modelo nao devolveu JSON: {texto[:300]!r}")
    faixas = json.loads(t[ini:fim + 1]).get("faixas", [])
    return sorted(faixas, key=lambda f: int(f.get("n", 0)))


def interpretar(em_votacao: str) -> dict:
    """Texto transcrito -> campos estruturados (ou marca como nao identificado)."""
    t = re.sub(r"\s+", " ", em_votacao or "").strip(" -")
    out = {"texto": t, "tipo": None, "numero": None, "ano": None, "turno": None, "parecer": None,
           "autor": None, "identificado": False}
    if not t or "[?]" in t:
        return out
    if m := RE_PARECER.search(t):
        out["parecer"] = m.group(0)
    tipos = list(RE_TIPO.finditer(t))
    # "Parecer ... ao PL n 53/2026": a materia e o PL; o parecer fica anotado a parte
    principal = next((m for m in tipos if not m.group(1).lower().startswith("parecer")), tipos[0] if tipos else None)
    if principal:
        k = principal.group(1).lower()
        k = "moção" if k.startswith("mo") else ("relatório" if k.startswith("relat") else k)
        out["tipo"] = TIPO_CANON.get(k, k.upper().replace("Ç", "C").replace("Ã", "A").replace("Ó", "O"))
        resto = t[principal.end():]
        if k.startswith("relat"):
            resto = resto[resto.lower().find("resolu"):] if "resolu" in resto.lower() else resto
            resto = re.sub(r"^\D*", "", resto)
        if m := RE_NUM.search(resto):
            out["numero"], out["ano"] = m.group(1).rstrip("."), m.group(2)
    if m := RE_TURNO.search(t):
        out["turno"] = m.group(0)
    if m := RE_AUTOR.search(t):
        out["autor"] = m.group(1).strip()
    out["identificado"] = bool(out["tipo"] and (out["numero"] or out["tipo"] in ("RELATÓRIO", "RELATORIO")))
    return out


def identificar(cabecalhos: list[np.ndarray], token: str | None = None) -> list[dict]:
    """Uma chamada pra todos os cabecalhos da sessao. Devolve, por votacao, transcricao + campos."""
    if not cabecalhos:
        return []
    faixas = transcrever(tira(cabecalhos), len(cabecalhos), token)
    por_n = {int(f.get("n", 0)): f for f in faixas}
    res = []
    for i in range(1, len(cabecalhos) + 1):
        f = por_n.get(i, {})
        res.append({
            "situacao_lida": (f.get("situacao") or "").upper() or None,
            "sessao_lida": f.get("sessao") or None,
            **interpretar(f.get("em_votacao", "")),
            "fonte": f"transcricao do cabecalho do painel por modelo de visao ({MODELO} via GitHub Models)",
        })
    return res


def diagnostico(token: str | None = None) -> None:
    """Imprime o que o GitHub Models responde (catalogo + chamada minima so com texto)."""
    import requests

    token = token or os.environ.get("GITHUB_TOKEN")
    h = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
         "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"}
    try:
        r = requests.get("https://models.github.ai/catalog/models", headers=h, timeout=30)
        print(f"  [diag] catalogo: {r.status_code} {r.headers.get('content-type')}")
        if r.ok and r.headers.get("content-type", "").startswith("application/json"):
            vis = [m["id"] for m in r.json() if "image" in json.dumps(m.get("supported_input_modalities", "")).lower()]
            print(f"  [diag] modelos com imagem: {vis[:15]}")
        else:
            print(f"  [diag] corpo: {r.text[:200]!r}")
    except Exception as e:  # noqa: BLE001
        print(f"  [diag] catalogo erro: {e!r}")
    for url in ["https://models.github.ai/inference/chat/completions",
                "https://models.inference.ai.azure.com/chat/completions"]:
        for modelo in ["openai/gpt-4.1-mini", "gpt-4o-mini"]:
            try:
                r = requests.post(url, headers=h, timeout=60, json={
                    "model": modelo, "messages": [{"role": "user", "content": "Responda apenas: ok"}]})
                print(f"  [diag] {url} {modelo}: {r.status_code} {r.headers.get('content-type')} {r.text[:160]!r}")
            except Exception as e:  # noqa: BLE001
                print(f"  [diag] {url} {modelo}: erro {e!r}")
