"""Faixa de impacto de cada projeto e requerimento, usada no Indice de Atuacao.

Regra fixa sobre a ementa (e, quando ha, o texto do projeto), publicada em Como funciona.
Casos que a regra nao resolve bem ficam em data/impacto_manual.json, com o motivo escrito.
Nada aqui usa IA: cada peso tem que ser defensavel lendo a regra.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from . import validacao as V

FAIXAS = {
    "simbolico": {"peso": 0.2, "nome": "Simbólico"},
    "autorizativo": {"peso": 0.5, "nome": "Autorizativo ou campanha"},
    "normativo": {"peso": 1.0, "nome": "Normativo"},
    "estrutural": {"peso": 1.5, "nome": "Estrutural"},
    # requerimentos
    "rq_procedimento": {"peso": 0.2, "nome": "Procedimento interno"},
    "rq_organizacao": {"peso": 0.2, "nome": "Comissão para organizar evento"},
    "rq_pedido": {"peso": 0.5, "nome": "Pedido ao Executivo"},
    "rq_investigacao": {"peso": 1.0, "nome": "Investigação ou acompanhamento"},
}

RE_SIMBOLICO = re.compile(
    r"DENOMINA|CALENDARIO|\bDIA (MUNICIPAL|DO|DA|DE)\b|SEMANA (MUNICIPAL|DO|DA|DE)\b|\bMES (MUNICIPAL|DO|DA)\b|"
    r"TITULO DE CIDAD|CIDADAO (CUBATENSE|HONORARIO|EMERITO)|UTILIDADE PUBLICA|MEDALHA|HONRA AO MERITO|"
    r"DATA COMEMORATIVA|HOMENAG|PATRIMONIO CULTURAL IMATERIAL")
RE_ESTRUTURAL = re.compile(
    r"LEI ORGANICA|PLANO DIRETOR|ESTIMA A RECEITA|DIRETRIZES ORCAMENTARIAS|PLANO PLURIANUAL|TRIBUT|IMPOSTO|\bIPTU\b|\bISS\b|"
    r"CODIGO (TRIBUTARIO|DE POSTURAS|DE OBRAS)|CONTRIBUICAO PARA (O )?CUSTEIO")
RE_AUTORIZATIVO_EMENTA = re.compile(r"^AUTORIZA O (PODER )?EXECUTIVO|CAMPANHA|CONSCIENTIZACAO|SENSIBILIZACAO|INCENTIVO A")
# no texto: lei so autorizativa ("fica o Poder Executivo autorizado") x lei que obriga ou proibe
RE_TXT_AUTORIZA = re.compile(r"FICA O (PODER )?EXECUTIVO (MUNICIPAL )?AUTORIZADO|PODERA O (PODER )?EXECUTIVO|"
                             r"FICA AUTORIZAD[OA] A INSTITUI|O PODER EXECUTIVO PODERA")
RE_TXT_OBRIGA = re.compile(r"\bFICA(M)? OBRIGAD|\bE OBRIGATORI|\bFICA(M)? PROIBID|\bE PROIBID|\bE VEDAD|\bFICA(M)? VEDAD|"
                           r"\bDEVERA(O)? (SER|OBSERVAR|GARANTIR|DISPONIBILIZAR|AFIXAR|MANTER|OFERECER|ASSEGURAR)|"
                           r"\bFICA(M)? ASSEGURAD|\bE ASSEGURAD|\bE GARANTID|\bFICA(M)? GARANTID|SOB PENA DE|\bMULTA\b|INFRACAO")

RE_RQ_PROCEDIMENTO = re.compile(r"SOLICITANDO QUE O PROCESSO|REGIME DE URGENCIA|SESSAO SECRETA|PRORROGACAO|ATO SOLENE|"
                                r"SESSAO SOLENE|SESSAO ESPECIAL")
RE_RQ_INVESTIGA = re.compile(r"COMISSAO ESPECIAL DE INQUERITO|\bCEI\b|APURAR|AVERIGUAR|ACOMPANHAR|FISCALIZAR|INVESTIGAR|"
                             r"SOLICITANDO INFORMACOES|PEDIDO DE INFORMACOES|SOLICITANDO AO .* INFORMACOES")
RE_RQ_ORGANIZA = re.compile(r"COMISSAO ESPECIAL DE VEREADORES.*\b(ORGANIZAR|REALIZAR|PROMOVER|PLANEJAR)\b")
RE_HOMENAGEM_RQ = re.compile(r"APLAUSO|CONGRATULA|PESAR|HOMENAG|VOTO DE LOUVOR")


def _u(t: str | None) -> str:
    return V._sem_acento_maiusc(re.sub(r"\s+", " ", t or ""))


def carregar_manual(dados: Path) -> dict:
    p = Path(dados) / "impacto_manual.json"
    if not p.exists():
        return {}
    j = json.loads(p.read_text("utf-8"))
    return {k: v for k, v in j.items() if not k.startswith("_") and v.get("faixa") in FAIXAS}


def classificar(m: dict, texto: str | None = None, manual: dict | None = None) -> dict:
    """-> {"faixa", "peso", "nome", "motivo", "fonte": "regra" | "revisao"}"""
    def r(faixa: str, motivo: str, fonte: str = "regra") -> dict:
        return {"faixa": faixa, "peso": FAIXAS[faixa]["peso"], "nome": FAIXAS[faixa]["nome"], "motivo": motivo, "fonte": fonte}

    if manual and m["slug"] in manual:
        x = manual[m["slug"]]
        return r(x["faixa"], x.get("motivo") or "revisão manual", "revisao")
    e = _u(m.get("assunto"))
    if m["tipo"] in ("RQ", "MOCAO"):
        if m["tipo"] == "MOCAO" or RE_HOMENAGEM_RQ.search(e):
            return r("rq_procedimento", "moção, homenagem ou voto de pesar")
        if RE_RQ_PROCEDIMENTO.search(e):
            return r("rq_procedimento", "pedido de procedimento interno (urgência, prorrogação, sessão)")
        if RE_RQ_ORGANIZA.search(e):
            return r("rq_organizacao", "comissão para organizar evento ou sessão")
        if RE_RQ_INVESTIGA.search(e):
            return r("rq_investigacao", "comissão de inquérito, de acompanhamento ou pedido de informações")
        return r("rq_pedido", "pedido de providência ou estudo ao Executivo")
    if m["tipo"] == "PELOM" or RE_ESTRUTURAL.search(e):
        return r("estrutural", "Lei Orgânica, tributo, orçamento ou código municipal")
    if RE_SIMBOLICO.search(e) or (m.get("tema") or "").startswith("Homenagens"):
        return r("simbolico", "nome de lugar, data comemorativa, título ou homenagem")
    t = _u(texto)[:60000] if texto else ""
    obriga = bool(RE_TXT_OBRIGA.search(t))
    if RE_AUTORIZATIVO_EMENTA.search(e) and not obriga:
        return r("autorizativo", "a ementa autoriza o Executivo ou cria campanha, sem obrigação no texto")
    if t and RE_TXT_AUTORIZA.search(t) and not obriga:
        return r("autorizativo", "o texto só autoriza o Executivo, sem criar obrigação")
    if t:
        return r("normativo", "o texto cria obrigação, direito ou proibição" if obriga else "muda regra em vigor")
    return r("normativo", "sem texto integral: classificado pela ementa")
