#!/usr/bin/env python3
"""Auditoria do cofre: links quebrados, notas órfãs e cobertura por MOC.

Uso: python3 second-brain/scripts/auditar_grafo.py
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FENCE = re.compile(r"```.*?```", re.S)
INLINE_CODE = re.compile(r"`[^`\n]*`")
# arquivos que não são notas (documentação do cofre)
NAO_NOTAS = {"README"}
LINK = re.compile(r"\[\[([^\]]+)\]\]")


def main() -> int:
    notes = {}
    for path in glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True):
        name = os.path.splitext(os.path.basename(path))[0]
        notes[name] = path

    broken, linked = {}, set()
    for name, path in notes.items():
        text = INLINE_CODE.sub("", FENCE.sub("", open(path, encoding="utf-8").read()))
        for match in LINK.finditer(text):
            target = match.group(1).split("|")[0].split("#")[0].strip()
            if not target:
                continue
            if target in notes:
                linked.add(target)
            else:
                broken.setdefault(name, set()).add(target)

    # placeholders do template são intencionais
    broken.pop("Modelo de Nota", None)

    orphans = sorted(
        n for n in notes if n not in linked and n not in NAO_NOTAS and n != "00 - Início"
    )

    print(f"notas: {len(notes)}")
    print(f"links internos resolvidos: {len(linked)}")
    print(f"links quebrados: {sum(len(v) for v in broken.values())}")
    for name, targets in sorted(broken.items()):
        print(f"  {name} -> {', '.join(sorted(targets))}")
    print(f"notas sem link de entrada: {len(orphans)}")
    for name in orphans:
        print(f"  {name}")

    return 1 if broken or orphans else 0


if __name__ == "__main__":
    sys.exit(main())
