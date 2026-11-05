"""Limpeza do texto extraido dos PDFs da Camara.

Problemas reais encontrados nos resumos de 2026:
- titulos em "negrito falso": cada caractere repetido ("RREESSUUMMOO DDAA")
- caracteres cirilicos parecidos com latinos no meio do texto ("CENTО" com О cirilico)
- cabecalho institucional repetido em toda pagina
"""
import re
import unicodedata

# Cirilico/grego -> latino (so os que tem cara identica)
_HOMOGLYPHS = str.maketrans({
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
    "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I", "Ј": "J", "Ѕ": "S",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "і": "i", "ј": "j", "ѕ": "s",
    "Α": "A", "Β": "B", "Ε": "E", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N",
    "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X", "ο": "o",
    " ": " ", " ": " ", " ": " ", "​": "",
})

# \s* em vez de espaco: o pdfplumber as vezes cola as palavras do cabecalho
# ("493ºAnodaFundaçãodoPovoadoe", "DIVISÃOLEGISLATIVA")
_HEADER_LINES = [
    re.compile(r"^DIVIS[ÃA]O\s*LEGISLATIVA$", re.I),
    re.compile(r"^C[âa]mara\s*Municipal\s*de\s*Cubat[ãa]o$", re.I),
    re.compile(r"^Estado\s*de\s*S[ãa]o\s*Paulo$", re.I),
    re.compile(r"^\d+\s*[º°o]\s*(Ano\s*)?da\s*Funda[çc][ãa]o\s*do\s*Povoado\s*e$", re.I),
    re.compile(r"^\d+\s*[º°o]\s*(Ano\s*)?de\s*Emancipa[çc][ãa]o\s*Pol[íi]tico[\s-]*Administrativa\.?$", re.I),
]
_PAGE_MARK = re.compile(r"^<<<PAGE>>>$|^\f$")


def _is_doubled(tok: str) -> bool:
    return len(tok) >= 2 and len(tok) % 2 == 0 and all(
        tok[i] == tok[i + 1] for i in range(0, len(tok), 2)
    )


def _is_word_doubled(tok: str) -> bool:
    h = len(tok) // 2
    return len(tok) >= 2 and len(tok) % 2 == 0 and tok[:h] == tok[h:]


def undouble_line(line: str) -> str:
    """Desfaz o negrito falso (char a char ou palavra inteira) quando a maioria
    dos tokens da linha esta duplicada."""
    toks = line.split(" ")
    cand = [t for t in toks if len(t) >= 2]
    if not cand:
        return line
    if len(cand) == 1 and len(cand[0]) < 6:
        return line
    if sum(_is_doubled(t) for t in cand) / len(cand) >= 0.8:
        return " ".join(t[::2] if _is_doubled(t) else t for t in toks)
    dup = sum(_is_word_doubled(t) or _is_doubled(t) for t in cand) / len(cand)
    if (len(cand) >= 3 and dup >= 0.6) or dup == 1:
        return " ".join(_undouble_tok(t) for t in toks)
    return line


def _undouble_tok(t: str) -> str:
    if len(t) < 2:
        return t
    if _is_word_doubled(t):
        return t[: len(t) // 2]
    if _is_doubled(t):
        return t[::2]
    # variante mista do pdf.js: "SESSSESSÃÃOO" -> "SESSÃO"
    return re.sub(r"(.+?)\1", r"\1", t)


def normalize(text: str) -> str:
    """Texto bruto do PDF -> linhas limpas, sem cabecalho de pagina."""
    text = unicodedata.normalize("NFC", text.translate(_HOMOGLYPHS))
    text = text.replace("\f", "\n\f\n")
    out = []
    for raw in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", raw).strip()
        if not line or _PAGE_MARK.match(line):
            continue
        line = undouble_line(line)
        if any(p.match(line) for p in _HEADER_LINES):
            continue
        out.append(line)
    return "\n".join(out)


def flat(text: str) -> str:
    """Junta tudo numa linha so (pra regex que atravessa quebra de linha)."""
    return re.sub(r"\s+", " ", text).strip()


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
