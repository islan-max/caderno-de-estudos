"""Banco de questões oficiais do ENEM, montado só com material do INEP.

Uso (sempre pela venv: .cache/venv/Scripts/python scripts/banco_inep.py ...):
  catalogo              lê as páginas de provas e gabaritos do INEP (2009-2025)
  microdados            baixa só o ITENS_PROVA de cada ano (leitura parcial do zip)
  texto                 baixa o texto pronto de terceiros (enem.dev, Maritaca), usado só como índice
  baixar [filtros]      baixa os PDFs de prova e gabarito dos cadernos escolhidos
  extrair [filtros]     separa as questões dos PDFs baixados
  buscar TERMOS         procura no banco e no índice de texto
  localizar ID          acha no PDF oficial uma questão do índice de texto
  mostrar ID            mostra uma questão do banco
  recortar ID ...       recorta uma região da página em PNG a 200 dpi, aparada e centrada
  pagina ID             renderiza a(s) página(s) da questão em PNG (para o revisor)
  conferir              sorteia 10 questões e gera as imagens para conferência
  cobertura             resume o que existe no banco por ano

Tudo fica em .cache/inep/ (fora do git). Download é feito com o curl do sistema,
que valida o certificado do INEP pelo repositório do Windows; a verificação TLS
nunca é desligada.
"""

import csv
from collections import Counter
import html
import io
import json
import random
import re
import struct
import subprocess
import sys
import time
import unicodedata
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / ".cache" / "inep"
PAGINAS = CACHE / "paginas"
PDFS = CACHE / "pdf"
ITENS = CACHE / "itens"
TEXTO = CACHE / "texto"
QUESTOES = CACHE / "questoes"
IMAGENS = CACHE / "imagens"
CATALOGO = CACHE / "catalogo.json"

ANOS = range(2009, 2026)
URL_PAGINA = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/{}"
URL_MICRODADOS = "https://download.inep.gov.br/microdados/microdados_enem_{}.zip"
LIMITE_DOWNLOAD = 2 * 1024**3

sys.stdout.reconfigure(encoding="utf-8")


# ---------------------------------------------------------------- utilidades
def sem_acento(t):
    return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))


def normalizar(t):
    """Texto para busca: minúsculo, sem acento, espaços simples."""
    return re.sub(r"\s+", " ", sem_acento(t).lower()).strip()


def curl(url, destino=None, faixa=None, cabecalho=False):
    cmd = ["curl", "-sS", "-L", "--fail", "--retry", "5", "--retry-all-errors", "--retry-delay", "2", "--max-time", "600"]
    if faixa:
        cmd += ["-r", faixa]
    if cabecalho:
        cmd += ["-I"]
    if destino:
        Path(destino).parent.mkdir(parents=True, exist_ok=True)
        cmd += ["-o", str(destino)]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        raise RuntimeError(f"curl falhou ({r.returncode}) em {url}: {r.stderr.decode(errors='replace')}")
    return r.stdout


def tamanho_remoto(url):
    cab = curl(url, cabecalho=True).decode(errors="replace")
    achados = re.findall(r"(?im)^content-length:\s*(\d+)", cab)
    return int(achados[-1]) if achados else 0


def ler_json(p, padrao=None):
    return json.loads(Path(p).read_text(encoding="utf-8")) if Path(p).exists() else padrao


def gravar_json(p, dados):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")


# ------------------------------------------------------------------ catálogo
CORES = ["azul", "amarelo", "branco", "rosa", "cinza", "laranja", "verde", "roxo"]


def slug_aplicacao(titulo):
    t = normalizar(titulo)
    if "digital" in t:
        return "digital"
    if "ppl" in t or "privad" in t:
        return "ppl"
    if "reaplica" in t:
        return "reaplicacao"
    if "regular" in t:
        return "regular"
    if "belem" in t:
        return "belem"
    if "segunda" in t or "2a aplicacao" in t or "2 aplicacao" in t:
        return "segunda-aplicacao"
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "regular"


def ler_pagina(ano):
    """Devolve os cadernos listados na página do ano, na ordem da página."""
    arq = PAGINAS / f"{ano}.html"
    if not arq.exists():
        curl(URL_PAGINA.format(ano), arq)
    s = arq.read_text(encoding="utf-8", errors="replace")
    inicio = s.find("download.inep.gov.br")
    s = s[max(0, inicio - 4000):]
    cadernos, aplicacao, atual = [], "regular", None
    padrao = re.compile(
        r"<(h[2-5])[^>]*>(.*?)</\1>|<(p|li|strong)[^>]*>(.*?)</\3>|<a [^>]*href=\"([^\"]*download\.inep[^\"]*\.pdf)\"[^>]*>(.*?)</a>",
        re.S | re.I,
    )
    for m in padrao.finditer(s):
        if m.group(1):
            titulo = html.unescape(re.sub("<[^>]+>", "", m.group(2))).strip()
            if titulo:
                aplicacao = slug_aplicacao(titulo)
            continue
        if m.group(3):
            # um <p> pode conter o rótulo e também os links; o rótulo é o texto antes do 1º link
            bruto = re.split(r"<a ", m.group(4), maxsplit=1)[0]
            rotulo = html.unescape(re.sub("<[^>]+>", "", bruto)).strip()
            if re.search(r"(?i)dia|caderno", rotulo):
                # o rótulo do caderno, quando nomeia a aplicação, vale mais que o título da seção
                nr = normalizar(rotulo)
                # ("regular" no rótulo não conta: a aplicação de Belém 2025 se rotula assim)
                apl = slug_aplicacao(rotulo) if re.search(r"ppl|reaplica|digital", nr) else aplicacao
                atual = {"ano": ano, "aplicacao": apl, "rotulo": re.sub(r"\s+", " ", rotulo)}
                cadernos.append(atual)
            # links dentro do mesmo parágrafo
            for a in re.finditer(r"href=\"([^\"]*download\.inep[^\"]*\.pdf)\"[^>]*>(.*?)</a>", m.group(4), re.S):
                anexar_link(atual, a.group(1), a.group(2))
            continue
        anexar_link(atual, m.group(5), m.group(6))
    return [c for c in cadernos if c.get("prova") or c.get("gabarito")]


def anexar_link(caderno, url, texto):
    if caderno is None:
        return
    t = normalizar(html.unescape(re.sub("<[^>]+>", "", texto)))
    tipo = "gabarito" if "gabarito" in t or "/gabaritos/" in url.lower() or "_GB_" in url else "prova"
    url = re.sub(r"^(https?:)?/*(https?:?/+)?", "https://", url.strip())  # a página tem "https://http//..."
    caderno.setdefault(tipo, url)


def interpretar_rotulo(c):
    r = normalizar(c["rotulo"])
    dia = re.search(r"(\d)\s*(?:o|º|°)?\s*dia", r) or re.search(r"dia\s*(\d)", r)
    cad = re.search(r"caderno\s*(\d+)", r)
    cor = next((k for k in CORES if k in r or (k == "branco" and "branca" in r)), None)
    especial = bool(re.search(r"amplia|braile|braille|ledor|libras|video|surd|cego|adaptad", r))
    lingua = "ingles" if "ingles" in r else "espanhol" if "espanhol" in r else None
    c.update(
        dia=int(dia.group(1)) if dia else None,
        caderno=int(cad.group(1)) if cad else None,
        cor=cor,
        especial=especial,
        lingua=lingua,
    )
    return c


def catalogo():
    todos = []
    for ano in ANOS:
        cads = [interpretar_rotulo(c) for c in ler_pagina(ano)]
        todos += cads
    # um caderno por aplicação, dia (e língua, no digital): azul se houver, senão o de menor número
    escolhidos = {}
    for c in todos:
        if c["especial"] or not c.get("prova") or not c["dia"]:
            continue
        chave = (c["ano"], c["aplicacao"], c["dia"], c["lingua"] or "")
        atual = escolhidos.get(chave)
        peso = (c["cor"] != "azul", c["caderno"] or 99)
        if atual is None or peso < (atual["cor"] != "azul", atual["caderno"] or 99):
            escolhidos[chave] = c
    gravar_json(CATALOGO, {"todos": todos, "escolhidos": sorted(escolhidos.values(), key=lambda c: (c["ano"], c["aplicacao"], c["dia"], c["lingua"] or ""))})
    for c in sorted(escolhidos.values(), key=lambda c: (c["ano"], c["aplicacao"], c["dia"])):
        falta = "" if c.get("gabarito") else "  (sem gabarito na página)"
        print(f"{c['ano']} {c['aplicacao']:<18} D{c['dia']} cad {c['caderno']} {c['cor']} {c['lingua'] or ''}{falta}")


# ---------------------------------------------------------------- microdados
class ArquivoRemoto(io.RawIOBase):
    """Arquivo somente leitura sobre HTTP Range: o zipfile lê só o que precisa."""

    def __init__(self, url):
        self.url, self.pos, self.tam = url, 0, tamanho_remoto(url)
        self.lidos = 0

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, pos, whence=0):
        self.pos = {0: pos, 1: self.pos + pos, 2: self.tam + pos}[whence]
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.tam - self.pos
        n = min(n, self.tam - self.pos)
        if n <= 0:
            return b""
        dados = curl(self.url, faixa=f"{self.pos}-{self.pos + n - 1}")
        self.pos += len(dados)
        self.lidos += len(dados)
        return dados

    def readinto(self, b):
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


def microdados(*anos):
    anos = [int(a) for a in anos] or list(ANOS)
    ITENS.mkdir(parents=True, exist_ok=True)
    for ano in anos:
        destino = ITENS / f"{ano}.csv"
        if destino.exists():
            print(ano, "já existe")
            continue
        try:
            remoto = ArquivoRemoto(URL_MICRODADOS.format(ano))
            with zipfile.ZipFile(io.BufferedReader(remoto, buffer_size=1 << 16)) as z:
                nomes = [n for n in z.namelist() if re.search(r"ITENS_PROVA.*\.csv$", n, re.I)]
                if not nomes:
                    print(ano, "sem ITENS_PROVA no zip")
                    continue
                destino.write_bytes(z.read(nomes[0]))
                # o dicionário explica CO_PROVA (cor e aplicação de cada caderno)
                dic = [n for n in z.namelist() if re.search(r"dicion.*\.xlsx$", n, re.I)]
                if dic:
                    (ITENS / f"{ano}-dicionario.xlsx").write_bytes(z.read(dic[0]))
            print(ano, nomes[0], f"{destino.stat().st_size // 1024} KB (baixados {remoto.lidos // 1024} KB)")
        except Exception as e:  # noqa: BLE001 — registra e segue para o próximo ano
            print(ano, "falhou:", e)


def ler_itens(ano):
    """Linhas do ITENS_PROVA do ano (lista de dicts), ou [] se não houver."""
    arq = ITENS / f"{ano}.csv"
    if not arq.exists():
        return []
    bruto = arq.read_bytes()
    texto = bruto.decode("utf-8") if bruto[:3] == b"\xef\xbb\xbf" or _eh_utf8(bruto) else bruto.decode("latin-1")
    texto = texto.lstrip("﻿")
    sep = ";" if texto.split("\n", 1)[0].count(";") > texto.split("\n", 1)[0].count(",") else ","
    linhas = list(csv.DictReader(io.StringIO(texto), delimiter=sep))
    # 2017 numera CO_POSICAO dentro de cada área (1-45; LC 1-50 com inglês 1-5 e
    # espanhol 6-10). Converte para o número da questão no caderno.
    if linhas and max(int(l["CO_POSICAO"]) for l in linhas) <= 50:
        inicio = {"LC": 1, "CH": 46, "CN": 91, "MT": 136} if ano >= 2017 else {"CH": 1, "CN": 46, "LC": 91, "MT": 136}
        for l in linhas:
            p, area = int(l["CO_POSICAO"]), l["SG_AREA"]
            if area == "LC" and p > 5:
                p = p - 5
            l["CO_POSICAO"] = str(inicio[area] + p - 1)
    return linhas


def _eh_utf8(b):
    try:
        b.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def mapa_provas(ano):
    """CO_PROVA -> (área, cor, aplicação), lido do dicionário dos microdados."""
    import openpyxl

    arq = ITENS / f"{ano}-dicionario.xlsx"
    if not arq.exists():
        return {}
    mapa, area = {}, None
    wb = openpyxl.load_workbook(arq, read_only=True)
    for ws in wb.worksheets:
        for linha in ws.iter_rows(values_only=True):
            cel = [c for c in linha if c is not None]
            if not cel:
                continue
            m = re.match(r"CO_PROVA_(CN|CH|LC|MT)$", str(cel[0]).strip())
            if m:
                area, cel = m.group(1), cel[2:]
            elif area and not re.match(r"^\d+$", str(cel[0]).strip()):
                area = None
            if area and cel and re.match(r"^\d+$", str(cel[0]).strip()) and len(cel) > 1:
                desc = normalizar(str(cel[1]))
                cor = next((k for k in CORES if k[:4] in desc), None)
                if "digital" in desc:
                    apl = "digital"
                elif "bam" in desc:
                    apl = "belem"
                elif "reaplica" in desc or "segunda oportunidade" in desc or "ppl" in desc:
                    apl = "reaplicacao" if ano == 2025 else "ppl"
                elif re.search(r"ledor|braill|braile|libras|amplia|adaptad|atendimento", desc):
                    apl = "especial"
                else:
                    apl = "regular"
                mapa[str(cel[0]).strip()] = (area, cor, apl)
        if mapa:
            break
    return mapa


def itens_do_caderno(ano, aplicacao, cor, gab, gab_lingua):
    """ITENS_PROVA do caderno: {posição: [linhas]}, mais o relato de como ligou cada área.

    Cada área do caderno é ligada ao CO_PROVA cujo gabarito coincide com o gabarito
    oficial do PDF (≥ 90% das posições). Sem gabarito no PDF, não liga nada."""
    mapa = mapa_provas(ano)
    por_prova = {}
    for l in ler_itens(ano):
        por_prova.setdefault(l.get("CO_PROVA"), []).append(l)
    por_pos, relato = {}, {}
    for area in ("LC", "CH", "CN", "MT"):
        cands = [cod for cod, (a, _, apl) in mapa.items() if a == area and apl != "especial" and cod in por_prova]
        escolhido, nota = None, 0.0
        if gab:
            for cod in cands:
                acertos = total = 0
                posicoes = [int(l["CO_POSICAO"]) for l in por_prova[cod]]
                for l in por_prova[cod]:
                    n = int(l["CO_POSICAO"])
                    if posicoes.count(n) > 1 and n not in gab_lingua:
                        continue  # questão de língua num caderno de uma língua só
                    oficial = gab.get(n)
                    if n in gab_lingua:
                        oficial = gab_lingua[n][0 if l.get("TP_LINGUA", "0") == "0" else 1]
                    if oficial and oficial != "anulada":
                        total += 1
                        acertos += oficial == l.get("TX_GABARITO")
                if total >= 20 and acertos / total > nota:
                    escolhido, nota = cod, acertos / total
            if nota < 0.9:
                escolhido = None
        # sem gabarito oficial não há como confirmar a ligação: melhor sem microdados
        # do que com o item errado (a ligação só pela cor errou 71 de 90 na PPL 2015)
        if escolhido:
            relato[area] = f"{escolhido} ({nota:.0%})"
            for l in por_prova[escolhido]:
                por_pos.setdefault(int(l["CO_POSICAO"]), []).append(l)
    return por_pos, relato


def cobre_o_dia(c, gab):
    faixa = range(1, 91) if c["dia"] == 1 else range(91, 181)
    return sum(1 for n in faixa if n in gab) >= 80


def obter_gabarito(c):
    """Gabarito oficial do caderno: o PDF da página; se faltar ou for de outro dia
    (há links trocados na página do INEP), o PDF que vem no zip dos microdados."""
    gab, lingua = ler_gabarito(arquivo_pdf(c, "gabarito"), c["cor"])
    if cobre_o_dia(c, {**gab, **lingua}):
        return gab, lingua, "pagina"
    zipado = arquivo_pdf(c, "gabarito-zip")
    if not zipado.exists():
        achado = gabarito_do_zip(c, zipado)
        print("  gabarito da página ausente ou de outro dia; zip:", achado)
    gab, lingua = ler_gabarito(zipado, c["cor"])
    if cobre_o_dia(c, {**gab, **lingua}):
        return gab, lingua, "zip-microdados"
    return {}, {}, None


def gabarito_do_zip(c, destino):
    """Gabarito oficial que não está na página, mas vem no zip dos microdados."""
    remoto = ArquivoRemoto(URL_MICRODADOS.format(c["ano"]))
    with zipfile.ZipFile(io.BufferedReader(remoto, buffer_size=1 << 16)) as z:
        cor = c["cor"].upper()[:4]
        for n in z.namelist():
            base = sem_acento(n).upper()
            nome = base.split("/")[-1]
            dia_ok = f"DIA_{c['dia']}" in base or ("SAB" if c["dia"] == 1 else "DOM") in nome
            if not base.endswith(".PDF") or not nome.startswith("GAB") or not dia_ok:
                continue
            if cor not in base and re.search(r"AZUL|AMAREL|BRANC|ROSA|CINZA", nome):
                continue
            segunda = bool(re.search(r"_P2_|_2\.PDF$|SEGUNDA", base))
            if segunda == (c["aplicacao"] != "regular") and not re.search(r"LEDOR|BRAIL|LIBRAS|AMPLIA", base):
                destino.write_bytes(z.read(n))
                return n
    return None


# -------------------------------------------------------------------- baixar
def filtrar(cadernos, args):
    """Filtros: ano (2019), aplicação (ppl), dia (D2); 'sem-texto' = só o que não tem texto pronto."""
    anos = {int(a) for a in args if re.fullmatch(r"\d{4}", a)}
    apls = {a for a in args if a in {"regular", "ppl", "digital", "reaplicacao", "segunda-aplicacao", "terceira-aplicacao", "belem"}}
    dias = {int(a[1]) for a in args if re.fullmatch(r"[dD][12]", a)}
    fora = []
    for c in cadernos:
        if anos and c["ano"] not in anos or apls and c["aplicacao"] not in apls or dias and c["dia"] not in dias:
            continue
        if "sem-texto" in args and tem_texto_pronto(c):
            continue
        fora.append(c)
    return fora


def tem_texto_pronto(c):
    return c["aplicacao"] == "regular" and c["ano"] <= 2024


def arquivo_pdf(c, tipo):
    lingua = f"-{c['lingua']}" if c["lingua"] else ""
    return PDFS / str(c["ano"]) / f"{c['aplicacao']}-D{c['dia']}-{c['cor']}{lingua}-{tipo}.pdf"


def baixar(*args):
    cadernos = filtrar(ler_json(CATALOGO)["escolhidos"], args)
    pendentes = [(c, t) for c in cadernos for t in ("prova", "gabarito") if c.get(t) and not arquivo_pdf(c, t).exists()]
    total = sum(tamanho_remoto(c[t]) for c, t in pendentes)
    print(f"{len(pendentes)} arquivos, {total / 1024**2:.0f} MB")
    if total > LIMITE_DOWNLOAD:
        sys.exit("Passa de 2 GB: peça autorização antes.")
    for c, t in pendentes:
        curl(c[t], arquivo_pdf(c, t))
        print("ok", arquivo_pdf(c, t).relative_to(CACHE))
    trocar_ilegiveis(cadernos)


def taxa_ilegivel(pdf):
    """Fração de caracteres de controle no texto: fonte com codificação própria."""
    import pymupdf

    t = "".join(p.get_text() for p in pymupdf.open(pdf))
    return sum(1 for ch in t if ord(ch) < 32 and ch not in "\n\t") / max(1, len(t))


def trocar_ilegiveis(cadernos):
    """Se o texto do caderno escolhido sai embaralhado, testa as outras cores da mesma
    aplicação e dia (mesmas questões em outra ordem) e fica com a mais legível."""
    cat = ler_json(CATALOGO)
    mudou = False
    for c in cadernos:
        pdf = arquivo_pdf(c, "prova")
        if not pdf.exists() or c.get("ilegivel") is not None:
            continue
        taxa = taxa_ilegivel(pdf)
        c["ilegivel"] = round(taxa, 3)
        if taxa <= 0.01:
            continue
        melhor, melhor_taxa = c, taxa
        irmaos = [o for o in cat["todos"] if (o["ano"], o["aplicacao"], o["dia"], o["lingua"]) == (c["ano"], c["aplicacao"], c["dia"], c["lingua"])
                  and not o["especial"] and o.get("prova") and o["cor"] != c["cor"]]
        for o in irmaos:
            try:
                for t in ("prova", "gabarito"):
                    if o.get(t) and not arquivo_pdf(o, t).exists():
                        curl(o[t], arquivo_pdf(o, t))
            except RuntimeError as e:
                print("  pulei", o["cor"], e)
                continue
            o["ilegivel"] = round(taxa_ilegivel(arquivo_pdf(o, "prova")), 3)
            if o["ilegivel"] < melhor_taxa:
                melhor, melhor_taxa = o, o["ilegivel"]
        print(f"{c['ano']} {c['aplicacao']} D{c['dia']}: {c['cor']} {taxa:.3f} -> {melhor['cor']} {melhor_taxa:.3f}")
        if melhor is not c:
            i = next(i for i, e in enumerate(cat["escolhidos"]) if e["prova"] == c["prova"])
            cat["escolhidos"][i] = melhor
            mudou = True
    for c in cadernos:  # guarda a taxa medida
        for e in cat["escolhidos"]:
            if e["prova"] == c["prova"] and c.get("ilegivel") is not None:
                e["ilegivel"] = c["ilegivel"]
    gravar_json(CATALOGO, cat)
    return mudou


# ------------------------------------------------------------------- extrair
CABECALHO = re.compile(r"(?i)^quest[ãa]o\s*0*(\d{1,3})\b")
FAIXA = re.compile(
    r"(?i)(e suas tecnologias|quest(õ|o)es de \d+ a \d+|^linguagens, c[óo]digos|^ci[êe]ncias (humanas|da natureza)$|"
    r"^matem[áa]tica$|^l[íi]ngua estrangeira|op[çc][ãa]o (ingl|espanh)|\*\w{6,}\*|p[áa]gina \d+$|^caderno \d|(enem\d{4}){2,}|"
    r"^\d[ªa]\s+aplica[çc][ãa]o$)"
)
COMPARTILHADO = re.compile(r"(?i)(para as|responda [àa]s) quest(õ|o)es( de)?\s+0?(?P<de>\d+)\s+(a|e)\s+0?(?P<ate>\d+)")
FIM = re.compile(r"(?i)(proposta de reda|instru[çc][õo]es para a reda|^rascunho|folha de rascunho|^reda[çc][ãa]o$)")
FONTE_LETRA = re.compile(r"(?i)bundesbahn|segoeui-bold|pi-?std|circled")


def linhas_da_pagina(pagina):
    """Linhas de texto (fora do cabeçalho e rodapé) com posição e fonte."""
    h = pagina.rect.height
    saida = []
    for b in pagina.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans:
                continue
            x0, y0, x1, y1 = l["bbox"]
            # Expoente (10⁶, 10⁻⁴...): a prova desenha o expoente menor e mais alto, como um span à
            # parte, sem espaço nem sinal de "elevado a". Sem isso, "10" e "6" viram "106" grudados.
            # Aqui, uma queda de tamanho de fonte dentro da mesma linha vira um "^" antes do expoente.
            partes, tam_normal, em_expoente = [], None, False
            for s in l["spans"]:
                if not s["text"]:
                    continue
                if tam_normal is None:
                    tam_normal = s["size"]
                if s["size"] < tam_normal * 0.85:
                    if not em_expoente:
                        partes.append("^")
                        em_expoente = True
                else:
                    tam_normal, em_expoente = s["size"], False
                partes.append(s["text"])
            texto = unicodedata.normalize("NFKC", "".join(partes))
            t = texto.strip()
            if y0 < 0.05 * h and not CABECALHO.match(t):
                continue
            # rodapé: número de página, código de barras, "dia | caderno"; o resto fica
            # (a alternativa E das provas antigas encosta na borda de baixo)
            if y1 > 0.955 * h and (y0 > 0.985 * h or re.fullmatch(r"\d{1,3}|\*.*\*", t)
                                   or re.search(r"(?i)dia\s*\|?\s*caderno|p[áa]gina\s*\d+|^caderno\s*\d+|^(CH|CN|LC|MT)\s*[–-]\s*\d|^ENEM\s*\d{4}$", t)):
                continue
            saida.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "texto": texto.strip(),
                          "fonte": spans[0]["font"], "tam": spans[0]["size"]})
    return saida


def juntar_em_linhas(linhas):
    """Junta pedaços na mesma altura (a letra da alternativa vem separada do texto na prova digital)."""
    # agrupa por centro vertical (letra e texto têm tamanhos de fonte diferentes)
    def centro(l):
        return (l["y0"] + l["y1"]) / 2

    ordem, faixas = sorted(linhas, key=centro), []
    for l in ordem:
        f = faixas[-1] if faixas else None
        if f and abs(centro(l) - f[0]) < 0.45 * min(l["y1"] - l["y0"], f[1]):
            f[2].append(l)
        else:
            faixas.append([centro(l), l["y1"] - l["y0"], [l]])
    linhas = [l for f in faixas for l in sorted(f[2], key=lambda l: l["x0"])]
    fila = []
    for l in linhas:
        ult = fila[-1] if fila else None
        cabecalho = CABECALHO.match(l["texto"]) or (ult and CABECALHO.match(ult["texto"]))
        if ult and not cabecalho and abs(centro(ult) - centro(l)) < 0.45 * min(l["y1"] - l["y0"], ult["y1"] - ult["y0"]) \
                and l["x0"] >= ult["x1"] - 2:
            ult["texto"] += (" " if not ult["texto"].endswith(("\t", " ")) else "") + l["texto"]
            ult["x1"], ult["y1"] = max(ult["x1"], l["x1"]), max(ult["y1"], l["y1"])
        else:
            novo = dict(l)
            novo["letra_isolada"] = bool(re.fullmatch(r"[A-E]", l["texto"]))
            fila.append(novo)
    # letra da alternativa desenhada duas vezes (sozinha, por cima da linha completa)
    return [l for l in fila if not (l["letra_isolada"] and any(
        o is not l and abs(o["y0"] - l["y0"]) < 4 and re.match(rf"{l['texto']}\s+\S", o["texto"]) for o in fila))]


def segmentos(doc):
    """Divide cada página em colunas e devolve os pedaços na ordem de leitura."""
    segs = []
    for pn, pagina in enumerate(doc):
        linhas = linhas_da_pagina(pagina)
        w = pagina.rect.width
        meio = w / 2
        # duas colunas: cabeçalho de questão na metade direita (em 2009 "Questão" e o
        # número vêm em pedaços separados) ou boa parte das linhas começando lá
        duas = any(re.match(r"(?i)quest[ãa]o", l["texto"]) and l["x0"] > meio - 5 for l in linhas) or \
            sum(1 for l in linhas if l["x0"] > meio - 5) > 0.15 * max(1, len(linhas))
        colunas = [(0, meio), (meio, w)] if duas else [(0, w)]
        for ci, (a, b) in enumerate(colunas):
            dentro = [l for l in linhas if (a - 2 <= l["x0"] < b - 5) and (not duas or ci == 1 or l["x0"] < meio - 2)]
            segs.append({"pagina": pn, "x0": a, "x1": b, "linhas": juntar_em_linhas(dentro)})
    return segs


def graficos_da_regiao(pagina, x0, y0, x1, y1):
    """Retângulos de desenhos e imagens dentro da região (sem as linhas divisórias da página)."""
    rets = []
    for d in pagina.get_drawings():
        r = d["rect"]
        if r.width < 2 and r.height > 300 or r.height < 2 and r.width > 0.9 * (x1 - x0):
            continue
        if r.x0 >= x0 - 2 and r.x1 <= x1 + 2 and r.y0 >= y0 - 2 and r.y1 <= y1 + 2 and (r.width > 1 or r.height > 1):
            rets.append(pymupdf_rect(r))
    for info in pagina.get_image_info():
        r = info["bbox"]
        if r[0] >= x0 - 2 and r[2] <= x1 + 2 and r[1] >= y0 - 2 and r[3] <= y1 + 2:
            rets.append(list(r))
    # agrupa por proximidade vertical
    rets.sort(key=lambda r: r[1])
    grupos = []
    for r in rets:
        g = grupos[-1] if grupos else None
        if g and r[1] <= g[3] + 12:
            g[:] = [min(g[0], r[0]), min(g[1], r[1]), max(g[2], r[2]), max(g[3], r[3])]
        else:
            grupos.append(list(r))
    return [g for g in grupos if (g[2] - g[0]) > 25 and (g[3] - g[1]) > 15]


def pymupdf_rect(r):
    return [r.x0, r.y0, r.x1, r.y1]


def eh_alternativa(l, letra):
    t = l["texto"]
    if not re.match(rf"^{letra}(\s|\t|$)", t):
        return False
    return bool(FONTE_LETRA.search(l["fonte"])) or t.startswith(letra + "\t") or l.get("letra_isolada", False)


def separar_alternativas(linhas):
    """Procura, de trás para frente, a sequência A..E; devolve (índice de A, [5 textos])."""
    for ia in range(len(linhas) - 1, -1, -1):
        if not eh_alternativa(linhas[ia], "A"):
            continue
        inicio, esperado, textos, atual = ia, 1, [], None
        for l in linhas[ia:]:
            if esperado <= 5 and eh_alternativa(l, "ABCDE"[esperado - 1]):
                atual = [re.sub(r"^[A-E](\s|\t)*", "", l["texto"]).strip()]
                textos.append(atual)
                esperado += 1
                x_letra = l["x0"]
            elif atual is not None and l["x0"] > x_letra + 3 and esperado <= 6:
                atual.append(l["texto"])
        if len(textos) == 5:
            # Fração digitada em duas linhas empilhadas (numerador em cima, denominador embaixo)
            # vira "8 3" em vez de "8/3": junta com "/" quando a alternativa inteira são só
            # dois números curtos, o padrão de uma fração sem mais nenhum texto ao redor.
            def montar(t):
                if len(t) == 2 and all(re.fullmatch(r"\d{1,4}", p) for p in t):
                    return "/".join(t)
                return " ".join(t).strip()
            return inicio, [montar(t) for t in textos]
    return None, []


def ler_gabarito(pdf, cor=None):
    """{número: letra} e, para as questões de língua estrangeira, {número: (inglês, espanhol)}.
    Se o PDF tiver uma página por cor (2015, 2ª aplicação), usa só a página da cor."""
    import pymupdf

    if not pdf or not Path(pdf).exists():
        return {}, {}
    doc = pymupdf.open(pdf)
    paginas = [p.get_text() for p in doc]
    if cor and len(paginas) > 1:
        da_cor = [t for t in paginas if cor[:4] in normalizar(t)]
        if da_cor and len(da_cor) < len(paginas):
            paginas = da_cor
    fichas = []
    for t in paginas:
        fichas += [f for f in re.split(r"\s+", t) if f]
    # tabela com as quatro cores lado a lado (2009): lê só a faixa da cor do caderno.
    # Sem isso, o leitor pegava a primeira coluna (amarelo) para qualquer caderno.
    faixas = None
    misturada = max(Counter(f for f in fichas if re.fullmatch(r"\d{2,3}", f)).values(), default=0) > 2
    for p in (doc if misturada else []):
        palavras = p.get_text("words")
        cabecalho = {}
        for w in palavras:
            n = normalizar(w[4])
            c = next((k for k in CORES if n == k[:len(n)] and len(n) >= 4 or n in (k, k[:-1] + "a")), None)
            if c and c not in cabecalho:
                cabecalho[c] = w[0]
        if len(cabecalho) >= 2:
            xs = sorted(cabecalho.values())
            if cor not in cabecalho:
                return {}, {}
            x0 = cabecalho[cor] - 25
            depois = [x for x in xs if x > cabecalho[cor]]
            x1 = (depois[0] - 25) if depois else 10**6
            faixas = (x0, x1)
            break
    if faixas:
        fichas = []
        for p in doc:
            palavras = sorted(p.get_text("words"), key=lambda w: (round(w[1] / 3), w[0]))
            fichas += [w[4] for w in palavras if faixas[0] <= w[0] < faixas[1]]
    elif cor and len(fichas) and max(Counter(f for f in fichas if re.fullmatch(r"\d{2,3}", f)).values(), default=0) > 2:
        return {}, {}  # vários gabaritos misturados e sem cabeçalho de cor: melhor nada que a cor errada
    simples, lingua = {}, {}
    i = 0
    while i < len(fichas):
        f = fichas[i]
        if re.fullmatch(r"\d{1,3}", f) and 1 <= int(f) <= 180 and i + 1 < len(fichas):
            respostas = []
            j = i + 1
            while j < len(fichas) and len(respostas) < 2 and re.fullmatch(r"(?i)[A-E]|anulad[oa]|x|\*", fichas[j]):
                respostas.append("anulada" if len(fichas[j]) > 1 or fichas[j] in "xX*" else fichas[j].upper())
                j += 1
            if respostas:
                n = int(f)
                if len(respostas) == 2:
                    lingua[n] = tuple(respostas)
                else:
                    simples.setdefault(n, respostas[0])
                i = j
                continue
        i += 1
    return simples, lingua


def area_por_numero(ano, dia, n):
    if ano <= 2016:
        return ("CH" if n <= 45 else "CN") if dia == 1 else ("LC" if n <= 135 else "MT")
    return ("LC" if n <= 45 else "CH") if dia == 1 else ("CN" if n <= 135 else "MT")


def chave_caderno(c):
    lingua = f"-{c['lingua']}" if c["lingua"] else ""
    return f"{c['ano']}-{c['aplicacao']}-D{c['dia']}-{c['cor']}{lingua}"


def extrair_caderno(c):
    import pymupdf

    pdf = arquivo_pdf(c, "prova")
    doc = pymupdf.open(pdf)
    segs = segmentos(doc)
    # 1) cabeçalhos na ordem de leitura
    marcas = []
    for si, s in enumerate(segs):
        for li, l in enumerate(s["linhas"]):
            m = CABECALHO.match(l["texto"])
            if m and len(l["texto"]) < 90:
                marcas.append((si, li, int(m.group(1))))
    # 2) cada questão vai do seu cabeçalho até o próximo
    vistos, questoes, compartilhados = {}, [], []
    gab, gab_lingua, c["fonte_gabarito"] = obter_gabarito(c)
    itens, relato = itens_do_caderno(c["ano"], c["aplicacao"], c["cor"], gab, gab_lingua)
    c["ligacao_microdados"] = relato
    for k, (si, li, n) in enumerate(marcas):
        fim = marcas[k + 1] if k + 1 < len(marcas) else (len(segs), 0, None)
        partes = []
        for sj in range(si, min(fim[0] + 1, len(segs), si + 5)):
            s = segs[sj]
            ini = li + 1 if sj == si else 0
            ate = fim[1] if sj == fim[0] else len(s["linhas"])
            linhas = []
            for l in s["linhas"][ini:ate]:
                if FIM.search(l["texto"]):
                    break
                if not FAIXA.search(l["texto"]) or COMPARTILHADO.search(l["texto"]):
                    linhas.append(l)
            if linhas:
                partes.append((s, linhas))
        todas = [l for _, ls in partes for l in ls]
        # bloco "Texto para as questões 06 a 10": sai desta questão e vai para as do intervalo
        j = next((i for i, l in enumerate(todas) if COMPARTILHADO.search(l["texto"])), None)
        if j is not None:
            m = COMPARTILHADO.search(todas[j]["texto"])
            base = todas[j:]
            ids_base = {id(l) for l in base}
            regs = []
            for s, ls in partes:
                dentro = [l for l in ls if id(l) in ids_base]
                if dentro:
                    regs.append({"pagina": s["pagina"] + 1, "bbox": [round(s["x0"], 1), round(min(l["y0"] for l in dentro) - 2, 1),
                                                                    round(s["x1"], 1), round(max(l["y1"] for l in dentro) + 2, 1)]})
            compartilhados.append({"de": int(m.group("de")), "ate": int(m.group("ate")), "regioes": regs,
                                   "texto": re.sub(r"\s+", " ", " ".join(l["texto"] for l in base)).strip()})
            todas = todas[:j]
            partes = [(s, [l for l in ls if id(l) not in ids_base]) for s, ls in partes]
            partes = [(s, ls) for s, ls in partes if ls]
        ia, alternativas = separar_alternativas(todas)
        enunciado = todas[:ia] if ia is not None else todas
        # 3) regiões por página/coluna, fechando na última alternativa
        ultimo_y = None
        if ia is not None:
            ultimo = todas[ia:][-1]
            ultimo_y = (id(ultimo), ultimo["y1"])
        regioes, figuras = [], []
        cab = segs[si]["linhas"][li]
        for s, ls in partes:
            y0 = cab["y0"] if s is segs[si] else ls[0]["y0"]
            y1 = max(l["y1"] for l in ls)
            if ultimo_y and any(id(l) == ultimo_y[0] for l in ls):
                y1 = ultimo_y[1]
            y1_regiao = y1
            pagina = doc[s["pagina"]]
            # A busca por figuras começa depois da linha do cabeçalho "Questão N", não da própria
            # linha: algumas provas desenham um risco/textura decorativo do lado do número da
            # questão, e ele batia como "figura" mesmo sem fazer parte do enunciado.
            y0_fig = cab["y1"] if s is segs[si] else y0
            for g in graficos_da_regiao(pagina, s["x0"], y0_fig, s["x1"], y1 + 1):
                figuras.append({"pagina": s["pagina"] + 1, "bbox": [round(v, 1) for v in g]})
            regioes.append({"pagina": s["pagina"] + 1, "bbox": [round(s["x0"], 1), round(y0 - 2, 1), round(s["x1"], 1), round(y1_regiao + 2, 1)]})
            if ultimo_y and any(id(l) == ultimo_y[0] for l in ls):
                break
        # 4) identidade, língua estrangeira e respostas oficiais
        vistos[n] = vistos.get(n, 0) + 1
        lingua = c["lingua"]
        eh_le = (n <= 5 and c["ano"] >= 2017) or (91 <= n <= 95 and c["ano"] <= 2016 and c["dia"] == 2) or (c["ano"] <= 2016 and c["dia"] == 2 and 91 <= n <= 95)
        if eh_le and not lingua:
            lingua = "ingles" if vistos[n] == 1 else "espanhol"
        qid = f"{chave_caderno(c) if not c['lingua'] else chave_caderno(c).rsplit('-', 1)[0]}-Q{n:03d}"
        if eh_le:
            qid += f"-{lingua}"
        linhas_micro = itens.get(n, [])
        if eh_le and len(linhas_micro) > 1:
            tp = "0" if lingua == "ingles" else "1"
            linhas_micro = [l for l in linhas_micro if l.get("TP_LINGUA", "") == tp] or linhas_micro
        oficial = gab.get(n)
        if n in gab_lingua:
            oficial = gab_lingua[n][0 if lingua == "ingles" else 1]
        micro = linhas_micro[0] if linhas_micro else {}
        # trava por questão: só usa o item dos microdados se a resposta dele for a oficial
        if micro and oficial and oficial != "anulada" and micro.get("TX_GABARITO") != oficial:
            micro = {}
        texto = " ".join(l["texto"] for l in enunciado)
        ruins = sum(1 for ch in texto if ord(ch) < 32 and ch not in "\n\t")
        questoes.append({
            "id": qid, "ano": c["ano"], "aplicacao": c["aplicacao"], "dia": c["dia"], "caderno": c["caderno"],
            "cor": c["cor"], "numero": n, "lingua": lingua if eh_le else None,
            "area": micro.get("SG_AREA") or area_por_numero(c["ano"], c["dia"], n),
            "pdf": str(pdf.relative_to(RAIZ)).replace("\\", "/"), "url_prova": c["prova"], "url_gabarito": c.get("gabarito"),
            "regioes": regioes, "figuras": figuras,
            "texto": re.sub(r"\s+", " ", texto).strip(), "alternativas": alternativas,
            "gabarito": oficial, "fonte_gabarito": c.get("fonte_gabarito"), "gabarito_microdados": micro.get("TX_GABARITO") or None,
            "anulada": oficial == "anulada" or micro.get("IN_ITEM_ABAN") == "1",
            "habilidade": f"H{int(float(micro['CO_HABILIDADE'])):02d}" if micro.get("CO_HABILIDADE") else None,
            "param_b": float(micro["NU_PARAM_B"].replace(",", ".")) if micro.get("NU_PARAM_B") else None,
            "texto_ilegivel": round(ruins / max(1, len(texto)), 3),
            "alternativas_em_imagem": len(alternativas) == 5 and any(len(re.sub(r"\W", "", a)) < 1 for a in alternativas),
            "texto_base": None, "regioes_base": [],
        })
    for bloco in compartilhados:
        for q in questoes:
            if bloco["de"] <= q["numero"] <= bloco["ate"]:
                q["texto_base"], q["regioes_base"] = bloco["texto"], bloco["regioes"]
    return questoes


def extrair(*args):
    cat = ler_json(CATALOGO)
    for c in filtrar(cat["escolhidos"], args):
        if not arquivo_pdf(c, "prova").exists():
            continue
        qs = extrair_caderno(c)
        gravar_json(QUESTOES / f"{chave_caderno(c)}.json", qs)
        sem_alt = sum(1 for q in qs if len(q["alternativas"]) != 5)
        sem_gab = sum(1 for q in qs if not (q["gabarito"] or q["gabarito_microdados"]))
        diverge = sum(1 for q in qs if q["gabarito"] and q["gabarito_microdados"] and q["gabarito"] != "anulada" and q["gabarito"] != q["gabarito_microdados"])
        print(f"{chave_caderno(c):40} {len(qs):3} q | sem 5 alt {sem_alt:2} | sem gab {sem_gab:2} | PDF≠micro {diverge:2} | {c.get('ligacao_microdados')}")


# --------------------------------------------------------------------- texto
def texto():
    """Índice de busca com texto pronto de terceiros (só para achar questões; a
    questão usada numa aula é sempre conferida no PDF oficial com `localizar`)."""
    TEXTO.mkdir(parents=True, exist_ok=True)
    indice = []
    for ano in range(2009, 2024):
        arq = TEXTO / f"enemdev-{ano}.json"
        if not arq.exists():
            qs, offset = [], 0
            while True:
                time.sleep(1.5)  # a API limita o número de pedidos por minuto
                bruto = curl(f"https://api.enem.dev/v1/exams/{ano}/questions?limit=50&offset={offset}")
                pag = json.loads(bruto)
                qs += pag.get("questions", [])
                if not pag.get("metadata", {}).get("hasMore"):
                    break
                offset += 50
            gravar_json(arq, qs)
        for q in ler_json(arq):
            partes = [q.get("context") or "", q.get("alternativesIntroduction") or ""]
            indice.append({"fonte": "enem.dev", "ano": ano, "numero_ref": q.get("index"), "lingua": q.get("language"),
                           "area": {"linguagens": "LC", "ciencias-humanas": "CH", "ciencias-natureza": "CN", "matematica": "MT"}.get(q.get("discipline")),
                           "texto": " ".join(partes), "alternativas": [a.get("text") or "" for a in q.get("alternatives", [])],
                           "gabarito": q.get("correctAlternative")})
    for ano in (2022, 2023, 2024):
        arq = TEXTO / f"maritaca-{ano}.jsonl"
        if not arq.exists():
            curl(f"https://huggingface.co/datasets/maritaca-ai/enem/resolve/main/{ano}.jsonl", arq)
        for linha in arq.read_text(encoding="utf-8").splitlines():
            q = json.loads(linha)
            n = int(re.sub(r"\D", "", q["id"]) or 0)
            alts = q["alternatives"]
            if isinstance(alts, str):
                try:
                    import ast
                    alts = ast.literal_eval(alts)
                except (ValueError, SyntaxError):
                    alts = [alts]
            indice.append({"fonte": "maritaca", "ano": ano, "numero_ref": n, "lingua": None, "area": None,
                           "texto": q["question"], "alternativas": alts, "gabarito": q.get("label")})
    gravar_json(TEXTO / "indice.json", indice)
    print(len(indice), "questões no índice de texto")


# -------------------------------------------------------------------- buscar
def todas_do_banco():
    for arq in sorted(QUESTOES.glob("*.json")):
        yield from ler_json(arq)


def buscar(*args):
    """buscar termo1 termo2 ... [--area MT] [--min 2]: todos os termos (sem acento), ou
    pelo menos --min deles. Mostra primeiro o banco oficial, depois o índice de texto."""
    termos, area, minimo = [], None, None
    it = iter(args)
    for a in it:
        if a == "--area":
            area = next(it).upper()
        elif a == "--min":
            minimo = int(next(it))
        else:
            termos.append(normalizar(a))
    minimo = minimo or len(termos)

    def nota(txt):
        t = normalizar(txt)
        return sum(1 for termo in termos if termo in t)

    achadas = []
    for q in todas_do_banco():
        if area and q["area"] != area:
            continue
        n = nota(q["texto"] + " " + " ".join(q["alternativas"]))
        if n >= minimo:
            achadas.append((n, q))
    achadas.sort(key=lambda x: (-x[0], -(x[1]["param_b"] or -9)))
    for n, q in achadas[:60]:
        b = f"b={q['param_b']:.2f}" if q["param_b"] is not None else "b=—"
        avisos = []
        if q["anulada"]:
            avisos.append("ANULADA")
        if not q["gabarito"] or q["gabarito"] == "anulada":
            avisos.append("sem gabarito oficial")
        if len(q["alternativas"]) != 5:
            avisos.append("alternativas não extraídas")
        if q["texto_ilegivel"] > 0.02:
            avisos.append("texto ilegível")
        if q["figuras"]:
            avisos.append(f"{len(q['figuras'])} figura(s)")
        print(f"[{n}] {q['id']:34} {q['area']} {q['habilidade'] or '   '} {b:8} {' · '.join(avisos)}")
        print("     ", q["texto"][:220])
    print(f"-- {len(achadas)} no banco oficial")
    indice = ler_json(TEXTO / "indice.json", [])
    extra = [(nota(i["texto"] + " " + " ".join(i["alternativas"])), i) for i in indice if not area or i["area"] in (None, area)]
    extra = sorted([x for x in extra if x[0] >= minimo], key=lambda x: -x[0])
    for n, i in extra[:40]:
        print(f"[{n}] texto:{i['fonte']}:{i['ano']}:{i['numero_ref']}{':' + i['lingua'] if i['lingua'] else ''}  {i['texto'][:200]}")
    print(f"-- {len(extra)} no índice de texto (regular sem PDF baixado: use `localizar`)")


# ----------------------------------------------------------------- localizar
def localizar(ref):
    """localizar texto:enem.dev:2019:147 -> baixa o PDF oficial desse ano (regular),
    extrai e devolve o id da questão no banco, achada pelo texto (não pelo número)."""
    _, fonte, ano, num = ref.split(":")[:4]
    ano = int(ano)
    indice = ler_json(TEXTO / "indice.json", [])
    item = next(i for i in indice if i["fonte"] == fonte and i["ano"] == ano and str(i["numero_ref"]) == num)
    cat = ler_json(CATALOGO)
    for c in filtrar(cat["escolhidos"], [str(ano), "regular"]):
        if not arquivo_pdf(c, "prova").exists():
            baixar(str(ano), "regular", f"D{c['dia']}")
        arq = QUESTOES / f"{chave_caderno(c)}.json"
        if not arq.exists():
            extrair(str(ano), "regular", f"D{c['dia']}")
    alvo = set(normalizar(item["texto"]).split())
    melhor, nota_melhor = None, 0.0
    for q in todas_do_banco():
        if q["ano"] != ano or q["aplicacao"] != "regular":
            continue
        palavras = set(normalizar(q["texto"]).split())
        nota = len(alvo & palavras) / max(1, len(alvo | palavras))
        if nota > nota_melhor:
            melhor, nota_melhor = q, nota
    if not melhor or nota_melhor < 0.5:
        print("não achei no PDF oficial com segurança (semelhança", round(nota_melhor, 2), ")")
        return None
    print(melhor["id"], f"(semelhança {nota_melhor:.2f})")
    return melhor["id"]


# ------------------------------------------------------ mostrar, recortar, página
def questao(qid):
    for q in todas_do_banco():
        if q["id"] == qid:
            return q
    sys.exit(f"questão {qid} não está no banco")


def mostrar(qid):
    print(json.dumps(questao(qid), ensure_ascii=False, indent=1))


def aparar(pag, ret, margem=6):
    """Encolhe o retângulo até a tinta e devolve com a mesma margem (em pt) nos quatro lados,
    para a figura sair centrada no PNG em vez de colada num canto com branco sobrando no outro."""
    import pymupdf

    pix = pag.get_pixmap(dpi=144, clip=ret, colorspace=pymupdf.csGRAY, alpha=False)
    w, h, st, a = pix.width, pix.height, pix.stride, pix.samples
    tinta = 235  # abaixo disto o pixel não é papel
    ys = [y for y in range(h) if min(a[y * st:y * st + w]) < tinta]
    xs = [x for x in range(w) if min(a[x:h * st:st]) < tinta]
    if not ys or not xs:
        return ret
    k = 72 / 144
    justo = pymupdf.Rect(ret.x0 + xs[0] * k, ret.y0 + ys[0] * k, ret.x0 + (xs[-1] + 1) * k, ret.y0 + (ys[-1] + 1) * k)
    return (justo + (-margem, -margem, margem, margem)) & pag.rect


def recortar(qid, *args):
    """recortar ID saida.png [--figura N | --regiao pagina x0 y0 x1 y1] [--sem-aparar]: PNG a 200 dpi,
    até 1600 px, aparado e centrado (mesma margem nos quatro lados)."""
    import pymupdf

    q = questao(qid)
    saida, resto = Path(args[0]), list(args[1:])
    if "--regiao" in resto:
        i = resto.index("--regiao")
        pagina, *bbox = [float(v) for v in resto[i + 1:i + 6]]
        pagina = int(pagina)
    else:
        n = int(resto[resto.index("--figura") + 1]) if "--figura" in resto else 1
        fig = q["figuras"][n - 1]
        pagina, bbox = fig["pagina"], fig["bbox"]
    doc = pymupdf.open(RAIZ / q["pdf"])
    ret = pymupdf.Rect(*bbox) + (-4, -4, 4, 4)  # folga para o traço não encostar na borda
    if "--sem-aparar" not in resto:
        ret = aparar(doc[pagina - 1], ret)
    # 200 dpi; figura pequena ganha até 300 dpi (mais que isso só borra imagem de baixa resolução)
    polegadas = ret.width / 72
    dpi = int(min(1600 / polegadas, max(200, min(300, 560 / polegadas))))
    saida.parent.mkdir(parents=True, exist_ok=True)
    doc[pagina - 1].get_pixmap(dpi=dpi, clip=ret).save(saida)
    print("recorte salvo:", saida, f"({dpi} dpi)")


def pagina(qid, destino=None):
    """Renderiza as regiões da questão (e a página inteira) em PNG, para conferência."""
    import pymupdf

    q = questao(qid)
    destino = Path(destino) if destino else IMAGENS / qid
    destino.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(RAIZ / q["pdf"])
    arquivos = []
    for k, r in enumerate(q["regioes"], 1):
        arq = destino / f"regiao-{k}.png"
        doc[r["pagina"] - 1].get_pixmap(dpi=150, clip=pymupdf.Rect(*r["bbox"])).save(arq)
        arquivos.append(arq)
    for p in sorted({r["pagina"] for r in q["regioes"]}):
        arq = destino / f"pagina-{p}.png"
        doc[p - 1].get_pixmap(dpi=110).save(arq)
        arquivos.append(arq)
    for a in arquivos:
        print(a)
    return arquivos


# ------------------------------------------------------- conferir, cobertura
def conferir(n="10", semente="2026"):
    """Sorteia questões e gera imagens + ficha para conferir texto, alternativas e gabarito."""
    random.seed(int(semente))
    boas = [q for q in todas_do_banco() if len(q["alternativas"]) == 5 and q["gabarito"] and q["gabarito"] != "anulada"]
    for q in random.sample(boas, int(n)):
        destino = IMAGENS / "conferencia" / q["id"]
        pagina(q["id"], destino)
        gravar_json(destino / "ficha.json", q)
        print(q["id"], "gabarito", q["gabarito"], "| micro", q["gabarito_microdados"], "| b", q["param_b"])


def conferir_gabaritos():
    """Compara o gabarito do banco (PDF do INEP) com o de terceiros (enem.dev, Maritaca),
    casando as questões pelo texto. Não substitui o INEP: só acusa leitura errada
    (ex.: coluna de outra cor), que a ligação com os microdados não pega."""
    indice = [i for i in ler_json(TEXTO / "indice.json", []) if i.get("gabarito")]
    por_ano = {}
    for i in indice:
        por_ano.setdefault(i["ano"], []).append((set(normalizar(i["texto"]).split()), i))
    total = iguais = 0
    for q in todas_do_banco():
        if q["aplicacao"] != "regular" or q["ano"] not in por_ano or not q["gabarito"] or q["gabarito"] == "anulada":
            continue
        palavras = set(normalizar(q["texto"]).split())
        if len(palavras) < 12:
            continue
        nota, melhor = max(((len(palavras & p) / max(1, len(palavras | p)), i) for p, i in por_ano[q["ano"]]), key=lambda x: x[0])
        if nota < 0.6 or (q["lingua"] and melhor.get("lingua") and melhor["lingua"] != q["lingua"]):
            continue
        total += 1
        if melhor["gabarito"] == q["gabarito"]:
            iguais += 1
        else:
            print(f"DIFERE {q['id']}: INEP (banco) {q['gabarito']} x {melhor['fonte']} {melhor['gabarito']} (semelhança {nota:.2f})")
    print(f"{iguais}/{total} gabaritos iguais aos de terceiros")


def cobertura():
    por = {}
    for q in todas_do_banco():
        k = (q["ano"], q["aplicacao"])
        d = por.setdefault(k, {"q": 0, "ok": 0, "b": 0, "anul": 0, "ileg": 0})
        d["q"] += 1
        d["ok"] += len(q["alternativas"]) == 5 and bool(q["gabarito"]) and q["gabarito"] != "anulada"
        d["b"] += q["param_b"] is not None
        d["anul"] += bool(q["anulada"])
        d["ileg"] += q["texto_ilegivel"] > 0.02
    print("ano  aplicação           questões  usáveis  com_b  anuladas  ilegíveis")
    for (ano, apl), d in sorted(por.items()):
        print(f"{ano} {apl:20} {d['q']:8} {d['ok']:8} {d['b']:6} {d['anul']:9} {d['ileg']:10}")
    tot = {k: sum(d[k] for d in por.values()) for k in ("q", "ok", "b")}
    print("total", tot)


def comando(nome):
    return {"catalogo": catalogo, "microdados": microdados, "baixar": baixar, "extrair": extrair,
            "texto": texto, "buscar": buscar, "localizar": localizar, "mostrar": mostrar,
            "recortar": recortar, "pagina": pagina, "conferir": conferir, "cobertura": cobertura,
            "conferir-gabaritos": conferir_gabaritos}.get(nome)


if __name__ == "__main__":
    if len(sys.argv) < 2 or not comando(sys.argv[1]):
        print(__doc__)
        sys.exit(1)
    comando(sys.argv[1])(*sys.argv[2:])
