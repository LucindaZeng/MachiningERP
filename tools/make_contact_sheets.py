#!/usr/bin/env python3
"""Create numbered contact sheets from rendered DOCX page PNGs for visual QA."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)", path.stem)
    return int(match.group(1)) if match else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--per-sheet", type=int, default=12)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    pages = sorted(args.source.glob("page-*.png"), key=page_number)
    columns = 4
    rows = (args.per_sheet + columns - 1) // columns
    cell_w, cell_h = 320, 420
    font = ImageFont.load_default()

    for sheet_index in range(0, len(pages), args.per_sheet):
        chunk = pages[sheet_index : sheet_index + args.per_sheet]
        sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(chunk):
            page = Image.open(path).convert("RGB")
            page.thumbnail((300, 388))
            x = (index % columns) * cell_w
            y = (index // columns) * cell_h
            draw.text((x + 4, y + 4), f"Page {page_number(path)}", fill="black", font=font)
            sheet.paste(page, (x + 10, y + 24))
        sheet.save(args.output / f"contact-{sheet_index // args.per_sheet + 1}.png")


if __name__ == "__main__":
    main()
