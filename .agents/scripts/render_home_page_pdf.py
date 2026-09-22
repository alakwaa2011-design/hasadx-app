import fitz
from pathlib import Path

source = Path("attached_assets/Home_page_1790061095934.pdf")
output = Path(".agents/outputs")
output.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
for index, page in enumerate(document):
    print(f"page={index + 1} size={page.rect.width}x{page.rect.height}")
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    target = output / f"home-page-{index + 1}.png"
    pixmap.save(target)
    print(target)