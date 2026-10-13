"""Generate the native icon set from the Trips Loom wordmark colors."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ASSETS = Path(__file__).resolve().parents[1] / "assets"
FONT = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
INK = "#1D3B4A"
PAPER = "#F7FBFC"
GOLD = "#D8AB6F"


def mark(size: int, *, transparent: bool = False) -> Image.Image:
    background = (0, 0, 0, 0) if transparent else INK
    image = Image.new("RGBA", (size, size), background)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, round(size * 0.42))
    label = "tl"
    bbox = draw.textbbox((0, 0), label, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = (size - width) / 2 - bbox[0] - size * 0.035
    y = (size - height) / 2 - bbox[1] - size * 0.045
    draw.text((x, y), label, font=font, fill=INK if transparent else PAPER)
    dot = size * 0.027
    dot_x = size * 0.715
    dot_y = size * 0.665
    draw.ellipse((dot_x - dot, dot_y - dot, dot_x + dot, dot_y + dot), fill=GOLD)
    return image


ASSETS.mkdir(parents=True, exist_ok=True)
mark(1024).convert("RGB").save(ASSETS / "icon.png")
mark(1024, transparent=True).save(ASSETS / "android-icon-foreground.png")
mark(1024, transparent=True).save(ASSETS / "android-icon-monochrome.png")
mark(192).convert("RGB").save(ASSETS / "favicon.png")

splash = Image.new("RGBA", (1024, 1024), PAPER)
logo = mark(512, transparent=True)
splash.alpha_composite(logo, (256, 256))
splash.convert("RGB").save(ASSETS / "splash-icon.png")
