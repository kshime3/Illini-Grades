/* Illini Grades — scoring + grade math.
 * Shared by the website (index.html) and the check script (tools/check.js),
 * so the site and the command line always agree.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Grade scale (GPA-style, S above A, capped at S++) ----
  const SCALE = [
    ["F-", -0.33], ["F", 0], ["F+", 0.33],
    ["D-", 0.67], ["D", 1], ["D+", 1.33],
    ["C-", 1.67], ["C", 2], ["C+", 2.33],
    ["B-", 2.67], ["B", 3], ["B+", 3.33],
    ["A-", 3.67], ["A", 4], ["A+", 4.33],
    ["S-", 4.67], ["S", 5], ["S+", 5.33], ["S++", 5.67],
  ];
  const VALUE = Object.fromEntries(SCALE);

  /** Parse a grade as typed ("S++🐐", "B+", "DNP", "just checked in").
   *  Returns { raw, letter, value } — value is null when it doesn't count
   *  toward averages (DNP, jokes, blanks). */
  function parseGrade(raw) {
    const out = { raw: raw == null ? "" : String(raw), letter: null, value: null, dnp: false };
    const s = out.raw.trim();
    if (!s) return out;
    if (/^dn[a-z]*$/i.test(s)) { out.dnp = true; return out; } // DNP, DNArena, DNO…
    const m = s.match(/^([SABCDF])\s*([+\-]*)/i);
    if (!m) return out;
    // the rest must be emoji/punctuation only — real words mean it's a joke entry
    const rest = s.slice(m[0].length);
    if (/[A-Za-z]/.test(rest)) return out;
    const L = m[1].toUpperCase();
    const mods = m[2];
    const plus = (mods.match(/\+/g) || []).length;
    const minus = (mods.match(/-/g) || []).length;
    let letter;
    if (L === "S") letter = plus >= 2 ? "S++" : plus === 1 ? "S+" : minus ? "S-" : "S";
    else letter = L + (plus ? "+" : minus ? "-" : "");
    out.letter = letter;
    out.value = VALUE[letter];
    return out;
  }

  /** Nearest letter for a numeric average. */
  function toLetter(avg) {
    if (avg == null || isNaN(avg)) return null;
    let best = SCALE[0];
    for (const pair of SCALE) if (Math.abs(pair[1] - avg) < Math.abs(best[1] - avg) - 1e-9) best = pair;
    return best[0];
  }

  /** "A", "S", "F" etc → tier used for colors. */
  function tier(letter) { return letter ? letter[0] : null; }

  // ---- Games ----
  function isPlayed(g) { return !!(g.result && g.result.illinois != null && g.result.opponent != null); }
  function outcome(g) {
    if (!isPlayed(g)) return null;
    return g.result.illinois > g.result.opponent ? "W" : "L";
  }
  function record(games) {
    let w = 0, l = 0;
    for (const g of games) { const o = outcome(g); if (o === "W") w++; else if (o === "L") l++; }
    return { w, l, text: `${w}-${l}` };
  }
  function parseRecord(s) {
    const m = String(s || "").match(/(\d+)\s*-\s*(\d+)/);
    return m ? { w: +m[1], l: +m[2] } : null;
  }
  function winPct(r) { return r && r.w + r.l ? r.w / (r.w + r.l) : null; }

  // ---- Scoring ----
  /** Award `pts` to everyone tied for the smallest distance. */
  function closest(friends, distFn, pts) {
    const d = {};
    friends.forEach((f) => (d[f] = distFn(f)));
    const valid = friends.filter((f) => d[f] != null);
    if (!valid.length) return {};
    const min = Math.min(...valid.map((f) => d[f]));
    const res = {};
    friends.forEach((f) => (res[f] = d[f] != null && Math.abs(d[f] - min) < 1e-9 ? pts : 0));
    return res;
  }

  function scoreQuestion(q, friends) {
    // returns { status: "open"|"final", points: {friend: n} }
    if (q.type === "judged") {
      if (!q.awarded) return { status: "open", points: {} };
      const p = {}; friends.forEach((f) => (p[f] = Number(q.awarded[f] || 0)));
      return { status: "final", points: p };
    }
    if (q.actual == null || q.actual === "") return { status: "open", points: {} };
    const p = {};
    if (q.type === "seed") {
      const a = parseInt(q.actual, 10);
      friends.forEach((f) => {
        const v = q.values[f];
        p[f] = isNaN(a) ? 0 : v === a ? 3 : Math.abs(v - a) === 1 ? 1 : 0;
      });
    } else if (q.type === "exact") {
      const worth = q.worth || 2;
      friends.forEach((f) => (p[f] = String(q.values[f]).toLowerCase() === String(q.actual).toLowerCase() ? worth : 0));
    } else if (q.type === "closest_record") {
      const act = winPct(parseRecord(q.actual));
      Object.assign(p, closest(friends, (f) => {
        const v = winPct(parseRecord(q.values[f]));
        return v == null || act == null ? null : Math.abs(v - act);
      }, 3));
    }
    return { status: "final", points: p };
  }

  function impliedRecord(data, friend) {
    let w = 0, l = 0;
    data.games.forEach((g) => (g.picks[friend] === "W" ? w++ : l++));
    return { w, l, text: `${w}-${l}` };
  }

  function leaderboard(data) {
    const F = data.friends;
    const played = data.games.filter(isPlayed);
    const rows = F.map((f) => ({ friend: f, correct: 0, wrong: 0, gamePts: 0, bonusPts: 0, bonus: {}, total: 0 }));
    const by = Object.fromEntries(rows.map((r) => [r.friend, r]));

    for (const g of played) {
      const o = outcome(g);
      F.forEach((f) => { if (g.picks[f] === o) { by[f].correct++; by[f].gamePts++; } else by[f].wrong++; });
    }

    // Closest Illinois regular-season record — only once all 32 are in
    const ilRec = record(data.games);
    let ilStatus = "open";
    if (played.length === data.games.length) {
      ilStatus = "final";
      const pts = closest(F, (f) => Math.abs(impliedRecord(data, f).w - ilRec.w), 3);
      F.forEach((f) => { by[f].bonus["il_record"] = pts[f]; by[f].bonusPts += pts[f]; });
    }

    const questions = data.questions.map((q) => {
      const s = scoreQuestion(q, F);
      F.forEach((f) => { if (s.points[f] != null) { by[f].bonus[q.id] = s.points[f]; by[f].bonusPts += s.points[f]; } });
      return Object.assign({ id: q.id }, s);
    });

    rows.forEach((r) => (r.total = r.gamePts + r.bonusPts));
    rows.sort((a, b) => b.total - a.total || b.correct - a.correct);
    let rank = 0, prev = null;
    rows.forEach((r, i) => { if (r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
    return { rows, questions, ilRecord: { status: ilStatus }, gamesPlayed: played.length };
  }

  // ---- Player / staff grade averages ----
  const STAFF = [
    ["coaches", "Coaches"], ["crowd", "Crowd"], ["opposingCoach", "Opposing Coach Style"], ["refs", "Refs"],
  ];

  function allGames(data) {
    return data.games.map((g) => Object.assign({ phase: "reg" }, g))
      .concat((data.postseason || []).map((g) => Object.assign({ phase: "post" }, g)));
  }

  function averages(data) {
    const games = allGames(data).filter(isPlayed);
    const avg = (list) => {
      const vals = list.map(parseGrade).filter((x) => x.value != null).map((x) => x.value);
      if (!vals.length) return { avg: null, letter: null, n: 0 };
      const a = vals.reduce((s, v) => s + v, 0) / vals.length;
      return { avg: a, letter: toLetter(a), n: vals.length };
    };
    const players = data.roster.map((p) => {
      const grades = games.map((g) => (g.result.grades || {})[p.name]);
      const sCount = grades.map(parseGrade).filter((x) => x.letter && x.letter[0] === "S").length;
      return Object.assign({ player: p, sCount }, avg(grades));
    });
    const staff = STAFF.map(([key, label]) => Object.assign({ key, label }, avg(games.map((g) => g.result[key]))));
    return { players, staff };
  }

  // ---- Validation (used by tools/check.js) ----
  function validate(data) {
    const errors = [], warnings = [];
    const names = new Set(data.roster.map((p) => p.name));
    const F = data.friends;
    if (data.games.length !== 32) errors.push(`Expected 32 regular-season games, found ${data.games.length}`);
    allGames(data).forEach((g) => {
      const tag = `Game ${g.id} (${g.opponent})`;
      if (g.phase === "reg") F.forEach((f) => { if (!["W", "L"].includes(g.picks[f])) errors.push(`${tag}: bad pick for ${f}`); });
      if (!g.result) return;
      const r = g.result;
      if (typeof r.illinois !== "number" || typeof r.opponent !== "number") errors.push(`${tag}: score must be two numbers`);
      if (r.illinois === r.opponent) errors.push(`${tag}: tie score?`);
      Object.keys(r.grades || {}).forEach((n) => { if (!names.has(n)) errors.push(`${tag}: "${n}" is not on the roster`); });
      Object.entries(r.grades || {}).forEach(([n, v]) => {
        const p = parseGrade(v);
        if (!p.dnp && p.value == null && v) warnings.push(`${tag}: ${n} grade "${v}" won't count toward average (joke entry)`);
      });
      STAFF.forEach(([k]) => { if (r[k] && parseGrade(r[k]).value == null) warnings.push(`${tag}: ${k} "${r[k]}" won't count toward average`); });
    });
    return { errors, warnings };
  }

  /** Look up a typed player name. Returns array of matching roster entries. */
  function findPlayer(data, typed) {
    const t = String(typed).trim().toLowerCase();
    const exact = data.roster.filter((p) =>
      [p.name, p.display, ...(p.aliases || [])].some((n) => n.toLowerCase() === t));
    if (exact.length) return exact;
    return data.roster.filter((p) => p.name.toLowerCase().split(" ").includes(t));
  }

  // ---- Character credits ----
  // 1 credit per correct game pick + bonus points from the season questions (not the closest-record bonus).
  // Customizations cost credits from data.shop; "spent" is the total cost of what is currently equipped.
  function credits(data) {
    const lb = leaderboard(data);
    const shop = data.shop || {};
    const out = {};
    lb.rows.forEach((r) => {
      const bonusQs = Object.entries(r.bonus).filter(([k]) => k !== "il_record").reduce((s, [, v]) => s + (v || 0), 0);
      const earned = r.correct + bonusQs;
      const c = (data.characters || {})[r.friend] || {};
      let spent = 0;
      ["jersey", "hat", "court"].forEach((cat) => {
        const item = ((shop[cat] || {})[c[cat]]) || {};
        spent += item.cost || 0;
      });
      out[r.friend] = { earned, spent, available: earned - spent };
    });
    return out;
  }

  return { credits, SCALE, VALUE, parseGrade, toLetter, tier, isPlayed, outcome, record, parseRecord,
    impliedRecord, leaderboard, averages, allGames, STAFF, validate, findPlayer };
});
