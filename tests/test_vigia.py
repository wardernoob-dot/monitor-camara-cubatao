import hashlib
import json

from camara import vigia as VG

URL = "https://www.cubatao.sp.leg.br/processo-legislativo/projetos-de-lei/arquivos/2026/PL_1-2026.pdf"
PDF = b"%PDF-1.4 conteudo original"
SHA = hashlib.sha256(PDF).hexdigest()


class Resp:
    def __init__(self, url, status=200, corpo=b"", headers=None):
        self.url, self.status_code, self._corpo, self.headers = url, status, corpo, headers or {}

    def iter_content(self, n):
        for i in range(0, len(self._corpo), n):
            yield self._corpo[i:i + n]


class Sessao:
    """Responde por prefixo de URL; guarda as chamadas."""
    def __init__(self, rotas):
        self.rotas, self.chamadas, self.headers, self.hooks = rotas, [], {}, {}

    def get(self, url, **kw):
        self.chamadas.append(url)
        for prefixo, resp in self.rotas.items():
            if url.startswith(prefixo):
                return resp(url) if callable(resp) else resp
        raise AssertionError(f"chamada inesperada: {url}")


def _dados(tmp_path):
    (tmp_path / "indice.json").write_text(json.dumps({URL: {"url": URL, "sha256": SHA, "titulo": "PL 1/2026",
                                                            "baixado_em": "2026-11-20T10:00:00+00:00"}}), "utf-8")
    return tmp_path


def test_arquiva_e_confere_o_sha(tmp_path):
    snap = f"https://web.archive.org/web/20261124120000/{URL}"
    wb = Sessao({
        "https://web.archive.org/save/": Resp(snap),
        "https://web.archive.org/web/20261124120000id_/": lambda u: Resp(u, corpo=PDF),
    })
    v = VG.Vigia(_dados(tmp_path), sessao_camara=Sessao({}), sessao_wayback=wb, dormir=lambda s: None)
    assert v.arquivar() == [URL]
    reg = json.loads((tmp_path / "arquivo.json").read_text("utf-8"))[URL]
    assert reg["wayback"] == snap and reg["confere"] is True and reg["sha256"] == SHA
    # segunda rodada: ja tem copia conferida do mesmo sha, nao pede de novo
    wb.chamadas.clear()
    assert VG.Vigia(tmp_path, sessao_camara=Sessao({}), sessao_wayback=wb, dormir=lambda s: None).arquivar() == []
    assert wb.chamadas == []


def test_copia_diferente_nao_conta_como_conferida(tmp_path):
    snap = f"https://web.archive.org/web/20261124120000/{URL}"
    wb = Sessao({"https://web.archive.org/save/": Resp(snap),
                 "https://web.archive.org/web/20261124120000id_/": lambda u: Resp(u, corpo=b"outro arquivo")})
    v = VG.Vigia(_dados(tmp_path), sessao_camara=Sessao({}), sessao_wayback=wb, dormir=lambda s: None)
    v.arquivar()
    assert json.loads((tmp_path / "arquivo.json").read_text("utf-8"))[URL]["confere"] is False
    assert any("difere" in a for a in v.avisos)


def test_wayback_redirecionando_pra_fora_vira_aviso(tmp_path):
    wb = Sessao({"https://web.archive.org/save/": Resp("https://malicioso.example/x")})
    v = VG.Vigia(_dados(tmp_path), sessao_camara=Sessao({}), sessao_wayback=wb, dormir=lambda s: None)
    assert v.arquivar() == []
    assert any("falhou" in a for a in v.avisos)


def test_vigia_registra_sumiu_e_mudou_uma_vez(tmp_path):
    _dados(tmp_path)
    estado = {"resp": Resp(URL, corpo=PDF)}
    camara = Sessao({URL: lambda u: estado["resp"]})
    novo = lambda: VG.Vigia(tmp_path, sessao_camara=camara, sessao_wayback=Sessao({}), dormir=lambda s: None)
    assert novo().conferir() == []                                   # igual ao coletado
    estado["resp"] = Resp(URL, corpo=b"%PDF trocado")
    ev = novo().conferir()
    assert [e["tipo"] for e in ev] == ["mudou"] and ev[0]["sha256_coletado"] == SHA
    assert novo().conferir() == []                                   # mesmo estado: nao repete o evento
    estado["resp"] = Resp(URL, status=404)
    assert [e["tipo"] for e in novo().conferir()] == ["sumiu"]
    hist = json.loads((tmp_path / "vigia.json").read_text("utf-8"))[URL]["historico"]
    assert [h["tipo"] for h in hist] == ["mudou", "sumiu"]


def test_rodar_nunca_levanta(tmp_path, monkeypatch):
    def quebra(*a, **k):
        raise RuntimeError("sem rede")
    monkeypatch.setattr(VG.Vigia, "__init__", quebra)
    r = VG.rodar(tmp_path)
    assert r["arquivados"] == [] and "sem rede" in r["avisos"][0]
