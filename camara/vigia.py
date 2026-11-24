"""Prova e vigilancia dos documentos da Camara.

1. Arquivo publico: guarda uma copia de cada PDF coletado no Wayback Machine (archive.org) e confere,
   baixando a copia arquivada, se o sha256 dela bate com o que o coletor registrou. Assim o link do
   documento continua valendo (e provando o que estava escrito) mesmo se a Camara tirar ou trocar o
   arquivo. Resultado em data/arquivo.json: {url: {"wayback", "quando", "sha256", "confere"}}.

2. Vigia: a cada rodada confere alguns documentos ja coletados (os checados ha mais tempo primeiro).
   Se o arquivo sumiu (404/410) ou mudou (sha256 diferente do coletado), registra em data/vigia.json.
   O texto antigo continua em data/texto/<sha>.txt, e o historico do git guarda o resto.

Nada aqui pode derrubar a coleta: erro de rede vira aviso e a rodada segue.
Educacao com os dois servidores: User-Agent identificado, uma requisicao por vez, intervalo, e um
teto de documentos por rodada (o robo roda a cada 4 horas, entao o ciclo inteiro fecha em poucos dias).
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

from .coletor import BASE, MAX_PDF_BYTES, USER_AGENT, _bloquear_redirect_externo

WAYBACK = "https://web.archive.org"
HOSTS_WAYBACK = {"web.archive.org", "archive.org"}
POR_RODADA_ARQUIVO = 5      # Save Page Now anonimo aceita poucas por minuto
POR_RODADA_VIGIA = 8
INTERVALO_CAMARA_S = 1.5
INTERVALO_WAYBACK_S = 12.0


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _host(url: str) -> str | None:
    return urlparse(url or "").hostname


def _ler(p: Path) -> dict:
    return json.loads(p.read_text("utf-8")) if p.exists() else {}


def _gravar(p: Path, d: dict) -> None:
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf-8")


def _sha_limitado(r) -> str | None:
    """sha256 do corpo, lendo no maximo MAX_PDF_BYTES (o mesmo teto do coletor)."""
    h, total = hashlib.sha256(), 0
    for bloco in r.iter_content(64 * 1024):
        total += len(bloco)
        if total > MAX_PDF_BYTES:
            return None
        h.update(bloco)
    return h.hexdigest()


class Vigia:
    def __init__(self, pasta_dados: str | Path, sessao_camara=None, sessao_wayback=None, dormir=time.sleep):
        import requests

        self.dados = Path(pasta_dados)
        self.indice: dict = _ler(self.dados / "indice.json")
        self.arquivo_path = self.dados / "arquivo.json"
        self.vigia_path = self.dados / "vigia.json"
        self.arquivo: dict = _ler(self.arquivo_path)
        self.vigia: dict = _ler(self.vigia_path)
        self.dormir = dormir
        self.camara = sessao_camara or requests.Session()
        self.camara.headers["User-Agent"] = USER_AGENT
        if hasattr(self.camara, "hooks") and isinstance(self.camara.hooks, dict):
            self.camara.hooks.setdefault("response", []).append(_bloquear_redirect_externo)
        self.wayback = sessao_wayback or requests.Session()
        self.wayback.headers["User-Agent"] = USER_AGENT
        self.avisos: list[str] = []

    # ---------- arquivo no Wayback ----------
    def _wb_get(self, url: str, **kw):
        if _host(url) not in HOSTS_WAYBACK:
            raise ValueError(f"fora do Wayback: {url!r}")
        r = self.wayback.get(url, timeout=120, **kw)
        if _host(getattr(r, "url", url)) not in HOSTS_WAYBACK:
            raise ValueError(f"Wayback redirecionou para fora: {getattr(r, 'url', '')!r}")
        return r

    def _snapshot(self, url: str) -> str | None:
        """Pede a captura (Save Page Now) e devolve o endereco /web/<timestamp>/<url> da copia."""
        r = self._wb_get(f"{WAYBACK}/save/{quote(url, safe=':/')}", allow_redirects=True)
        for cand in (r.headers.get("Content-Location"), getattr(r, "url", "")):
            if cand and "/web/" in cand:
                return cand if cand.startswith("http") else WAYBACK + cand
        return None

    def _confere(self, snapshot: str, sha_esperado: str) -> bool | None:
        """Baixa a copia arquivada crua (id_) e compara o sha256 com o do coletor."""
        partes = snapshot.split("/web/", 1)[1].split("/", 1)
        if len(partes) != 2:
            return None
        cru = f"{WAYBACK}/web/{partes[0].removesuffix('id_')}id_/{partes[1]}"
        r = self._wb_get(cru, stream=True)
        if r.status_code != 200:
            return None
        sha = _sha_limitado(r)
        return None if sha is None else sha == sha_esperado

    def arquivar(self, limite: int = POR_RODADA_ARQUIVO) -> list[str]:
        """Arquiva os documentos que ainda nao tem copia conferida. Devolve as URLs arquivadas nesta rodada."""
        feitos = []
        pendentes = [u for u, m in sorted(self.indice.items(), key=lambda x: x[1].get("baixado_em", ""), reverse=True)
                     if not (self.arquivo.get(u) or {}).get("confere") or self.arquivo[u].get("sha256") != m.get("sha256")]
        for url in pendentes[:limite]:
            meta = self.indice[url]
            try:
                snap = self._snapshot(url)
                if not snap:
                    self.avisos.append(f"Wayback nao devolveu copia de {url}")
                    continue
                self.dormir(INTERVALO_WAYBACK_S)
                ok = self._confere(snap, meta["sha256"])
                self.arquivo[url] = {"wayback": snap, "quando": _agora(), "sha256": meta["sha256"], "confere": ok}
                if ok is False:
                    self.avisos.append(f"copia no Wayback difere do coletado (o site pode ter trocado o arquivo): {url}")
                feitos.append(url)
            except Exception as e:  # noqa: BLE001 - rede nunca derruba a coleta
                self.avisos.append(f"arquivo falhou em {url}: {e}")
            self.dormir(INTERVALO_WAYBACK_S)
        _gravar(self.arquivo_path, self.arquivo)
        return feitos

    # ---------- vigia do site da Camara ----------
    def conferir(self, limite: int = POR_RODADA_VIGIA) -> list[dict]:
        """Rebaixa os documentos checados ha mais tempo e registra quem sumiu ou mudou. Devolve os eventos novos."""
        eventos = []
        fila = sorted(self.indice, key=lambda u: (self.vigia.get(u) or {}).get("conferido_em", ""))
        for url in fila[:limite]:
            if _host(url) != _host(BASE):
                continue
            meta = self.indice[url]
            reg = self.vigia.setdefault(url, {"historico": []})
            try:
                r = self.camara.get(url, timeout=60, stream=True)
                if _host(getattr(r, "url", url)) != _host(BASE):
                    raise ValueError(f"redirecionou para fora: {getattr(r, 'url', '')!r}")
                if r.status_code in (404, 410):
                    estado, sha = "sumiu", None
                elif r.status_code == 200:
                    sha = _sha_limitado(r)
                    estado = "igual" if sha == meta["sha256"] else ("grande_demais" if sha is None else "mudou")
                else:
                    estado, sha = f"http_{r.status_code}", None
            except Exception as e:  # noqa: BLE001
                self.avisos.append(f"vigia falhou em {url}: {e}")
                estado, sha = "erro", None
            reg["conferido_em"] = _agora()
            anterior = reg.get("estado")
            reg["estado"] = estado
            if estado in ("sumiu", "mudou") and estado != anterior:
                ev = {"quando": reg["conferido_em"], "tipo": estado, "sha256_coletado": meta["sha256"], "sha256_agora": sha}
                reg["historico"].append(ev)
                eventos.append({"url": url, "titulo": meta.get("titulo"), **ev})
            self.dormir(INTERVALO_CAMARA_S)
        _gravar(self.vigia_path, self.vigia)
        return eventos


def rodar(pasta_dados: str | Path) -> dict:
    """Passo do pipeline (python -m camara tudo/vigiar). Nunca levanta excecao."""
    try:
        v = Vigia(pasta_dados)
        arquivados = v.arquivar()
        eventos = v.conferir()
    except Exception as e:  # noqa: BLE001
        return {"arquivados": [], "eventos": [], "avisos": [f"vigia nao rodou: {e}"]}
    return {"arquivados": arquivados, "eventos": eventos, "avisos": v.avisos}
