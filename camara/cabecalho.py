"""Identifica O QUE esta em votacao lendo o cabecalho do painel.

O texto do cabecalho tem ~5 px de altura nas miniaturas: OCR comum nao le, modelo de visao le.
Uma chamada por sessao: todos os cabecalhos ampliados numa tira so.
O modelo SO transcreve texto; o voto de cada vereador continua vindo da cor do pixel.
A transcricao e conferida por regex; o que nao passar fica marcado como nao identificado.

Backend: API do Gemini (plano gratuito, chave em GEMINI_API_KEY). O GitHub Models foi desativado em 30/07/2026.
"""
from __future__ import annotations

import base64
import io
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw

MODELO = "gemini"  # preenchido com o modelo que efetivamente respondeu

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
RE_TURNO = re.compile(r"[12]\s*[ªaº°o]\s*Discuss[ãa]o|Discuss[ãa]o [ÚU]nica|Reda[çc][ãa]o Final", re.I)
RE_PARECER = re.compile(r"Parecer\s+(?:em\s+(?:Conjunto|Separado)\s+)?(Favor[áa]vel|Contr[áa]rio)(?:\s+em\s+Separado)?", re.I)
# "Emenda ao PL nº 27/2026", "Veto Parcial ao PL nº 60/2025": a materia de referencia
RE_REF = re.compile(r"\b(PLC|PL|PR|PDL|PELOM)\s*n?[º°o]?\.?\s*(\d[\d\.]{0,6})\s*/\s*(\d{4})", re.I)
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


GEMINI = "https://generativelanguage.googleapis.com/v1beta"
PREFERENCIA = ["flash-lite", "flash"]  # modelos gratuitos e baratos; Pro e geracao de imagem sao pagos


def _modelos_gemini(chave: str, http) -> list[str]:
    """Pergunta a API quais modelos existem (evita depender de nome que muda)."""
    fixo = os.environ.get("MODELO_GEMINI")
    r = http.get(f"{GEMINI}/models", params={"key": chave, "pageSize": 200}, timeout=30)
    r.raise_for_status()
    nomes = [m["name"].split("/", 1)[1] for m in r.json().get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    estaveis = [n for n in nomes if not re.search(r"preview|exp|image|tts|live|audio|embedding|pro", n)]
    ordem = []
    for pref in PREFERENCIA:
        cand = sorted((n for n in estaveis if n.endswith(pref) or f"-{pref}-" in n or n.endswith(f"{pref}-latest")),
                      key=lambda n: [int(x) for x in re.findall(r"\d+", n)], reverse=True)
        ordem += [c for c in cand if c not in ordem]
    return ([fixo] if fixo else []) + ordem


def transcrever(png: bytes, n: int, chave: str | None = None, http=None) -> list[dict]:
    """Transcreve os cabecalhos via Gemini (plano gratuito). Tenta os modelos disponiveis em ordem."""
    import requests

    chave = chave or os.environ.get("GEMINI_API_KEY")
    if not chave:
        raise RuntimeError("sem GEMINI_API_KEY (secret do repositorio)")
    http = http or requests
    corpo = {
        "contents": [{"parts": [
            {"text": PROMPT.format(n=n)},
            {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(png).decode()}},
        ]}],
        "generationConfig": {"temperature": 0, "response_mime_type": "application/json"},
    }
    erros = []
    for modelo in _modelos_gemini(chave, http)[:5]:
        r = http.post(f"{GEMINI}/models/{modelo}:generateContent", params={"key": chave}, json=corpo, timeout=120)
        if r.status_code != 200:
            erros.append(f"{modelo}: HTTP {r.status_code} {r.text[:120]}")
            continue
        try:
            texto = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:  # noqa: BLE001
            erros.append(f"{modelo}: resposta sem texto {r.text[:120]}")
            continue
        global MODELO
        MODELO = modelo
        return _faixas(texto)
    raise RuntimeError("nenhum modelo Gemini respondeu: " + " | ".join(erros)[:400])


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
           "autor": None, "ref": None, "identificado": False}
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
    if out["tipo"] in ("EMENDA", "VETO") and (m := RE_REF.search(t)):
        out["ref"] = {"tipo": m.group(1).upper(), "numero": m.group(2).rstrip("."), "ano": m.group(3)}
        if out["tipo"] == "VETO" and not out["numero"]:
            out["numero"], out["ano"] = out["ref"]["numero"], out["ref"]["ano"]
    if m := RE_TURNO.search(t):
        out["turno"] = m.group(0)
    if m := RE_AUTOR.search(t):
        out["autor"] = m.group(1).strip()
    out["identificado"] = bool(out["tipo"] and (out["numero"] or out["ref"] or out["tipo"] in ("RELATÓRIO", "RELATORIO")))
    return out


def identificar(cabecalhos: list[np.ndarray], chave: str | None = None, pausa: float = 4.0) -> list[dict]:
    """Uma chamada pra todos os cabecalhos da sessao; faixa que voltar vazia ganha uma segunda
    chamada sozinha e mais ampliada (na 35a as duas vieram vazias com o texto legivel)."""
    import time

    if not cabecalhos:
        return []
    faixas = transcrever(tira(cabecalhos), len(cabecalhos), chave)
    por_n = {int(f.get("n", 0)): f for f in faixas}
    res = []
    for i, c in enumerate(cabecalhos, 1):
        f = por_n.get(i, {})
        tentativa = 1
        if not (f.get("em_votacao") or "").strip():
            time.sleep(pausa)  # plano gratuito: limite de requisicoes por minuto
            try:
                f = (transcrever(tira([c], escala=5), 1, chave) or [{}])[0]
                tentativa = 2
            except Exception:  # noqa: BLE001
                pass
        res.append({
            "situacao_lida": (f.get("situacao") or "").upper() or None,
            "sessao_lida": f.get("sessao") or None,
            **interpretar(f.get("em_votacao", "")),
            "tentativas": tentativa,
            "fonte": f"transcricao do cabecalho do painel por modelo de visao ({MODELO}, API Gemini)",
        })
    return res
