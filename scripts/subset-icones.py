"""Gera o subconjunto da fonte Font Awesome Solid usado pelo site.

Lê os glifos declarados em src/styles/fonts.css (".fa-nome { --fa: "\\f185"; }",
todas são do solid) e grava src/assets/fonts/fa-solid-900.woff2
com apenas esses glifos. A fonte completa fica em scripts/fontes/.

Ao criar um ícone novo: adicione a linha em fonts.css e rode de novo.

    pip install fonttools brotli
    python scripts/subset-icones.py
"""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSS = RAIZ / "src/styles/fonts.css"
COMPLETA = RAIZ / "scripts/fontes/fa-solid-900.woff2"
SAIDA = RAIZ / "src/assets/fonts/fa-solid-900.woff2"

css = CSS.read_text(encoding="utf-8")
solid = css

pontos = set()
for m in re.finditer(r'--fa:\s*"\\([0-9a-fA-F]+|.)"', solid):
    g = m.group(1)
    # "\f185" é hexadecimal; "\?" "\#" "\@" "\+" são o próprio caractere ASCII.
    pontos.add(int(g, 16) if len(g) > 1 else ord(g))
pontos.add(0xF111)  # fa-circle: disco de fundo do .fa-duo (::after)

unicodes = ",".join(f"U+{p:04X}" for p in sorted(pontos))
subprocess.run(
    [
        sys.executable, "-m", "fontTools.subset", str(COMPLETA),
        f"--unicodes={unicodes}", "--flavor=woff2", "--layout-features=",
        "--no-hinting", "--desubroutinize", f"--output-file={SAIDA}",
    ],
    check=True,
)
print(f"{len(pontos)} glifos -> {SAIDA.relative_to(RAIZ)} ({SAIDA.stat().st_size / 1024:.1f} KB)")
