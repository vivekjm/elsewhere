import re
# ---- Smooth illustrations: round every polygon vertex, soften rects and line ends (idempotent)
_POLY = re.compile(r'^[MLZ\d\s.,-]+$')
_NUM = re.compile(r'-?\d*\.?\d+')


def _round_poly(d, r=7.0):
    if not _POLY.match(d) or "Z" not in d:
        return d
    out = []
    for sub in [s for s in d.split("Z") if s.strip()]:
        nums = [float(n) for n in _NUM.findall(sub)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) < 3:
            return d
        n = len(pts)
        seg = []
        for i in range(n):
            px, py = pts[i - 1]
            cx, cy = pts[i]
            nx, ny = pts[(i + 1) % n]
            l1 = ((cx - px) ** 2 + (cy - py) ** 2) ** 0.5 or 1
            l2 = ((nx - cx) ** 2 + (ny - cy) ** 2) ** 0.5 or 1
            k = min(r, l1 * 0.45, l2 * 0.45)
            ax, ay = cx + (px - cx) * k / l1, cy + (py - cy) * k / l1
            bx, by = cx + (nx - cx) * k / l2, cy + (ny - cy) * k / l2
            seg.append((ax, ay, cx, cy, bx, by))
        f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
        a0 = seg[0]
        p = [f"M{f(a0[0])} {f(a0[1])}"]
        for ax, ay, cx, cy, bx, by in seg:
            p.append(f"L{f(ax)} {f(ay)} Q{f(cx)} {f(cy)} {f(bx)} {f(by)}")
        out.append(" ".join(p) + " Z")
    return " ".join(out)


def smooth(html):
    html = re.sub(r'(<path d=")([^"]+)(")', lambda m: m.group(1) + _round_poly(m.group(2)) + m.group(3), html)
    html = re.sub(r'<rect x="([^"]+)"(?![^>]*\brx=)', r'<rect rx="3" x="\1"', html)
    html = re.sub(r'preserveAspectRatio="xMidYMid slice"(?! stroke-linejoin)', 'preserveAspectRatio="xMidYMid slice" stroke-linejoin="round" stroke-linecap="round"', html)
    return html
