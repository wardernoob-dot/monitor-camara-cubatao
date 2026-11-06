"""Parser do "Resumo da Sessao" publicado pela Camara Municipal de Cubatao.

Entrada: texto extraido do PDF (pdfplumber, pdftotext ou pdf.js).
Saida: dict com sessao, presenca, itens deliberados e votos nominais.

Regras de interpretacao (importantes pra nao publicar besteira):
- O resumo so lista quem votou. Vereador presente que nao aparece na lista
  NAO e voto contrario: vira "nao_consta" (pode ser presidente, ausente do
  plenario no momento, abstencao nao registrada...).
- Votacao em cima de PARECER inverte o sentido quando o parecer e contrario:
  "aprovacao do Parecer contrario a Propositura" = voto CONTRA o projeto.
- Em VETO: "manutencao do Veto" = a favor do veto (contra o projeto original).
"""
import re
from datetime import date

from . import nomes as N
from .textclean import flat, normalize

MESES = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5,
    "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
    "novembro": 11, "dezembro": 12,
}

RE_TITULO = re.compile(
    r"RESUMO DA (\d+)\s*[ªa]\s*SESS[ÃA]O\s+(ORDIN[ÁA]RIA|EXTRAORDIN[ÁA]RIA|SOLENE|ESPECIAL)", re.I)
RE_DATA_SESSAO = re.compile(r"REALIZADA NO DIA (\d{1,2})\s*(?:[º°])?\s+DE\s+([A-ZÇÃa-zçã]+)\s+DE\s+(\d{4})", re.I)
RE_INICIO = re.compile(r"In[íi]cio [àa]s (\d{1,2})h\s?(\d{2})", re.I)
RE_FIM = re.compile(r"Sess[ãa]o foi encerrada [àa]s (\d{1,2})h\s?(\d{2})", re.I)
RE_PRESENCA = re.compile(r"^(.+?)\s+(SIM|N[ÃA]O|JUSTIFICAD[AO]|AUSENTE|LICENCIAD[AO])$", re.I)
RE_OBSTRUCAO = re.compile(
    r"\bO Vereador[a]? ([^.;:]{3,90}?) solicitou obstru[çc][ãa]o da Sess[ãa]o em nome da bancada d[oa]s? ([^.;]{1,120})\.", re.I)
RE_REMOTO = re.compile(r"\bO Vereador[a]? ([^.;:]{3,90}?) participou de forma remota", re.I)
RE_FALTA_QUORUM = re.compile(r"falta de \W?qu[óo]rum", re.I)

SEC_MESA = re.compile(r"^1\s*[ªa] PARTE\b", re.I)
SEC_VEREADORES = re.compile(r"^2\s*[ªa] PARTE\b", re.I)
SEC_ORDEM = re.compile(r"^ORDEM DO DIA\b", re.I)
SEC_FIM = re.compile(r"^(A Sess[ãa]o foi encerrada|Divis[ãa]o Legislativa,)", re.I)
RE_CORTE_ITEM = re.compile(
    r"\bO Vereador[a]? .{0,90}? solicitou obstru|\bA presente Sess[ãa]o .{0,30}?foi encerrada", re.I)

RE_ITEM_EXP = re.compile(r"^([a-z])\)\s+")
RE_ITEM_ORDEM = re.compile(r"^(?:(\d+)\s*[º°o]\s+)?PROC\.?\s*N", re.I)

RE_VOTO = re.compile(
    r"\b(?:Os|As|O|A)\s+Vereador(?:es|as|a)?\s*:?\s*(?P<nomes>[^.;]{3,1500}?)\s+vot(?:aram|ou)\s+pel[ao]\s+"
    r"(?P<acao>aprova[çc][ãa]o|rejei[çc][ãa]o|manuten[çc][ãa]o)\s+d[oa]\s+"
    r"(?P<alvo>Parecer\s+favor[áa]vel(?:\s+[àa]\s+Propositura)?|Parecer\s+contr[áa]rio(?:\s+[àa]\s+Propositura)?"
    r"|Parecer|Propositura|Veto|Projeto(?:\s+de\s+\w+)?|Mo[çc][ãa]o|Requerimento|Relat[óo]rio|Emendas?|Mat[ée]ria)",
    re.I,
)
RE_VOTOU_QUALQUER = re.compile(r"\bvot(?:aram|ou)\s+pel[ao]\b", re.I)

RESULTADOS = [
    ("aprovado", re.compile(r"^APROVAD[OA]S?\b", re.I)),
    ("rejeitado", re.compile(r"^REJEITAD[OA]S?\b", re.I)),
    ("veto_mantido", re.compile(r"^MANTID[OA]S?\b", re.I)),
    ("retirado", re.compile(r"^RETIRAD[OA]S?\b", re.I)),
    ("adiado", re.compile(r"^ADIAD[OA]S?\b", re.I)),
    ("vista", re.compile(r"^(PEDIDO DE )?VISTA", re.I)),
    ("prejudicado", re.compile(r"^PREJUDICAD", re.I)),
    ("retornou_comissoes", re.compile(r"RETORNOU\s+[ÀA]S\s+COMISS", re.I)),
    ("nao_apreciado", re.compile(r"N[ÃA]O FOI APRECIAD", re.I)),
    ("apresentado", re.compile(r"^Apresentad[oa]s?\b", re.I)),
    ("lido", re.compile(r"^(Lid[oa]s?|Leitura)\b", re.I)),
    ("comunicado", re.compile(r"^(Comunicad[oa]|O Sr\.? Presidente comunicou)", re.I)),
]

RE_TURNO = [
    ("1a_discussao", re.compile(r"\b1\s*[ªa]\s+DISCUSS|PRIMEIRA DISCUSS", re.I)),
    ("2a_discussao", re.compile(r"\b2\s*[ªa]\s+DISCUSS|SEGUNDA DISCUSS", re.I)),
    ("discussao_unica", re.compile(r"DISCUSS[ÃA]O [ÚU]NICA", re.I)),
]


def _resultado(txt: str) -> str:
    t = txt.strip()
    for codigo, rx in RESULTADOS:
        if rx.search(t):
            return codigo
    return "outro"


def _turno(txt: str):
    for codigo, rx in RE_TURNO:
        if rx.search(txt):
            return codigo
    return None


def _sentido(acao: str, alvo: str, objeto: str) -> str:
    """Sentido do voto em relacao ao OBJETO votado (materia, veto ou parecer do TC)."""
    a = N.chave(acao)[:5]   # aprov / rejei / manut
    al = N.chave(alvo)
    if al.startswith("veto"):
        return "favor" if a == "manut" else "contra"
    if al.startswith("parecer contr"):
        return "contra" if a == "aprov" else "favor"
    return "favor" if a == "aprov" else "contra"


ROTULOS = {
    "materia": {"favor": "a favor", "contra": "contra"},
    "veto": {"favor": "manter o veto", "contra": "derrubar o veto"},
    "parecer_tc": {"favor": "seguir o parecer do TCE", "contra": "derrubar o parecer do TCE"},
}


def _ajusta_resultado(res: str, objeto: str) -> str:
    if objeto == "veto":
        return {"rejeitado": "veto_derrubado", "aprovado": "veto_mantido"}.get(res, res)
    if objeto == "parecer_tc":
        return {"rejeitado": "parecer_tc_rejeitado", "aprovado": "parecer_tc_aprovado"}.get(res, res)
    return res


def _objeto_votado(especie: str, autoria: str, assunto: str) -> str:
    blob = f"{especie} {autoria} {assunto}".upper()
    if "VETO" in blob:
        return "veto"
    if "TRIBUNAL DE CONTAS" in blob or "PARECER DAS CONTAS" in blob or "TC-" in blob:
        return "parecer_tc"
    return "materia"


def parse_votos(texto: str, reg: N.Registro, objeto: str, avisos: list, ctx: str, notas: list | None = None):
    t = flat(texto)
    grupos, por_vereador = [], {}
    achados = 0
    for m in RE_VOTO.finditer(t):
        achados += 1
        sentido = _sentido(m["acao"], m["alvo"], objeto)
        lista = []
        for bruto in N.split_lista(m["nomes"]):
            k, exato = reg.resolver(bruto)
            if k is None:
                avisos.append(f"{ctx}: nome nao reconhecido '{bruto}'")
                k = reg.adicionar(bruto)
            elif not exato:
                (notas if notas is not None else avisos).append(f"{ctx}: '{bruto}' ~ '{reg.nome(k)}'")
            lista.append(k)
            if k in por_vereador and por_vereador[k] != sentido:
                avisos.append(f"{ctx}: {reg.nome(k)} aparece com votos conflitantes")
            por_vereador[k] = sentido
        grupos.append({
            "acao": m["acao"].lower(), "alvo": re.sub(r"\s+", " ", m["alvo"]),
            "sentido": sentido, "vereadores": lista,
        })
    total_frases = len(RE_VOTOU_QUALQUER.findall(t))
    if total_frases != achados:
        avisos.append(f"{ctx}: {total_frases} frase(s) de voto, {achados} interpretada(s)")
    placar = {
        "favor": sum(1 for v in por_vereador.values() if v == "favor"),
        "contra": sum(1 for v in por_vereador.values() if v == "contra"),
    }
    return grupos, por_vereador, placar


def _split_secoes(linhas: list[str]) -> dict:
    marcas = []
    for i, l in enumerate(linhas):
        if SEC_MESA.match(l):
            marcas.append((i, "expediente_mesa"))
        elif SEC_VEREADORES.match(l):
            marcas.append((i, "expediente_vereadores"))
        elif SEC_ORDEM.match(l):
            marcas.append((i, "ordem_do_dia"))
        elif SEC_FIM.match(l):
            marcas.append((i, "fim"))
            break
    secoes = {"cabecalho": linhas[: marcas[0][0]] if marcas else linhas}
    for j, (i, nome) in enumerate(marcas):
        if nome == "fim":
            secoes["rodape"] = linhas[i:]
            break
        fim = marcas[j + 1][0] if j + 1 < len(marcas) else len(linhas)
        secoes.setdefault(nome, []).extend(linhas[i + 1: fim])
    return secoes


def _blocos(linhas: list[str], rx: re.Pattern) -> list[tuple[re.Match, str]]:
    blocos, atual, m_atual = [], [], None
    for l in linhas:
        m = rx.match(l)
        if m:
            if m_atual is not None or atual:
                blocos.append((m_atual, "\n".join(atual)))
            atual, m_atual = [l], m
        else:
            atual.append(l)
    if m_atual is not None or atual:
        blocos.append((m_atual, "\n".join(atual)))
    return [(m, t) for m, t in blocos if m is not None]


RE_ESPECIE_EXP = re.compile(
    r"(Mo[çc][ãa]o|Requerimento|Projeto de Lei Complementar|Projeto de Lei|Projeto de Resolu[çc][ãa]o|"
    r"Projeto de Decreto Legislativo|Relat[óo]rio (?:Final|Parcial)|Indica[çc](?:[ãa]o|[õo]es)|Balancete)"
    r"(?:\s+n[º°o]s?\.?\s*([\d\.]+(?:/\d{4})?))?", re.I)
RE_AUTOR_EXP = re.compile(r"de autoria d[oa]s? Vereador(?:a|es|as)?\s+(.+?)(?:,|\s+-\s+|\s+solicitando)", re.I)


def _item_expediente(secao, m, bloco, reg, avisos, ctx_sessao, notas):
    letra = m.group(1)
    corpo = RE_ITEM_EXP.sub("", bloco, count=1)
    corpo = RE_CORTE_ITEM.split(flat(corpo))[0]
    partes = re.split(r"\bOBS\.?\s*:", corpo, maxsplit=1)
    descricao = partes[0].strip()
    obs = partes[1].strip() if len(partes) > 1 else ""
    esp = RE_ESPECIE_EXP.search(descricao)
    aut = RE_AUTOR_EXP.search(descricao)
    ctx = f"{ctx_sessao} {secao} {letra})"
    grupos, por_vereador, placar = parse_votos(obs, reg, "materia", avisos, ctx, notas) if obs else ([], {}, {"favor": 0, "contra": 0})
    tipo = "indicacoes" if re.match(r"Leitura das Indica", descricao, re.I) else "deliberacao"
    return {
        "secao": secao, "ordem": letra, "tipo": tipo,
        "resultado": _resultado(descricao),
        "especie": esp.group(1) if esp else None,
        "numero": esp.group(2) if esp and esp.group(2) else None,
        "autoria": aut.group(1).strip() if aut else None,
        "descricao": descricao if tipo != "indicacoes" else descricao[:300],
        "objeto_votado": "materia",
        "rotulos": ROTULOS["materia"],
        "votacoes": [{"turno": None, "resultado": _resultado(descricao), "detalhe": None,
                      "grupos": grupos, "por_vereador": por_vereador, "placar": placar}] if grupos else [],
    }


def _campo(rx, txt):
    m = re.search(rx, txt, re.I | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip(" .") if m else None


def _item_ordem(m, bloco, reg, avisos, ctx_sessao, notas):
    ordem = m.group(1)
    corpo = RE_CORTE_ITEM.split(flat(bloco))[0]
    proc = _campo(r"PROC\.?\s*N[º°o]?\.?\s*([\d\.]+/\d{4})", corpo)
    especie = _campo(r"ESP[ÉE]CIE:\s*(.+?)\s*(?=AUTORIA:)", corpo)
    autoria = _campo(r"AUTORIA:\s*(.+?)\s*(?=ASSUNTO:)", corpo)
    assunto = _campo(r"ASSUNTO:\s*(.+?)\s*(?=DATA:|OBS\.?\s*:)", corpo)
    data_doc = _campo(r"DATA:\s*(.+?)\s*(?=OBS\.?\s*:|$)", corpo)
    objeto = _objeto_votado(especie or "", autoria or "", assunto or "")
    ctx = f"{ctx_sessao} ordem {ordem or '1'}"
    obs_list = [o.strip() for o in re.split(r"\bOBS\.?\s*:", corpo)[1:]]
    if not obs_list:
        avisos.append(f"{ctx}: item sem OBS (resultado desconhecido)")
    votacoes = []
    for obs in obs_list:
        cab = re.split(r"\s+-\s+(?:Os|As|O|A)\s+Vereador", obs, maxsplit=1)[0]
        grupos, por_vereador, placar = parse_votos(obs, reg, objeto, avisos, ctx, notas)
        res = _ajusta_resultado(_resultado(cab), objeto)
        if res == "outro":
            avisos.append(f"{ctx}: resultado nao classificado '{cab[:80]}'")
        votacoes.append({
            "turno": _turno(cab), "resultado": res, "detalhe": cab,
            "grupos": grupos, "por_vereador": por_vereador, "placar": placar,
        })
    num = re.search(r"N[º°o]\.?\s*([\d\.]+/\d{4})", especie or "")
    return {
        "secao": "ordem_do_dia", "ordem": ordem or "1", "tipo": "deliberacao",
        "processo": proc, "especie": especie, "numero": num.group(1) if num else None,
        "autoria": autoria, "assunto": assunto, "data_documento": data_doc,
        "objeto_votado": objeto,
        "rotulos": ROTULOS[objeto],
        "resultado": votacoes[-1]["resultado"] if votacoes else "outro",
        "votacoes": votacoes,
    }


RE_TITULO_SITE = re.compile(
    r"(\d+)\s*[ªa]\s*SESS[ÃA]O\s+(ORDIN[ÁA]RIA|EXTRAORDIN[ÁA]RIA|SOLENE|ESPECIAL)\D*?(\d{2})/(\d{2})/(\d{4})", re.I)


def _sessao_do_titulo(titulo: str | None) -> dict:
    m = RE_TITULO_SITE.search(titulo or "")
    if not m:
        return {}
    try:
        d = date(int(m.group(5)), int(m.group(4)), int(m.group(3))).isoformat()
    except ValueError:
        d = None
    return {"numero": int(m.group(1)), "tipo": N.chave(m.group(2)), "data": d}


def parse_resumo(texto_bruto: str, registro: N.Registro | None = None, fonte: str | None = None,
                 titulo: str | None = None) -> dict:
    reg = registro or N.Registro()
    avisos: list[str] = []
    notas: list[str] = []
    texto = normalize(texto_bruto)
    linhas = texto.split("\n")
    tudo = flat(texto)

    sessao = {"numero": None, "tipo": None, "data": None, "inicio": None, "fim": None}
    if m := RE_TITULO.search(tudo):
        sessao["numero"] = int(m.group(1))
        sessao["tipo"] = N.chave(m.group(2))
    if m := RE_DATA_SESSAO.search(tudo):
        mes = MESES.get(N.chave(m.group(2)))
        if mes:
            sessao["data"] = date(int(m.group(3)), mes, int(m.group(1))).isoformat()
    if m := RE_INICIO.search(tudo):
        sessao["inicio"] = f"{int(m.group(1)):02d}:{m.group(2)}"
    if m := RE_FIM.search(tudo):
        sessao["fim"] = f"{int(m.group(1)):02d}:{m.group(2)}"
    do_titulo = _sessao_do_titulo(titulo)
    cab_ilegivel = texto[:300].upper().count("RESUMO") >= 2
    for campo, valor in do_titulo.items():
        if sessao.get(campo) is None or (cab_ilegivel and valor is not None):
            if cab_ilegivel and sessao.get(campo) not in (None, valor):
                notas.append(f"cabecalho do PDF ilegivel; {campo} veio do titulo do site")
            sessao[campo] = valor
        elif valor is not None and sessao[campo] != valor:
            avisos.append(f"{campo} diverge: PDF diz {sessao[campo]!r}, titulo no site diz {valor!r}")
    cab_ilegivel = texto[:300].upper().count("RESUMO") >= 2
    ctx = f"[{sessao['numero'] or '?'}a {sessao['tipo'] or '?'} {sessao['data'] or '?'}]"

    secoes = _split_secoes(linhas)

    # presenca: alimenta o registro de nomes antes de ler os votos
    presenca = {}
    em_lista = False
    for l in secoes.get("cabecalho", []):
        if re.match(r"^LISTA DE PRESEN", l, re.I):
            em_lista = True
            continue
        if em_lista and (m := RE_PRESENCA.match(l)):
            k = reg.adicionar(m.group(1))
            presenca[k] = N.chave(m.group(2)).replace("justificado", "justificada")
    if not presenca and "cabecalho" in secoes and sessao["numero"]:
        avisos.append(f"{ctx}: lista de presenca nao encontrada")

    itens = []
    for nome_sec in ("expediente_mesa", "expediente_vereadores"):
        for m, bloco in _blocos(secoes.get(nome_sec, []), RE_ITEM_EXP):
            itens.append(_item_expediente(nome_sec, m, bloco, reg, avisos, ctx, notas))
    for m, bloco in _blocos(secoes.get("ordem_do_dia", []), RE_ITEM_ORDEM):
        itens.append(_item_ordem(m, bloco, reg, avisos, ctx, notas))

    obstrucoes = []
    for m in RE_OBSTRUCAO.finditer(tudo):
        k, _ = reg.resolver(m.group(1))
        k = k or reg.adicionar(m.group(1))
        obstrucoes.append({"vereador": k, "bancada": m.group(2).strip()})

    if not tudo.strip():
        avisos.append(f"{ctx}: PDF sem texto (provavelmente escaneado, precisa OCR)")

    return {
        "fonte": fonte,
        "sessao": sessao,
        "presenca": presenca,
        "titulo_site": titulo,
        "participacao_remota": sorted({(reg.resolver(m.group(1))[0] or N.chave(m.group(1))) for m in RE_REMOTO.finditer(tudo)}),
        "encerrada_por_falta_de_quorum": bool(RE_FALTA_QUORUM.search(tudo)),
        "obstrucoes": obstrucoes,
        "itens": itens,
        "vereadores": {k: reg.nome(k) for k in sorted(set(presenca) | {
            v for it in itens for vt in it["votacoes"] for v in vt["por_vereador"]
        } | {o["vereador"] for o in obstrucoes})},
        "avisos": avisos,
        "notas": notas,
    }
