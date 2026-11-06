"""Analise imparcial de cada projeto votado, feita por modelo de linguagem SO com o documento oficial.

- Entrada: texto do projeto (PDF do site da Camara) ou, se o PDF e imagem, so a ementa da pauta.
- Votos e nomes NAO entram: a analise e do conteudo, nunca de quem votou.
- Prompt publico em prompts/analise.md.
- Cada ponto de atencao traz um trecho literal; trecho que nao existe no documento derruba o ponto.
- Cache por materia + hash do documento + versao do prompt: so chama o modelo de novo se o texto mudar.

Backend: Claude (ANTHROPIC_API_KEY) se existir; senao Gemini no plano gratuito (GEMINI_API_KEY).
O modelo que efetivamente gerou fica gravado e aparece no post.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from .textclean import flat, normalize, strip_accents

RAIZ = Path(__file__).resolve().parent.parent
TIPOS_ANALISADOS = ("PL", "PLC", "PR", "PDL", "PELOM", "VETO")
NATUREZAS = {"homenagem_ou_data", "politica_publica", "orcamento_financas", "organizacao_administrativa",
             "tributos", "funcionamento_da_camara", "outro"}
MAX_DOC = 14000
RE_URL_PROJ = re.compile(r"/(PLC|PL|PR|PDL|PELOM)(?:%20|[ _\-.])*0*(\d{1,4})[.\-_](\d{4})", re.I)
RE_VETO_TIT = re.compile(r"VETO (INTEGRAL|PARCIAL|TOTAL) AO PROJETO DE LEI N\S?\s*0*(\d{1,4})/(\d{4})", re.I)
RE_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _prompt() -> tuple[str, str]:
    txt = (RAIZ / "prompts" / "analise.md").read_text("utf-8")
    corpo = txt.split("\n---\n", 1)[1].strip()
    return corpo, hashlib.sha256(corpo.encode()).hexdigest()[:10]


def _n(t: str) -> str:
    """Normaliza pra conferir trecho literal: sem acento, minusculo, so letras/digitos."""
    t = strip_accents(t or "").lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


# ---------------------------------------------------------------- documento oficial

def documento(dados: Path, tipo: str, numero: str, ano: str | None, ementa: str | None) -> dict:
    """Acha o PDF da materia no indice; devolve {texto, fonte, url, so_ementa}."""
    dados = Path(dados)
    achado = _pdf_da_materia(dados, tipo, numero, ano)
    if achado and RE_SHA256.match(achado.get("sha256") or ""):
        for arq, fonte in ((f"{achado['sha256']}.txt", "texto integral do projeto publicado no site da Camara"),
                           (f"{achado['sha256']}.ocr.txt", "texto integral do projeto (transcricao automatica do PDF escaneado)")):
            p = dados / "texto" / arq
            if p.exists() and (arq.endswith(".ocr.txt") or not achado.get("precisa_ocr")):
                t = flat(normalize(p.read_text("utf-8")))
                if len(t) > 300:
                    return {"texto": t[:MAX_DOC], "fonte": fonte, "url": achado["url"], "so_ementa": False}
    if not ementa:
        return {}
    return {"texto": ementa, "fonte": "somente a ementa publicada na pauta (o PDF do projeto e imagem escaneada)",
            "url": achado["url"] if achado else None, "so_ementa": True}


# ---------------------------------------------------------------- OCR do PDF escaneado

PROMPT_OCR = ("Transcreva literalmente todo o texto deste documento oficial, na ordem, sem resumir, "
              "sem corrigir e sem comentar. Ignore carimbos e assinaturas. Responda so com o texto.")
# Resumo de sessao: o parser le a lista de presenca como uma linha "NOME STATUS" por vereador.
# Tabela com barras ou nome e status em linhas separadas fazem o parser nao achar a lista.
PROMPT_OCR_RESUMO = (PROMPT_OCR + " Na lista de presenca dos vereadores, escreva uma linha por vereador no formato "
                     "NOME STATUS (por exemplo: EDSON MENEZES MOTA SIM, ou JAIR FERREIRA LUCAS JUSTIFICADA), sem tabela, "
                     "sem barras verticais e sem cabecalho de coluna.")
MAX_PDF = 15 * 1024 * 1024


def transcrever_pdf(dados: Path, url: str, sha: str, http=None, prompt: str = PROMPT_OCR) -> bool:
    """PDF escaneado -> data/texto/<sha>.ocr.txt via Gemini (uma vez por documento)."""
    import base64

    import requests

    from .cabecalho import GEMINI, _modelos_gemini

    if not RE_SHA256.match(sha or ""):
        raise ValueError(f"sha256 invalido: {sha!r}")
    p_url = urlparse(url or "")
    if p_url.scheme not in ("https", "http") or p_url.hostname != "www.cubatao.sp.leg.br":
        raise ValueError(f"URL de PDF fora do dominio da Camara: {url!r}")
    texto_dir = (Path(dados) / "texto").resolve()
    destino = (texto_dir / f"{sha}.ocr.txt").resolve()
    if not destino.is_relative_to(texto_dir):
        raise ValueError(f"caminho invalido: {destino}")
    if destino.exists() or not os.environ.get("GEMINI_API_KEY"):
        return destino.exists()
    http = http or requests
    pdf = http.get(url, timeout=120, headers={"User-Agent": "monitor-camara-cubatao"})
    pdf.raise_for_status()
    url_final = getattr(pdf, "url", None)
    if url_final:
        p_fin = urlparse(str(url_final))
        if p_fin.scheme not in ("https", "http") or p_fin.hostname != "www.cubatao.sp.leg.br":
            raise ValueError(f"Redirecionamento externo bloqueado em transcrever_pdf: {url_final!r}")
    if len(pdf.content) > MAX_PDF:
        return False
    chave = os.environ["GEMINI_API_KEY"]
    corpo = {"contents": [{"parts": [{"text": prompt},
                                     {"inline_data": {"mime_type": "application/pdf",
                                                      "data": base64.b64encode(pdf.content).decode()}}]}],
             "generationConfig": {"temperature": 0}}
    for modelo in _modelos_gemini(chave, http)[:3]:
        r = http.post(f"{GEMINI}/models/{modelo}:generateContent", headers={"x-goog-api-key": chave},
                      json=corpo, timeout=300)
        if r.status_code == 200:
            try:
                t = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
            except Exception:  # noqa: BLE001
                continue
            if len(t) > 300:
                destino.write_text(t, "utf-8")
                return True
    return False


def transcrever_resumos(dados: Path, http=None) -> dict:
    """Resumos de sessao escaneados -> data/texto/<sha>.ocr.txt. Comando manual (python -m camara ocr-resumos).

    O resultado NAO entra no site sozinho: uma pessoa confere o .ocr.txt contra o PDF e so entao commita.
    """
    dados = Path(dados)
    indice = json.loads((dados / "indice.json").read_text("utf-8"))
    rel = {"transcritos": [], "ja_existiam": [], "falhas": []}
    for m in indice.values():
        if m["secao"] != "resumo" or not m.get("precisa_ocr"):
            continue
        existia = (dados / "texto" / f"{m['sha256']}.ocr.txt").exists()
        try:
            ok = transcrever_pdf(dados, m["url"], m["sha256"], http, prompt=PROMPT_OCR_RESUMO)
        except Exception as e:  # noqa: BLE001
            rel["falhas"].append(f"{m['titulo']}: {e!r}"[:200])
            continue
        (rel["ja_existiam"] if existia else rel["transcritos"] if ok else rel["falhas"]).append(m["titulo"])
    return rel


def _pdf_da_materia(dados: Path, tipo: str, numero: str, ano: str | None) -> dict | None:
    idx = json.loads((Path(dados) / "indice.json").read_text("utf-8"))
    for m in idx.values():
        if m["secao"] != "projetos":
            continue
        if tipo == "VETO":
            mv = RE_VETO_TIT.search(m.get("titulo") or "")
            if mv and mv.group(2) == numero and (not ano or mv.group(3) == ano):
                return m
        elif (mu := RE_URL_PROJ.search(m["url"])) and mu.group(1).upper() == tipo and mu.group(2) == numero \
                and (not ano or mu.group(3) == ano):
            return m
    return None


# ---------------------------------------------------------------- modelos

def _gemini(prompt: str, http) -> tuple[str, str]:
    from .cabecalho import GEMINI, _modelos_gemini

    chave = os.environ["GEMINI_API_KEY"]
    corpo = {"contents": [{"parts": [{"text": prompt}]}],
             "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}}
    erros = []
    for modelo in _modelos_gemini(chave, http)[:5]:
        r = http.post(f"{GEMINI}/models/{modelo}:generateContent", headers={"x-goog-api-key": chave},
                      json=corpo, timeout=180)
        if r.status_code != 200:
            erros.append(f"{modelo}: HTTP {r.status_code}")
            continue
        try:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"], f"Gemini ({modelo})"
        except Exception:  # noqa: BLE001
            erros.append(f"{modelo}: sem texto")
    raise RuntimeError("Gemini: " + " | ".join(erros))


def _claude(prompt: str, http) -> tuple[str, str]:
    modelo = os.environ.get("MODELO_CLAUDE", "claude-haiku-5-5")
    r = http.post("https://api.anthropic.com/v1/messages", timeout=180, json={
        "model": modelo, "max_tokens": 1500, "temperature": 0.2,
        "messages": [{"role": "user", "content": prompt}]},
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"})
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json()["content"]), f"Claude ({modelo})"


def gerar(prompt: str, http=None) -> tuple[str, str]:
    import requests

    http = http or requests
    if os.environ.get("ANTHROPIC_API_KEY"):
        return _claude(prompt, http)
    if os.environ.get("GEMINI_API_KEY"):
        return _gemini(prompt, http)
    raise RuntimeError("sem ANTHROPIC_API_KEY nem GEMINI_API_KEY")


# ---------------------------------------------------------------- conferencia da saida

def _json(texto: str) -> dict:
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto.strip())
    return json.loads(t[t.find("{"): t.rfind("}") + 1])


def conferir(saida: dict, doc: dict) -> dict:
    """Mantem so o formato esperado; derruba ponto cujo trecho nao esta no documento."""
    base = _n(doc["texto"])
    out = {
        "resumo": str(saida.get("resumo") or "").strip(),
        "o_que_muda": [str(x).strip() for x in (saida.get("o_que_muda") or []) if str(x).strip()][:4],
        "quem_e_afetado": str(saida.get("quem_e_afetado") or "").strip(),
        "justificativa_do_autor": str(saida.get("justificativa_do_autor") or "").strip(),
        "natureza": saida.get("natureza") if saida.get("natureza") in NATUREZAS else "outro",
        "limitacoes": str(saida.get("limitacoes") or "").strip(),
        "pontos_de_atencao": [], "pontos_descartados": [],
    }
    for p in saida.get("pontos_de_atencao") or []:
        ponto, trecho = str(p.get("ponto") or "").strip(), str(p.get("trecho") or "").strip()
        if not ponto:
            continue
        tn = _n(trecho)
        if trecho and len(tn) >= 12 and tn in base:
            out["pontos_de_atencao"].append({"ponto": ponto, "trecho": trecho})
        elif not trecho and _n(ponto).startswith("o texto nao") and not doc["so_ementa"]:
            out["pontos_de_atencao"].append({"ponto": ponto, "trecho": ""})  # ausencia: so vale com texto integral
        else:
            out["pontos_descartados"].append({"ponto": ponto, "trecho": trecho, "motivo": "trecho nao encontrado no documento"})
    out["pontos_de_atencao"] = out["pontos_de_atencao"][:4]
    if doc["so_ementa"]:
        out["justificativa_do_autor"] = ""
        out["limitacoes"] = out["limitacoes"] or "Analise feita so com a ementa: o texto integral do projeto esta em PDF escaneado."
    if not out["resumo"]:
        raise ValueError("modelo nao devolveu resumo")
    return out


# ---------------------------------------------------------------- orquestracao

def chave_materia(tipo: str, numero: str, ano: str | None) -> str:
    if not re.match(r"^[A-Z]{2,10}$", str(tipo or "")):
        raise ValueError(f"tipo invalido: {tipo!r}")
    ano_limpo = re.sub(r"[^0-9]", "", str(ano or ""))[:4] or "sem-ano"
    return f"{tipo}-{int(numero):03d}-{ano_limpo}"


def analisar_tudo(dados: Path, limite: int = 15, limite_ocr: int = 10, pausa: float = 4.0, http=None) -> dict:
    """Analisa as materias votadas que aparecem no consolidado e ainda nao tem analise valida."""
    dados = Path(dados)
    pasta = (dados / "analises").resolve()
    pasta.mkdir(exist_ok=True)
    corpo, versao = _prompt()
    rel = {"novas": 0, "em_cache": 0, "sem_documento": 0, "ocr": 0, "erros": []}
    vistas = set()
    for arq in sorted((dados / "consolidado").glob("*.json"), reverse=True):  # mais recentes primeiro
        for m in json.loads(arq.read_text("utf-8"))["materias"]:
            if m["tipo"] not in TIPOS_ANALISADOS or m["tipo"] == "VETO" or not m.get("numero") or not m["votacoes"]:
                continue  # vetos: analisar_vetos(), com prompt proprio
            k = chave_materia(m["tipo"], m["numero"], m.get("ano"))
            if k in vistas:
                continue
            vistas.add(k)
            pdf = _pdf_da_materia(dados, m["tipo"], m["numero"], m.get("ano"))
            if pdf and pdf.get("precisa_ocr") and rel["ocr"] < limite_ocr:
                try:
                    if transcrever_pdf(dados, pdf["url"], pdf["sha256"], http):
                        rel["ocr"] += 1
                        time.sleep(pausa)
                except Exception as e:  # noqa: BLE001
                    rel["erros"].append(f"ocr {k}: {e!r}"[:200])
            doc = documento(dados, m["tipo"], m["numero"], m.get("ano"), m.get("assunto"))
            if not doc or doc["so_ementa"]:
                # so a ementa (PDF escaneado sem transcricao ainda): nao analisa; a ementa da pauta as vezes
                # vem cortada (PL 79/2026: "REGULAMENTADOS PELA CVM") e o modelo teria que adivinhar
                rel["sem_documento"] += 1
                continue
            h = hashlib.sha256(doc["texto"].encode()).hexdigest()[:16]
            saida = (pasta / f"{k}.json").resolve()
            if not saida.is_relative_to(pasta):
                continue
            if saida.exists():
                antigo = json.loads(saida.read_text("utf-8"))
                if antigo.get("hash_documento") == h and antigo.get("versao_prompt") == versao:
                    rel["em_cache"] += 1
                    continue
            if rel["novas"] >= limite:
                continue
            bloco_doc = (
                "<documento_oficial>\n"
                f"{m['tipo']} {m['numero']}/{m.get('ano') or ''} - Autoria: {m.get('autoria') or 'nao informada'}\n"
                f"Ementa: {m.get('assunto') or ''}\n\n{doc['texto']}\n"
                "</documento_oficial>"
            )
            prompt = corpo.replace("{fonte}", doc["fonte"]).replace("{documento}", bloco_doc)
            try:
                if rel["novas"]:
                    time.sleep(pausa)
                texto, modelo = gerar(prompt, http)
                res = conferir(_json(texto), doc)
            except Exception as e:  # noqa: BLE001
                rel["erros"].append(f"{k}: {e!r}"[:200])
                print(f"  ! analise {k}: {e!r}"[:200])
                continue
            saida.write_text(json.dumps({
                "materia": {"tipo": m["tipo"], "numero": m["numero"], "ano": m.get("ano"),
                            "autoria": m.get("autoria"), "ementa": m.get("assunto")},
                "documento": {"fonte": doc["fonte"], "url": doc["url"], "so_ementa": doc["so_ementa"]},
                "analise": res, "modelo": modelo, "versao_prompt": versao, "hash_documento": h,
                "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }, ensure_ascii=False, indent=1), "utf-8")
            rel["novas"] += 1
            print(f"  analise: {k} ({modelo}); {len(res['pontos_descartados'])} ponto(s) descartado(s)")
    print(f"  analises: {rel['novas']} nova(s), {rel['em_cache']} em cache, {rel['sem_documento']} sem documento, "
          f"{rel['ocr']} PDF(s) transcrito(s), {len(rel['erros'])} erro(s)")
    return rel


def carregar(dados: Path, tipo: str, numero: str, ano: str | None) -> dict | None:
    if tipo not in TIPOS_ANALISADOS:  # ex.: RQ (requerimento) nao tem analise; chave_materia segue recusando tipo estranho
        return None
    pasta = (Path(dados) / "analises").resolve()
    p = (pasta / f"{chave_materia(tipo, numero, ano)}.json").resolve()
    if not p.is_relative_to(pasta):
        raise ValueError(f"caminho de analise invalido: {p}")
    return json.loads(p.read_text("utf-8")) if p.exists() else None


# ---------------------------------------------------------------- oficios de veto

FUNDAMENTOS = {"competencia_ou_iniciativa", "inconstitucionalidade", "custo_ou_orcamento", "interesse_publico",
               "tecnica_ou_redacao", "outro"}


def _prompt_veto() -> tuple[str, str]:
    txt = (RAIZ / "prompts" / "veto.md").read_text("utf-8")
    corpo = txt.split("\n---\n", 1)[1].strip()
    return corpo, hashlib.sha256(corpo.encode()).hexdigest()[:10]


def conferir_veto(saida: dict, texto: str) -> dict:
    base = _n(texto)
    out = {
        "resumo": str(saida.get("resumo") or "").strip(),
        "o_que_foi_vetado": [str(x).strip() for x in (saida.get("o_que_foi_vetado") or []) if str(x).strip()][:6],
        "fundamento": saida.get("fundamento") if saida.get("fundamento") in FUNDAMENTOS else "outro",
        "limitacoes": str(saida.get("limitacoes") or "").strip(),
        "razoes": [], "razoes_descartadas": [],
    }
    for r in saida.get("razoes") or []:
        razao, trecho = str(r.get("razao") or "").strip(), str(r.get("trecho") or "").strip()
        if razao and trecho and _n(trecho) and _n(trecho) in base:
            out["razoes"].append({"razao": razao, "trecho": trecho})
        elif razao:
            out["razoes_descartadas"].append({"razao": razao, "trecho": trecho, "motivo": "trecho nao encontrado no oficio"})
    out["razoes"] = out["razoes"][:5]
    if not out["resumo"]:
        raise ValueError("modelo nao devolveu resumo do veto")
    return out


def analisar_vetos(dados: Path, oficios: list[dict], pausa: float = 4.0, http=None) -> dict:
    """Todo oficio de veto, votado ou nao: transcreve se for escaneado e le as razoes do prefeito.
    Grava data/analises/VETO-<num>-<ano>.json (num/ano do projeto vetado)."""
    from .vetos import texto_doc

    dados = Path(dados)
    (dados / "analises").mkdir(exist_ok=True)
    corpo, versao = _prompt_veto()
    rel = {"novas": 0, "em_cache": 0, "sem_texto": 0, "ocr": 0, "erros": []}
    for o in oficios:
        k = chave_materia("VETO", o["numero"], o["ano"])
        meta = {"sha256": o["sha256"]}
        if o.get("precisa_ocr") and not (dados / "texto" / f"{o['sha256']}.ocr.txt").exists():
            try:
                if transcrever_pdf(dados, o["url"], o["sha256"], http):
                    rel["ocr"] += 1
                    time.sleep(pausa)
            except Exception as e:  # noqa: BLE001
                rel["erros"].append(f"ocr {k}: {e!r}"[:200])
        texto = flat(normalize(texto_doc(dados, meta)))
        if len(texto) < 300:
            rel["sem_texto"] += 1
            continue
        h = hashlib.sha256(texto.encode()).hexdigest()[:16]
        saida = dados / "analises" / f"{k}.json"
        if saida.exists():
            antigo = json.loads(saida.read_text("utf-8"))
            if antigo.get("tipo_analise") == "veto" and antigo.get("hash_documento") == h and antigo.get("versao_prompt") == versao:
                rel["em_cache"] += 1
                continue
        fonte = "transcricao automatica do PDF escaneado" if o.get("precisa_ocr") else "texto do oficio publicado no site da Camara"
        prompt = corpo.replace("{fonte}", fonte).replace("{documento}", texto[:MAX_DOC])
        try:
            if rel["novas"]:
                time.sleep(pausa)
            bruto, modelo = gerar(prompt, http)
            res = conferir_veto(_json(bruto), texto)
        except Exception as e:  # noqa: BLE001
            rel["erros"].append(f"{k}: {e!r}"[:200])
            print(f"  ! veto {k}: {e!r}"[:200])
            continue
        saida.write_text(json.dumps({
            "tipo_analise": "veto",
            "materia": {"tipo": "VETO", "numero": o["numero"], "ano": o["ano"], "alcance": o["alcance"]},
            "documento": {"fonte": fonte, "url": o["url"], "oficio": o.get("oficio"), "data_oficio": o.get("data_oficio")},
            "analise": res, "modelo": modelo, "versao_prompt": versao, "hash_documento": h,
            "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, ensure_ascii=False, indent=1), "utf-8")
        rel["novas"] += 1
    print(f"  vetos: {rel['novas']} lido(s), {rel['em_cache']} em cache, {rel['sem_texto']} sem texto, "
          f"{rel['ocr']} PDF(s) transcrito(s), {len(rel['erros'])} erro(s)")
    return rel
