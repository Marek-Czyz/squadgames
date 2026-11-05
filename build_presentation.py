"""Builds 'The Squad Games' rules deck on top of the EASEE GENERAL PRESENTATION template."""
import os
import sys

from PIL import ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "EASEE GENERAL PRESENTATION.pptx")
OUT = os.path.join(HERE, "The_Squad_Games_Rules.pptx")
FONT_DIR = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Windows", "Fonts")

# Easee theme colours
DARK = RGBColor(0x1A, 0x1A, 0x1A)
TEXT = RGBColor(0x33, 0x33, 0x33)
WHITE = RGBColor(0xFA, 0xFA, 0xFA)
BEIGE = RGBColor(0xE8, 0xE5, 0xDE)
CORAL = RGBColor(0xFF, 0x69, 0x5C)
LIGHTBLUE = RGBColor(0xC8, 0xE8, 0xFA)
BLUE = RGBColor(0x00, 0x5B, 0xFF)
PINK = RGBColor(0xFA, 0xD5, 0xCE)
SAND = RGBColor(0xDC, 0xCE, 0xC1)
YELLOW = RGBColor(0xFF, 0xFA, 0x6F)

HEAD = "Season Mix"
BODY = "Buenos Aires Book"
SEMI = "Buenos Aires SemiBold"
BLACK = "Buenos Aires Black"

# ---------------------------------------------------------------- helpers


def shape(slide, kind, x, y, w, h, fill=None, line=None, lw=None, rot=0):
    s = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw or 2)
    s.shadow.inherit = False
    s.rotation = rot
    return s


def text(slide, x, y, w, h, paras, size=32, font=BODY, color=TEXT,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=None, target=None):
    """paras: list of paragraphs; each is a str or a list of (text, overrides) runs."""
    if target is None:
        box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    else:
        box = target
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.space_after = Pt(spacing)
        runs = [(para, {})] if isinstance(para, str) else para
        for t, o in runs:
            r = p.add_run()
            r.text = t
            r.font.name = o.get("font", font)
            r.font.size = Pt(o.get("size", size))
            r.font.color.rgb = o.get("color", color)
    return box


def label(s, paras, size, font=SEMI, color=DARK, align=PP_ALIGN.CENTER):
    """Write centred text into an existing shape."""
    tf = s.text_frame
    text(None, 0, 0, 0, 0, paras, size=size, font=font, color=color,
         align=align, anchor=MSO_ANCHOR.MIDDLE, target=s)
    tf.margin_left = tf.margin_right = Inches(0.1)


def background(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def symbols(slide, x, y, size, color, lw=3):
    """The ○ △ □ trio."""
    shape(slide, MSO_SHAPE.OVAL, x, y, size, size, line=color, lw=lw)
    shape(slide, MSO_SHAPE.ISOSCELES_TRIANGLE, x + size * 1.5, y, size * 1.1, size, line=color, lw=lw)
    shape(slide, MSO_SHAPE.RECTANGLE, x + size * 3.1, y, size, size, line=color, lw=lw)


def coin(slide, x, y, d, txt, fill=YELLOW, size=28):
    c = shape(slide, MSO_SHAPE.OVAL, x, y, d, d, fill=fill, line=DARK, lw=2.5)
    label(c, [txt], size, font=BLACK)
    return c


def tag(slide, x, y, w, h, txt, fill, color=DARK, size=24):
    t = shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill=fill)
    t.adjustments[0] = 0.5
    label(t, [txt], size, color=color)
    return t


def stick_figure(slide, x, y, h, color=DARK):
    """Simple person: head circle + rounded body. (x, y) = top-left, h = height."""
    hd = h * 0.32
    shape(slide, MSO_SHAPE.OVAL, x + (h * 0.45 - hd) / 2, y, hd, hd, fill=color)
    b = shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y + hd * 1.1, h * 0.45, h - hd * 1.1, fill=color)
    b.adjustments[0] = 0.5


# ---------------------------------------------------------------- deck scaffolding

prs = Presentation(TEMPLATE)
SW, SH = Emu(prs.slide_width).inches, Emu(prs.slide_height).inches  # 26.67 x 15 in

# drop all example slides (unreferenced parts are not written on save)
sldIdLst = prs.slides._sldIdLst
for sldId in list(sldIdLst):
    prs.part.drop_rel(sldId.rId)
    sldIdLst.remove(sldId)

layout = {l.name: l for l in prs.slide_layouts}


def new_slide(layout_name):
    s = prs.slides.add_slide(layout[layout_name])
    for ph in list(s.placeholders):
        ph._element.getparent().remove(ph._element)
    return s


def footer(slide, n, color=TEXT):
    text(slide, 0.7, SH - 0.85, 10, 0.4, [[("The Squad Games", {"font": SEMI}),
                                           (f"   |   Post {n} of 5", {})]], size=16, color=color)
    symbols(slide, 4.75, SH - 0.82, 0.26, CORAL, lw=1.5)


def post_slide(n, title, bg, rules, earn, accent=CORAL):
    s = new_slide("EMPTY White")
    background(s, bg)
    # post number badge + title
    badge = shape(s, MSO_SHAPE.OVAL, 0.7, 0.75, 1.6, 1.6, fill=accent)
    label(badge, [str(n)], 64, font=HEAD, color=WHITE)
    text(s, 0.7, 2.65, 14.6, 0.5, [f"POST {n}"], size=22, font=SEMI, color=accent)
    text(s, 0.7, 3.15, 14.6, 1.9, [title], size=80, font=HEAD, color=DARK)
    # rules
    paras = []
    for r in rules:
        paras.append([("—  ", {"font": SEMI, "color": accent})] + (
            [(r, {})] if isinstance(r, str) else r))
    box = text(s, 0.7, 5.35, 14.4, 5.6, paras, size=30, spacing=18)
    for p in box.text_frame.paragraphs:
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(Inches(0.55)))
        pPr.set("indent", str(-Inches(0.55)))
        p.runs[0].text = "—	"
    # how to gain FC banner
    ban = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.7, 11.15, 14.4, 2.45, fill=DARK)
    ban.adjustments[0] = 0.12
    text(s, 1.3, 11.5, 13.2, 0.5, ["HOW TO GAIN FC"], size=20, font=SEMI, color=YELLOW)
    text(s, 1.3, 12.05, 13.2, 1.4, [earn], size=30, font=BODY, color=WHITE)
    footer(s, n)
    return s


def panel(slide, color=WHITE):
    p = shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 16.0, 0.75, 9.95, 12.85, fill=color)
    p.adjustments[0] = 0.05
    return 16.0, 0.75, 9.95, 12.85


# ---------------------------------------------------------------- slide 1: title

s = new_slide("Title 1")

# Squid Game parody wordmark: real text with the Q/A glyphs hidden and replaced by ○ and △
WORD = "SQUAD GAMES"
FS = 200  # pt
BASELINE_FUDGE = 1.0  # baseline = top + ascent * fudge (tuned against a PowerPoint render)
mfont = ImageFont.truetype(os.path.join(FONT_DIR, "BuenosAires-Black.otf"), 1000)
k = FS / 1000 / 72  # font units at 1000px -> inches at FS pt
asc, _ = mfont.getmetrics()
hb = mfont.getbbox("H")
cap = (hb[3] - hb[1]) * k
lx, ly = 0.7, 2.2
wm = text(s, lx, ly, 25, 3.4, [[(ch, {}) for ch in WORD]], size=FS, font=BLACK, color=DARK)
baseline = ly + asc * k * BASELINE_FUDGE
for i, r in enumerate(wm.text_frame.paragraphs[0].runs):
    ch = WORD[i]
    if ch not in "QA":
        continue
    r.font.fill.background()  # invisible glyph keeps the spacing
    x0 = lx + mfont.getlength(WORD[:i]) * k
    adv = mfont.getlength(ch) * k
    if ch == "Q":
        d = cap
        shape(s, MSO_SHAPE.OVAL, x0 + (adv - d) / 2, baseline - d, d, d, line=CORAL, lw=26)
    else:
        w = adv * 0.92
        shape(s, MSO_SHAPE.ISOSCELES_TRIANGLE, x0 + (adv - w) / 2, baseline - cap, w, cap,
              line=CORAL, lw=26)
# "THE" + the square, completing the circle / triangle / square trio
text(s, lx + 0.05, ly - 0.95, 6, 0.9, ["THE"], size=54, font=BLACK, color=DARK)
symbols(s, lx + 2.45, ly - 0.83, 0.55, CORAL, lw=6)

text(s, 0.7, 6.25, 16, 2.4, [
    "Five posts that test your ability to think, resolve, plan and acquire information.",
], size=40, font=HEAD, color=DARK)
text(s, 0.7, 8.25, 15, 1.6, [
    [("Along the way you can gain or lose money — but don’t worry, it’s not real. "
      "We play with an imaginary currency: ", {}), ("FC (flex-coins)", {"font": SEMI}), (".", {})],
], size=28, color=DARK)

# starting credit coin
c = shape(s, MSO_SHAPE.OVAL, 18.6, 6.0, 3.6, 3.6, fill=YELLOW, line=DARK, lw=2.5)
text(None, 0, 0, 0, 0, [[("100", {"size": 88, "font": BLACK})], [("FC", {"size": 36, "font": SEMI})]],
     color=DARK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, target=c)
text(s, 17.6, 9.75, 5.6, 0.6, ["Starting credit for every team"], size=22, font=SEMI,
     color=DARK, align=PP_ALIGN.CENTER)

# the five posts
posts = ["What is this?\nWhat is what?", "The art of\nengineering", "Knowledge\nis king",
         "Co-operation", "Tic Tac Run"]
for i, name in enumerate(posts):
    x = 0.7 + i * 3.3
    chip = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, 10.7, 3.05, 1.65, fill=WHITE)
    chip.adjustments[0] = 0.15
    text(s, x + 0.25, 10.85, 2.6, 0.4, [f"POST {i + 1}"], size=16, font=SEMI, color=CORAL)
    text(s, x + 0.25, 11.25, 2.7, 1.0, name.split("\n"), size=20, font=SEMI, color=DARK)

# ---------------------------------------------------------------- slide 2: What is this?

s = post_slide(1, "What is this? What is what?", BEIGE, [
    "An item is hidden under a cover.",
    "Lift the cover for 15 seconds: the item can be touched, lifted and studied.",
    [("Google and even AI are allowed — but ", {}), ("taking pictures is NOT", {"font": SEMI}), (".", {})],
    "After 15 seconds the cover goes back on.",
    [("Buy another 15 seconds for ", {}), ("5 FC", {"font": SEMI}),
     (", or a hint for ", {}), ("10 FC", {"font": SEMI}), (".", {})],
], [("Guess the item correctly:  ", {}), ("+50 FC", {"font": BLACK, "color": YELLOW})])
px, py, pw, ph = panel(s, WHITE)
# table + cup + mystery
shape(s, MSO_SHAPE.RECTANGLE, px + 1.0, py + 7.3, pw - 2.0, 0.25, fill=SAND)
cup = shape(s, MSO_SHAPE.TRAPEZOID, px + 2.6, py + 3.6, 4.75, 3.7, fill=CORAL)
label(cup, ["?"], 160, font=HEAD, color=WHITE)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, px + 4.35, py + 3.1, 1.25, 0.55, fill=CORAL).adjustments[0] = 0.5
# stopwatch
sw = shape(s, MSO_SHAPE.OVAL, px + 0.8, py + 0.8, 2.3, 2.3, fill=LIGHTBLUE, line=BLUE, lw=6)
label(sw, [[("15", {"font": BLACK, "size": 54})], [("sec", {"font": SEMI, "size": 22})]], 30, color=BLUE)
shape(s, MSO_SHAPE.RECTANGLE, px + 1.75, py + 0.45, 0.4, 0.35, fill=BLUE)
# no-photo sign over a camera
cam = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, px + pw - 2.55, py + 1.5, 1.3, 0.85, fill=DARK)
cam.adjustments[0] = 0.2
shape(s, MSO_SHAPE.OVAL, px + pw - 2.13, py + 1.68, 0.48, 0.48, fill=WHITE)
shape(s, MSO_SHAPE.NO_SYMBOL, px + pw - 3.0, py + 0.8, 2.2, 2.2, fill=CORAL)
# price tags
tag(s, px + 1.0, py + 8.4, pw - 2.0, 1.0, "+15 seconds  =  5 FC", YELLOW, size=28)
tag(s, px + 1.0, py + 9.65, pw - 2.0, 1.0, "Hint  =  10 FC", PINK, size=28)
tag(s, px + 1.0, py + 10.9, pw - 2.0, 1.0, "Correct guess  =  +50 FC", DARK, color=YELLOW, size=28)

# ---------------------------------------------------------------- slide 3: The art of engineering

s = post_slide(2, "The art of engineering", LIGHTBLUE, [
    "Build a bridge using only the provided set of materials.",
    "The bridge must carry the whole team across — one member at a time.",
    "Plan it, build it, trust it… then walk it!",
], [("Each member who crosses without the bridge collapsing:  ", {}),
    ("+10 FC", {"font": BLACK, "color": YELLOW})], accent=BLUE)
px, py, pw, ph = panel(s, WHITE)
# cliffs
shape(s, MSO_SHAPE.RECTANGLE, px, py + 6.5, 2.4, ph - 7.5, fill=SAND)
shape(s, MSO_SHAPE.RECTANGLE, px + pw - 2.4, py + 6.5, 2.4, ph - 7.5, fill=SAND)
# deck + triangle truss underneath
span = pw - 3.8
shape(s, MSO_SHAPE.RECTANGLE, px + 1.9, py + 6.3, span, 0.35, fill=DARK)
tw = span / 5
for i in range(5):
    shape(s, MSO_SHAPE.ISOSCELES_TRIANGLE, px + 1.9 + i * tw, py + 6.65, tw, 1.5,
          line=BLUE, lw=7, rot=180)
for i in range(4):
    shape(s, MSO_SHAPE.ISOSCELES_TRIANGLE, px + 1.9 + tw / 2 + i * tw, py + 6.65, tw, 1.5,
          line=BLUE, lw=7)
# team crossing
for xx, col in [(px + 0.5, DARK), (px + 1.3, DARK), (px + 4.2, CORAL), (px + pw - 1.6, DARK)]:
    stick_figure(s, xx, py + 4.7, 1.6, col)
tag(s, px + 3.75, py + 3.7, 1.5, 0.75, "+10", YELLOW, size=26)
tag(s, px + pw - 2.15, py + 3.7, 1.5, 0.75, "+10", YELLOW, size=26)
text(s, px + 0.8, py + 0.9, pw - 1.6, 2.4, [[("Whole team across  =  ", {}),
                                            ("+10 FC × team size", {"font": SEMI})]],
     size=30, font=BODY, color=DARK, align=PP_ALIGN.CENTER)
text(s, px + 0.8, py + 11.6, pw - 1.6, 0.8, ["One by one. No collapse."], size=28, font=HEAD,
     color=DARK, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- slide 4: Knowledge is king

s = post_slide(3, "Knowledge is king", PINK, [
    "A quiz with 6 tricky multiple-choice questions and 6 tricky riddles.",
    "Questions stay hidden until a team buys one. Once purchased — no way back.",
    [("Right answer: you get ", {}), ("double", {"font": SEMI}), (" the price back.", {})],
    "Wrong answer, or no answer before the end of the game: the money is gone. "
    "Want another chance? Buy the question again.",
    [("No time limit — but ", {}), ("no Google and no AI", {"font": SEMI}), (".", {})],
], [("Questions are priced from ", {}), ("3 FC to 60 FC", {"font": BLACK, "color": YELLOW}),
    (" according to difficulty. You may guess the rest. (pun intended)", {})])
px, py, pw, ph = panel(s, WHITE)
text(s, px + 0.7, py + 0.6, pw - 1.4, 0.6, ["6 QUESTIONS"], size=22, font=SEMI, color=CORAL)
text(s, px + 0.7, py + 4.55, pw - 1.4, 0.6, ["6 RIDDLES"], size=22, font=SEMI, color=BLUE)
cw, chh, gap = 2.6, 1.35, 0.33
for row in range(4):
    for col in range(3):
        yy = py + 1.25 + row * (chh + gap) + (0.6 if row >= 2 else 0)
        xx = px + 0.7 + col * (cw + gap)
        card = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, xx, yy, cw, chh,
                     fill=CORAL if row < 2 else BLUE)
        card.adjustments[0] = 0.12
        label(card, ["?"], 54, font=HEAD, color=WHITE)
tag(s, px + 0.7, py + 9.05, pw - 1.4, 0.95, "Correct  →  2× your FC back", YELLOW, size=26)
tag(s, px + 0.7, py + 10.2, pw - 1.4, 0.95, "Wrong  →  FC lost", DARK, color=WHITE, size=26)
tag(s, px + 0.7, py + 11.35, pw - 1.4, 0.95, "No Google  ·  No AI  ·  No time limit", BEIGE, size=26)

# ---------------------------------------------------------------- slide 5: Co-operation

s = post_slide(4, "Co-operation", BEIGE, [
    "Classic Engineering Alias: explain the word — without saying it.",
    "Teams compete against each other, and you choose which team to challenge.",
    "Each team gets a randomly selected set of 10 cards.",
], [("First team to solve a card:  ", {}), ("+5 FC", {"font": BLACK, "color": YELLOW}),
    (" for each solved card.", {})])
px, py, pw, ph = panel(s, WHITE)
for i, (rot, col) in enumerate([(-18, LIGHTBLUE), (-9, PINK), (18, SAND), (9, CORAL), (0, YELLOW)]):
    off = [-2, -1, 2, 1, 0][i]
    c = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, px + 2.9 + off * 0.55, py + 1.4 + abs(off) * 0.25,
              4.1, 5.6, fill=col, line=DARK, lw=2.5, rot=rot)
    c.adjustments[0] = 0.08
label(c, [[("ALIAS", {"font": BLACK, "size": 44})], [("Engineering edition", {"size": 22})]], 30,
      color=DARK)
tag(s, px + 2.3, py + 7.8, pw - 4.6, 1.1, "10 cards per team", DARK, color=WHITE, size=28)
# team vs team
v = shape(s, MSO_SHAPE.OVAL, px + pw / 2 - 0.8, py + 9.65, 1.6, 1.6, fill=CORAL)
label(v, ["VS"], 36, font=BLACK, color=WHITE)
for t_, base in enumerate([px + 0.9, px + pw - 3.25]):
    for j in range(3):
        stick_figure(s, base + j * 0.8, py + 9.4, 1.9, DARK if t_ == 0 else BLUE)
text(s, px + 0.8, py + 11.6, pw - 1.6, 0.8, ["First to solve takes the FC"], size=28, font=HEAD,
     color=DARK, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- slide 6: Tic Tac Run

s = post_slide(5, "Tic Tac Run", LIGHTBLUE, [
    "Team vs team relay. A tic-tac-toe grid waits at the far end of the track — out of sight from the start.",
    "The first 3 runners each carry an O or an X and place it wherever they want.",
    "After that, the next runners may move the pieces already placed.",
    "Be strategic: complete your own row, or block the other team first?",
    "Nobody waits for turns — think too long and the other team catches up!",
], [("5 rounds. For each win, the winning team steals ", {}),
    ("10 FC", {"font": BLACK, "color": YELLOW}), (" from the loser’s pot.", {})], accent=BLUE)
px, py, pw, ph = panel(s, WHITE)
# grid
g0x, g0y, gs = px + 1.6, py + 0.9, 6.75
cell = gs / 3
for i in (1, 2):
    shape(s, MSO_SHAPE.RECTANGLE, g0x + cell * i - 0.09, g0y, 0.18, gs, fill=DARK)
    shape(s, MSO_SHAPE.RECTANGLE, g0x, g0y + cell * i - 0.09, gs, 0.18, fill=DARK)
board = {(0, 0): "X", (1, 1): "O", (2, 0): "X", (0, 2): "O", (2, 2): "X", (1, 0): "O"}
for (r, c_), m in board.items():
    cx, cy = g0x + c_ * cell + cell * 0.18, g0y + r * cell + cell * 0.18
    d = cell * 0.64
    if m == "O":
        shape(s, MSO_SHAPE.DONUT, cx, cy, d, d, fill=BLUE).adjustments[0] = 0.16
    else:
        shape(s, MSO_SHAPE.MATH_MULTIPLY, cx - 0.15, cy - 0.15, d + 0.3, d + 0.3, fill=CORAL)
# relay: runners at the start, grid out of sight at the far end
up = shape(s, MSO_SHAPE.UP_ARROW, px + pw / 2 - 0.5, py + 7.95, 1.0, 1.6, fill=DARK)
text(s, px + pw / 2 + 0.75, py + 8.3, 3.6, 1.0, ["Grid hidden", "from the start"], size=18,
     font=SEMI, color=DARK)
for j in range(3):
    stick_figure(s, px + pw / 2 - 1.75 + j * 1.15, py + 9.85, 1.7, CORAL)
text(s, px + 0.9, py + 11.75, pw - 1.8, 0.6, ["START  —  relay"], size=20, font=SEMI, color=DARK,
     align=PP_ALIGN.CENTER)
tag(s, px + 0.6, py + 10.2, 2.4, 0.95, "5 rounds", YELLOW, size=26)
tag(s, px + pw - 3.0, py + 10.2, 2.4, 0.95, "Steal 10 FC", DARK, color=YELLOW, size=22)

prs.save(OUT)
print("saved", OUT)

