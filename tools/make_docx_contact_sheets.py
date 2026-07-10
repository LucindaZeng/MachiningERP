import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--src", default=str(root / ".tmp" / "erp_plan_render_final2"))
parser.add_argument("--dst", default=str(root / ".tmp" / "erp_plan_contact_final2"))
args = parser.parse_args()
src = Path(args.src)
dst = Path(args.dst)
dst.mkdir(parents=True, exist_ok=True)
pages = sorted(src.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", 32, index=0)

for start in range(0, len(pages), 4):
    batch = pages[start : start + 4]
    opened = [Image.open(p).convert("RGB") for p in batch]
    w = max(im.width for im in opened)
    h = max(im.height for im in opened)
    canvas = Image.new("RGB", (w * 2 + 60, h * 2 + 100), "#D8DEE8")
    draw = ImageDraw.Draw(canvas)
    for idx, (page_path, im) in enumerate(zip(batch, opened)):
        col, row = idx % 2, idx // 2
        x = col * (w + 40)
        y = row * (h + 50)
        canvas.paste(im, (x, y + 40))
        page_no = int(page_path.stem.split("-")[-1])
        draw.text((x + 8, y + 4), f"Page {page_no}", font=font, fill="#203748")
    end = start + len(batch)
    canvas.save(dst / f"pages-{start + 1:02d}-{end:02d}.jpg", quality=92, subsampling=0)

print(dst)
