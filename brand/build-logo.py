#!/usr/bin/env python3
"""
ACERV logo generator.

Mark concept: the letter A assembled from five stacked, cut stone slabs.
Reads as "A" (the monogram) and as a heap/pile (acervus) at the same time.
The 2.5-unit gaps between slabs vanish below ~24px, so at favicon size the
mark degrades gracefully into a solid, legible A.

Everything is derived from a few named parameters, so the geometry can be
retuned without hand-editing polygons.
"""

# ----------------------------------------------------------------------------
# Geometry parameters (viewBox 120x120)
# ----------------------------------------------------------------------------
VB = 120
APEX_Y = 16.0        # top of the legs
BASE_Y = 104.0       # bottom of the legs
OUT_TOP_X = 46.0     # outer-left edge x at apex
OUT_BOT_X = 12.0     # outer-left edge x at base
IN_TOP_X = 60.0      # inner-left edge x at apex (centre line)
IN_BOT_X = 38.0      # inner-left edge x at base

GAP = 2.5            # visible mortar gap between stacked stones
SPLIT_Y = 51.0       # horizontal cut between upper and lower leg stones
CB_TOP_Y = 64.0      # crossbar stone top
CB_BOT_Y = 76.0      # crossbar stone bottom
CB_OVER_TOP = 4.0    # how far the crossbar penetrates the leg at its top
CB_OVER_BOT = 5.0    # ... and at its bottom


def lerp_x(y, y0, y1, x0, x1):
    return x0 + (x1 - x0) * ((y - y0) / (y1 - y0))


def x_out(y):
    """Outer-left edge at height y."""
    return lerp_x(y, APEX_Y, BASE_Y, OUT_TOP_X, OUT_BOT_X)


def x_in(y):
    """Inner-left (counter) edge at height y."""
    return lerp_x(y, APEX_Y, BASE_Y, IN_TOP_X, IN_BOT_X)


def cb_left(y):
    """Left edge of the crossbar stone at height y."""
    return lerp_x(y, CB_TOP_Y, CB_BOT_Y, x_in(CB_TOP_Y) - CB_OVER_TOP,
                  x_in(CB_BOT_Y) - CB_OVER_BOT)


def pts(seq, mirror=False):
    out = []
    for x, y in seq:
        out.append((VB - x if mirror else x, y))
    return " ".join(f"{px:.2f},{py:.2f}" for px, py in out)


def stones():
    """The five slabs, as left-side polygons. Mirror for the right side."""
    up_bot_y = SPLIT_Y - GAP                      # 48.5
    lo_top_y = SPLIT_Y + GAP                      # 53.5
    notch_top_y = CB_TOP_Y - GAP                  # 61.5
    notch_bot_y = CB_BOT_Y + GAP                  # 78.5
    cb_lt = cb_left(notch_top_y) - GAP            # notch x, upper
    cb_lb = cb_left(notch_bot_y) - GAP            # notch x, lower

    upper = [                                      # top-left leaning slab
        (x_out(APEX_Y), APEX_Y),
        (IN_TOP_X - GAP / 2, APEX_Y),
        (x_in(up_bot_y), up_bot_y),
        (x_out(up_bot_y), up_bot_y),
    ]
    lower = [                                      # bottom-left slab, notched
        (x_in(lo_top_y), lo_top_y),
        (x_in(notch_top_y), notch_top_y),
        (cb_lt, notch_top_y),
        (cb_lb, notch_bot_y),
        (x_in(notch_bot_y), notch_bot_y),
        (x_in(BASE_Y), BASE_Y),
        (x_out(BASE_Y), BASE_Y),
        (x_out(lo_top_y), lo_top_y),
    ]
    crossbar = [
        (cb_left(CB_TOP_Y), CB_TOP_Y),
        (VB - cb_left(CB_TOP_Y), CB_TOP_Y),
        (VB - cb_left(CB_BOT_Y), CB_BOT_Y),
        (cb_left(CB_BOT_Y), CB_BOT_Y),
    ]
    return upper, lower, crossbar


UPPER, LOWER, CROSSBAR = stones()

# ----------------------------------------------------------------------------
# Palettes
# ----------------------------------------------------------------------------
PALETTES = {
    # warm, archaeological
    "basalt": {
        "bg": "#14110E",
        "tones": ["#EFE7DA", "#DCD2C0", "#C2B6A1", "#A3957D"],
        "accent": "#C9762E",
    },
    # cool, instrumented
    "slate": {
        "bg": "#0B0E13",
        "tones": ["#E8EDF4", "#C6CFDD", "#9AA7BB", "#6F7D93"],
        "accent": "#3FB6F0",
    },
}

SANS = "Noto Sans, DejaVu Sans, FreeSans, sans-serif"


def mark(fills, accent_index=4, opacity=1.0):
    """Five <polygon>s. Order: LU, RU, LL, RL, CB (crossbar last = on top)."""
    ul, ll, cb = UPPER, LOWER, CROSSBAR
    shapes = [
        (pts(ul), fills[0]),
        (pts(ul, mirror=True), fills[1]),
        (pts(ll), fills[2]),
        (pts(ll, mirror=True), fills[3]),
        (pts(cb), fills[accent_index]),
    ]
    body = "\n    ".join(
        f'<polygon points="{p}" fill="{c}"' + (f' opacity="{opacity}"' if opacity < 1 else "") + "/>"
        for p, c in shapes
    )
    return f'<g class="acerv-mark">\n    {body}\n  </g>'


def svg(w, h, content, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}">{rect}{content}</svg>'
    )


def mark_svg(palette, size=120, mono=None):
    p = PALETTES[palette]
    if mono:
        fills = [mono, mono, mono, mono]
        inner = mark(fills, accent_index=0)
    else:
        inner = mark(p["tones"] + [p["accent"]], accent_index=4)
    return svg(size, size, inner, bg=None)


def wordmark(x, y, size, fill, tracking=0.30, text="ACERV"):
    return (
        f'<text x="{x}" y="{y}" fill="{fill}" font-family="{SANS}" '
        f'font-size="{size}" font-weight="700" letter-spacing="{size * tracking:.1f}">'
        f"{text}</text>"
    )


def lockup(palette, bg, w=760, h=240, scale=1.0):
    p = PALETTES[palette]
    fill = p["tones"][0]
    m = f'<g transform="translate(70,60) scale({1.0})">{mark(p["tones"] + [p["accent"]], 4)}</g>'
    return svg(w, h, m + wordmark(238, 155, 58, fill), bg=bg)


# ----------------------------------------------------------------------------
# Files
# ----------------------------------------------------------------------------
out = []

# 1. primary mark, warm
out.append(("acerv-mark.svg", mark_svg("basalt")))

# 2. cool variant
out.append(("acerv-mark-slate.svg", mark_svg("slate")))

# 3. monochrome marks (for currentColor / single-colour use)
out.append(("acerv-mark-mono-dark.svg", mark_svg("basalt", mono="#EFE7DA")))
out.append(("acerv-mark-mono-light.svg", mark_svg("basalt", mono="#14110E")))

# 4. lockups
out.append(("acerv-lockup-dark.svg", lockup("basalt", "#14110E")))
out.append(("acerv-lockup-light.svg", lockup("basalt", "#F5F1E8")))

for name, content in out:
    with open(f"brand/{name}", "w") as f:
        f.write(content)

# ----------------------------------------------------------------------------
# 5. Presentation sheet (rendered to PNG for review)
# ----------------------------------------------------------------------------
W, H = 1500, 1140
p = PALETTES["basalt"]
s = PALETTES["slate"]
panel = "#1B1713"
light = "#F5F1E8"
rule = "#2E2721"


def label(x, y, t, fill="#8B8272", size=19):
    return (
        f'<text x="{x}" y="{y}" fill="{fill}" font-family="{SANS}" font-size="{size}" '
        f'font-weight="600" letter-spacing="3.4">{t}</text>'
    )


# small-size row ------------------------------------------------------------
SMALL = [96, 56, 36, 24, 16]
ROW_TOP = 660
size_marks = []
for i, size in enumerate(SMALL):
    x = 716 + i * 112
    y = ROW_TOP + (96 - size) / 2
    size_marks.append(
        f'<g transform="translate({x},{y:.1f}) scale({size / 120:.5f})">'
        f'{mark(p["tones"] + [p["accent"]], 4)}</g>'
    )
    size_marks.append(label(x, 798, f"{size}PX", size=15))

parts = [
    f'<rect width="{W}" height="{H}" fill="#0F0D0B"/>',
    # --- hero mark -------------------------------------------------------
    f'<rect x="48" y="48" width="600" height="500" rx="18" fill="{panel}"/>',
    label(88, 100, "PRIMARY MARK / BASALT"),
    f'<g transform="translate(168,150) scale(3.0)">{mark(p["tones"] + [p["accent"]], 4)}</g>',
    label(88, 520, "A BUILT FROM FIVE STACKED STONES", size=17),
    # --- cool variant ----------------------------------------------------
    f'<rect x="48" y="572" width="600" height="440" rx="18" fill="#0B0E13"/>',
    label(88, 624, "SLATE + SIGNAL", fill="#6E7D93"),
    f'<g transform="translate(228,660) scale(2.5)">{mark(s["tones"] + [s["accent"]], 4)}</g>',
    label(88, 990, "COOL PALETTE FOR PRODUCT UI / DARK MODE", size=17, fill="#6E7D93"),
    # --- lockups ---------------------------------------------------------
    f'<rect x="676" y="48" width="776" height="500" rx="18" fill="{panel}"/>',
    label(716, 100, "LOCKUP / DARK"),
    f'<g transform="translate(716,150) scale(0.9)">{mark(p["tones"] + [p["accent"]], 4)}</g>',
    wordmark(860, 235, 76, p["tones"][0]),
    label(716, 330, "LOCKUP / LIGHT"),
    f'<rect x="716" y="352" width="696" height="150" rx="12" fill="{light}"/>',
    f'<g transform="translate(750,394) scale(0.55)">{mark(["#14110E"] * 4, 0)}</g>',
    wordmark(832, 445, 54, "#14110E"),
    # --- scale / mono / icon ---------------------------------------------
    f'<rect x="676" y="572" width="776" height="440" rx="18" fill="{panel}"/>',
    label(716, 624, "SMALL SIZES — GAPS CLOSE, A SURVIVES"),
    *size_marks,
    f'<line x1="716" y1="830" x2="1412" y2="830" stroke="{rule}" stroke-width="2"/>',
    label(716, 884, "MONOCHROME", size=17),
    f'<rect x="900" y="854" width="110" height="50" fill="#14110E"/>',
    f'<g transform="translate(930,854) scale(0.41667)">{mark(["#EFE7DA"] * 4, 0)}</g>',
    f'<rect x="1040" y="854" width="110" height="50" fill="{light}"/>',
    f'<g transform="translate(1070,854) scale(0.41667)">{mark(["#14110E"] * 4, 0)}</g>',
    label(1250, 800, "APP ICON", size=15),
    f'<rect x="1250" y="620" width="150" height="150" rx="34" fill="#0F0D0B" '
    f'stroke="{rule}" stroke-width="2"/>',
    f'<g transform="translate(1268,638) scale(0.95)">{mark(p["tones"] + [p["accent"]], 4)}</g>',
    # --- footer -----------------------------------------------------------
    label(48, 1078, "ACERV — FROM LATIN ACERVUS: HEAP, PILE, MASS. FIVE STONES MAKE THE A; "
                    "BELOW 24PX THE GAPS CLOSE.", size=17, fill="#6E6455"),
]

with open("brand/acerv-sheet.svg", "w") as f:
    f.write(svg(W, H, "".join(parts)))

print("wrote:", ", ".join(n for n, _ in out), "acerv-sheet.svg")
