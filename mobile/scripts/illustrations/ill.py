"""Loom illustrations: flat, geometric, two or three tints, no outlines, no photos."""

TINT = {
    "peach": ("#FBD9C4", "#F4A77C", "#9A3F13"),
    "rose": ("#F9D4D8", "#E98C98", "#9A2F3B"),
    "mint": ("#D6F0E3", "#8FD3B0", "#1C6B45"),
    "lavender": ("#E3E6F5", "#A9B3E6", "#3B4A8F"),
    "grey": ("#E8E8E6", "#BDBDB9", "#555555"),
    "ember": ("#FF8F5A", "#FF6A2B", "#FFFFFF"),
}


def _svg(w, h, body, radius=0, bg="#FBD9C4", vb="0 0 200 200"):
    r = f' rx="{radius}"' if radius else ""
    return (
        f'<svg aria-hidden="true" width="{w}" height="{h}" viewBox="{vb}" preserveAspectRatio="xMidYMid slice" '
        f'style="display:block;flex:0 0 auto">'
        f'<rect width="100%" height="100%" fill="{bg}"{r}></rect>{body}</svg>'
    )



_CAP_N = [0]


def caps(mountain_d, apexes, depth=22, color="#FFFFFF", opacity=1):
    """Snow that follows the mountain's own (rounded) outline, ending in a soft wave."""
    out = []
    for x, y in apexes:
        _CAP_N[0] += 1
        cid = f"cap{_CAP_N[0]}"
        b = y + depth
        w = depth * 1.5
        clip = (f'M{x-w} {y-30} L{x+w} {y-30} L{x+w} {b} Q{x+w*0.66} {b+5} {x+w*0.4} {b-1} '
                f'Q{x+w*0.15} {b-6} {x-w*0.08} {b+2} Q{x-w*0.35} {b+8} {x-w*0.6} {b} Q{x-w*0.82} {b-4} {x-w} {b} Z')
        out.append(f'<clipPath id="{cid}"><path d="{clip}"></path></clipPath>'
                   f'<path d="{mountain_d}" fill="{color}" opacity="{opacity}" clip-path="url(#{cid})"></path>')
    return "".join(out)


def torii(w, h, radius=0):
    # Kyoto: ember torii in front of soft peach hills and a pale sun
    a, b, c = TINT["peach"]
    body = (
        '<circle cx="140" cy="64" r="30" fill="#FFF1E6"></circle>'
        '<path d="M-10 150 C40 110 80 118 120 142 C150 160 180 156 210 140 L210 210 L-10 210 Z" fill="#F4A77C"></path>'
        '<path d="M-10 172 C50 150 110 170 210 160 L210 210 L-10 210 Z" fill="#E98A5A"></path>'
        '<rect x="62" y="78" width="10" height="92" fill="#FF6A2B"></rect>'
        '<rect x="128" y="78" width="10" height="92" fill="#FF6A2B"></rect>'
        '<path d="M46 72 Q100 60 154 72 L154 82 Q100 72 46 82 Z" fill="#FF6A2B"></path>'
        '<rect x="56" y="96" width="88" height="8" fill="#FF6A2B"></rect>'
    )
    return _svg(w, h, body, radius, a)


def tram(w, h, radius=0):
    # Lisbon: a yellow tram on a rose hill of houses
    a, b, c = TINT["rose"]
    body = (
        '<path d="M-10 120 L40 90 L40 130 L90 100 L90 140 L140 108 L140 150 L210 120 L210 210 L-10 210 Z" fill="#E98C98" opacity="0.7"></path>'
        '<rect x="46" y="96" width="14" height="14" fill="#FFF4F5"></rect><rect x="98" y="108" width="14" height="14" fill="#FFF4F5"></rect>'
        '<rect x="150" y="124" width="12" height="12" fill="#FFF4F5"></rect>'
        '<rect x="40" y="120" width="120" height="60" rx="14" fill="#F2C94C"></rect>'
        '<rect x="52" y="132" width="22" height="20" rx="4" fill="#FFF9E6"></rect><rect x="82" y="132" width="22" height="20" rx="4" fill="#FFF9E6"></rect>'
        '<rect x="112" y="132" width="22" height="20" rx="4" fill="#FFF9E6"></rect>'
        '<rect x="40" y="166" width="120" height="8" fill="#9A2F3B"></rect>'
        '<circle cx="66" cy="184" r="8" fill="#9A2F3B"></circle><circle cx="134" cy="184" r="8" fill="#9A2F3B"></circle>'
        '<path d="M100 120 L100 100 L130 86" stroke="#9A2F3B" stroke-width="3" fill="none"></path>'
    )
    return _svg(w, h, body, radius, a)


def cove(w, h, radius=0):
    # Amalfi: mint sea with white arcs, a cliff and a sun
    a, b, c = TINT["mint"]
    body = (
        '<circle cx="52" cy="54" r="22" fill="#FFF8E8"></circle>'
        '<path d="M-10 118 Q100 96 210 118 L210 210 L-10 210 Z" fill="#8FD3B0"></path>'
        '<path d="M-10 150 Q60 136 120 150 T210 150" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.8"></path>'
        '<path d="M-10 176 Q60 162 120 176 T210 176" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.6"></path>'
        '<path d="M120 118 L150 70 L178 92 L210 76 L210 130 Z" fill="#1C6B45"></path>'
        '<path d="M140 118 L160 96 L180 118 Z" fill="#2E8C5E"></path>'
    )
    return _svg(w, h, body, radius, a)


def aurora(w, h, radius=0):
    # Iceland: lavender sky with ribbon lights above dark peaks
    a, b, c = TINT["lavender"]
    body = (
        '<path d="M-10 40 C40 10 80 80 130 40 S190 70 210 30 L210 90 C160 120 120 60 70 100 S10 80 -10 100 Z" fill="#C9D0F2" opacity="0.9"></path>'
        '<path d="M-10 80 C50 60 90 120 140 80 S200 110 210 90 L210 130 C150 150 110 100 60 140 S0 120 -10 130 Z" fill="#8FD3B0" opacity="0.55"></path>'
        '<path d="M-10 170 L50 112 L90 150 L130 104 L170 146 L210 120 L210 210 L-10 210 Z" fill="#3B4A8F"></path>'
        + caps("M-10 170 L50 112 L90 150 L130 104 L170 146 L210 120 L210 210 L-10 210 Z", [(50, 112), (130, 104)], 16, "#FFFFFF", 0.85) +
        '<circle cx="36" cy="30" r="3" fill="#FFFFFF"></circle><circle cx="160" cy="24" r="2" fill="#FFFFFF"></circle><circle cx="110" cy="18" r="2" fill="#FFFFFF"></circle>'
    )
    return _svg(w, h, body, radius, a)


def peaks(w, h, radius=0):
    # Trek: layered grey-blue peaks with snow caps
    a, b, c = TINT["lavender"]
    body = (
        '<circle cx="150" cy="56" r="26" fill="#FFF4EA"></circle>'
        '<path d="M-10 190 L60 90 L110 150 L150 100 L210 180 L210 210 L-10 210 Z" fill="#A9B3E6"></path>'
        + caps("M-10 190 L60 90 L110 150 L150 100 L210 180 L210 210 L-10 210 Z", [(60, 90), (150, 100)], 22) +
        '<path d="M-10 210 L40 150 L90 190 L130 160 L210 210 Z" fill="#3B4A8F"></path>'
    )
    return _svg(w, h, body, radius, a)


def road(w, h, radius=0):
    # Road trip: a peach desert road vanishing into hills
    a, b, c = TINT["peach"]
    body = (
        '<circle cx="60" cy="60" r="28" fill="#FF6A2B" opacity="0.9"></circle>'
        '<path d="M-10 130 Q60 100 120 128 T210 124 L210 210 L-10 210 Z" fill="#F4A77C"></path>'
        '<path d="M70 210 L96 124 L104 124 L130 210 Z" fill="#9A3F13"></path>'
        '<path d="M100 134 L100 150 M100 160 L100 176 M100 186 L100 202" stroke="#FBD9C4" stroke-width="2"></path>'
    )
    return _svg(w, h, body, radius, a)


def dunes(w, h, radius=0):
    a, b, c = TINT["grey"]
    body = (
        '<circle cx="140" cy="60" r="24" fill="#FF6A2B"></circle>'
        '<path d="M-10 150 Q50 110 110 150 T210 140 L210 210 L-10 210 Z" fill="#BDBDB9"></path>'
        '<path d="M-10 180 Q70 150 140 180 T210 176 L210 210 L-10 210 Z" fill="#8E8E8A"></path>'
    )
    return _svg(w, h, body, radius, a)


def tide(w, h, radius=0):
    a, b, c = TINT["mint"]
    body = (
        '<circle cx="48" cy="52" r="20" fill="#FFF8E8"></circle>'
        '<path d="M-10 110 Q50 90 100 110 T210 110 L210 210 L-10 210 Z" fill="#8FD3B0"></path>'
        '<path d="M-10 140 Q50 120 100 140 T210 140 L210 210 L-10 210 Z" fill="#1C6B45" opacity="0.85"></path>'
        '<path d="M60 92 L84 72 L90 92 Z" fill="#FFFFFF"></path><rect x="84" y="92" width="4" height="18" fill="#FFFFFF"></rect>'
    )
    return _svg(w, h, body, radius, a)


def threads(w, h, radius=0):
    """Welcome hero: loom threads over the ember gradient."""
    body = (
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB07A"></stop><stop offset="0.45" stop-color="#FF6A2B"></stop><stop offset="1" stop-color="#E8EAF0"></stop></linearGradient></defs>'
        '<rect width="100%" height="100%" fill="url(#g)"></rect>'
        '<circle cx="30" cy="30" r="90" fill="#FFD1B2" opacity="0.55"></circle>'
        '<circle cx="190" cy="120" r="80" fill="#FF3F0A" opacity="0.35"></circle>'
        '<g fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.85">'
        '<path d="M-10 70 C40 48 80 92 130 70 S190 48 220 70"></path>'
        '<path d="M-10 92 C40 70 80 114 130 92 S190 70 220 92"></path>'
        '<path d="M-10 114 C40 92 80 136 130 114 S190 92 220 114"></path>'
        '</g>'
        '<g fill="#FFFFFF" opacity="0.9"><circle cx="70" cy="70" r="4"></circle><circle cx="130" cy="114" r="4"></circle><circle cx="178" cy="78" r="4"></circle></g>'
    )
    return _svg(w, h, body, radius, "#FF6A2B")


def threads_bg(w, h, radius=0):
    """The Welcome hero without its woven lines; the app draws the lines to fit the space it has."""
    body = (
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB07A"></stop><stop offset="0.45" stop-color="#FF6A2B"></stop><stop offset="1" stop-color="#E8EAF0"></stop></linearGradient></defs>'
        '<rect width="100%" height="100%" fill="url(#g)"></rect>'
        '<circle cx="30" cy="30" r="90" fill="#FFD1B2" opacity="0.55"></circle>'
        '<circle cx="190" cy="120" r="80" fill="#FF3F0A" opacity="0.35"></circle>'
    )
    return _svg(w, h, body, radius, "#FF6A2B")


def compass(w, h, radius=0):
    a, b, c = TINT["lavender"]
    body = (
        '<circle cx="100" cy="100" r="62" fill="#FFFFFF"></circle>'
        '<circle cx="100" cy="100" r="50" fill="#E3E6F5"></circle>'
        '<path d="M100 54 L114 100 L100 146 L86 100 Z" fill="#FF6A2B"></path>'
        '<path d="M54 100 L100 86 L146 100 L100 114 Z" fill="#3B4A8F"></path>'
        '<circle cx="100" cy="100" r="7" fill="#FFFFFF"></circle>'
    )
    return _svg(w, h, body, radius, a)


def suitcase(w, h, radius=0):
    a, b, c = TINT["peach"]
    body = (
        '<rect x="46" y="76" width="108" height="84" rx="14" fill="#FF6A2B"></rect>'
        '<rect x="82" y="58" width="36" height="22" rx="6" fill="#9A3F13"></rect>'
        '<rect x="46" y="104" width="108" height="10" fill="#9A3F13" opacity="0.5"></rect>'
        '<rect x="92" y="98" width="16" height="22" rx="4" fill="#FFF1E6"></rect>'
    )
    return _svg(w, h, body, radius, a)


def passport(w, h, radius=0):
    a, b, c = TINT["mint"]
    body = (
        '<rect x="56" y="48" width="88" height="112" rx="12" fill="#1C6B45"></rect>'
        '<circle cx="100" cy="94" r="22" fill="none" stroke="#8FD3B0" stroke-width="5"></circle>'
        '<rect x="74" y="128" width="52" height="6" rx="3" fill="#8FD3B0"></rect>'
    )
    return _svg(w, h, body, radius, a)


def receipt(w, h, radius=0):
    a, b, c = TINT["rose"]
    body = (
        '<path d="M60 44 L140 44 L140 160 L128 150 L116 160 L104 150 L92 160 L80 150 L68 160 L60 150 Z" fill="#FFFFFF"></path>'
        '<rect x="74" y="64" width="52" height="6" rx="3" fill="#E98C98"></rect><rect x="74" y="80" width="40" height="6" rx="3" fill="#F9D4D8"></rect>'
        '<rect x="74" y="96" width="46" height="6" rx="3" fill="#F9D4D8"></rect><rect x="74" y="120" width="52" height="8" rx="4" fill="#9A2F3B"></rect>'
    )
    return _svg(w, h, body, radius, a)


def summit(w, h, radius=0):
    a, b, c = TINT["grey"]
    body = (
        '<path d="M-10 200 L70 84 L110 140 L150 104 L210 196 L210 210 L-10 210 Z" fill="#555555"></path>'
        + caps("M-10 200 L70 84 L110 140 L150 104 L210 196 L210 210 L-10 210 Z", [(70, 84), (150, 104)], 24) +
        '<rect x="68.5" y="52" width="3" height="36" rx="1.5" fill="#FF6A2B"></rect><path d="M71 52 L94 60 L71 68 Z" fill="#FF6A2B"></path>'
    )
    return _svg(w, h, body, radius, a)


def tent(w, h, radius=0):
    a, b, c = TINT["mint"]
    body = (
        '<path d="M-10 170 Q100 140 210 170 L210 210 L-10 210 Z" fill="#8FD3B0"></path>'
        '<path d="M100 60 L160 170 L40 170 Z" fill="#FF6A2B"></path>'
        '<path d="M100 60 L124 170 L76 170 Z" fill="#9A3F13" opacity="0.5"></path>'
        '<circle cx="40" cy="60" r="18" fill="#FFF8E8"></circle>'
    )
    return _svg(w, h, body, radius, a)


def forest(w, h, radius=0):
    a, b, c = TINT["mint"]
    body = (
        '<circle cx="150" cy="52" r="22" fill="#FFF8E8"></circle>'
        '<path d="M-10 160 Q100 130 210 160 L210 210 L-10 210 Z" fill="#8FD3B0"></path>'
        '<path d="M40 70 L70 130 L10 130 Z" fill="#2E8C5E"></path><path d="M40 100 L76 160 L4 160 Z" fill="#1C6B45"></path><rect x="36" y="160" width="8" height="16" fill="#9A3F13"></rect>'
        '<path d="M110 50 L144 118 L76 118 Z" fill="#1C6B45"></path><path d="M110 84 L152 152 L68 152 Z" fill="#2E8C5E"></path><rect x="106" y="152" width="8" height="18" fill="#9A3F13"></rect>'
        '<path d="M170 90 L196 140 L144 140 Z" fill="#2E8C5E"></path><rect x="167" y="140" width="6" height="14" fill="#9A3F13"></rect>'
    )
    return _svg(w, h, body, radius, a)


def lake(w, h, radius=0):
    a, b, c = TINT["lavender"]
    body = (
        '<circle cx="60" cy="56" r="22" fill="#FFF4EA"></circle>'
        '<path d="M-10 130 L50 70 L90 110 L140 60 L210 126 L210 210 L-10 210 Z" fill="#A9B3E6"></path>'
        '<path d="M-10 128 L210 128 L210 210 L-10 210 Z" fill="#8FD3B0" opacity="0.85"></path>'
        '<path d="M20 150 L80 150 M110 166 L180 166 M40 182 L120 182" stroke="#FFFFFF" stroke-width="4" opacity="0.8"></path>'
        '<path d="M120 140 L160 140 L150 152 L128 152 Z" fill="#FF6A2B"></path>'
    )
    return _svg(w, h, body, radius, a)


def island(w, h, radius=0):
    a, b, c = TINT["peach"]
    body = (
        '<circle cx="150" cy="50" r="22" fill="#FFF1E6"></circle>'
        '<path d="M-10 140 L210 140 L210 210 L-10 210 Z" fill="#8FD3B0"></path>'
        '<path d="M40 144 Q100 110 160 144 Z" fill="#F4A77C"></path>'
        '<path d="M100 130 Q104 100 96 72" stroke="#9A3F13" stroke-width="6" fill="none"></path>'
        '<path d="M96 72 Q70 60 54 78 Q78 72 96 76 Q100 50 124 48 Q108 64 98 76 Q124 70 138 86 Q114 78 96 76 Z" fill="#1C6B45"></path>'
        '<path d="M10 170 Q60 158 110 170 T210 170" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.7"></path>'
    )
    return _svg(w, h, body, radius, a)


def food(w, h, radius=0):
    a, b, c = TINT["rose"]
    body = (
        '<path d="M40 104 L160 104 Q156 156 100 160 Q44 156 40 104 Z" fill="#FFFFFF"></path>'
        '<path d="M52 104 Q100 84 148 104 Z" fill="#E98C98"></path>'
        '<circle cx="80" cy="96" r="8" fill="#FF6A2B"></circle><circle cx="112" cy="94" r="7" fill="#8FD3B0"></circle>'
        '<rect x="132" y="40" width="5" height="62" rx="2.5" fill="#9A2F3B"></rect><rect x="144" y="40" width="5" height="62" rx="2.5" fill="#9A2F3B"></rect>'
    )
    return _svg(w, h, body, radius, a)


def stay(w, h, radius=0):
    a, b, c = TINT["lavender"]
    body = (
        '<rect x="34" y="110" width="132" height="36" rx="10" fill="#3B4A8F"></rect>'
        '<rect x="34" y="86" width="20" height="70" rx="8" fill="#3B4A8F"></rect>'
        '<rect x="60" y="96" width="40" height="18" rx="8" fill="#FFFFFF"></rect>'
        '<rect x="96" y="100" width="70" height="14" rx="6" fill="#A9B3E6"></rect>'
        '<circle cx="150" cy="56" r="16" fill="#FFF4EA"></circle><circle cx="158" cy="50" r="14" fill="#E3E6F5"></circle>'
    )
    return _svg(w, h, body, radius, a)


def ticket(w, h, radius=0):
    a, b, c = TINT["lavender"]
    body = (
        '<path d="M40 70 L160 70 L160 92 Q148 100 160 108 L160 130 L40 130 L40 108 Q52 100 40 92 Z" fill="#FFFFFF"></path>'
        '<path d="M120 76 L120 124" stroke="#A9B3E6" stroke-width="3" stroke-dasharray="5 5"></path>'
        '<rect x="56" y="86" width="48" height="8" rx="4" fill="#3B4A8F"></rect><rect x="56" y="102" width="32" height="6" rx="3" fill="#A9B3E6"></rect>'
        '<circle cx="140" cy="100" r="9" fill="#FF6A2B"></circle>'
    )
    return _svg(w, h, body, radius, a)


def train(w, h, radius=0):
    a, b, c = TINT["mint"]
    body = (
        '<rect x="44" y="60" width="112" height="90" rx="22" fill="#1C6B45"></rect>'
        '<rect x="58" y="76" width="84" height="34" rx="8" fill="#D6F0E3"></rect>'
        '<circle cx="74" cy="128" r="7" fill="#FFF8E8"></circle><circle cx="126" cy="128" r="7" fill="#FFF8E8"></circle>'
        '<path d="M60 172 L140 172 M70 150 L56 176 M130 150 L144 176" stroke="#1C6B45" stroke-width="5"></path>'
        '<rect x="92" y="48" width="16" height="12" rx="4" fill="#FF6A2B"></rect>'
    )
    return _svg(w, h, body, radius, a)


BY_NAME = {
    "torii": torii, "tram": tram, "cove": cove, "aurora": aurora, "peaks": peaks, "road": road,
    "dunes": dunes, "tide": tide, "threads": threads, "threadsBg": threads_bg, "compass": compass, "suitcase": suitcase,
    "passport": passport, "receipt": receipt, "summit": summit, "tent": tent,
    "forest": forest, "lake": lake, "island": island, "food": food, "stay": stay, "ticket": ticket, "train": train,
}


def ill(name, w, h, radius=0):
    return BY_NAME[name](w, h, radius)
