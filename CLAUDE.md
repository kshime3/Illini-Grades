# Illini Grades — how to update after a game

This repo is a small static website for an Illinois men's basketball predictions
contest between four friends: **Shime, Krazy, Ross, Don** (Don was a late entry,
submitted 11/2 before tip-off). The owner (Shime) is not
technical. After each game they paste a plain-English summary; your job is to
update the data, check it, and republish. Ask before any big decision.

## Files

| File | What it is | Edit after a game? |
|---|---|---|
| `data.json` | **All data**: roster, 32 games + picks, postseason, season questions | **Yes, only this** |
| `scoring.js` | Grade scale, points system, averages (shared by site + check script) | No |
| `index.html`, `app.js`, `style.css` | The website (reads `data.json`) | No |
| `tools/check.js` | Validates data and prints leaderboard/averages | Run it |

Never hard-code data into the HTML/JS. Picks and season-question answers are
copied **word-for-word** from the Google Form (typos and jokes included, e.g.
"Purdont", "Buttgers", "Blake Fagemi", "At Wisconsin I guess") — never "fix" them.

## The update routine

Example message:
> Illinois beat FDU 88-61. Grades: Mirkovic S, Stojakovic A, Vaaks B+, Zvon C …
> Coaches A, Crowd B, opposing coach B+, refs C-, 2 beverages,
> projection 24-7.

1. **Find the game.** Match the opponent to the next unplayed entry in
   `data.json` → `games` (or by opponent name). If it isn't one of the 32
   (Big Ten Tournament / NCAA), add it to `postseason` instead (see below).
   If it's ambiguous (e.g. Northwestern / Wisconsin / Purdont appear twice:
   home and "at"), use the date / home-away / next-unplayed logic, and ask if still unsure.
2. **Match every player name** to the roster:
   `node tools/check.js --find Mirkovic Zvon Davis`
   - One match → use the full roster `name` as the key in `grades`.
   - **NO MATCH or AMBIGUOUS → stop and ask the owner. Never guess.**
     Known ambiguities: "Davis" (Jake vs Landon), "Quentin" (McCoy vs Coleman),
     "Ivisic" (Tomi/Tomislav vs Zvon/Zvonimir).
   - If they confirm a new nickname, add it to that player's `aliases`.
   - If a genuinely new player joins, ask, then add them to `roster`.
3. **Fill in `result`** for that game (replace `null`):
   ```json
   "result": {
     "illinois": 88,
     "opponent": 61,
     "grades": { "David Mirkovic": "S", "Andrej Stojakovic": "A", "Lucas Morillo": "DNP" },
     "coaches": "A",
     "crowd": "B",
     "opposingCoach": "B+",
     "refs": "C-",
     "beverages": "2",
     "projection": "24-7",
     "notes": ""
   }
   ```
   - `illinois` / `opponent` are numbers; win/loss is computed from them.
   - Store every value **exactly as typed** (strings), including emoji and jokes
     ("S++🐐", "1 bottle of wine", "just checked in"). Players not mentioned are
     simply left out. "DNP" if they say so.
   - Missing fields: leave them out (don't invent). If the score is missing, ask.
   - Anything extra they say that doesn't fit a field → `notes`.
   - **Arousal level is no longer tracked** (owner removed it). Don't record or display it.
4. **Check:** `node tools/check.js` — must end with `OK ✅`. Read any `warn:`
   lines (they flag grades that won't count, e.g. a typo like "B=") and ask if
   something looks like a mistake rather than a joke.
5. **Preview (optional but good):** `python3 -m http.server 8000` and open
   the site, or screenshot with Playwright at 390px wide.
6. **Publish:** commit `data.json` with a message like
   `Game 1: Illinois 88, FDU 61` and push (see "Publishing" below).
   The live site updates within ~1–2 minutes.
7. **Reply to the owner** with: the result, new Illinois record, the updated
   leaderboard (from `check.js` output), and the star of the night. Keep it short and fun.

### Tip times
Each game has a `time` in **Central time** (e.g. `"7:30 PM CT"`, or `null` if TBD),
shown in the "Still to play" list. If the owner mentions a time change, update it.

### Postseason games
Append to `postseason` (no picks, not scored for the contest, but grades and fun
columns count toward averages):
```json
{ "id": "P1", "date": "2027-03-12", "round": "Big Ten Tournament QF", "opponent": "Purdont", "site": "neutral", "tv": "BTN", "result": { ... } }
```

### Season questions
When something resolves (seed announced, MSU season ends, DC hired or Jan 1 passes,
draft happens, transfers known), update `questions` in `data.json`:
- `seed`, `exact`, `closest_record` types: set `"actual"` (e.g. `3`, `"Yes"`, `"24-8"`).
  If Illinois misses the tournament set seed `actual` to `"none"`.
- `judged` types (Best Win, Worst Loss, MVP, Transfers): the owner decides. Set
  `"actual"` to their wording and `"awarded": {"Shime": 2, "Krazy": 0, "Ross": 0}`.
  Transfers = 1 point per correctly named player (the "assistant coach" line counts if it happens).
- The "closest Illinois record" bonus is automatic once all 32 games have results.
- Note: "Michigan St. Record" really is Michigan State's record (one friend is an MSU fan).

### Friends & themes
`friends` in `data.json` lists everyone in the contest; every game's `picks` and every
question's `answers` (and `values`, where present) must have an entry for each friend.
`friendThemes` gives a friend a special look: **Don is the Michigan State fan →
`"msu"`** (Spartan green, 🛡️ badge, his own column, and the Michigan St. game is
tagged "Rivalry"). To add a late entry, parse their form row by tabs: the form has
"Seattle" twice and the **2nd Seattle column is always blank — skip it**, leaving 32 picks.

### Past seasons (`history` in data.json)
2025-26 (last season) and 2024-25 come from the old grade sheet: season averages
(as typed in the sheet, not mapped to the current roster) and the friends' old
predictions. Shown under "Past Seasons" on the Grades tab. Actual results are in `actual` (from Wikipedia; overall/Big Ten records exclude exhibitions) and are
compared to the friends' predictions in a table. Best win, worst loss and MVP are still blank (owner decides).
The predictions themselves are NOT results,
and they don't affect scoring. 2025-26 has game-by-game grades (`games`, with `phase` reg/post and `players` order), matched by
column position. Beverages and the projection row were skipped as unreliable. 2024-25 game-by-game is imported too (35 games, with refs and the female crowd row).
Source: the Google Sheet "Basketball Grades" (id 13QFKm55fb6yZxfRchEGsK5ktJBTcJPmxkIeR7jRC5I4), tabs "2025-26 True Grades" and "2024-25 Grades".

## Rules baked into scoring.js (confirmed with owner — don't change without asking)

**Points:** 1 per correct game pick · closest Illinois record 3 · tourney seed 3 exact / 1 off-by-one ·
Best Win / Worst Loss / MVP 2 each (owner judges) · closest Michigan St. record 3 ·
suspensions exact 2 · draftees exact 2 · DC hire 2 · transfers 1 per correct name.
Ties for "closest" all get the full points.

**Grade scale** (GPA style, averages shown as nearest letter):
F- −0.33, F 0, F+ 0.33, D- 0.67, D 1, D+ 1.33, C- 1.67, C 2, C+ 2.33, B- 2.67, B 3, B+ 3.33,
A- 3.67, A 4, A+ 4.33, S- 4.67, S 5, S+ 5.33, **S++ 5.67 (cap — S+++, S++++++ all count as S++)**.
Extra pluses on non-S grades (e.g. "B++") count as one plus. Emoji after a grade are
ignored for math but displayed. DNP / blank / joke text don't count toward averages.

## Publishing

The live site is GitHub Pages, served from the **`main` branch, root folder** of
`kshime3/Illini-Grades` (public repo; owner approved). Live URL:
https://kshime3.github.io/Illini-Grades/

To publish: commit on `main` and `git push origin main`. (If a session is assigned
a different working branch, commit there too, but the site only changes when
`main` changes; the owner has approved pushing data updates to `main`.)
Pages takes ~1–2 minutes to rebuild. The page loads `data.json` with a
cache-buster, so a normal refresh shows new data.
**If you change `app.js`, `style.css` or `scoring.js`, bump the `?v=N` number on
all three links in `index.html`**, otherwise phones keep the old code for ~10 minutes.

## Practice / undo
To try a made-up game, add it, run `check.js`, show the owner, then restore with
`git checkout data.json` (if not committed) or `git revert <commit>` (if pushed).
