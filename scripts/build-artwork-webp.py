import json
from datetime import datetime
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path.home() / "Downloads" / "artwork"
DEST = ROOT / "assets" / "artwork"
ARTWORK_JSON = ROOT / "assets" / "data" / "artwork.json"
MAX_SIZE = 1400
QUALITY = 86

FILES = {
    "2026-main-poster/2026-main.png": "2026-main.webp",
    "2026-main-poster/feat-2023.png": "2026-feat-2023.webp",
    "2024-main-icon/gp2-2048.png": "2024-main-icon.webp",
    "2023-main-poster/v4.0.0-alpha0-square.png": "2023-main-poster.webp",
    "2026-for-UNMotion/usagi-pose-U.png": "un-motion-pose-u.webp",
    "2026-for-UNMotion/usagi-pose-T.png": "un-motion-pose-t.webp",
    "2026-for-UNMotion/usagi-pose-T-wrist-front.png": "un-motion-pose-t-wrist-front.webp",
    "2026-for-UNMotion/usagi-pose-I.png": "un-motion-pose-i.webp",
}


def convert(src: Path, dest: Path):
    with Image.open(src) as image:
        image = image.convert("RGB")
        image.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        image.save(dest, "WEBP", quality=QUALITY, method=6)
        print(f"{src} -> {dest}")


def main():
    for rel, out in FILES.items():
        src = SOURCE / rel
        if not src.exists():
            raise FileNotFoundError(src)
        convert(src, DEST / out)
    refresh_cache_version()


def refresh_cache_version():
    data = json.loads(ARTWORK_JSON.read_text(encoding="utf-8"))
    data["cacheVersion"] = datetime.now().strftime("%Y%m%d")
    ARTWORK_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"updated {ARTWORK_JSON}")


if __name__ == "__main__":
    main()
