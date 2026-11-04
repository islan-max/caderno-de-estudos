"""Gera public/treino/*.png e src/data/treino.json a partir do banco do INEP (.cache/inep).

Cada questão vira o recorte da própria página do PDF oficial (texto, figura e alternativas
exatamente como na prova). Gabarito: o do PDF do INEP, exigindo que bata com o dos microdados.
Uso (na raiz do repositório principal ou do worktree):  CACHE=<pasta .cache> python scripts/gerar-treino.py
"""
import json, os, pathlib, re
import pymupdf

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(os.environ.get('CACHE', RAIZ / '.cache'))
SAIDA = RAIZ / 'public' / 'treino'
SAIDA.mkdir(parents=True, exist_ok=True)

# Matemática do ENEM 2023 (dia 2): as 30 mais fáceis pelo param_b (TRI), sem as que já foram feitas em listas
# anteriores (137, 141, 143, 153, 155, 156, 157, 162), sem anuladas e sem as marcadas nos microdados.
JA_FEITAS_2023 = {137, 141, 143, 153, 155, 156, 157, 162}


def banco(ano, dia=2):
    return {q['numero']: q for q in json.load(open(CACHE / 'inep/questoes' / f'{ano}-regular-D{dia}-azul.json', encoding='utf-8'))}


# Alternativas só viram texto quando o texto extraído é simples e confere com o PDF: letras, números e
# pontuação comum, sem expoente, quebra de linha ou caractere quebrado. O resto fica como imagem.
SIMPLES = re.compile(r"^[\w .,;:!?%()/\-–—'\"“”‘’$º°ª+=×÷<>≤≥]+$")


def alternativas_em_texto(q, pag, clip):
    """Devolve (y onde as alternativas começam, lista de 5 textos) ou (None, None)."""
    alts = q.get('alternativas') or []
    if len(alts) != 5 or q.get('alternativas_em_imagem') or q.get('texto_ilegivel'):
        return None, None
    alts = [a.strip() for a in alts]
    if not all(a and SIMPLES.match(a) for a in alts):
        return None, None
    # As alternativas do PDF são linhas "A<tab> texto". Acha as cinco no recorte (mesmo x, uma abaixo da outra) e
    # confere que o texto do banco é o que está no PDF: quem diz onde cortar é o PDF, não o texto do banco.
    linhas = [l for blk in pag.get_text('dict', clip=clip)['blocks'] for l in blk.get('lines', [])]
    achadas = {}
    for l in sorted(linhas, key=lambda l: l['bbox'][1]):
        m = re.match(r'([A-E])\t\s*(\S.*)', ''.join(sp['text'] for sp in l['spans']))
        if m and m.group(1) not in achadas and l['bbox'][1] > clip.y0 + 40:
            achadas[m.group(1)] = (l['bbox'][0], l['bbox'][1], m.group(2))
    if sorted(achadas) != list('ABCDE'):
        return None, None
    xs = [achadas[c][0] for c in 'ABCDE']
    ys = [achadas[c][1] for c in 'ABCDE']
    norm = lambda t: re.sub(r'\s+', '', t)[:10]
    if max(xs) - min(xs) > 3 or ys != sorted(ys) or any(not (0 < y2 - y1 < 60) for y1, y2 in zip(ys, ys[1:])):
        return None, None
    if any(norm(achadas[c][2]) != norm(a) for c, a in zip('ABCDE', alts)):
        return None, None
    # Corta logo abaixo da última linha (ou figura) acima da alternativa A, sem depender do espaço entre elas.
    acima = [b for b in pag.get_text('dict', clip=clip)['blocks'] for b in ([b] if b['type'] == 1 else b.get('lines', []))]
    fundos = [pymupdf.Rect(b['bbox']).y1 for b in acima if pymupdf.Rect(b['bbox']).y0 < ys[0] - 4 and pymupdf.Rect(b['bbox']).width > 12 and 'ENEM' not in ''.join(sp['text'] for sp in b.get('spans', []))
              and not re.match(r'[A-E]\t', ''.join(sp['text'] for sp in b.get('spans', [])))]
    if not fundos:
        return ys[0] - 7, alts
    fundo = max(fundos)
    # A caixa da alternativa A pode encostar na da última linha (2 pt): então corta logo depois da linha inteira.
    return (min(fundo + 3, ys[0] - 2) if ys[0] - 2 >= fundo + 1 else fundo + 0.5), alts


# Últimas questões de Linguagens e de Humanas (ENEM 2023, dia 1): o banco anexa regiões da página seguinte (instruções e
# folha de redação) e da figura larga da questão ao lado. Só vale a primeira região.
SO_A_PRIMEIRA = {(2023, 1, 45), (2023, 1, 90)}


def regioes_da(q):
    """Regiões da questão no PDF, sem as faixas de cabeçalho e rodapé que o banco anexa na última questão do caderno."""
    regioes = q['regioes'][:1] if (q['ano'], q['dia'], q['numero']) in SO_A_PRIMEIRA else q['regioes']
    return [r for r in regioes if r['bbox'][3] - r['bbox'][1] > 30] or regioes


def recortar(q, nome):
    pdf = pymupdf.open(CACHE.parent / q['pdf'])
    imgs = []
    regioes = regioes_da(q)
    if len(regioes) > 1:
        # A questão atravessa as duas colunas (ou a página): o recorte por coluna a cortaria no meio.
        # Mostra a(s) página(s) inteira(s) e a interface avisa qual é a questão.
        paginas = list(dict.fromkeys(r['pagina'] for r in regioes))
        for i, p in enumerate(paginas):
            arq = f'{nome}-{i + 1}.png'
            pdf[p - 1].get_pixmap(matrix=pymupdf.Matrix(1.7, 1.7)).save(SAIDA / arq)
            imgs.append(arq)
        return imgs, None
    for i, r in enumerate(regioes):
        arq = f'{nome}-{i + 1}.png'
        pag = pdf[r['pagina'] - 1]
        clip = pymupdf.Rect(*r['bbox'])
        # O bbox do banco às vezes termina antes da última figura (Q138 de 2025): estica até cobrir
        # imagens que começam dentro do recorte e acabam fora, sem passar do rodapé.
        itens = [pymupdf.Rect(b['bbox']) for b in pag.get_image_info()]
        for it in itens:
            if it.x0 >= clip.x0 - 2 and it.x1 <= clip.x1 + 2 and clip.y0 <= it.y0 < clip.y1 < it.y1 < pag.rect.height - 50:
                clip.y1 = it.y1 + 4
        if clip.y1 != pymupdf.Rect(*r['bbox']).y1:
            print('esticado', nome, r['bbox'][3], '->', round(clip.y1))
        # Questão de largura total (tabela ou texto que atravessa as duas colunas): o bbox do banco só tem a
        # coluna da esquerda e cortaria a direita (Q165 de 2025). Alarga para a página inteira.
        if any(b[0] < clip.x1 - 4 and b[2] > clip.x1 + 4 and b[3] > clip.y0 and b[1] < clip.y1 and 'ENEM' not in b[4] and 'CADERNO' not in b[4]
               for b in pag.get_text('blocks')):
            larga = pymupdf.Rect(0, clip.y0, pag.rect.width, clip.y1)
            # Se a largura inteira pegaria o cabeçalho da questão do lado, o bloco largo era falso alarme.
            if len(re.findall(r'QUESTÃO\s+\d+', pag.get_text(clip=larga))) == 1:
                print('alargado', nome)
                clip = larga
        # O bbox do banco às vezes termina antes da última alternativa (Q48, Q70 de 2023). Desce enquanto houver
        # linhas coladas embaixo, sem passar do cabeçalho da próxima questão nem do rodapé.
        linhas = [l['bbox'] for blk in pag.get_text('dict')['blocks'] for l in blk.get('lines', [])
                  if l['bbox'][0] < clip.x1 - 10 and l['bbox'][2] > clip.x0 + 10]
        # Figuras e quadros (alternativas desenhadas, tabelas): ignora filetes finos e linhas que cortam a página inteira.
        linhas += [tuple(r) for r in [d['rect'] for d in pag.get_drawings()] + [pymupdf.Rect(i['bbox']) for i in pag.get_image_info()]
                   if r.width > 6 and 1.5 < r.height < 300 and r.x0 < clip.x1 - 10 and r.x1 > clip.x0 + 10]
        proximas = [b[1] for b in pag.get_text('blocks') if re.match(r'QUESTÃO\s+\d+', b[4]) and b[1] > clip.y0 + 20 and b[0] < clip.x1 - 10 and b[2] > clip.x0 + 10]
        # Rodapé: "–CH • 1º DIA • CADERNO 1 • AZUL–" (2023) ou "MT - 2° dia | Caderno 7 - AZUL" (2022).
        rodapes = [b[1] for b in pag.get_text('blocks') if b[1] > pag.rect.height - 120 and re.search(r'caderno\s*\d', b[4], re.I)]
        limite = min(proximas + rodapes + [pag.rect.height - 20]) - 1
        fim = clip.y1
        for y0, y1 in sorted((l[1], l[3]) for l in linhas if l[3] > clip.y1 - 0.5 and l[1] < limite):
            if y0 - fim < 30:
                fim = max(fim, y1)
        if fim > clip.y1:
            novo_y1 = min(fim + 2, limite + 0.5)  # a última linha pode encostar no rodapé
            print('descido', nome, round(clip.y1), '->', round(novo_y1))
            clip.y1 = novo_y1
        # Tira o rodapé da página ("22 ——— MT • 2º DIA • CAD"), que o bbox do banco às vezes inclui.
        if rodapes and clip.y0 + 40 < min(rodapes) < clip.y1:
            clip.y1 = min(rodapes) - 1
        y_alt, alts = alternativas_em_texto(q, pag, clip)
        if alts:
            clip.y1 = y_alt
        cortadas = [l for blk in pag.get_text('dict', clip=clip)['blocks'] for l in blk.get('lines', [])
                    if l['bbox'][1] < clip.y1 - 2 < l['bbox'][3] - 2 and l['bbox'][2] > clip.x0 + 20 and l['bbox'][0] < clip.x1 - 20]
        if cortadas:
            print('AVISO corte', nome, [''.join(sp['text'] for sp in l['spans'])[:40] for l in cortadas][:2])
        cabecalhos = re.findall(r'QUESTÃO\s+(\d+)', pag.get_text(clip=clip))
        if [int(c) for c in cabecalhos] != [q['numero']]:  # o recorte cortou o próprio cabeçalho ou pegou a questão do lado
            print('AVISO cabeçalhos', nome, cabecalhos)
        pag.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip).save(SAIDA / arq)
        imgs.append(arq)
    return imgs, alts


def questao(q, nome, rotulo):
    assert not q['anulada'] and q['gabarito'] == q['gabarito_microdados'] and q['gabarito'] in 'ABCDE', q['id']
    imgs, alts = recortar(q, nome)
    return {'id': nome, 'rotulo': rotulo, 'imgs': imgs, 'alternativas': alts, 'gabarito': q['gabarito'],
            'habilidade': q['habilidade'], 'fonte': f"ENEM {q['ano']}, questão {q['numero']}", 'paginaInteira': len(regioes_da(q)) > 1}


def lista(ano, dia, nums, prefixo, rotulos=None):
    """Questões do banco em ordem de `nums`. Anulada pelo INEP (gabarito do PDF) vale ponto para todos."""
    b = banco(ano, dia)
    saida = []
    for i, n in enumerate(nums):
        q, nome = b[n], f'{prefixo}-{n}'
        rotulo = rotulos[i] if rotulos else f'Questão {n}'
        if q['gabarito'] == 'anulada':
            saida.append({'id': nome, 'rotulo': rotulo, 'imgs': recortar(q, nome)[0], 'alternativas': None, 'gabarito': None,
                          'habilidade': q['habilidade'], 'fonte': f'ENEM {ano}, questão {n}', 'paginaInteira': len(regioes_da(q)) > 1})
        else:
            # `anulada` vem dos microdados (item fora da TRI), o gabarito é o do PDF: se batem, a questão vale.
            saida.append(questao(dict(q, anulada=False), nome, rotulo))
    return saida


b23 = banco(2023)
elegiveis = sorted((n for n, q in b23.items() if n >= 136 and n not in JA_FEITAS_2023 and not q['anulada'] and q['gabarito'] in 'ABCDE'),
                   key=lambda n: b23[n]['param_b'])[:30]
manha = lista(2023, 2, elegiveis, 'm2023', [f'Questão {i + 1}' for i in range(30)])

# Simulados completos de provas que ainda não foram feitas (ENEM regular, caderno azul).
lingua = lista(2023, 1, range(6, 46), 'l2023')                                          # Linguagens (sem Q1-5, de língua estrangeira)
humanas = lista(2023, 1, range(46, 91), 'h2023')                                        # Ciências Humanas
natureza = lista(2023, 2, range(91, 136), 'n2023')                                      # Ciências da Natureza
simulado = lista(2022, 2, [n for n in range(136, 181) if n not in (164, 171)], 'sm2022')  # Matemática, sem as já feitas

def paginas(ano, nums, prefixo):
    pdf = pymupdf.open(CACHE / f'inep/pdf/{ano}/regular-D1-azul-prova.pdf')
    arqs = []
    for p in nums:
        arq = f'{prefixo}-{p}.png'
        pdf[p - 1].get_pixmap(matrix=pymupdf.Matrix(1.8, 1.8)).save(SAIDA / arq)
        arqs.append(arq)
    return arqs


red = paginas(2025, (20, 21), 'redacao2025')

red24 = paginas(2024, (19,), 'redacao2024')

json.dump({'manha': manha, 'lingua': lingua, 'humanas': humanas, 'natureza': natureza, 'simulado': simulado, 'redacao': red,
           'redacao2024': red24}, open(RAIZ / 'src/data/treino.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(manha), len(lingua), len(humanas), len(natureza), len(simulado), 'ok')
