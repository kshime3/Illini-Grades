---
name: game-update
description: Enter a finished Illini game into the Illini Grades site. Use when the owner pastes a filled-in game form (GAME / SCORE / PLAYER GRADES / TEAM blocks), says "update game", or asks for a blank game form. Fills data.json, runs the checks, publishes to main, and replies with the standings.
---

# Illini Grades: game update

Read `CLAUDE.md` in the repo first. It has the full rules. This skill is the short routine.

## If the owner asks for a blank form
Reply with the blank form below, and nothing else. Keep it in a code block so it's easy to copy.

```
GAME: ________
DATE: ________

SCORE
Illinois: ____
Opponent: ____

PLAYER GRADES (leave blank if not mentioned, write DNP if they didn't play)
Andrej Stojakovic:  ____
David Mirkovic:     ____
Lucas Morillo:      ____
Stefan Vaaks:       ____
Zvonimir Ivisic:    ____
Tomislav Ivisic:    ____
Jake Davis:         ____
Zavier Zens:        ____
Quentin Coleman:    ____
Blake Fagbemi:      ____
Lincoln Williams:   ____
Quentin McCoy:      ____
Landon Davis:       ____
Jason Jakstys:      ____
Ethan Brown:        ____

TEAM / FUN STUFF
Coaches:            ____
Crowd:              ____
Opposing coach:     ____
Refs:               ____
Beverages:          ____
Projection:         ____
Notes:              ____
```

## If the owner pastes a filled-in form
1. **Find the game.** Match `GAME:` to the next unplayed entry in `data.json` → `games`
   (match by opponent; the date helps). If it's a postseason game, add it to `postseason`.
   If it's ambiguous, ask.
2. **Match names.** Run `node tools/check.js --find <name>` for each player with a grade.
   If anything has no match or is ambiguous, stop and ask. Never guess.
3. **Fill `result`.** Use `illinois` and `opponent` from SCORE, plus the grades and team fields.
   Store values exactly as typed (emoji and jokes included). Leave out blanks. Skip DNPs
   the same way the other players are skipped. Put anything that doesn't fit into `notes`.
   Do not record arousal level.
4. **Check.** Run `node tools/check.js`. It must end with `OK ✅`. Read any `warn:` lines and
   ask about anything that looks like a typo.
5. **Publish.** Commit `data.json` as `Game N: Illinois X, Opponent Y`, then run
   `git push origin main` and `git push origin HEAD:ccr-ee39b464-lad11x`.
   If you changed `app.js`, `style.css` or `scoring.js`, bump `?v=N` in `index.html`.
6. **Reply** with the score, the new record, the leaderboard from `check.js`, and the star of the night. Keep it short.
