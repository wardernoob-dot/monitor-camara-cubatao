"""Site estatico (docs/) a partir dos dados ja coletados. Servivel por GitHub Pages ou qualquer dominio.

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

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import analise as AN
from . import validacao as V
from .nomes import Registro, chave, display
from .painel import LAYOUT_2026
from .posts import APELIDO, ETAPA, NOME_TIPO, frase, lei_num, rotulo_etapa

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
NOME_SITE = "Voto a voto"
CIDADE = "Cubatão"
REPO = "https://github.com/wardernoob-dot/monitor-camara-cubatao"
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
FINAIS = ("2a_discussao", "discussao_unica", "redacao_final", "unica")
APELIDO_EXTRA = {"washington luiz lessa de souza": "Carioca"}
ROTULO = {"SIM": "Sim", "NAO": "Não", "BRANCO": "Não votou", "AUSENTE": "Ausente", "?": "Ilegível"}


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


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
        k = f"{tipo.lower()}-{numero or 'x'}-{ano or 'x'}"
        if k not in self.materias:
            self.materias[k] = {
                "id": k, "slug": k, "tipo": tipo, "numero": numero, "ano": ano, "assunto": None, "autoria_txt": None,
                "autores": [], "autoria": "Autoria não identificada", "pautas": [], "documento": None,
                "eventos": [], "lei": None, "veto": None, "analise": None, "divergencias": [],
            }
        return self.materias[k]

    def carregar_pautas_e_documentos(self):
        idx = json.loads((self.dados / "indice.json").read_text("utf-8"))
        for meta in idx.values():
            p = self.dados / "texto" / f"{meta['sha256']}.txt"
            if meta["secao"] == "pauta" and p.exists():
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
            if meta["secao"] in ("projetos",) and p.exists():
                self._cargos(p.read_text("utf-8"))
            if meta["secao"] == "projetos":
                mu = AN.RE_URL_PROJ.search(meta["url"])
                mv = AN.RE_VETO_TIT.search(meta.get("titulo") or "")
                if mv:
                    m = self.materia("PL", mv.group(2), mv.group(3))
                    m["veto"] = {"alcance": mv.group(1).lower(), "url": meta["url"]}
                elif mu:
                    m = self.materia(mu.group(1).upper(), mu.group(2), mu.group(3))
                    m["documento"] = meta["url"]
                    if not m["assunto"] and meta.get("titulo") and "MENSAGEM" not in meta["titulo"].upper():
                        m["assunto"] = meta["titulo"]
                    if not m["autoria_txt"] and p.exists():
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
        sim = sum(1 for v in votos.values() if v == "SIM")
        nao = sum(1 for v in votos.values() if v == "NAO")
        if not votos and r.get("placar"):
            sim, nao = r["placar"].get("favor"), r["placar"].get("contra")
        ev = {
            "data": c["data"], "materia": m, "etapa": x["etapa"], "etapa_txt": rotulo_etapa(x),
            "resultado": res, "sim": sim, "nao": nao, "votos": votos, "fonte": fonte,
            "link": p.get("link"), "detalhe": r.get("detalhe"), "resumo_url": r.get("fonte"),
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
            if an and not an["documento"]["so_ementa"]:
                m["analise"] = an
            m["autores_obj"] = [self.vereadores[k] for k in m["autores"] if k in self.vereadores]
            m["ultima_data"] = max([e["data"] for e in m["eventos"]] + m["pautas"] or [""])
            if m["tipo"] in ("RQ", "MOCAO"):
                m["assunto_txt"] = _desc_curta(m["assunto"])
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
        self.dias.sort(key=lambda d: d["data"], reverse=True)

    def materias_publicas(self) -> list[dict]:
        tipos = ("PL", "PLC", "PR", "PDL", "PELOM")
        return sorted((m for m in self.materias.values() if m["tipo"] in tipos and m["numero"] and m["ano"]),
                      key=lambda m: (m["ultima_data"], int(m["numero"])), reverse=True)


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
    n = f"{m['numero']}/{m['ano']}" if m["ano"] else (m["numero"] or "")
    if m["tipo"] in ("MOCAO", "RELATORIO"):
        return f"{NOME_TIPO[m['tipo']]} {n}".strip()
    return f"{m['tipo']} {n}"


def _situacao(m: dict) -> tuple[str, str]:
    if m["lei"]:
        return f"Virou a Lei {m['lei']['numero']}", "lei"
    if m["veto"]:
        return f"Vetado pelo prefeito ({m['veto']['alcance']})", "veto"
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
    b.finalizar()
    return b


# =============================================================== renderizacao

def _env() -> Environment:
    env = Environment(loader=FileSystemLoader(WEB / "templates"), autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    env.filters.update({"extenso": data_extenso, "curta": data_curta, "rotulo": lambda v: ROTULO.get(v, v),
                        "lower1": lambda s: (s[:1].lower() + s[1:]) if s else s})
    env.globals.update({"NOME_SITE": NOME_SITE, "CIDADE": CIDADE, "REPO": REPO, "NOME_TIPO": NOME_TIPO, "ETAPA": ETAPA})
    return env


def gerar(dados: Path, saida: Path | None = None) -> dict:
    dados = Path(dados)
    saida = Path(saida or RAIZ / "docs")
    b = montar(dados)
    env = _env()
    if saida.exists():
        shutil.rmtree(saida)
    shutil.copytree(WEB / "static", saida / "static")
    (saida / ".nojekyll").write_text("", "utf-8")
    agora = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    paginas = 0

    def escreve(rel: str, tpl: str, **ctx):
        nonlocal paginas
        prof = rel.count("/")
        destino = saida / rel / "index.html" if rel else saida / "index.html"
        destino.parent.mkdir(parents=True, exist_ok=True)
        html = env.get_template(tpl).render(raiz="../" * (prof + 1 if rel else 0) or "./", atualizado=agora,
                                             caminho=rel, **ctx)
        destino.write_text(html, "utf-8")
        paginas += 1

    atuais = sorted((v for v in b.vereadores.values() if v["em_exercicio"]), key=lambda v: v["exibicao"])
    outros = sorted((v for v in b.vereadores.values() if not v["em_exercicio"] and v["sessoes_total"] >= 5),
                    key=lambda v: v["exibicao"])
    mats = b.materias_publicas()
    for m in b.materias.values():
        m["tem_pagina"] = bool(m["numero"]) and (bool(m["eventos"]) or m in mats)
    # matriz da pagina inicial: votacoes com voto nominal do painel (registram quem nao votou)
    recentes = [e for e in b.votacoes if e["fonte"] == "painel"]
    colunas = recentes[-80:]
    escreve("", "inicio.html", vereadores=atuais, colunas=colunas, dias=b.dias[:6], total_votacoes=len(b.votacoes),
            total_painel=len(recentes), leis=[m for m in mats if m["lei"]][:6],
            desde=recentes[0]["data"] if recentes else None)
    escreve("vereadores", "vereadores.html", atuais=atuais, outros=outros)
    for v in atuais + outros:
        escreve(f"vereadores/{v['slug']}", "vereador.html", v=v)
    autores = sorted({m["autoria"] for m in mats})
    escreve("projetos", "projetos.html", materias=mats, autores=autores)
    for m in b.materias.values():
        if m["tem_pagina"]:
            escreve(f"projetos/{m['slug']}", "projeto.html", m=m)
    escreve("sessoes", "sessoes.html", dias=b.dias)
    for d in b.dias:
        escreve(f"sessoes/{d['data']}", "sessao.html", d=d)
    escreve("como-funciona", "como-funciona.html")
    print(f"  site: {paginas} pagina(s) em {saida.relative_to(RAIZ) if saida.is_relative_to(RAIZ) else saida}")
    return {"paginas": paginas}
