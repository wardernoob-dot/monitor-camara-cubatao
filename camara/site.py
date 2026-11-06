"""Dados do site: monta vereadores, projetos, votacoes e sessoes e exporta docs/data/dados.json.

O front e um app React (frontend/), compilado uma vez em docs/ e servido estatico (GitHub Pages ou
qualquer dominio). Todo dia so o JSON muda; o app le docs/data/dados.json ao abrir.


Paginas:
  /                       inicio: todos os vereadores x todas as votacoes recentes (matriz) + ultimas sessoes
  /vereadores/            quem esta em exercicio e quem ja exerceu em 2026
  /vereadores/<apelido>/  votos, presenca e projetos de autoria
  /projetos/              tudo que foi pautado ou publicado, com situacao e autoria
  /projetos/<pl-92-2026>/ etapas, placar, voto de cada um, analise, lei/veto, documentos
  /sessoes/ e /sessoes/<data>/
  /como-funciona/         fontes, metodo, limites

Regra: todo voto mostra de onde veio (painel da transmissao ou resumo oficial).
Sem ranking de vereadores.
"""
from __future__ import annotations

import json
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path


from . import analise as AN
from . import explicacao as EX
from . import validacao as V
from .nomes import Registro, chave, display
from .painel import LAYOUT_2026
from .posts import APELIDO, ETAPA, NOME_TIPO, frase, lei_num, rotulo_etapa

RAIZ = Path(__file__).resolve().parent.parent
NOME_SITE = "Voto a voto"
CIDADE = "Cubatão"
REPO = "https://github.com/wardernoob-dot/monitor-camara-cubatao"
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
FINAIS = ("2a_discussao", "discussao_unica", "redacao_final", "unica")
APELIDO_EXTRA = {"washington luiz lessa de souza": "Carioca", "maria jaqueline da silva": "Jaque Barbosa"}  # Jaque: confirmado pelo responsavel do site
ROTULO = {"SIM": "Sim", "NAO": "Não", "BRANCO": "Não votou", "AUSENTE": "Ausente", "?": "Ilegível"}


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def url_segura(u: str | None) -> str | None:
    """Garante que URLs exportadas para o front usam apenas http(s), evitando XSS via javascript:/data:."""
    if not u or not isinstance(u, str):
        return None
    u = u.strip()
    return u if u.startswith(("https://", "http://")) else None


def data_extenso(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def data_curta(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day:02d}/{d.month:02d}"


# =============================================================== montagem dos dados

class Base:
    def __init__(self, dados: Path):
        self.dados = Path(dados)
        self.reg = Registro()
        self.vereadores: dict[str, dict] = {}
        self.materias: dict[str, dict] = {}
        self.dias: list[dict] = []
        self.votacoes: list[dict] = []   # cada votacao nominal (painel ou resumo), em ordem cronologica
        self.presencas: dict[str, dict] = {}  # data -> {vereador: sim/ausente/justificada}
        self.partidos_pdf: dict[str, Counter] = defaultdict(Counter)
        self.cargos: dict[str, Counter] = defaultdict(Counter)  # "presidente"/"vice" -> chave -> ocorrencias

    # ------------------------------------------------------------ vereadores
    def carregar_vereadores(self):
        v = json.loads((self.dados / "vereadores.json").read_text("utf-8"))
        v = v.get("vereadores", v)
        recentes = set(LAYOUT_2026)
        for k, x in v.items():
            self.reg.adicionar(x["nome"])
            ap = APELIDO.get(k) or APELIDO_EXTRA.get(k)
            self.vereadores[k] = {
                "chave": k, "nome": x["nome"], "apelido": ap, "exibicao": ap or x["nome"],
                "slug": slug(ap or x["nome"]), "partido": x.get("bancada_declarada"),
                "em_exercicio": k in recentes, "presenca": x.get("presenca") or {},
                "votos": [], "projetos": [], "requerimentos": [], "iniciais": "".join(p[0] for p in (ap or x["nome"]).replace("Dr. ", "").split()[:2]).upper(),
            }
        for s in sorted((self.dados / "sessoes").glob("*.json")):
            j = json.loads(s.read_text("utf-8"))
            self.presencas.setdefault(s.name[:10], {}).update(j.get("presenca") or {})

    def autor(self, autoria: str | None) -> tuple[list[str], str]:
        """Texto de autoria -> (chaves de vereadores, rotulo exibivel)."""
        a = re.sub(r"\s+", " ", autoria or "").strip(" .-")
        if not a:
            return [], "Autoria não identificada"
        ku = chave(a)
        if "prefeit" in ku:
            return [], "Prefeito Municipal"
        if "mesa" in ku:
            return [], "Mesa da Câmara"
        if "tribunal de contas" in ku:
            return [], "Tribunal de Contas do Estado"
        chaves = []
        for parte in re.split(r",| E | e |/", a):
            k, _ = self.reg.resolver(parte)
            if k and k not in chaves:
                chaves.append(k)
        if chaves:
            return chaves, ", ".join(self.vereadores[k]["exibicao"] for k in chaves if k in self.vereadores)
        return [], display(a) if a.isupper() else a

    # ------------------------------------------------------------ projetos
    def materia(self, tipo: str, numero: str | None, ano: str | None) -> dict:
        k = slug(f"{tipo.lower()}-{numero or 'x'}-{ano or 'x'}")
        if k not in self.materias:
            self.materias[k] = {
                "id": k, "slug": k, "tipo": tipo, "numero": numero, "ano": ano, "assunto": None, "autoria_txt": None,
                "autores": [], "autoria": "Autoria não identificada", "pautas": [], "documento": None,
                "eventos": [], "lei": None, "veto": None, "analise": None, "divergencias": [],
            }
        return self.materias[k]

    def carregar_pautas_e_documentos(self):
        idx = json.loads((self.dados / "indice.json").read_text("utf-8"))
        texto_dir = (self.dados / "texto").resolve()
        for meta in idx.values():
            sha = str(meta.get("sha256") or "")
            p = (texto_dir / f"{sha}.txt").resolve() if AN.RE_SHA256.match(sha) else None
            p_ok = bool(p and p.is_relative_to(texto_dir) and p.exists())
            if meta["secao"] == "pauta" and p_ok:
                t = re.sub(r"\s+", " ", p.read_text("utf-8"))
                dt = _data_pauta(t)
                for c in V.candidatos([t]):
                    if c["tipo"] == "VETO":
                        continue
                    m = self.materia(c["tipo"], c["numero"], c["ano"])
                    if not m["assunto"] or len(c["assunto"]) > len(m["assunto"]):
                        m["assunto"] = c["assunto"]
                    m["autoria_txt"] = m["autoria_txt"] or c["autoria"]
                    if dt and dt not in m["pautas"]:
                        m["pautas"].append(dt)
            if meta["secao"] in ("projetos",) and p_ok:
                self._cargos(p.read_text("utf-8"))
            if meta["secao"] == "projetos":
                mu = AN.RE_URL_PROJ.search(meta["url"])
                mv = AN.RE_VETO_TIT.search(meta.get("titulo") or "")
                if mv:
                    pass  # oficio de veto: ligar_oficios_de_veto()
                elif mu:
                    m = self.materia(mu.group(1).upper(), mu.group(2), mu.group(3))
                    m["documento"] = meta["url"]
                    if not m["assunto"] and meta.get("titulo") and "MENSAGEM" not in meta["titulo"].upper():
                        m["assunto"] = meta["titulo"]
                    if not m["autoria_txt"] and p_ok:
                        m["autoria_txt"] = self._autor_do_pdf(p.read_text("utf-8"))
        for m in self.materias.values():
            m["autores"], m["autoria"] = self.autor(m["autoria_txt"])
            m["pautas"].sort()

    def _cargos(self, t: str):
        """'NOME / (apelido) / Presidente da Camara Municipal' em assinaturas e oficios."""
        linhas = [ln.strip(" _\t") for ln in t.splitlines()]
        for i, ln in enumerate(linhas):
            mm = re.match(r"(?i)^(vice[- ]?)?presidente da c[âa]mara", ln)
            if not mm:
                continue
            for j in range(max(0, i - 3), i):
                cand = re.sub(r"(?i)^vereador[a]?\s+|\(cid:\d+\)", "", linhas[j]).strip()
                k = self.reg.resolver(cand, cutoff=0.85)[0] if len(cand) > 6 else None
                if k:
                    self.cargos["vice" if mm.group(1) else "presidente"][k] += 1
                    break

    def _autor_do_pdf(self, t: str) -> str | None:
        if re.search(r"Prefeitura Municipal de Cubat", t[:400], re.I) or \
                re.search(r"(?im)^\s*Prefeito(?: Municipal)?\s*$", t[-2500:]):
            return "PREFEITO MUNICIPAL"
        ap = {chave(n): k for k, n in {**APELIDO, **APELIDO_EXTRA}.items()}
        nomes = []
        for nome, partido in _assinaturas(t):
            k = ap.get(chave(nome)) or self.reg.resolver(nome, cutoff=0.8)[0]
            if k and k in self.vereadores:
                if k not in nomes:
                    nomes.append(k)
                if partido:
                    self.partidos_pdf[k][partido] += 1
        if nomes:
            return " E ".join(self.vereadores[k]["nome"] for k in nomes)
        if mm := re.search(r"GABINETE (?:DO |DA )?VEREADOR[A]?\s+([A-ZÀ-Ü][A-ZÀ-Ü ]{5,60}?)\s*\n", t):
            return mm.group(1).strip()
        return None

    # ------------------------------------------------------------ votacoes (consolidado por dia)
    def carregar_votacoes(self):
        for arq in sorted((self.dados / "consolidado").glob("*.json")):
            c = json.loads(arq.read_text("utf-8"))
            dia = {"data": c["data"], "sessoes": c["sessoes"], "status": c["status"], "materias": [],
                   "noticias": c.get("noticias") or []}
            for mc in c["materias"]:
                if not mc["votacoes"]:
                    continue
                if mc["tipo"] == "RELATORIO":  # relatorio de comissao nao tem numero: um por dia de votacao
                    m = self.materia("RELATORIO", None, c["data"])
                else:
                    m = self.materia(mc["tipo"], mc["numero"], mc.get("ano") or (c["data"][:4] if mc["tipo"] in ("RQ", "MOCAO") else None))
                if mc.get("assunto") and (not m["assunto"] or (mc["tipo"] in ("RQ", "MOCAO", "RELATORIO"))):
                    m["assunto"] = mc["assunto"]
                if mc.get("autoria") and not m["autoria_txt"]:
                    m["autoria_txt"] = mc["autoria"]
                    m["autores"], m["autoria"] = self.autor(mc["autoria"])
                for pub in mc.get("diario_oficial") or []:
                    if pub.get("tipo") == "lei":
                        m["lei"] = {"numero": lei_num(pub["numero"]), "data": pub["data"], "url": pub.get("url")}
                    elif pub.get("tipo") == "veto" and not m["veto"]:
                        m["veto"] = {"alcance": pub.get("alcance") or "", "url": pub.get("url")}
                if mc["tipo"] == "VETO":
                    mv = re.search(r"PROJETO DE LEI(?: COMPLEMENTAR)?\s+N\S?\s*0*(\d{1,4})/(\d{4})", V._sem_acento_maiusc(mc.get("assunto") or ""))
                    if mv:
                        pl = self.materia("PL", mv.group(1), mv.group(2))
                        alc = re.search(r"VETO (INTEGRAL|PARCIAL|TOTAL)", V._sem_acento_maiusc(mc.get("assunto") or ""))
                        pl["veto"] = {**(pl["veto"] or {}), "alcance": (alc.group(1).lower() if alc else (pl["veto"] or {}).get("alcance", "")),
                                      "resultado": mc.get("resultado_oficial") or (pl["veto"] or {}).get("resultado"),
                                      "data": c["data"], "pagina": m["slug"]}
                        if not pl["assunto"]:
                            mt = re.search(r'QUE\s*[“"]?(.+?)[”"]?\s*$', mc.get("assunto") or "")
                            pl["assunto"] = mt.group(1) if mt else None
                        m["pl_vetado"] = pl["slug"]
                dia["materias"].append(m)
                for x in mc["votacoes"]:
                    ev = self._evento(c, m, x)
                    m["eventos"].append(ev)
                    if ev["votos"]:
                        self.votacoes.append(ev)
                    for d in (x.get("conferencia") or {}).get("divergencias", []):
                        if d["tipo"] in ("voto_divergente", "resumo_inclui_nao_votante", "resumo_inclui_ausente"):
                            m["divergencias"].append({**d, "etapa": ev["etapa_txt"], "data": c["data"],
                                                      "vereador_txt": self._nome(d["vereador"])})
            dia["materias"] = list({id(m): m for m in dia["materias"]}.values())
            self.dias.append(dia)

    def ligar_oficios_de_veto(self):
        """Oficio do prefeito (numero, data, PDF) e a leitura das razoes do veto, no projeto vetado."""
        from . import vetos as VT

        assuntos = {(m["tipo"], m["numero"], m["ano"]): m["assunto"] or "" for m in self.materias.values()
                    if m["numero"] and m["ano"] and m["tipo"] in ("PL", "PLC")}
        for o in VT.oficios(self.dados, assuntos):
            m = self.materia(o["tipo"], o["numero"], o["ano"])
            v = m["veto"] or {}
            v.update({"alcance": v.get("alcance") or o["alcance"], "url": o["url"], "oficio": o["oficio"],
                      "data_oficio": o["data_oficio"], "ligacao": o["ligacao"]})
            leitura = AN.carregar(self.dados, "VETO", o["numero"], o["ano"])
            if leitura and leitura.get("tipo_analise") == "veto":
                a = leitura["analise"]
                v["leitura"] = {"resumo": a["resumo"], "o_que_foi_vetado": a["o_que_foi_vetado"], "razoes": a["razoes"],
                                "fundamento": a["fundamento"], "limitacoes": a["limitacoes"],
                                "modelo": re.sub(r"^\w+ \((.+)\)$", r"\1", leitura["modelo"]),
                                "fonte": "texto do ofício (transcrição automática do PDF escaneado)"
                                if "transcricao" in leitura["documento"]["fonte"] else "texto do ofício publicado no site da Câmara"}
            m["veto"] = v
            # a pagina da votacao do veto mostra o mesmo oficio
            vv = self.materias.get(f"veto-{o['numero']}-{o['ano']}") or self.materias.get(f"veto-{o['numero']}-x")
            if vv is not None:
                vv["veto"] = v

    def _nome(self, k: str) -> str:
        return self.vereadores[k]["exibicao"] if k in self.vereadores else display(k)

    def _evento(self, c: dict, m: dict, x: dict) -> dict:
        p = x.get("painel") or {}
        r = x.get("resumo") or {}
        votos, fonte = {}, None
        if p.get("votos") and p.get("completo"):
            votos, fonte = dict(p["votos"]), "painel"
        elif r.get("por_acao"):
            fonte = "resumo"
            for acao, lista in r["por_acao"].items():
                s = "SIM" if acao.lower().startswith(("aprova", "manuten")) else "NAO"
                for v in lista:
                    votos[v] = s
            data_s = (r.get("sessao") or {}).get("data") or c["data"]
            for v, st in (self.presencas.get(data_s) or {}).items():
                if v not in votos and st in ("ausente", "justificada"):
                    votos[v] = "AUSENTE"
        res = p.get("resultado") or ""
        if not res and r.get("resultado"):
            res = "APROVADO" if r["resultado"].startswith("aprovado") else "REJEITADO" if r["resultado"].startswith("rejeitado") else ""
        if votos:
            sim = sum(1 for v in votos.values() if v == "SIM")
            nao = sum(1 for v in votos.values() if v == "NAO")
        elif r.get("placar") and (r["placar"].get("favor") or r["placar"].get("contra")):
            sim, nao = r["placar"].get("favor"), r["placar"].get("contra")
        else:
            sim = nao = None
        ev = {
            "data": c["data"], "materia": m, "etapa": x["etapa"], "etapa_txt": rotulo_etapa(x),
            "resultado": res, "sim": sim, "nao": nao, "votos": votos, "fonte": fonte,
            "link": p.get("link"), "detalhe": r.get("detalhe"), "resumo_url": r.get("fonte"), "lido": p.get("lido"),
            "grade": [], "ordem": len(self.votacoes),
        }
        for k in LAYOUT_2026:
            if k in votos:
                ev["grade"].append({"v": self.vereadores.get(k), "voto": votos[k]})
        for k, v in votos.items():
            if k not in LAYOUT_2026 and k in self.vereadores:
                ev["grade"].append({"v": self.vereadores[k], "voto": v})
        ev["grade"].sort(key=lambda g: (["SIM", "NAO", "BRANCO", "AUSENTE", "?"].index(g["voto"]), g["v"]["exibicao"]))
        return ev

    # ------------------------------------------------------------ derivados
    def finalizar(self):
        for ev in self.votacoes:
            for k, v in ev["votos"].items():
                if k not in self.vereadores:
                    continue
                contra = v in ("SIM", "NAO") and ev["resultado"] in ("APROVADO", "REJEITADO") and \
                    ((v == "SIM") != (ev["resultado"] == "APROVADO"))
                self.vereadores[k]["votos"].append({"ev": ev, "voto": v, "contra": contra})
        rank = {"parecer_emenda": 0, "emenda": 1, "parecer": 2, "1a_discussao": 3, "2a_discussao": 4,
                "discussao_unica": 4, "unica": 5, "redacao_final": 6}
        for m in self.materias.values():
            m["eventos"].sort(key=lambda e: (e["data"], rank.get(e["etapa"], 5), e["ordem"]))
            m["titulo"] = _titulo(m)
            m["assunto_txt"] = frase(m["assunto"]) if m["assunto"] else ""
            m["situacao"], m["situacao_cls"] = _situacao(m)
            an = AN.carregar(self.dados, m["tipo"], m["numero"], m["ano"]) if m["numero"] and m["ano"] else None
            if an and an.get("tipo_analise") != "veto" and not an["documento"].get("so_ementa"):
                m["analise"] = an
            m["autores_obj"] = [self.vereadores[k] for k in m["autores"] if k in self.vereadores]
            m["ultima_data"] = max([e["data"] for e in m["eventos"]] + m["pautas"] or [""])
            if m["tipo"] in ("RQ", "MOCAO"):
                m["assunto_txt"] = _desc_curta(m["assunto"])
            m["tema"] = tema(m)
            m["relevancia"] = relevancia(m)
            for e in m["eventos"]:
                e["sentido"] = sentido(e)
            for k in m["autores"]:
                if k in self.vereadores:
                    self.vereadores[k]["projetos" if m["tipo"] not in ("RQ", "MOCAO") else "requerimentos"].append(m)
        for k, cont in self.partidos_pdf.items():
            v = self.vereadores[k]
            if not v["partido"]:
                v["partido"] = cont.most_common(1)[0][0]
                v["partido_fonte"] = "assinatura em projeto de lei"
            elif v["partido"]:
                v.setdefault("partido_fonte", "resumo oficial de sessão")
        for cargo, cont in self.cargos.items():
            if cont:
                self.vereadores[cont.most_common(1)[0][0]]["cargo"] = cargo
        for v in self.vereadores.values():
            if v["partido"]:
                v.setdefault("partido_fonte", "resumo oficial de sessão")
            c = Counter(x["voto"] for x in v["votos"])
            v["contagem"] = {k: c.get(k, 0) for k in ("SIM", "NAO", "BRANCO", "AUSENTE")}
            v["total_votacoes"] = len(v["votos"])
            v["contra_resultado"] = sum(1 for x in v["votos"] if x["contra"])
            v["votos"].sort(key=lambda x: (x["ev"]["data"], x["ev"]["ordem"]), reverse=True)
            v["projetos"].sort(key=lambda m: m["ultima_data"], reverse=True)
            v["requerimentos"].sort(key=lambda m: m["ultima_data"], reverse=True)
            pres = v["presenca"]
            v["sessoes_total"] = sum(pres.values())
            v["leis"] = sum(1 for m in v["projetos"] if m["lei"])
            v["faltas"] = pres.get("ausente", 0) + pres.get("justificada", 0)
        self.dias.sort(key=lambda d: d["data"], reverse=True)
        calcular_indice(self)

    def materias_publicas(self) -> list[dict]:
        tipos = ("PL", "PLC", "PR", "PDL", "PELOM")
        return sorted((m for m in self.materias.values() if m["tipo"] in tipos and m["numero"] and m["ano"]),
                      key=lambda m: (m["ultima_data"], int(m["numero"])), reverse=True)


TEMAS = [
    ("Homenagens, datas e nomes de lugares", r"DENOMINA|CALENDARIO|DIA MUNICIPAL|SEMANA MUNICIPAL|MES MUNICIPAL|TITULO DE CIDAD|"
     r"UTILIDADE PUBLICA|HOMENAG|APLAUSO|CONGRATULA|PATRIMONIO CULTURAL|VOTO DE PESAR|MEDALHA"),
    ("Orçamento, impostos e finanças", r"ORCAMENT|CREDITO|ESTIMA A RECEITA|DESPESA|TRIBUT|IMPOSTO|\bTAXA|IPTU|\bISS\b|EMPRESTIMO|"
     r"FINANCIAMENTO|DIRETRIZES ORCAMENTARIAS|PLANO PLURIANUAL|FUNDO MUNICIPAL|GARANTIA DA UNIAO|DIVIDA"),
    ("Servidores e estrutura da Prefeitura", r"SERVIDOR|VENCIMENTO|\bCARGO|ESTRUTURA ADMINISTRATIVA|ESTRUTURA DA SECRETARIA|"
     r"REVISAO GERAL ANUAL|CARREIRA|ESTATUTO|CESSAO DE SERVIDORES|CONSELHO MUNICIPAL"),
    ("Saúde", r"SAUDE|AUTIS|\bTEA\b|DOENCA|HOSPITAL|MEDIC|GESTANTE|VACIN|FISIOTERAP|SANGUE|DEPENDENCIA|LUDOPATIA"),
    ("Educação e cultura", r"EDUCA|ESCOLA|CRECHE|ALUNO|ENSINO|CULTURA|ESPORT|LEITURA|BIBLIOTECA"),
    ("Assistência social e inclusão", r"DEFICIENCIA|IDOSO|MELHOR IDADE|ASSISTENCIA SOCIAL|VULNERAB|INCLUS|MULHER|CRIANCA|"
     r"ADOLESCENTE|EMPREGABILIDADE|FOME|ALIMENT|ACESSIBILIDADE|LIBRAS"),
    ("Meio ambiente e animais", r"ANIMA|AMBIENT|RESIDUO|LIXO|ARBORIZ|MANGUE|RECICL|SONORO|POLUI"),
    ("Trânsito, transporte e cidade", r"TRANSITO|TRANSPORTE|ONIBUS|VEICULO|BICICLET|CALCADA|ESTACIONAMENTO|URBAN|IMOVEL|OBRA|"
     r"MOBILIDADE|FAIXA"),
    ("Segurança", r"SEGURANCA|GUARDA|VIGILANCIA|MONITORAMENTO|VIOLENCIA"),
    ("Funcionamento da Câmara", r"REGIMENTO|RESOLUCAO N|CAMARA MUNICIPAL|COMISSAO ESPECIAL|\bCEI\b|\bCEV\b|LEI ORGANICA|"
     r"PRORROGACAO DE CEV|ATO SOLENE|SESSAO SOLENE"),
]


def tema(m: dict) -> str:
    if m["tipo"] == "PELOM":
        return "Funcionamento da Câmara" if re.search("CAMARA", V._sem_acento_maiusc(m["assunto"] or "")) else "Lei Orgânica"
    u = V._sem_acento_maiusc(f"{m.get('assunto') or ''}")
    for nome, rx in TEMAS:
        if re.search(rx, u):
            return nome
    return "Outros"


def relevancia(m: dict) -> dict:
    """Regras publicas e objetivas (tambem descritas em 'Como funciona'). Nao avalia se e bom ou ruim."""
    alta, media = [], []
    t = m.get("tema")
    if t == "Orçamento, impostos e finanças":
        alta.append("Mexe no orçamento, em impostos ou nas finanças da cidade")
    if m["tipo"] == "PELOM":
        alta.append("Muda a Lei Orgânica, a lei mais importante do município")
    if t == "Servidores e estrutura da Prefeitura":
        alta.append("Mexe com servidores ou com a estrutura da Prefeitura")
    if m.get("veto"):
        alta.append("Foi vetado pelo prefeito")
    decisivos = [e for e in m["eventos"] if e["etapa"] not in ("parecer", "parecer_emenda", "emenda")]
    if any((e["nao"] or 0) >= 3 for e in decisivos):
        e = max(decisivos, key=lambda e: e["nao"] or 0)
        alta.append(f"Votação dividida ({e['sim']} a {e['nao']})")
    if any(e["resultado"] == "REJEITADO" for e in decisivos):
        alta.append("Foi rejeitado pela Câmara")
    if any(e["etapa"] == "parecer" and "contr" in e["etapa_txt"].lower() for e in m["eventos"]):
        media.append("Teve parecer contrário de comissão")
    if t in ("Saúde", "Educação e cultura", "Assistência social e inclusão", "Meio ambiente e animais",
             "Trânsito, transporte e cidade", "Segurança") and m["tipo"] in ("PL", "PLC"):
        media.append("Cria regra, programa ou obrigação para a cidade")
    if alta:
        return {"nivel": "alta", "motivos": alta + media}
    if media:
        return {"nivel": "media", "motivos": media}
    motivo = "Homenagem, data comemorativa ou nome de lugar" if t and t.startswith("Homenagens") else "Sem critério de destaque"
    return {"nivel": "baixa", "motivos": [motivo]}


def sentido(e: dict) -> str | None:
    """O que um SIM significa para o projeto nesta etapa."""
    t = e["etapa_txt"].lower()
    if e["etapa"] in ("emenda", "parecer_emenda"):
        return "emenda"
    if e["etapa"] == "parecer":
        return "inverso" if "contr" in t else "direto" if "favor" in t else None
    if e["materia"]["tipo"] == "VETO":
        return None
    return "direto"


# =============================================================== indice de atuacao (0 a 10)

PESO_SIMBOLICO = 0.3
APROVADOS = ("aprovado", "lei", "veto")
TIPOS_PRODUCAO = ("PL", "PLC", "PR", "PDL", "PELOM")
MIN_SESSOES = 10
RE_RQ_PROCEDIMENTO = re.compile(r"SOLICITANDO QUE O PROCESSO|REGIME DE URGENCIA|SESSAO SECRETA|SOLICITANDO A PRORROGACAO|ATO SOLENE|SESSAO SOLENE")
RE_AUTOR_LIDO = re.compile(r"Autor(?:ia)?\s*:\s*(?:Vereador[a]?\s+)?(.+)$", re.I)


def _peso_tema(m: dict) -> float:
    t = m.get("tema") or ""
    if t.startswith("Homenagens"):
        return PESO_SIMBOLICO
    if m["tipo"] == "RQ" and (t == "Funcionamento da Câmara" or RE_RQ_PROCEDIMENTO.search(V._sem_acento_maiusc(m.get("assunto") or ""))):
        return PESO_SIMBOLICO  # pedido de procedimento interno (urgencia, prorrogacao, sessao secreta): nao e cobranca ao Executivo
    return 1.0


def _br(x: float, casas: int = 2) -> str:
    return f"{x:.{casas}f}".replace(".", ",")


def _pct(a: float, b: float) -> float:
    return a / b if b else 0.0


def calcular_indice(b: "Base") -> None:
    """Indice de Atuacao em 4 pilares (25 + 25 + 35 + 15 = 100 pontos, exibido de 0 a 10).
    Toda conta fica registrada em v['indice']['pilares'][...]['itens'][...]['conta'] (memoria de calculo)."""
    ap = {chave(n): k for k, n in {**APELIDO, **APELIDO_EXTRA}.items()}
    vs = b.vereadores

    # producao ponderada: tema (homenagem 0,3) e coautoria (1/raiz de k)
    prod = {k: {"apresentados": 0.0, "aprovados": 0.0, "leis": 0.0, "n_ap": 0, "n_aprov": 0, "n_leis": 0} for k in vs}
    fisc = {k: {"rq": 0.0, "n_rq": 0, "emendas": 0.0, "n_em": 0} for k in vs}
    for m in b.materias.values():
        autores = [k for k in m["autores"] if k in vs]
        if not autores:
            continue
        w = _peso_tema(m) / (len(autores) ** 0.5)
        for k in autores:
            if m["tipo"] in TIPOS_PRODUCAO:
                prod[k]["apresentados"] += w
                prod[k]["n_ap"] += 1
                if m["situacao_cls"] in APROVADOS:
                    prod[k]["aprovados"] += w
                    prod[k]["n_aprov"] += 1
                if m["lei"] or (m["veto"] or {}).get("resultado") == "veto_derrubado":
                    prod[k]["leis"] += w
                    prod[k]["n_leis"] += 1
            elif m["tipo"] == "RQ" and m["situacao_cls"] in APROVADOS:
                fisc[k]["rq"] += w
                fisc[k]["n_rq"] += 1
    # emendas e relatorios: autor lido no painel (so desde set/2026)
    vistos = set()
    for m in b.materias.values():
        for e in m["eventos"]:
            if e["etapa"] not in ("emenda", "unica") or not e.get("lido"):
                continue
            if e["etapa"] == "unica" and m["tipo"] != "RELATORIO":
                continue
            ma = RE_AUTOR_LIDO.search(e["lido"])
            k = ap.get(chave(ma.group(1))) if ma else None
            k = k or (b.reg.resolver(ma.group(1), cutoff=0.8)[0] if ma else None)
            if k in fisc and (m["slug"], k) not in vistos:
                vistos.add((m["slug"], k))
                fisc[k]["emendas"] += 1
                fisc[k]["n_em"] += 1

    base_norm = [k for k, v in vs.items() if v["em_exercicio"] and v["sessoes_total"] >= MIN_SESSOES]
    def teto(d, campo):
        return max([d[k][campo] for k in base_norm] + [0.0])
    tetos = {c: teto(prod, c) for c in ("apresentados", "aprovados", "leis")}
    tetos.update({c: teto(fisc, c) for c in ("rq", "emendas")})

    for k, v in vs.items():
        pres = v["presenca"]
        s_tot = v["sessoes_total"]
        s_p, s_j, s_a = pres.get("sim", 0), pres.get("justificada", 0), pres.get("ausente", 0)
        painel = [x for x in v["votos"] if x["ev"]["fonte"] == "painel"]
        c = Counter(x["voto"] for x in painel)
        presente_painel = c["SIM"] + c["NAO"] + c["BRANCO"]
        alta = [x for x in painel if x["ev"]["materia"]["relevancia"]["nivel"] == "alta"]
        ca = Counter(x["voto"] for x in alta)
        presente_alta = ca["SIM"] + ca["NAO"] + ca["BRANCO"]
        presidente = v.get("cargo") == "presidente"

        def item(nome, pts, mx, conta):
            return {"nome": nome, "pontos": round(pts, 2), "max": mx, "conta": conta}

        a1 = 15 * max(0.0, _pct(s_p - 0.5 * s_j - 1.5 * s_a, s_tot))
        b1 = 10 * (1 - _pct(c["AUSENTE"], len(painel))) if painel else 0.0
        pil1 = [item("Presença nas sessões", a1, 15,
                     f"{s_p} presenças, {s_j} faltas justificadas (peso 0,5) e {s_a} sem justificativa (peso 1,5) em {s_tot} sessões: "
                     f"15 × ({s_p} − 0,5×{s_j} − 1,5×{s_a}) / {s_tot}"),
                item("No plenário na hora de votar", b1, 10,
                     f"ausente em {c['AUSENTE']} de {len(painel)} votações do painel (desde set/2026): 10 × (1 − {c['AUSENTE']}/{len(painel)})"
                     if painel else "sem votações do painel")]
        a2 = 15 * _pct(c["SIM"] + c["NAO"], presente_painel)
        b2 = 10 * _pct(ca["SIM"] + ca["NAO"], presente_alta)
        pil2 = [item("Votou quando estava presente", a2, 15,
                     f"votou sim ou não em {c['SIM'] + c['NAO']} das {presente_painel} votações do painel em que estava presente"),
                item("Votou nos projetos em destaque", b2, 10,
                     f"votou sim ou não em {ca['SIM'] + ca['NAO']} das {presente_alta} votações de projetos em destaque em que estava presente")]
        p = prod[k]
        pil3 = [item("Projetos apresentados", 15 * _pct(p["apresentados"], tetos["apresentados"]), 15,
                     f"{p['n_ap']} projetos, {_br(p['apresentados'], 2)} pontos ponderados (homenagem vale 0,3; coautoria divide por √autores); "
                     f"maior da Câmara: {_br(tetos['apresentados'], 2)}"),
                item("Projetos aprovados", 10 * _pct(p["aprovados"], tetos["aprovados"]), 10,
                     f"{p['n_aprov']} aprovados, {_br(p['aprovados'], 2)} ponderados; maior da Câmara: {_br(tetos['aprovados'], 2)}"),
                item("Viraram lei", 10 * _pct(p["leis"], tetos["leis"]), 10,
                     f"{p['n_leis']} viraram lei (Diário Oficial do ano) ou tiveram o veto derrubado, {_br(p['leis'], 2)} ponderados; "
                     f"maior da Câmara: {_br(tetos['leis'], 2)}")]
        f = fisc[k]
        pil4 = [item("Requerimentos aprovados", 10 * _pct(f["rq"], tetos["rq"]), 10,
                     f"{f['n_rq']} requerimentos aprovados, {_br(f['rq'], 2)} ponderados (homenagem e pedido de procedimento interno, como urgência ou prorrogação, valem 0,3); "
                     f"maior da Câmara: {_br(tetos['rq'], 2)}"),
                item("Emendas e relatórios de comissão", 5 * _pct(f["emendas"], tetos["emendas"]), 5,
                     f"{f['n_em']} emendas ou relatórios votados com autoria no painel (desde set/2026); maior da Câmara: {_br(tetos['emendas'], 0)}")]
        sem_painel = not painel
        if sem_painel:  # nao exerceu mandato no periodo do painel: o item nao conta (peso redistribuido)
            pil1[1]["nao_se_aplica"] = True
            pil1[1]["conta"] = "não exerceu mandato no período com painel (desde set/2026); item não entra na nota"
        pilares = [
            {"id": "assiduidade", "nome": "Assiduidade", "max": 25 if not sem_painel else 15, "itens": pil1},
            {"id": "participacao", "nome": "Participação nas votações", "max": 25, "itens": pil2,
             "nao_se_aplica": presidente or sem_painel},
            {"id": "producao", "nome": "Produção legislativa", "max": 35, "itens": pil3},
            {"id": "fiscalizacao", "nome": "Fiscalização e plenário", "max": 15, "itens": pil4},
        ]
        for pl in pilares:
            pl["pontos"] = round(sum(i["pontos"] for i in pl["itens"] if not i.get("nao_se_aplica")), 2)
        conta = [pl for pl in pilares if not pl.get("nao_se_aplica")]
        total_max = sum(pl["max"] for pl in conta)
        nota = 10 * sum(pl["pontos"] for pl in conta) / total_max if total_max else 0
        v["indice"] = {"nota": round(nota, 1), "pilares": pilares, "parcial": s_tot < MIN_SESSOES or sem_painel,
                       "presidente": presidente, "pontos_validos": total_max}

    # media da Camara (titulares com amostra cheia)
    for pl_i in range(4):
        vals = [vs[k]["indice"]["pilares"][pl_i]["pontos"] for k in base_norm
                if not vs[k]["indice"]["pilares"][pl_i].get("nao_se_aplica")]
        media = round(sum(vals) / len(vals), 2) if vals else 0
        for v in vs.values():
            v["indice"]["pilares"][pl_i]["media_camara"] = media
    notas = [vs[k]["indice"]["nota"] for k in base_norm]
    for v in vs.values():
        v["indice"]["media_camara"] = round(sum(notas) / len(notas), 1) if notas else 0


def _data_pauta(t: str) -> str | None:
    u = V._sem_acento_maiusc(t[:400])
    mm = re.search(r"DIA (\d{1,2}) DE ([A-Z]+) DE (\d{4})", u)
    if not mm:
        return None
    nomes = [chave(x).upper() for x in MESES]
    if mm.group(2) not in nomes:
        return None
    return f"{mm.group(3)}-{nomes.index(mm.group(2)) + 1:02d}-{int(mm.group(1)):02d}"


RE_PARTIDOS = r"(PSDB|PSB|PSD|PL|PT|MDB|PP|PDT|PODEMOS|PODE|REPUBLICANOS|UNI[ÃA]O BRASIL|AGIR|AVANTE|SOLIDARIEDADE|CIDADANIA|PSOL|NOVO|PRD|PV|PCDOB|DC|MOBILIZA)"


def _assinaturas(t: str) -> list[tuple[str, str | None]]:
    """Assinaturas 'Nome / Vereador PARTIDO' ou 'Vereador Nome - PARTIDO' -> [(nome, partido)]."""
    linhas = [ln.strip(" _\t") for ln in t.splitlines()]
    out = []
    for i, ln in enumerate(linhas):
        mm = re.match(r"(?i)^vereador[a]?\b\s*(.*)$", ln)
        if not mm or any(re.search(r"(?i)excel|senhor|^a\s*$|^ao\s", x) for x in linhas[max(0, i - 2):i]):
            continue  # destinatario de oficio ("A Vossa Excelencia o Senhor Vereador X, Presidente"), nao autor
        resto = mm.group(1)
        pm = re.search(RE_PARTIDOS, resto, re.I)
        partido = pm.group(1).upper().replace("UNIAO", "UNIÃO") if pm else None
        nome = re.split(r"\s+[-–]\s+|" + RE_PARTIDOS, resto, flags=re.I)[0].strip(" -–") if resto else ""
        if len(nome) < 4:
            j = i - 1
            while j >= 0 and not linhas[j]:
                j -= 1
            nome = linhas[j] if j >= 0 else ""
        if 4 <= len(nome) <= 60 and not re.search(r"\d|c[âa]mara|presidente|sala|nobres", nome, re.I):
            out.append((nome, partido))
    return out


def _desc_curta(t: str | None) -> str:
    """'Aprovado o Requerimento n 61, de autoria do Vereador X, solicitando Y' -> 'Solicitando Y'."""
    t = re.sub(r"\s+", " ", t or "").strip()
    t = re.sub(r"^Aprovad[oa]s?\s+(?:o|a)\s+\w+\s+n\S*\s*[\d.]+(?:/\d{4})?,?\s*", "", t, flags=re.I)
    t = re.sub(r"^de autoria d[oa]s?\s+Vereador(?:a|es)?\s+.+?,\s*", "", t, flags=re.I)
    return (t[:1].upper() + t[1:]) if t else ""


def _titulo(m: dict) -> str:
    if m["tipo"] == "RELATORIO":
        a, mes, d = (m["ano"] or "0000-00-00").split("-")
        return f"Relatório de comissão ({d}/{mes}/{a})"
    n = f"{m['numero']}/{m['ano']}" if m["ano"] else (m["numero"] or "")
    if m["tipo"] in ("MOCAO", "RELATORIO"):
        return f"{NOME_TIPO[m['tipo']]} {n}".strip()
    return f"{m['tipo']} {n}"


def _situacao(m: dict) -> tuple[str, str]:
    if m["lei"]:
        return f"Virou a Lei {m['lei']['numero']}", "lei"
    if m["veto"]:
        r = m["veto"].get("resultado") or ""
        if r == "veto_derrubado":
            return "Veto do prefeito derrubado pela Câmara", "veto"
        if r == "veto_mantido":
            return f"Vetado pelo prefeito ({m['veto']['alcance']}); veto mantido", "veto"
        return f"Vetado pelo prefeito ({m['veto']['alcance']}); falta a Câmara votar o veto", "veto"
    decisivos = [e for e in m["eventos"] if e["etapa"] not in ("parecer", "parecer_emenda", "emenda") and e["resultado"]]
    if decisivos:
        u = decisivos[-1]
        if u["resultado"] == "REJEITADO":
            return "Rejeitado pela Câmara", "rejeitado"
        if u["etapa"] in FINAIS:
            return "Aprovado pela Câmara", "aprovado"
        return f"Aprovado em {u['etapa_txt'].lower()}", "andamento"
    com_res = [e for e in m["eventos"] if e["resultado"]]
    if com_res:
        u = com_res[-1]
        return f"{u['etapa_txt']}: {'aprovado' if u['resultado'] == 'APROVADO' else 'rejeitado'}", "andamento"
    if m["pautas"]:
        return "Na pauta, sem votação registrada", "pauta"
    return "Protocolado", "pauta"


def montar(dados: Path) -> Base:
    b = Base(dados)
    b.carregar_vereadores()
    b.carregar_pautas_e_documentos()
    b.carregar_votacoes()
    b.ligar_oficios_de_veto()
    b.finalizar()
    return b


# =============================================================== exportacao (consumida pelo app React em frontend/)

def _ev_json(ev: dict, vslug: dict) -> dict:
    return {
        "id": ev["id"], "data": ev["data"], "materia": ev["materia"]["slug"], "etapa": ev["etapa"],
        "etapa_txt": ev["etapa_txt"], "resultado": ev["resultado"] or None, "sim": ev["sim"], "nao": ev["nao"],
        "fonte": ev["fonte"], "link": url_segura(ev["link"]), "resumo_url": url_segura(ev["resumo_url"]),
        "detalhe": ev["detalhe"],
        "votos": {vslug[k]: v for k, v in ev["votos"].items() if k in vslug},
        "sentido": ev.get("sentido"),
    }


FOTOS_ORIGINAIS = RAIZ / "fotos"


def preparar_fotos(vereadores: dict) -> dict[str, str]:
    """Fotos colocadas pelo responsavel do site em fotos/ (qualquer nome que lembre o vereador:
    'xuxa.jpg', 'Daniel Barbosa.png', 'DANIEL_BARBOSA_DE_ASSIS.jpeg'). Recorta quadrado puxando
    pro rosto, reduz pra 480 px e grava docs/fotos/<slug>.webp. Devolve {slug: caminho no site}."""
    from PIL import Image, ImageOps

    destino = RAIZ / "docs" / "fotos"
    destino.mkdir(parents=True, exist_ok=True)
    if not FOTOS_ORIGINAIS.exists():
        return {}
    nomes = {}
    for v in vereadores.values():
        for n in (v["slug"], v["nome"], v.get("apelido") or ""):
            if n:
                nomes[slug(n)] = v["slug"]
    out = {}
    for arq in sorted(FOTOS_ORIGINAIS.iterdir()):
        if arq.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        # "ivan.jpg..jpg", "guilherme_amaral..jpg": tira extensoes e pontos repetidos
        base = re.sub(r"(?i)(\.+(jpe?g|png|webp))+\.*$", "", arq.name).strip(". ")
        k = slug(base)
        alvo = nomes.get(k)
        if not alvo:
            import difflib
            hit = difflib.get_close_matches(k, list(nomes), n=1, cutoff=0.75)
            alvo = nomes[hit[0]] if hit else None
        if not alvo and k:
            # todas as palavras do arquivo aparecem no nome de um vereador so ("ivan", "guilherme amaral")
            palavras = set(k.split("-")) - {"da", "de", "do", "dos", "das", "e"}
            donos = {s_ for n, s_ in nomes.items() if palavras <= set(n.split("-"))}
            alvo = donos.pop() if len(donos) == 1 else None
        if not alvo:
            print(f"  ! foto sem vereador correspondente: {arq.name}")
            continue
        final = destino / f"{alvo}.webp"
        if not final.exists() or final.stat().st_mtime < arq.stat().st_mtime:
            im = ImageOps.exif_transpose(Image.open(arq)).convert("RGB")
            lado = min(im.size)
            x = (im.width - lado) // 2
            y = max(0, min(int(im.height * 0.08), im.height - lado)) if im.height > im.width else 0
            alvo_px = min(lado, 480)  # nao amplia foto pequena (fica borrada)
            im.crop((x, y, x + lado, y + lado)).resize((alvo_px, alvo_px), Image.LANCZOS).save(final, "WEBP", quality=85)
        out[alvo] = f"fotos/{alvo}.webp"
    return out


def _explicacao(m: dict, explic: dict) -> dict | None:
    if m["analise"]:
        a = m["analise"]
        return {"texto": a["analise"]["resumo"], "base": "o texto integral do projeto",
                "modelo": re.sub(r"^\w+ \((.+)\)$", r"\1", a["modelo"])}
    e = explic.get(m["slug"])
    if e and "incompleta" not in e["texto"].lower():
        return {"texto": e["texto"], "base": "a descrição oficial (ementa)", "modelo": e["modelo"]}
    return None


def exportar(dados: Path, saida: Path | None = None) -> dict:
    """Grava docs/data/dados.json (tudo que o app precisa) e docs/data/analises/<projeto>.json (sob demanda)."""
    dados = Path(dados)
    saida = Path(saida or RAIZ / "docs" / "data")
    b = montar(dados)
    vslug = {k: v["slug"] for k, v in b.vereadores.items()}
    publicas = b.materias_publicas()
    ids_publicas = {m["id"] for m in publicas}
    eventos = sorted((ev for m in b.materias.values() for ev in m["eventos"]), key=lambda e: (e["data"], e["ordem"]))
    for i, ev in enumerate(eventos):
        ev["id"] = i
    for m in b.materias.values():
        m["tem_pagina"] = bool(m["eventos"]) or (bool(m["numero"]) and m["id"] in ids_publicas)
    paginas = {m["slug"] for m in b.materias.values() if m["tem_pagina"]}
    if saida.exists():
        shutil.rmtree(saida)
    (saida / "analises").mkdir(parents=True)

    fotos = preparar_fotos(b.vereadores)
    EX.gerar(dados, [{"id": m["slug"], "tipo": NOME_TIPO.get(m["tipo"], m["tipo"]), "titulo": m["titulo"],
                      "autoria": m["autoria"], "ementa": m["assunto_txt"]}
                     for m in b.materias.values() if m["tem_pagina"] and not m["analise"]])
    explic = EX.carregar(dados)
    vereadores = []
    for v in sorted(b.vereadores.values(), key=lambda v: v["exibicao"]):
        if not v["em_exercicio"] and v["sessoes_total"] < 1:
            vslug.pop(v["chave"], None)  # suplente de 1 ou 2 sessoes: aparece so pelo nome, sem pagina
            continue
        vereadores.append({
            "slug": v["slug"], "exibicao": v["exibicao"], "nome": v["nome"], "iniciais": v["iniciais"],
            "partido": v["partido"], "partido_fonte": v.get("partido_fonte"), "cargo": v.get("cargo"),
            "em_exercicio": v["em_exercicio"], "contagem": v["contagem"], "total_votacoes": v["total_votacoes"],
            "contra_resultado": v["contra_resultado"], "sessoes_total": v["sessoes_total"], "presenca": v["presenca"],
            "faltas": v["faltas"], "leis": v["leis"], "indice": v["indice"],
            "foto": fotos.get(v["slug"]),
            "projetos": [m["slug"] for m in v["projetos"] if m["slug"] in paginas],
            "requerimentos": [m["slug"] for m in v["requerimentos"] if m["slug"] in paginas],
        })
    materias = []
    for m in b.materias.values():
        if not m["tem_pagina"]:
            continue
        if m["analise"]:
            an = m["analise"]
            pasta_an = (saida / "analises").resolve()
            arq_an = (pasta_an / f"{slug(m['slug'])}.json").resolve()
            if arq_an.is_relative_to(pasta_an):
                arq_an.write_text(json.dumps({
                    "modelo": re.sub(r"^\w+ \((.+)\)$", r"\1", an["modelo"]),
                    "fonte": an["documento"]["fonte"].split(" (")[0], **{k: an["analise"][k] for k in (
                        "resumo", "o_que_muda", "quem_e_afetado", "justificativa_do_autor", "pontos_de_atencao", "limitacoes")},
                }, ensure_ascii=False), "utf-8")
        lei_obj = {**m["lei"], "url": url_segura(m["lei"].get("url"))} if m["lei"] else None
        veto_obj = ({**m["veto"], "url": url_segura(m["veto"].get("url"))}
                    if m["veto"] and "url" in m["veto"] else m["veto"])
        materias.append({
            "slug": m["slug"], "titulo": m["titulo"], "tipo": m["tipo"], "tipo_nome": NOME_TIPO.get(m["tipo"], m["tipo"]),
            "numero": m["numero"], "ano": m["ano"], "assunto": m["assunto_txt"], "autoria": m["autoria"],
            "autores": [vslug[k] for k in m["autores"] if k in vslug], "situacao": m["situacao"],
            "situacao_cls": m["situacao_cls"], "pautas": m["pautas"], "documento": url_segura(m["documento"]),
            "lei": lei_obj, "veto": veto_obj, "ultima_data": m["ultima_data"], "eventos": [e["id"] for e in m["eventos"]],
            "divergencias": [{"etapa": d["etapa"], "data": d["data"], "vereador": vslug.get(d["vereador"]),
                              "vereador_txt": d["vereador_txt"], "painel": d["painel"], "resumo": d["resumo"]}
                             for d in m["divergencias"]],
            "analise": bool(m["analise"]), "lista": m["id"] in ids_publicas,
            "tema": m["tema"], "relevancia": m["relevancia"], "explicacao": _explicacao(m, explic),
        })
    dias = [{"data": d["data"], "sessoes": d["sessoes"], "status": d["status"],
             "materias": [m["slug"] for m in d["materias"] if m["slug"] in paginas],
             "noticias": [{"titulo": n["titulo"], "url": url_segura(n["url"]) or ""} for n in d["noticias"] if url_segura(n["url"])]} for d in b.dias]
    pacote = {
        "meta": {"atualizado": datetime.now(timezone.utc).isoformat(timespec="minutes"), "nome_site": NOME_SITE,
                 "cidade": CIDADE, "repo": REPO},
        "vereadores": vereadores, "materias": sorted(materias, key=lambda m: (m["ultima_data"], int(m["numero"] or 0)), reverse=True),
        "votacoes": [_ev_json(e, vslug) for e in eventos], "dias": dias,
    }
    (saida / "dados.json").write_text(json.dumps(pacote, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tam = (saida / "dados.json").stat().st_size // 1024
    print(f"  site: dados.json ({tam} KB), {len(vereadores)} vereadores, {len(materias)} materias, "
          f"{len(eventos)} votacoes, {len(list((saida / 'analises').glob('*.json')))} analises")
    return {"vereadores": len(vereadores), "materias": len(materias), "votacoes": len(eventos)}


gerar = exportar  # nome antigo usado no pipeline
