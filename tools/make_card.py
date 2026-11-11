#!/usr/bin/env python3
"""Rebuild the link-preview card from data.json and point index.html at it.

Run after every game:   python3 tools/make_card.py
It reads the scores from scoring.js (same math as the site), redraws img/og-card.png,
and bumps the ?v= number on og:image so messaging apps fetch the new picture.
"""
import json, os, re, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(ROOT)
data = json.load(open("data.json"))
lb = json.loads(subprocess.check_output(["node", "-e",
    "const S=require('./scoring.js');const d=require('./data.json');"
    "console.log(JSON.stringify({lb:S.leaderboard(d),rec:S.record(d.games)}))"]))
rows = sorted(lb["lb"]["rows"], key=lambda r: -r["total"])
rec = lb["rec"]["text"]
played = lb["lb"]["gamesPlayed"]

NAVY = (19, 41, 75); NAVY2 = (11, 25, 50); ORANGE = (255, 95, 5); CREAM = (255, 247, 239)
DARK = (60, 25, 5); BLACK = (8, 8, 10); MUTED = (170, 185, 210); GOLD = (255, 190, 60)
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
f = lambda p, s: ImageFont.truetype(p, s)

def ball(r):
    S = int(2 * r) + 8; c = S / 2
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0)); bd = ImageDraw.Draw(base)
    bd.ellipse([4, 4, S - 4, S - 4], fill=ORANGE + (255,))
    seams = Image.new("RGBA", (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(seams)
    w = max(3, int(r * 0.07))
    sd.line([(c, 4), (c, S - 4)], fill=DARK + (255,), width=w)
    sd.line([(4, c), (S - 4, c)], fill=DARK + (255,), width=w)
    for side in (-1, 1):
        pts = []
        for i in range(101):
            t = -1 + 2 * i / 100
            pts.append((c + side * r * (1.0 - 0.55 * (1 - t * t)), c + t * r * 0.98))
        sd.line(pts, fill=DARK + (255,), width=w, joint="curve")
    mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).ellipse([4, 4, S - 4, S - 4], fill=255)
    seams.putalpha(Image.composite(seams.getchannel("A"), Image.new("L", (S, S), 0), mask))
    base.alpha_composite(seams)
    ImageDraw.Draw(base).ellipse([4, 4, S - 4, S - 4], outline=DARK + (255,), width=max(3, int(r * 0.05)))
    return base

W, H = 1200, 630
im = Image.new("RGB", (W, H), (22, 40, 80)); d = ImageDraw.Draw(im)
for y in range(H):
    t = y / H
    d.line([0, y, W, y], fill=tuple(int((22, 40, 80)[i] * (1 - t) + NAVY2[i] * t) for i in range(3)))
bx, by, bs = 60, 120, 270
d.rounded_rectangle([bx, by, bx + bs, by + bs], radius=34, fill=NAVY)
b = ball(70)
im.paste(b, (int(bx + bs / 2 - b.width / 2), int(by + bs / 2 - 18 - b.height / 2)), b)
d.rounded_rectangle([bx, by + bs - 62, bx + bs, by + bs + 10], radius=22, fill=ORANGE)
d.rectangle([bx, by + bs - 62, bx + bs, by + bs - 30], fill=ORANGE)
bf = f(BOLD, 30); tw = d.textlength("ILLINI GRADES", font=bf)
d.text((bx + (bs - tw) / 2, by + bs - 52), "ILLINI GRADES", font=bf, fill=NAVY)
tx = 380
d.text((tx, 92), "ILLINI GRADES 2026-27", font=f(BOLD, 52), fill=(255, 255, 255))
d.text((tx, 160), f"Illinois {rec} · Who's winning?", font=f(REG, 26), fill=CREAM)

# friends: one row
px, py, pw, ph = tx, 205, 740, 62
d.rounded_rectangle([px, py, px + pw, py + ph], radius=14, fill=BLACK, outline=(60, 60, 70), width=2)
cw = pw / len(rows[:4])
for i, r in enumerate(rows[:4]):
    x0 = px + i * cw
    txt = f"{r['friend'].upper()} {r['total']}"
    tw2 = d.textlength(txt, font=f(BOLD, 26))
    d.text((x0 + (cw - tw2) / 2, py + 17), txt, font=f(BOLD, 26), fill=GOLD)

# last game grades
last = max((g for g in data["games"] if g.get("result")), key=lambda g: g["id"], default=None)
gy = 285
d.rounded_rectangle([px, gy, px + pw, 596], radius=14, fill=BLACK, outline=(60, 60, 70), width=2)
if last:
    res = last["result"]
    head = f"{last['opponent'].upper()} {res['illinois']}-{res['opponent']} · PLAYER GRADES"
    d.text((px + 16, gy + 12), head, font=f(BOLD, 20), fill=MUTED)
    def short_grade(g):
        if g is None or g == "": return "—"
        if "DNP" in g.upper(): return "DNP"
        m = re.match(r"^\s*([SABCDF][+\-]*)", g)
        return m.group(1) if m else "—"
    players = data["roster"]
    cols, rowsN = 5, 3
    cell_w = (pw - 32) / cols
    for idx, pl in enumerate(players[:cols * rowsN]):
        c_i, r_i = idx % cols, idx // cols
        x0 = px + 16 + c_i * cell_w
        y0 = gy + 46 + r_i * 58
        g = short_grade((res.get("grades") or {}).get(pl["name"]))
        nm = pl["display"][:12]
        d.text((x0, y0), nm, font=f(REG, 18), fill=CREAM)
        d.text((x0, y0 + 20), g, font=f(BOLD, 24), fill=MUTED if g in ("DNP", "—") else GOLD)
d.rectangle([0, H - 14, W, H], fill=GOLD)
sub = "Scored through game %d" % played if played else "Tip-off soon"
im.save("img/og-card.png", optimize=True)

# bump ?v= so messaging apps fetch the new picture
html = open("index.html").read()
html = re.sub(r'(og:image" content="https://kshime3\.github\.io/Illini-Grades/img/og-card\.png)(\?v=\d+)?"',
              lambda m: m.group(1) + "?v=%d\"" % played, html)
open("index.html", "w").write(html)
print("card rebuilt: record %s, played %d, top: %s" % (rec, played, ", ".join(f"{r['friend']} {r['total']}" for r in rows)))
