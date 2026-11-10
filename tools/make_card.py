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
d.text((tx, 130), "ILLINI GRADES", font=f(BOLD, 72), fill=(255, 255, 255))
d.text((tx, 212), "2026-27", font=f(BOLD, 72), fill=ORANGE)
d.text((tx, 305), f"Illinois {rec} · Who's winning?", font=f(REG, 30), fill=CREAM)
px, py, pw, ph = tx, 360, 740, 200
d.rounded_rectangle([px, py, px + pw, py + ph], radius=18, fill=BLACK, outline=(60, 60, 70), width=3)
for i, r in enumerate(rows[:4]):
    y = py + 22 + i * 44
    d.text((px + 30, y + 4), str(i + 1), font=f(REG, 24), fill=MUTED)
    d.text((px + 70, y), r["friend"].upper(), font=f(BOLD, 30), fill=GOLD)
    pts = f"{r['total']} pt" if r["total"] == 1 else f"{r['total']} pts"
    tw2 = d.textlength(pts, font=f(BOLD, 30))
    d.text((px + pw - 40 - tw2, y), pts, font=f(BOLD, 30), fill=GOLD)
    if i < 3: d.line([px + 30, y + 40, px + pw - 30, y + 40], fill=(60, 60, 70), width=1)
sub = "Scored through game %d" % played if played else "Tip-off soon"
d.text((px + 30, py + ph + 14), sub, font=f(REG, 22), fill=MUTED)
d.rectangle([0, H - 14, W, H], fill=GOLD)
im.save("img/og-card.png", optimize=True)

# bump ?v= so messaging apps fetch the new picture
html = open("index.html").read()
html = re.sub(r'(og:image" content="https://kshime3\.github\.io/Illini-Grades/img/og-card\.png)(\?v=\d+)?"',
              lambda m: m.group(1) + "?v=%d\"" % played, html)
open("index.html", "w").write(html)
print("card rebuilt: record %s, played %d, top: %s" % (rec, played, ", ".join(f"{r['friend']} {r['total']}" for r in rows)))
