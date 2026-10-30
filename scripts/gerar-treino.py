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

# Treino da manhã: Matemática do ENEM regular (2022-2024), dia 2, caderno azul, de fácil a médio.
MANHA = [(2023, 153), (2023, 156), (2024, 139), (2024, 154), (2024, 178), (2023, 162), (2022, 171),
         (2024, 157), (2024, 145), (2023, 137), (2024, 153), (2023, 157), (2023, 141), (2023, 155),
         (2023, 143), (2024, 140), (2024, 137), (2024, 173), (2022, 164), (2024, 176)]


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
    ys = []
    for a in alts:
        achados = [r for r in pag.search_for(a[:30], clip=clip) if r.y0 > clip.y0 + 40]
        if not achados:
            return None, None
        ys.append(min(r.y0 for r in achados))
    if ys != sorted(ys) or len(set(round(y) for y in ys)) != 5:  # lista vertical, uma por linha
        return None, None
    # Corta logo abaixo da última linha (ou figura) acima da alternativa A, sem depender do espaço entre elas.
    acima = [b for b in pag.get_text('dict', clip=clip)['blocks'] for b in ([b] if b['type'] == 1 else b.get('lines', []))]
    fundos = [pymupdf.Rect(b['bbox']).y1 for b in acima if pymupdf.Rect(b['bbox']).y0 < ys[0] - 4 and 'ENEM' not in ''.join(sp['text'] for sp in b.get('spans', []))]
    return (min(max(fundos) + 3, ys[0] - 2) if fundos else ys[0] - 7), alts


def recortar(q, nome):
    pdf = pymupdf.open(CACHE.parent / q['pdf'])
    imgs = []
    regioes = q['regioes']
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
        y_alt, alts = alternativas_em_texto(q, pag, clip)
        if alts:
            clip.y1 = y_alt
        pag.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip).save(SAIDA / arq)
        imgs.append(arq)
    return imgs, alts


def questao(q, nome, rotulo):
    assert not q['anulada'] and q['gabarito'] == q['gabarito_microdados'] and q['gabarito'] in 'ABCDE', q['id']
    imgs, alts = recortar(q, nome)
    return {'id': nome, 'rotulo': rotulo, 'imgs': imgs, 'alternativas': alts, 'gabarito': q['gabarito'],
            'habilidade': q['habilidade'], 'fonte': f"ENEM {q['ano']}, questão {q['numero']}", 'paginaInteira': len(q['regioes']) > 1}


manha = [questao(banco(a)[n], f'm{a}-{n}', f'Questão {i + 1}') for i, (a, n) in enumerate(MANHA)]

b25 = banco(2025)
simulado = []
for n in range(136, 181):
    q = b25[n]
    if q['anulada'] and q['gabarito'] == 'anulada':  # 174: anulada pelo INEP, vale ponto para todos
        simulado.append({'id': f's2025-{n}', 'rotulo': f'Questão {n}', 'imgs': recortar(q, f's2025-{n}')[0], 'alternativas': None, 'gabarito': None,
                         'habilidade': q['habilidade'], 'fonte': f'ENEM 2025, questão {n}'})
    else:
        q = dict(q, anulada=False)  # a 172 consta como "anulada" nos microdados, mas o PDF oficial dá A
        simulado.append(questao(q, f's2025-{n}', f'Questão {n}'))

def paginas(ano, nums, prefixo):
    pdf = pymupdf.open(CACHE / f'inep/pdf/{ano}/regular-D1-azul-prova.pdf')
    arqs = []
    for p in nums:
        arq = f'{prefixo}-{p}.png'
        pdf[p - 1].get_pixmap(matrix=pymupdf.Matrix(1.8, 1.8)).save(SAIDA / arq)
        arqs.append(arq)
    return arqs


red = paginas(2025, (20, 21), 'redacao2025')

# Humanas completa: ENEM 2024, 1º dia, caderno azul, questões 46 a 90, e a proposta de redação do mesmo dia.
b24 = banco(2024, 1)
humanas = [questao(b24[n], f'h2024-{n}', f'Questão {n}') for n in range(46, 91)]
red24 = paginas(2024, (19,), 'redacao2024')

json.dump({'manha': manha, 'simulado': simulado, 'redacao': red, 'humanas': humanas, 'redacao2024': red24}, open(RAIZ / 'src/data/treino.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(manha), len(simulado), len(humanas), 'ok')
