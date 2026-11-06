"""Confere a identificacao lida no cabecalho do painel contra a pauta da sessao.

O modelo de visao erra digito em texto de 5 px (39 vira 29, 38 vira 30). Nada vai pro ar
sem passar por aqui:
  - (tipo, numero) existe na pauta do dia             -> "confirmado_pauta"
  - nao existe, mas 1 candidato da pauta casa por autor
    ou por 1 digito de diferenca                        -> "corrigido_pauta" (guarda o lido)
  - requerimento/mocao (nao constam da pauta)          -> "a_confirmar_resumo"
  - nada casa                                          -> "nao_confirmado"
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .nomes import chave
from .textclean import flat, normalize, strip_accents

MESES_NOME = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO",
              "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]
ESPECIES = {
    "PROJETO DE LEI COMPLEMENTAR": "PLC", "PROJETO DE LEI": "PL", "PROJETO DE RESOLUCAO": "PR",
    "PROJETO DE DECRETO LEGISLATIVO": "PDL", "PROJETO DE EMENDA A LEI ORGANICA": "PELOM",
}
RE_VETO = re.compile(r"VETO (?:INTEGRAL|PARCIAL) AO PROJETO DE LEI N\S?\s*(\d{1,4})/(\d{4})")
RE_APELIDO = re.compile(r"Vereador[a]?\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\-–“\"\n]{5,60}?)\s*[-–]\s*[“\"]([^”\"]{2,40})[”\"]")
RE_SHA256 = re.compile(r"^[0-9a-f]{64}$")

# apelidos que nao aparecem nas indicacoes dos resumos (vistos no painel/noticias)
APELIDOS_EXTRA = {
    "topete": "alexandre mendes da silva", "tinho": "marcos roberto silva",
    "rony martins": "roniele martins da silva", "dr anderson de lana": "anderson de lana andrade",
    "anderson de lana": "anderson de lana andrade", "ivan hildebrando": "ivan da silva",
    "ronaldo da comissao": "ronaldo araujo queiroz", "guilherme do salao": "guilherme dos santos malaquias",
    "jair do bar": "jair ferreira lucas", "allan matias": "allan matias barboza de souza",
    "alessandro oliveira": "alessandro donizete de oliveira", "edson mota": "edson menezes mota",
}


def _sem_acento_maiusc(t: str) -> str:
    """Maiusculo sem acento, preservando digitos e pontuacao (chave() descarta digitos)."""
    t = strip_accents(t.replace("º", "").replace("°", "").replace("ª", "")).upper()
    return re.sub(r"[ \t]+", " ", t)


def apelidos(dados: Path) -> dict[str, str]:
    """apelido normalizado -> chave do nome civil, a partir das indicacoes dos resumos."""
    dados = Path(dados)
    texto_dir = (dados / "texto").resolve()
    idx = json.loads((dados / "indice.json").read_text("utf-8"))
    out = dict(APELIDOS_EXTRA)
    for m in idx.values():
        if m["secao"] != "resumo":
            continue
        sha = str(m.get("sha256") or "")
        if not RE_SHA256.match(sha):
            continue
        p = (texto_dir / f"{sha}.txt").resolve()
        if not p.is_relative_to(texto_dir) or not p.exists():
            continue
        for a in RE_APELIDO.finditer(flat(normalize(p.read_text("utf-8")))):
            out.setdefault(chave(a.group(2)), chave(a.group(1)))
    return out


def pautas_do_dia(dados: Path, data_iso: str) -> list[str]:
    """Texto de todas as pautas (ordinaria e extraordinarias) daquele dia."""
    dados = Path(dados)
    texto_dir = (dados / "texto").resolve()
    a, m, d = data_iso.split("-")
    alvo = f"DIA {int(d)} DE {MESES_NOME[int(m) - 1]} DE {a}"
    alvo2 = f"DIA {d} DE {MESES_NOME[int(m) - 1]} DE {a}"
    # convocacoes de extraordinaria: "realizada dia 03 do corrente mes" -> cai no fallback abaixo
    idx = json.loads((dados / "indice.json").read_text("utf-8"))
    out = []
    for meta in idx.values():
        if meta["secao"] != "pauta":
            continue
        sha = str(meta.get("sha256") or "")
        if not RE_SHA256.match(sha):
            continue
        p = (texto_dir / f"{sha}.txt").resolve()
        if not p.is_relative_to(texto_dir) or not p.exists():
            continue
        t = _sem_acento_maiusc(flat(normalize(p.read_text("utf-8")))[:600])
        if alvo in t or alvo2 in t:
            out.append(flat(normalize(p.read_text("utf-8"))))
    return out


RE_ITEM_ORIG = re.compile(
    r"ESP[ÉE]CIE:\s*(.{5,90}?)\s+AUTORIA:\s*(.{2,70}?)\s+ASSUNTO:\s*(.+?)(?=\s+\d{1,2}\s*[º°o]\s*PROC\.|\s+PAUTA PARA|$)",
    re.I | re.S)


def candidatos(textos_pauta: list[str]) -> list[dict]:
    """Itens da pauta: tipo, numero, ano, autor (chave) + autoria/assunto como estao no documento."""
    cands = {}
    for t in textos_pauta:
        for m in RE_ITEM_ORIG.finditer(t):
            esp_u, autoria = _sem_acento_maiusc(m.group(1)), m.group(2).strip()
            assunto = re.split(r"\s+DATA:\s|\s+OBS\.?:\s|\s+PARECER\b", m.group(3))[0].strip(' ."“”')
            assunto_u = _sem_acento_maiusc(assunto)
            if mv := RE_VETO.search(assunto_u):
                tipo, num, ano = "VETO", mv.group(1), mv.group(2)
            else:
                esp = next((v for k, v in ESPECIES.items() if esp_u.startswith(k)), None)
                mn = re.search(r"N\S?\s*(\d{1,4})/(\d{4})", esp_u)
                if not esp or not mn:
                    continue
                tipo, num, ano = esp, mn.group(1), mn.group(2)
            num = num.lstrip("0")
            novo = {"tipo": tipo, "numero": num, "ano": ano, "autor": chave(autoria),
                    "autoria": autoria, "assunto": assunto[:3000]}
            velho = cands.setdefault((tipo, num), novo)
            if len(velho["assunto"]) < 60 and len(novo["assunto"]) > len(velho["assunto"]):
                velho["assunto"] = novo["assunto"]  # pauta truncada; parecer anexado traz o assunto inteiro
    return list(cands.values())


def _um_digito(a: str, b: str) -> bool:
    return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1


def _autor_casa(lido: str | None, civil: str, apel: dict[str, str]) -> bool:
    if not lido:
        return False
    k = chave(re.sub(r"(?i)\bvereador[a]?\b|\bdr\.?\b", " ", lido))
    if not k:
        return False
    if "prefeit" in k:
        return "prefeit" in civil or "cesar" in civil
    if "mesa" in k:
        return "mesa" in civil
    alvo = apel.get(k)
    if alvo:
        return alvo == civil
    toks = [x for x in k.split() if len(x) > 2]
    return bool(toks) and all(x in civil for x in toks)


def validar(materia: dict, cands: list[dict], apel: dict[str, str]) -> dict:
    tipo, num = materia.get("tipo"), (materia.get("numero") or "").lstrip("0")
    autor = materia.get("autor")
    if tipo == "EMENDA" and materia.get("ref"):
        # emenda: confere o projeto emendado; o autor lido e o da emenda, nao o do projeto
        tipo, num, autor = materia["ref"]["tipo"], materia["ref"]["numero"].lstrip("0"), None
    if tipo in ("RQ", "MOCAO", "MOÇÃO", "RELATORIO", "RELATÓRIO"):
        return {"status": "a_confirmar_resumo", "motivo": "requerimento/mocao/relatorio nao constam da pauta"}
    if not cands:
        return {"status": "nao_confirmado", "motivo": "pauta do dia nao encontrada"}
    if not tipo or not num:
        return {"status": "nao_confirmado", "motivo": "cabecalho sem tipo/numero legivel"}
    mesmo_tipo = [c for c in cands if c["tipo"] == tipo]
    if any(c["numero"] == num for c in mesmo_tipo):
        return {"status": "confirmado_pauta", "tipo": tipo, "numero": num}
    por_autor = [c for c in mesmo_tipo if _autor_casa(autor, c["autor"], apel)]
    por_digito = [c for c in mesmo_tipo if _um_digito(c["numero"], num)]
    for grupo, motivo in ((por_autor, "autor"), (por_digito, "1 digito de diferenca")):
        if len(grupo) == 1:
            return {"status": "corrigido_pauta", "tipo": tipo, "numero": grupo[0]["numero"], "ano": grupo[0]["ano"],
                    "numero_lido": num, "motivo": f"unico {tipo} da pauta compativel por {motivo}"}
    if len(mesmo_tipo) == 1 and materia.get("parecer"):
        c = mesmo_tipo[0]
        return {"status": "corrigido_pauta", "tipo": tipo, "numero": c["numero"], "ano": c["ano"], "numero_lido": num,
                "motivo": f"parecer; unico {tipo} na pauta"}
    return {"status": "nao_confirmado", "tipo": tipo, "numero_lido": num,
            "candidatos": [c["numero"] for c in (por_digito or por_autor)],
            "motivo": f"{tipo} {num} nao esta na pauta e nao ha candidato unico"}


def validar_sessao(materias: list[dict | None], cands: list[dict], apel: dict[str, str]) -> list[dict | None]:
    """Valida cada votacao; empate entre candidatos e desfeito pela votacao vizinha
    (parecer vem logo antes do projeto: 'Parecer ao PL 28' seguido de 'PL 38' -> PL 38)."""
    res = [validar(m, cands, apel) if m and m.get("texto") else None for m in materias]
    for i, r in enumerate(res):
        if not r or r["status"] != "nao_confirmado" or len(r.get("candidatos", [])) < 2:
            continue
        for j in (i + 1, i - 1):
            if 0 <= j < len(res) and res[j] and res[j]["status"] in ("confirmado_pauta", "corrigido_pauta") \
                    and res[j].get("tipo") == r["tipo"] and res[j]["numero"] in r["candidatos"]:
                c = next(c for c in cands if c["tipo"] == r["tipo"] and c["numero"] == res[j]["numero"])
                res[i] = {"status": "corrigido_pauta", "tipo": r["tipo"], "numero": c["numero"], "ano": c["ano"],
                          "numero_lido": r["numero_lido"],
                          "motivo": f"empate entre {', '.join(r['candidatos'])}; desfeito pela votacao {'seguinte' if j > i else 'anterior'}"}
                break
    return res
