"""Junta tudo de um dia de sessao num arquivo so: data/consolidado/AAAA-MM-DD.json

Fontes, em ordem de chegada:
  pauta (vespera)  -> o que ia ser votado, autoria, assunto
  painel (mesmo dia, transmissao) -> resultado, placar e o voto de cada um, inclusive quem nao votou
  noticias (mesmo dia/D+1) -> resultado e, nas divididas, nomes   [data/noticias, quando existir]
  diario oficial   -> lei sancionada / veto                         [data/diario, quando existir]
  resumo oficial (~2 semanas) -> registro oficial; serve de conferencia

Chave por DATA, nao por numero de sessao: a TV transmite ordinaria e extraordinaria do mesmo
dia no mesmo video (29a/30a extra de 29/10, 31a ord + 26a extra de 22/09).

Conferencia painel x resumo, por vereador (SIM/NAO do painel vs aprovacao/rejeicao do resumo):
  voto_divergente         painel SIM e resumo rejeicao (ou o contrario)
  resumo_inclui_nao_votante  painel mostra presente sem voto, resumo lista voto
  resumo_inclui_ausente      painel mostra ausente, resumo lista voto
  resumo_omite_voto          painel mostra voto, resumo nao lista
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from . import validacao as V
from .nomes import chave

TURNO = {"1": "1a_discussao", "2": "2a_discussao"}
ESPECIE_TIPO = [("PROJETO DE LEI COMPLEMENTAR", "PLC"), ("PROJETO DE LEI", "PL"), ("PROJETO DE RESOLU", "PR"),
                ("PROJETO DE DECRETO", "PDL"), ("PROJETO DE EMENDA", "PELOM"), ("OFICIO", "VETO"),
                ("REQUERIMENTO", "RQ"), ("MOCAO", "MOCAO"), ("RELATORIO", "RELATORIO")]


def _u(t: str | None) -> str:
    return V._sem_acento_maiusc(t or "")


def _turno_painel(m: dict) -> str | None:
    t = _u(m.get("turno"))
    if "UNICA" in t:
        return "discussao_unica"
    if "REDACAO FINAL" in t:
        return "redacao_final"
    if mm := re.match(r"\s*([12])", t):
        return TURNO[mm.group(1)]
    return None


def _chave_item_resumo(it: dict) -> tuple[str, str] | None:
    esp = _u(it.get("especie"))
    tipo = next((t for k, t in ESPECIE_TIPO if esp.startswith(k)), None)
    if tipo == "VETO" or it.get("objeto_votado") == "veto":
        mv = V.RE_VETO.search(_u(it.get("assunto") or it.get("descricao")))
        return ("VETO", mv.group(1).lstrip("0")) if mv else None
    num = re.match(r"(\d+)", (it.get("numero") or "").replace(".", ""))
    if not tipo or not num:
        return (tipo, "") if tipo == "RELATORIO" else None
    return tipo, num.group(1).lstrip("0")


def _chave_painel(m: dict) -> tuple[str, str] | None:
    if fin := m.get("final"):
        return fin["tipo"], fin["numero"]
    t = (m.get("tipo") or "").replace("Ç", "C").replace("Ã", "A").replace("Ó", "O")
    if t in ("RQ", "MOCAO") and m.get("numero"):
        return t, m["numero"].lstrip("0")
    if t.startswith("RELAT"):
        return "RELATORIO", ""
    return None


def _etapa_painel(m: dict) -> str:
    if m.get("tipo") == "EMENDA":
        return "parecer_emenda" if m.get("parecer") else "emenda"
    if m.get("parecer"):
        return "parecer"
    return _turno_painel(m) or "unica"


def _etapa_resumo(vot: dict) -> str:
    if any("ARECER" in _u(g.get("alvo")) for g in vot.get("grupos", [])):
        return "parecer"
    return vot.get("turno") or "unica"


def conferir(painel: dict, resumo_vot: dict) -> list[dict]:
    """Compara uma votacao do painel com a mesma votacao no resumo oficial."""
    acao = {}
    for g in resumo_vot.get("grupos", []):
        a = "SIM" if _u(g.get("acao")).startswith("APROVA") or _u(g.get("acao")).startswith("MANUTEN") else "NAO"
        for v in g["vereadores"]:
            acao[v] = a
    div = []
    for ver, pv in (painel.get("votos") or {}).items():
        rv = acao.get(ver)
        if pv in ("SIM", "NAO") and rv and rv != pv:
            div.append({"tipo": "voto_divergente", "vereador": ver, "painel": pv, "resumo": rv})
        elif pv == "BRANCO" and rv:
            div.append({"tipo": "resumo_inclui_nao_votante", "vereador": ver, "painel": "nao votou", "resumo": rv})
        elif pv == "AUSENTE" and rv:
            div.append({"tipo": "resumo_inclui_ausente", "vereador": ver, "painel": "ausente", "resumo": rv})
        elif pv in ("SIM", "NAO") and not rv and acao:
            div.append({"tipo": "resumo_omite_voto", "vereador": ver, "painel": pv, "resumo": None})
    rp = (painel.get("resultado") or "").upper()
    rr = _u(resumo_vot.get("resultado"))
    # no parecer, "aprovado" no painel e o parecer aprovado; o resumo registra o destino da materia
    if rp and rr and not any("ARECER" in _u(g.get("alvo")) for g in resumo_vot.get("grupos", [])):
        if (rp == "APROVADO") != rr.startswith("APROVADO"):
            div.append({"tipo": "resultado_divergente", "painel": rp, "resumo": resumo_vot.get("resultado")})
    pp = painel.get("placar") or {}
    sim_r = sum(1 for a in acao.values() if a == "SIM")
    nao_r = sum(1 for a in acao.values() if a == "NAO")
    if acao and (pp.get("SIM"), pp.get("NAO")) != (sim_r, nao_r):
        div.append({"tipo": "placar_divergente", "painel": f"{pp.get('SIM')}x{pp.get('NAO')}", "resumo": f"{sim_r}x{nao_r}"})
    return div


def _resumos_do_dia(dados: Path, data: str) -> list[dict]:
    return [json.loads(p.read_text("utf-8")) for p in sorted((dados / "sessoes").glob(f"{data}_*.json"))]


def _painel_do_dia(dados: Path, data: str) -> list[dict]:
    out = []
    for p in sorted((dados / "painel").glob("*.json")):
        d = json.loads(p.read_text("utf-8"))
        if d["sessao"].get("data") == data:
            out.append(d)
    return out


def _datas(dados: Path) -> list[str]:
    ds = {p.name[:10] for p in (dados / "sessoes").glob("*.json")}
    for p in (dados / "painel").glob("*.json"):
        if dt := json.loads(p.read_text("utf-8"))["sessao"].get("data"):
            ds.add(dt)
    return sorted(ds)


def _noticias_do_dia(dados: Path, data: str) -> list[dict]:
    """Noticias cuja sessao e deste dia: pela data '(dd/mm)' do texto ou, sem ela, publicada no dia ou em D+1."""
    out = []
    d0 = date.fromisoformat(data)
    for p in sorted((dados / "noticias").glob("*.json")) if (dados / "noticias").exists() else []:
        n = json.loads(p.read_text("utf-8"))
        e = n.get("extraido") or {}
        if not e.get("materias"):
            continue
        pub = date.fromisoformat(n["publicado"][:10])
        if e.get("data_sessao") == data or (not e.get("data_sessao") and 0 <= (pub - d0).days <= 1):
            out.append(n)
    return out


def conferir_noticia(grupo: dict, painel: dict) -> list[dict]:
    div = []
    votos = painel.get("votos") or {}
    for sentido in ("SIM", "NAO"):
        for v in grupo[sentido]:
            pv = votos.get(v)
            if pv and pv != sentido:
                div.append({"tipo": "noticia_diverge_painel", "vereador": v, "noticia": sentido,
                            "painel": {"BRANCO": "nao votou", "AUSENTE": "ausente"}.get(pv, pv)})
    return div


def consolidar_dia(dados: Path, data: str, apel: dict | None = None) -> dict:
    dados = Path(dados)
    resumos = _resumos_do_dia(dados, data)
    paineis = _painel_do_dia(dados, data)
    cands = V.candidatos(V.pautas_do_dia(dados, data))
    nomes = json.loads((dados / "vereadores.json").read_text("utf-8")) if (dados / "vereadores.json").exists() else {}
    nomes = nomes.get("vereadores", nomes) if isinstance(nomes, dict) else {}

    materias: dict[tuple, dict] = {}

    def mat(k: tuple) -> dict:
        if k not in materias:
            materias[k] = {"tipo": k[0], "numero": k[1] or None, "ano": None, "autoria": None, "assunto": None,
                           "na_pauta": False, "resultado_oficial": None, "votacoes": [], "sem_painel": False}
        return materias[k]

    for c in cands:
        m = mat((c["tipo"], c["numero"]))
        m.update({"ano": c["ano"], "autoria": c["autoria"], "assunto": c["assunto"], "na_pauta": True})

    resumo_vots: dict[tuple, list] = {}
    for r in resumos:
        for it in r["itens"]:
            k = _chave_item_resumo(it)
            if not k or (it.get("tipo") != "deliberacao"):
                continue
            m = mat(k)
            if it.get("autoria"):
                m["autoria"] = m["autoria"] or it["autoria"]
            if it.get("assunto"):
                m["assunto"] = it["assunto"]
            elif not m["assunto"] and it.get("descricao"):
                m["assunto"] = it["descricao"][:400]
            if mn := re.search(r"/(\d{4})", it.get("numero") or ""):
                m["ano"] = m["ano"] or mn.group(1)
            m["resultado_oficial"] = it.get("resultado")
            for vt in it.get("votacoes") or []:
                resumo_vots.setdefault(k, []).append({**vt, "_sessao": r["sessao"], "_fonte": r["fonte"]})

    nao_casadas = []
    for p in paineis:
        for v in p["votacoes"]:
            m_l = v.get("materia") or {}
            k = _chave_painel(m_l)
            base = {"etapa": _etapa_painel(m_l) if k else None, "painel": {
                "video": p["url"], "n": v["n"], "resultado": v.get("resultado"), "placar": v.get("placar"),
                "votos": v.get("votos"), "completo": bool(v.get("resultado")), "link": v.get("link"),
                "evidencia": v.get("evidencia"), "lido": m_l.get("texto"),
                "validacao": (m_l.get("validacao") or {}).get("status"), "aviso": v.get("aviso")}}
            if not k:
                nao_casadas.append(base)
                continue
            mat(k)["votacoes"].append(base)

    # casa cada votacao do resumo com a do painel (mesma materia, mesma etapa, na ordem)
    for k, vots in resumo_vots.items():
        m = mat(k)
        livres = [x for x in m["votacoes"] if "resumo" not in x]
        for rv in vots:
            et = _etapa_resumo(rv)
            alvo = next((x for x in livres if x["etapa"] == et), None)
            if alvo is None and et == "unica":
                alvo = next((x for x in livres if x["etapa"] in ("unica", "discussao_unica", "emenda")), None)
            reg = {"sessao": rv["_sessao"], "resultado": rv.get("resultado"), "detalhe": rv.get("detalhe"),
                   "placar": rv.get("placar"), "fonte": rv["_fonte"],
                   "por_acao": {g["acao"]: g["vereadores"] for g in rv.get("grupos", [])}}
            if alvo is None:
                m["votacoes"].append({"etapa": et, "painel": None, "resumo": reg,
                                      "conferencia": {"status": "so_resumo", "divergencias": []}})
                continue
            livres.remove(alvo)
            alvo["resumo"] = reg
            div = conferir(alvo["painel"], rv) if alvo["painel"]["validacao"] != "nao_confirmado" else []
            if div and not alvo["painel"]["completo"]:
                # sem APROVADO/REJEITADO na tela o print pode ser de antes do ultimo voto: nao acusa ninguem
                pl = next((d_ for d_ in div if d_["tipo"] == "placar_divergente"), None)
                div = [{"tipo": "painel_incompleto", "painel": pl["painel"] if pl else None,
                        "resumo": pl["resumo"] if pl else None,
                        "obs": "print do painel sem resultado na tela; provavel captura antes do fim da votacao"}]
            alvo["conferencia"] = {"status": "diverge" if div else "confere", "divergencias": div}

    # noticias: resultado do mesmo dia e, nas divididas, os nomes
    noticias = _noticias_do_dia(dados, data)
    for n in noticias:
        for nm in n["extraido"]["materias"]:
            k = (nm["tipo"], nm["numero"])
            if k not in materias and n["extraido"].get("data_sessao") != data:
                continue  # sem data explicita so anexa a materia que ja e deste dia
            m = mat(k)
            m.setdefault("noticias", []).append({"url": n["url"], "titulo": n["titulo"], "resultado": nm["resultado"],
                                                 "votos": nm["votos"], "nomes_nao_reconhecidos": nm["nomes_nao_reconhecidos"]})
            for g in nm["votos"]:
                cand = [x for x in m["votacoes"] if x.get("painel") and (
                    x["etapa"] == "parecer" if g["alvo"].startswith("parecer") else x["etapa"] not in ("parecer", "parecer_emenda"))]
                # entre os candidatos, o de placar igual ao da noticia
                alvo = next((x for x in cand if (x["painel"]["placar"] or {}).get("SIM") == len(g["SIM"])
                             and (x["painel"]["placar"] or {}).get("NAO") == len(g["NAO"])), cand[0] if len(cand) == 1 else None)
                if alvo is None or not alvo["painel"]["completo"]:
                    continue
                dv = conferir_noticia(g, alvo["painel"])
                alvo["noticia"] = {"url": n["url"], "confere": not dv}
                if dv:
                    conf = alvo.setdefault("conferencia", {"status": "diverge", "divergencias": []})
                    conf["divergencias"] += dv
                    conf["status"] = "diverge"

    for m in materias.values():
        for x in m["votacoes"]:
            if "conferencia" not in x:
                x["resumo"] = x.get("resumo")
                st = "aguardando_resumo"
                if resumos:
                    st = "resumo_nao_registra" if x["etapa"] in ("parecer", "parecer_emenda", "emenda") else "so_painel"
                x["conferencia"] = {"status": st, "divergencias": []}
        m["sem_painel"] = bool(paineis) and not any(x["painel"] for x in m["votacoes"])

    ordem = {"VETO": 0, "PELOM": 1, "PLC": 2, "PL": 3, "PR": 4, "PDL": 5, "RQ": 6, "MOCAO": 7, "RELATORIO": 8}
    lista = sorted(materias.values(), key=lambda m: (ordem.get(m["tipo"], 9), int(m["numero"] or 0)))
    divs = [{"materia": f"{m['tipo']} {m['numero'] or ''}".strip(), "etapa": x["etapa"], **d}
            for m in lista for x in m["votacoes"] for d in x["conferencia"]["divergencias"]]
    return {
        "data": data,
        "status": "oficial_conferido" if resumos and paineis else ("so_oficial" if resumos else "provisorio_painel"),
        "sessoes": [{**r["sessao"], "resumo": r["fonte"]} for r in resumos],
        "transmissoes": [{"titulo": p["titulo"], "url": p["url"]} for p in paineis],
        "noticias": [{"titulo": n["titulo"], "url": n["url"], "publicado": n["publicado"]} for n in noticias],
        "materias": lista,
        "votacoes_nao_identificadas": nao_casadas,
        "divergencias": divs,
        "nomes": {k: v for k, v in nomes.items()} if nomes else {},
    }


def consolidar_tudo(dados: Path, desde: str = "2026-01-01") -> dict:
    """Refaz o consolidado dos dias com painel ou resumo desde 'desde' (painel so existe a partir de set/2026).
    Segunda passada: liga lei/veto do Diario Oficial ao projeto aprovado."""
    from . import diario as DO

    dados = Path(dados)
    out = dados / "consolidado"
    out.mkdir(exist_ok=True)
    dias = {data: consolidar_dia(dados, data) for data in _datas(dados) if data >= desde}

    aprovadas = []
    for data, c in dias.items():
        for m in c["materias"]:
            ok = (m["resultado_oficial"] or "").startswith("aprovado") or any(
                (x.get("painel") or {}).get("resultado") == "APROVADO" and x["etapa"] not in ("parecer", "parecer_emenda", "emenda")
                for x in m["votacoes"])
            if ok and m.get("assunto"):
                aprovadas.append({"tipo": m["tipo"], "numero": m["numero"], "assunto": m["assunto"], "data": data})
    pubs = DO.vincular(dados, aprovadas)
    for c in dias.values():
        for m in c["materias"]:
            if pubs.get((m["tipo"], m["numero"])):
                m["diario_oficial"] = pubs[(m["tipo"], m["numero"])]

    tot = {"dias": 0, "divergencias": 0, "provisorios": 0, "leis_vinculadas": len(pubs)}
    for data, c in dias.items():
        (out / f"{data}.json").write_text(json.dumps(c, ensure_ascii=False, indent=1), "utf-8")
        tot["dias"] += 1
        tot["divergencias"] += len(c["divergencias"])
        tot["provisorios"] += c["status"] == "provisorio_painel"
    print(f"  consolidado: {tot['dias']} dia(s), {tot['provisorios']} provisorio(s), "
          f"{tot['divergencias']} divergencia(s), {tot['leis_vinculadas']} materia(s) com publicacao no DO")
    return tot
