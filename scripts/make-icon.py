# -*- coding: utf-8 -*-
"""从 docs/image.png 生成应用图标。

- 若源图自带透明通道（RGBA）：原样保留透明，不做背景处理（角色白发与白底同色，
  不能做颜色去底，会误删头发）
- 若为白底 RGB：原样输出，同样不做去底
- 检测右下角是否残留疑似水印（与主图分离的独立内容块），有则中止并提示
- 输出：build/icon.ico（多尺寸）、build/icon.png（完整母版）、resources/icon.png（256 窗口图标）

依赖：pip install pillow numpy
用法：python scripts/make-icon.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "image.png"
OUT_ICO = ROOT / "build" / "icon.ico"
OUT_PNG_FULL = ROOT / "build" / "icon.png"
OUT_PNG_256 = ROOT / "resources" / "icon.png"


def content_components(content: np.ndarray):
    """返回 (y0, x0, y1, x1) 连通块列表（4-邻域）"""
    h, w = content.shape
    visited = np.zeros((h, w), bool)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if content[y0, x0] and not visited[y0, x0]:
                visited[y0, x0] = True
                dq = deque([(y0, x0)])
                pts = [(y0, x0)]
                while dq:
                    y, x = dq.popleft()
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and content[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            dq.append((ny, nx))
                            pts.append((ny, nx))
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                comps.append((min(ys), min(xs), max(ys), max(xs)))
    return comps


img = Image.open(SRC)
print(f"源图: {img.width}x{img.height} mode={img.mode}")
if img.mode not in ("RGB", "RGBA"):
    img = img.convert("RGBA")
arr = np.array(img.convert("RGB")).astype(np.int32)
h, w = arr.shape[:2]

diff = np.abs(arr - 255).max(axis=2)
alpha_arr = np.array(img)[..., 3].astype(np.int32) if img.mode == "RGBA" else np.full((h, w), 255)
opaque = alpha_arr > 128
content = (diff > 30) & opaque

if img.mode == "RGBA":
    corners = np.concatenate([alpha_arr[:60, :60], alpha_arr[:60, -60:], alpha_arr[-60:, :60], alpha_arr[-60:, -60:]]).ravel()
    if (corners > 128).mean() > 0.05:
        raise SystemExit("警告：图片角部有大量不透明像素，背景可能未透明化，请检查源图。")
    print(f"图片自带透明通道（透明像素 {100*(alpha_arr==0).mean():.0f}%），原样保留，不做背景处理")

# ---- 1) 检测右下角残留水印（与主图分离的独立内容块）----
comps = content_components(content)
main = max(comps, key=lambda c: (c[2] - c[0]) * (c[3] - c[1])) if comps else None
watermark = None
if main is not None:
    my0, mx0, my1, mx1 = main
    for c in comps:
        y0, x0, y1, x1 = c
        # 位于右下角（底部 8% 且右侧 40%），且与主图边界框无重叠
        in_corner = y0 > h * 0.92 and x0 > w * 0.6
        overlaps = not (x1 < mx0 or x0 > mx1 or y1 < my0 or y0 > my1)
        if in_corner and not overlaps:
            watermark = c
            break
if watermark:
    y0, x0, y1, x1 = watermark
    raise SystemExit(
        f"检测到疑似水印: x {x0}-{x1}, y {y0}-{y1}。"
        "请先在图片中去除水印，再重新运行本脚本。"
    )
print(f"主图 bbox: x {main[1]}-{main[3]}, y {main[0]}-{main[2]}（右下角无残留内容）")

# ---- 2) 输出（保留白底，不做透明化）----
OUT_ICO.parent.mkdir(parents=True, exist_ok=True)
OUT_PNG_256.parent.mkdir(parents=True, exist_ok=True)

img.save(OUT_PNG_FULL)
print(f"已保存完整母版: {OUT_PNG_FULL}")

img256 = img.resize((256, 256), Image.LANCZOS)
img256.save(OUT_PNG_256)
print(f"已保存 256 窗口图标: {OUT_PNG_256}")

# ICO 需要 RGBA 才能保留透明
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
img.convert("RGBA").save(OUT_ICO, sizes=[(s, s) for s in ico_sizes])
print(f"已保存多尺寸 ICO: {OUT_ICO} ({ico_sizes})")
