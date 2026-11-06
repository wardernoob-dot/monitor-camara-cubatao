"""Coletor: varre as pastas do site da Camara, baixa PDFs novos e extrai o texto.

O RSS do site (Plone) vem incompleto e fora de ordem, e as pastas de PL e pauta
nem tem RSS. Por isso o coletor le a listagem HTML das pastas.

Educacao com o servidor: User-Agent identificado, 1 requisicao por vez com
intervalo, e so baixa o que ainda nao esta no indice.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

BASE = "https://www.cubatao.sp.leg.br"
SECOES = {
    "resumo": "/processo-legislativo/resumo-das-sessoes",
    "pauta": "/processo-legislativo/pauta-das-sessoes-1",
    "projetos": "/processo-legislativo/projetos-de-lei",
}
USER_AGENT = "monitor-camara-cubatao/0.1 (projeto civico de transparencia; contato no README)"
INTERVALO_S = 1.5
MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_PAGINAS_PDF = 250

_IGNORAR = re.compile(r"/RSS$|/sendto_form|/print|#|mailto:|/login|/search|@@", re.I)
_EH_VETO = re.compile(r"(?i)veto|of[._ -]*\d|oficio|of[íi]cio")
_ANO = re.compile(r"\b(20\d{2})\b")


def _bloquear_redirect_externo(r, *args, **kwargs):
    if 300 <= getattr(r, "status_code", 200) < 400 and "location" in getattr(r, "headers", {}):
        destino = urlparse(urljoin(getattr(r, "url", BASE), r.headers["location"]))
        if destino.scheme not in ("https", "http") or destino.hostname != urlparse(BASE).hostname:
            raise ValueError(f"Redirecionamento externo bloqueado: {r.headers['location']!r}")


@dataclass
class Link:
    url: str
    titulo: str


def extrair_links(html: str, pagina_url: str, prefixo: str) -> list[Link]:
    """Links do conteudo principal de uma pagina Plone que ficam dentro do prefixo da secao."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    area = soup.select_one("#content") or soup.body or soup
    vistos, out = set(), []
    host_base = urlparse(BASE).hostname
    for a in area.select("a[href]"):
        href = urljoin(pagina_url, a["href"].strip())
        titulo = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        p = urlparse(href)
        if p.scheme not in ("https", "http") or p.hostname != host_base:
            continue
        if _IGNORAR.search(href) or not titulo or titulo.lower().startswith("leia mais"):
            continue
        if not p.path.startswith(prefixo):
            continue
        href = href.split("#")[0]
        if href.rstrip("/") == pagina_url.rstrip("/") or href in vistos:
            continue
        vistos.add(href)
        out.append(Link(href, titulo))
    return out


def url_download(url: str) -> str:
    """Pagina /view de arquivo Plone -> URL que entrega o binario."""
    if url.endswith("/view"):
        return url[: -len("/view")] + "/at_download/file"
    return url


class Coletor:
    def __init__(self, pasta_dados: Path, desde: int = 2026, sessao=None, guardar_pdf: bool = False):
        import requests

        self.dados = Path(pasta_dados)
        self.desde = desde
        self.guardar_pdf = guardar_pdf
        self.http = sessao or requests.Session()
        self.http.headers["User-Agent"] = USER_AGENT
        if hasattr(self.http, "hooks") and isinstance(self.http.hooks, dict):
            self.http.hooks.setdefault("response", []).append(_bloquear_redirect_externo)
        self._ultimo = 0.0
        self.indice_path = self.dados / "indice.json"
        self.indice: dict = json.loads(self.indice_path.read_text("utf-8")) if self.indice_path.exists() else {}
        (self.dados / "texto").mkdir(parents=True, exist_ok=True)
        if guardar_pdf:
            (self.dados / "pdf").mkdir(parents=True, exist_ok=True)
        # projetos do ano anterior que interessam: os vetados (o veto e votado neste ano). Sem o PDF do
        # projeto nao da pra saber a autoria. Vem dos oficios ja lidos (data/analises/VETO-<num>-<ano>.json).
        ant = self.desde - 1
        self.nums_ano_anterior = {int(m.group(1)) for f in (self.dados / "analises").glob(f"VETO-*-{ant}.json")
                                  if (m := re.match(rf"VETO-0*(\d+)-{ant}\.json$", f.name))}
        for f in (self.dados / "consolidado").glob("*.json"):  # vetos votados (mesmo sem oficio localizado)
            for mc in json.loads(f.read_text("utf-8")).get("materias", []):
                if mc.get("tipo") == "VETO" and str(mc.get("ano")) == str(ant) and str(mc.get("numero") or "").isdigit():
                    self.nums_ano_anterior.add(int(mc["numero"]))

    # ---------- rede ----------
    def _get(self, url: str):
        p = urlparse(url or "")
        if p.scheme not in ("https", "http") or p.hostname != urlparse(BASE).hostname:
            raise ValueError(f"URL fora do dominio da Camara: {url!r}")
        espera = INTERVALO_S - (time.monotonic() - self._ultimo)
        if espera > 0:
            time.sleep(espera)
        for tentativa in range(3):
            try:
                r = self.http.get(url, timeout=60)
                self._ultimo = time.monotonic()
                url_final = getattr(r, "url", None)
                if url_final:
                    pf = urlparse(url_final)
                    if pf.scheme not in ("https", "http") or pf.hostname != urlparse(BASE).hostname:
                        raise ValueError(f"Redirecionamento para fora do dominio: {url_final!r}")
                if r.status_code == 200:
                    return r
                if r.status_code in (404, 410):
                    return None
            except Exception as e:  # noqa: BLE001
                if tentativa == 2:
                    print(f"  ! falhou {url}: {e}")
            time.sleep(3 * (tentativa + 1))
        return None

    # ---------- varredura ----------
    def varrer(self, secao: str) -> list[dict]:
        prefixo = SECOES[secao]
        fila = [(BASE + prefixo, 0, None, False)]
        visitados, docs = set(), []
        while fila:
            url, prof, titulo_pasta, so_vetos = fila.pop(0)
            if url in visitados or prof > 3:
                continue
            visitados.add(url)
            r = self._get(url)
            if r is None:
                continue
            if "pdf" in r.headers.get("content-type", ""):
                docs.append({"url": url, "titulo": titulo_pasta or url.rsplit("/", 1)[-1], "secao": secao})
                continue
            links = extrair_links(r.text, url, prefixo)
            if so_vetos:
                pul = [ln for ln in links if not _EH_VETO.search(f"{ln.titulo} {ln.url}")
                       and not self._projeto_vetado(f"{ln.titulo} {ln.url}")]
                print(f"  pasta do ano anterior {url.rsplit('/', 1)[-1]}: {len(links)} links, {len(pul)} ignorados; "
                      f"ex.: {[(x.titulo[:40], x.url.rsplit('/', 1)[-1]) for x in pul[:6]]}")
            for ln in links:
                if "b_start" in ln.url:  # paginacao do Plone: segue sempre, com o mesmo filtro da pasta
                    fila.append((ln.url, prof, titulo_pasta, so_vetos))
                    continue
                ano = _ANO.search(ln.titulo)
                vetos_ln = so_vetos
                # filtro de ano so nas pastas de ano (primeiro nivel). Excecao: na pasta de projetos do ano
                # anterior entram so os oficios de veto (veto de projeto de 2025 e votado em 2026)
                if prof == 0 and ano and int(ano.group(1)) < self.desde:
                    if secao == "projetos" and int(ano.group(1)) == self.desde - 1:
                        vetos_ln = True
                    else:
                        continue
                if vetos_ln and prof > 0 and not _EH_VETO.search(f"{ln.titulo} {ln.url}") \
                        and not self._projeto_vetado(f"{ln.titulo} {ln.url}"):
                    continue
                alvo = url_download(ln.url)
                if alvo != ln.url or alvo.lower().endswith(".pdf") or "/arquivos/" in ln.url:
                    # arquivos ficam em .../arquivos/...; alguns nao tem extensao (ex.: pl-92.2026).
                    # baixar() confere o content-type e descarta o que nao for PDF.
                    docs.append({"url": alvo, "titulo": ln.titulo, "secao": secao})
                else:
                    fila.append((ln.url, prof + 1, ln.titulo, vetos_ln))
        # dedup preservando o primeiro titulo visto
        unicos = {}
        for d in docs:
            unicos.setdefault(d["url"], d)
        return list(unicos.values())

    def _projeto_vetado(self, txt: str) -> bool:
        """'PL 112.2025.pdf', 'PL%20141.2025', 'pl-146-2025' na pasta do ano anterior."""
        ant = self.desde - 1
        sep = r"(?:%20|[\s_.-])*"
        for m in re.finditer(rf"(?i)(?<![a-z])(?:PLC?|Projeto{sep}de{sep}Lei){sep}(?:n(?:o|º|°|deg)?\.?{sep})?0*(\d{{1,4}})(?:%20|[\s_./-])+{ant}(?!\d)", txt):
            if int(m.group(1)) in self.nums_ano_anterior:
                return True
        return False

    # ---------- download + texto ----------
    @staticmethod
    def extrair_texto(pdf_bytes: bytes) -> tuple[str, int]:
        import pdfplumber

        paginas = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for pg in pdf.pages[:MAX_PAGINAS_PDF]:
                paginas.append(pg.extract_text() or "")
        return "\f".join(paginas), len(paginas)

    def baixar(self, doc: dict) -> dict | None:
        r = self._get(doc["url"])
        if r is None:
            return None
        try:
            cl = int(r.headers.get("content-length") or 0)
        except ValueError:
            cl = 0
        if cl > MAX_PDF_BYTES or len(r.content) > MAX_PDF_BYTES:
            return None
        if "pdf" not in r.headers.get("content-type", "") and not r.content[:5] == b"%PDF-":
            return None
        sha = hashlib.sha256(r.content).hexdigest()
        texto, n_pag = self.extrair_texto(r.content)
        (self.dados / "texto" / f"{sha}.txt").write_text(texto, "utf-8")
        if self.guardar_pdf:
            (self.dados / "pdf" / f"{sha}.pdf").write_bytes(r.content)
        meta = {
            **doc,
            "sha256": sha,
            "bytes": len(r.content),
            "paginas": n_pag,
            "precisa_ocr": len(texto.strip()) < 80 * max(n_pag, 1),
            "baixado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        return meta

    def coletar(self, secoes=("resumo", "pauta", "projetos"), refazer=False) -> list[dict]:
        novos = []
        for secao in secoes:
            print(f"> varrendo {secao}...")
            docs = self.varrer(secao)
            print(f"  {len(docs)} documentos listados")
            for d in docs:
                if d["url"] in self.indice and not refazer:
                    continue
                meta = self.baixar(d)
                if meta:
                    self.indice[d["url"]] = meta
                    novos.append(meta)
                    print(f"  + {meta['titulo'][:90]}")
                    self.salvar_indice()
        return novos

    def salvar_indice(self):
        self.indice_path.write_text(json.dumps(self.indice, ensure_ascii=False, indent=1, sort_keys=True), "utf-8")
