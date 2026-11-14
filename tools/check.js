#!/usr/bin/env node
/* Run after every update:   node tools/check.js
 * Validates data.json and prints the record, leaderboard and grade averages.
 * Look up a typed name:     node tools/check.js --find "Zvon"
 */
const fs = require("fs");
const path = require("path");
const S = require("../scoring.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data.json"), "utf8"));

const i = process.argv.indexOf("--find");
if (i > -1) {
  const names = process.argv.slice(i + 1);
  for (const n of names) {
    const m = S.findPlayer(data, n);
    console.log(`${n} -> ${m.length === 1 ? m[0].name : m.length ? "AMBIGUOUS: " + m.map((p) => p.name).join(" / ") : "NO MATCH (ask the user!)"}`);
  }
  process.exit(0);
}

const { errors, warnings } = S.validate(data);
const cr = S.credits(data);
Object.entries(cr).forEach(([f, c]) => { if (c.available < 0) errors.push(`${f} has spent ${c.spent} credits but only earned ${c.earned}`); });
warnings.forEach((w) => console.log("warn: " + w));
if (errors.length) { errors.forEach((e) => console.log("ERROR: " + e)); process.exit(1); }

const reg = S.record(data.games);
console.log(`\nIllinois regular season: ${reg.text}` + (data.postseason.length ? `  | postseason ${S.record(data.postseason).text}` : ""));
const lb = S.leaderboard(data);
console.log(`\nLeaderboard (${lb.gamesPlayed}/32 games scored)`);
lb.rows.forEach((r) => console.log(`  ${r.rank}. ${r.friend.padEnd(6)} ${String(r.total).padStart(3)} pts  (picks ${r.correct}-${r.wrong}, bonus ${r.bonusPts})`));
const av = S.averages(data);
console.log("\nSeason averages");
av.players.filter((p) => p.n).sort((a, b) => b.avg - a.avg)
  .forEach((p) => console.log(`  ${p.player.name.padEnd(18)} ${p.letter.padEnd(4)} (${p.avg.toFixed(2)}, ${p.n} games)`));
av.staff.filter((s) => s.n).forEach((s) => console.log(`  ${s.label.padEnd(18)} ${s.letter.padEnd(4)} (${s.avg.toFixed(2)})`));
console.log("\nOK ✅");
