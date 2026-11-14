/* Illini Grades — renders everything from data.json. No data lives in this file. */
(function () {
  "use strict";
  const S = window.Scoring;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { if (!iso) return ""; const [, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };
  // Per-friend themes from data.json → friendThemes (e.g. {"Don": "msu"})
  let THEMES = {};
  const th = (f) => (THEMES[f] ? " f-" + THEMES[f] : "");
  const badge = (f) => (THEMES[f] === "msu" ? ` <span class="spartan-badge">🛡️ Spartan</span>` : "");
  const fname = (f) => `<span class="fname${th(f)}">${esc(f)}</span>`;
  const isMsuGame = (g) => /michigan st/i.test(g.opponent) && Object.values(THEMES).includes("msu");
  const siteIcon = (s) => (s === "home" ? "🏠" : s === "away" ? "✈️" : "⚖️");

  // ---------- small renderers ----------
  function gradeChip(raw, big) {
    const p = S.parseGrade(raw);
    if (raw == null || raw === "") return `<span class="g dnp">—</span>`;
    if (p.dnp) return `<span class="g dnp">${esc(raw)}</span>`;
    if (p.value == null) return `<span class="g joke" title="Doesn't count toward average">${esc(raw)}</span>`;
    const goat = p.letter === "S++" ? " 🐐" : "";
    return `<span class="g ${p.letter[0]}${big ? " big" : ""}" title="${esc(raw)} = ${p.value}">${esc(raw)}${raw.includes("🐐") ? "" : goat}</span>`;
  }
  function letterChip(letter, big) {
    if (!letter) return `<span class="g dnp">—</span>`;
    return `<span class="g ${letter[0]}${big ? " big" : ""}">${letter}</span>`;
  }
  function beverages(v) {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== "") {
      if (n <= 0) return `${esc(v)} ${n < 0 ? "🤷 (somehow)" : "🚱 sober"}`;
      return `<span class="bev">${"🍺".repeat(Math.min(n, 12))}</span> ${esc(v)}`;
    }
    const icon = /wine/i.test(v) ? "🍷 " : /many|lot|enough/i.test(v) ? "🍻 " : "🥤 ";
    return icon + esc(v);
  }

  // ---------- sections ----------
  function renderScoreboard(data, lb) {
    const rec = S.record(data.games);
    const post = (data.postseason || []).filter(S.isPlayed);
    const next = data.games.find((g) => !S.isPlayed(g));
    const leaders = lb.rows.filter((r) => r.rank === 1);
    const leaderTxt = !lb.gamesPlayed ? "TBD" : leaders.length === 1 ? leaders[0].friend : leaders.length === data.friends.length ? `${leaders.length}-way tie` : leaders.map((r) => r.friend).join(" & ");
    $("#scoreboard").innerHTML = `
      <div class="sb-cell"><div class="sb-label">Illini</div><div class="sb-val">${rec.text}</div>
        <div class="sb-sub">${post.length ? "Post " + S.record(post).text : `${32 - rec.w - rec.l} to play`}</div></div>
      <div class="sb-cell"><div class="sb-label">Leader</div><div class="sb-val">${esc(leaderTxt)}</div>
        <div class="sb-sub">${lb.gamesPlayed ? leaders[0].total + (leaders[0].total === 1 ? " pt" : " pts") : "tip-off soon"}</div></div>
      <div class="sb-cell"><div class="sb-label">Next</div><div class="sb-val">${next ? esc(next.opponent.replace(/^(at|neutral) /, "")) : "🏁"}</div>
        <div class="sb-sub">${next ? siteIcon(next.site) + " " + fmtDate(next.date) + (next.time ? " · " + esc(next.time) : "") : "season over"}</div></div>`;
  }

  function renderStandings(data, lb, av) {
    const played = data.games.filter(S.isPlayed);
    const all = S.allGames(data).filter(S.isPlayed);
    // fun stats
    let bev = 0, mystery = 0;
    all.forEach((g) => { const v = g.result.beverages; const n = Number(v); if (v != null && v !== "" && !isNaN(n)) bev += n; else if (v) mystery++; });
    const sGrades = av.players.reduce((s, p) => s + p.sCount, 0);
    const topPlayer = av.players.filter((p) => p.n).sort((a, b) => b.avg - a.avg)[0];
    const F = data.friends;
    const disputed = data.games.filter((g) => new Set(F.map((f) => g.picks[f])).size > 1).length;
    const contrarian = F.map((f) => ({ f, n: data.games.filter((g) => F.filter((o) => o !== f).every((o) => g.picks[o] !== g.picks[f])).length }))
      .sort((a, b) => b.n - a.n)[0];

    const rows = lb.rows.map((r) => {
      const imp = S.impliedRecord(data, r.friend);
      const pct = played.length ? Math.round((r.correct / played.length) * 100) : 0;
      return `<div class="lb-row r${r.rank}${th(r.friend)}">
        <div class="lb-rank">${r.rank === 1 && lb.gamesPlayed ? "👑" : "#" + r.rank}</div>
        ${avatar(data, r.friend, 54)}
        <div><div class="lb-name">${esc(r.friend)}${badge(r.friend)}</div>
          <div class="lb-detail">Picks ${r.correct}-${r.wrong}${played.length ? ` (${pct}%)` : ""} · bonus ${r.bonusPts} · predicted ${imp.text} · ${lockerLevel(data, r.total)}</div>
          <div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="lb-pts">${r.total}<small>PTS</small></div></div>`;
    }).join("");

    $("#tab-standings").innerHTML = `
      <h2>Standings <small>${lb.gamesPlayed}/32 games scored</small></h2>
      <div class="podium">${rows}</div>
      <div class="stat-grid">
        <div class="stat"><b>${S.record(data.games).text}</b><span>Illinois record</span></div>
        <div class="stat"><b>${bev}${mystery ? "+" : ""} 🍺</b><span>Beverages consumed${mystery ? ` (+${mystery} unquantifiable)` : ""}</span></div>
        <div class="stat"><b>${sGrades} ✨</b><span>S-tier grades handed out</span></div>
        <div class="stat"><b>${topPlayer ? esc(topPlayer.player.display) + " " + topPlayer.letter : "—"}</b><span>Top season average</span></div>
        <div class="stat"><b>${disputed}</b><span>Games the group disagreed on</span></div>
        <div class="stat"><b>${contrarian && contrarian.n ? esc(contrarian.f) : "—"}</b><span>Biggest contrarian${contrarian && contrarian.n ? ` (${contrarian.n} solo picks)` : ""}</span></div>
      </div>
      ${lockerRoomCard(data)}
      ${melonCard(data)}`;
  }

  function renderPicks(data) {
    const F = data.friends;
    const nextId = (data.games.find((g) => !S.isPlayed(g)) || {}).id;
    const body = data.games.map((g) => {
      const o = S.outcome(g);
      const res = o ? `<span class="result-pill ${o}">${o} ${g.result.illinois}-${g.result.opponent}</span>` : `<span class="result-pill tbd">—</span>`;
      const cells = F.map((f) => {
        const p = g.picks[f];
        const cls = o ? (p === o ? "right" : "wrong") : "";
        return `<td class="pc${th(f)}"><span class="pick ${cls}">${p}</span></td>`;
      }).join("");
      return `<tr class="${g.id === nextId ? "next" : ""}${isMsuGame(g) ? " rival" : ""}"><td>${g.id}</td>
        <td class="game"><div class="opp">${esc(g.opponent)}${isMsuGame(g) ? ` <span class="spartan-badge">⚔️ Rivalry</span>` : ""}</div><div class="meta">${siteIcon(g.site)} ${fmtDate(g.date)} · ${esc(g.tv)}</div></td>
        <td>${res}</td>${cells}</tr>`;
    }).join("");
    const foot = F.map((f) => `<td class="pc${th(f)}">${S.impliedRecord(data, f).text}</td>`).join("");
    $("#tab-picks").innerHTML = `
      <h2>The Picks <small>straight from the form</small></h2>
      <p class="hint">🟢 = nailed it · 🔴 = whiffed · highlighted row = next game</p>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th style="text-align:left">Game</th><th>Result</th>${F.map((f) => `<th class="${th(f).trim()}">${THEMES[f] === "msu" ? "🛡️" : ""}${esc(f)}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td></td><td class="game">Predicted record</td><td></td>${foot}</tr></tfoot>
      </table></div>`;
  }

  function renderGrades(data, av) {
    const games = S.allGames(data).filter(S.isPlayed);
    const cards = av.players.filter((p) => p.n).sort((a, b) => b.avg - a.avg).map((p) => `
      <div class="avg-card">${letterChip(p.letter, true)}
        <div><div class="who">${esc(p.player.display)}</div><div class="sub">${p.n} graded${p.sCount ? ` · ${p.sCount}× S-tier` : ""}</div></div>
        <div class="num">${p.player.number}</div></div>`).join("");
    const staffCards = av.staff.filter((s) => s.n).map((s) => `
      <div class="avg-card staff">${letterChip(s.letter, true)}
        <div><div class="who">${esc(s.label)}</div><div class="sub">${s.n} graded</div></div></div>`).join("");

    if (!games.length) {
      $("#tab-grades").innerHTML = `<h2>Report Card</h2>
        <div class="empty"><div class="big">📝</div><p><b>No grades yet.</b><br>The red pen comes out after the first game.</p></div>`;
      return;
    }
    const head = games.map((g) => {
      const o = S.outcome(g);
      return `<th class="gh">${esc(g.opponent.replace(/^neutral /, "vs "))}<span class="res ${o}">${o} ${g.result.illinois}-${g.result.opponent}</span></th>`;
    }).join("");
    const playerRows = av.players.filter((p) => games.some((g) => (g.result.grades || {})[p.player.name])).map((p) => `<tr><td><b>${esc(p.player.display)}</b> <small>#${p.player.number}</small></td>
      <td>${letterChip(p.letter)}</td>${games.map((g) => `<td>${gradeChip((g.result.grades || {})[p.player.name])}</td>`).join("")}</tr>`).join("");
    const staffRows = av.staff.map((s, i) => `<tr class="staff${i === 0 ? " staff-first" : ""}"><td><b>${esc(s.label)}</b></td>
      <td>${letterChip(s.letter)}</td>${games.map((g) => `<td>${gradeChip(g.result[s.key])}</td>`).join("")}</tr>`).join("");

    $("#tab-grades").innerHTML = `
      <h2>Report Card <small>season averages</small></h2>
      <div class="avg-grid">${cards}${staffCards}</div>
      <h2>Every Grade <small>swipe sideways →</small></h2>
      <div class="table-wrap"><table class="grades-table">
        <thead><tr><th>Player</th><th>Avg</th>${head}</tr></thead>
        <tbody>${playerRows}${staffRows}</tbody>
      </table></div>`;
  }

  function renderLog(data) {
    const F = data.friends;
    const played = S.allGames(data).filter(S.isPlayed).sort((a, b) => (a.date < b.date ? 1 : -1));
    const cards = played.map((g) => {
      const r = g.result, o = S.outcome(g);
      const graded = data.roster.map((p) => ({ p, raw: (r.grades || {})[p.name], v: S.parseGrade((r.grades || {})[p.name]) }))
        .filter((x) => x.raw && !x.v.dnp);
      const best = graded.filter((x) => x.v.value != null).sort((a, b) => b.v.value - a.v.value)[0];
      const mini = graded.map((x) => `<span class="mg">${esc(x.p.display)} ${gradeChip(x.raw)}</span>`).join("");
      const pickLine = g.picks ? F.map((f) => `${fname(f)} <b class="${g.picks[f] === o ? "ok" : "no"}">${g.picks[f] === o ? "✓" : "✗"}</b>`).join(" · ") : "Postseason — no picks on the line";
      return `<article class="game-card">
        <div class="gc-head ${o}"><div><div class="opp">${o === "W" ? "🔥" : "🧊"} ${esc(g.round ? g.round + ": " : "")}${esc(g.opponent)}</div>
          <div class="date">${siteIcon(g.site)} ${fmtDate(g.date)}${g.tv ? " · " + esc(g.tv) : ""}</div></div>
          <div class="gc-score">${r.illinois}-${r.opponent}<small>${o === "W" ? "WIN" : "LOSS"}</small></div></div>
        <div class="gc-body">
          <div class="vibes">
            <div class="vibe"><div class="lbl">🍺 Beverages</div><div class="val">${beverages(r.beverages)}</div></div>
            <div class="vibe"><div class="lbl">📈 Projection</div><div class="val">${esc(r.projection || "—")}</div></div>
            <div class="vibe"><div class="lbl">🧑‍🏫 Coaches</div><div class="val">${gradeChip(r.coaches)}</div></div>
            <div class="vibe"><div class="lbl">📣 Crowd</div><div class="val">${gradeChip(r.crowd)}</div></div>
            <div class="vibe"><div class="lbl">🎩 Opp. coach style</div><div class="val">${gradeChip(r.opposingCoach)}</div></div>
            <div class="vibe"><div class="lbl">🦓 Refs</div><div class="val">${gradeChip(r.refs)}</div></div>
          </div>
          ${best ? `<div class="star">⭐ Star of the night: <b>${esc(best.p.display)}</b> ${gradeChip(best.raw)}</div>` : ""}
          ${mini ? `<div class="mini-grades">${mini}</div>` : ""}
          ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ""}
          <div class="picks-line">Picks: ${pickLine}</div>
        </div></article>`;
    }).join("");
    const upcoming = data.games.filter((g) => !S.isPlayed(g));
    const up = upcoming.map((g) => `<li><span>${siteIcon(g.site)} ${esc(g.opponent)}</span><span>${fmtDate(g.date)} · ${g.time ? esc(g.time) : "time TBD"}${g.tv && g.tv !== "TBD" ? " · " + esc(g.tv) : ""}</span></li>`).join("");
    $("#tab-log").innerHTML = `
      <h2>Game Log <small>newest first</small></h2>
      ${cards ? `<div class="log-list">${cards}</div>` : `<div class="empty"><div class="big">🍺</div><p><b>No games logged yet.</b><br>Hydrate accordingly.</p></div>`}
      ${upcoming.length ? `<details class="upcoming"${cards ? "" : " open"}><summary>📅 Still to play (${upcoming.length})</summary><ul class="up-list">${up}</ul></details>` : ""}`;
  }

  function renderQuestions(data, lb) {
    const F = data.friends;
    const qs = lb.questions.reduce((m, q) => ((m[q.id] = q), m), {});
    const ilFinal = lb.ilRecord.status === "final";
    const rec = S.record(data.games);
    const ilCard = `<div class="q-card"><div class="q-head"><h3>Illinois Record <small>(from your 32 picks)</small></h3>
        <span class="q-worth">3 to closest · <span class="badge ${ilFinal ? "final" : ""}">${ilFinal ? "final" : "live"}</span></span></div>
      <div class="q-answers">${F.map((f) => {
        const pts = lb.rows.find((r) => r.friend === f).bonus.il_record;
        return `<div class="q-ans${th(f)}"><span class="who">${esc(f)}</span><span class="txt">${S.impliedRecord(data, f).text}</span>
          <span class="pts ${pts ? "got" : ""}">${ilFinal ? "+" + pts : ""}</span></div>`;
      }).join("")}</div>
      <div class="q-actual">Currently: <b>${rec.text}</b></div></div>`;

    const cards = data.questions.map((q) => {
      const s = qs[q.id];
      const fin = s.status === "final";
      return `<div class="q-card"><div class="q-head"><h3>${esc(q.label)}</h3>
          <span class="q-worth">${esc(q.points)} · <span class="badge ${fin ? "final" : ""}">${fin ? "final" : "open"}</span></span></div>
        <div class="q-answers">${F.map((f) => {
          const pts = s.points[f];
          return `<div class="q-ans${th(f)}"><span class="who">${esc(f)}</span><span class="txt">${esc(q.answers[f])}</span>
            <span class="pts ${pts ? "got" : ""}">${fin ? "+" + (pts || 0) : ""}</span></div>`;
        }).join("")}</div>
        ${q.actual != null && q.actual !== "" ? `<div class="q-actual">Answer: <b>${esc(q.actual)}</b></div>` : ""}</div>`;
    }).join("");
    $("#tab-questions").innerHTML = `<h2>Season Questions <small>word-for-word, typos and all</small></h2>${ilCard}${cards}`;
  }

  // ---------- tabs ----------
  function setupTabs() {
    const buttons = document.querySelectorAll("#tabs button");
    const valid = (id) => !!document.getElementById("tab-" + id);
    const show = (id) => {
      if (!valid(id)) id = "standings";
      buttons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
      document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.dataset.tab === id));
      try { localStorage.setItem("illini-tab", id); } catch (e) { /* ignore */ }
    };
    buttons.forEach((b) => b.addEventListener("click", () => {
      show(b.dataset.tab);
      history.replaceState(null, "", "#" + b.dataset.tab);
      const nav = document.getElementById("tabs");
      if (window.scrollY > nav.offsetTop) window.scrollTo({ top: nav.offsetTop });
    }));
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    let start = location.hash.slice(1);
    if (!valid(start)) { try { start = localStorage.getItem("illini-tab"); } catch (e) { start = null; } }
    show(start);
  }

  // ---------- past seasons (from the old grade sheet) ----------
  function gameTable(s) {
    const games = s.games;
    const head = games.map((g) => `<th class="gh${g.phase === "post" ? " post" : ""}">${esc(g.opponent)}</th>`).join("");
    const pRows = s.players.map((p) => `<tr><td><b>${esc(p)}</b></td>${games.map((g) => `<td>${gradeChip((g.grades || {})[p])}</td>`).join("")}</tr>`).join("");
    const sRows = [["coaches", "Coaches"], ["crowd", "Crowd"], ["crowdFemale", "Crowd (female)"], ["opposingCoach", "Opp. coach style"], ["refs", "Refs"]]
      .filter(([k]) => games.some((g) => g[k]))
      .map(([k, label], i) => `<tr class="staff${i === 0 ? " staff-first" : ""}"><td><b>${label}</b></td>${games.map((g) => `<td>${gradeChip(g[k])}</td>`).join("")}</tr>`).join("");
    return `<div class="table-wrap" style="margin-top:8px"><table class="grades-table">
      <thead><tr><th>Player</th>${head}</tr></thead><tbody>${pRows}${sRows}</tbody></table></div>`;
  }

  function compareHtml(s, data) {
    const a = s.actual;
    if (!a) return "";
    const P = s.predictions || {};
    const F = data.friends.filter((f) => Object.values(P).some((r) => r && r[f] != null));
    const roundCode = (t) => {
      const x = String(t || "").toLowerCase().replace(/\s+/g, "");
      if (/final|f4/.test(x)) return "F4";
      if (/^s16|sweet/.test(x)) return "S16";
      if (/^e8|elite/.test(x)) return "E8";
      if (/^r32|second/.test(x)) return "R32";
      return x;
    };
    const cell = (v, ok) => {
      const cls = ok === true ? "hit" : ok === false ? "miss" : "";
      return `<span class="cmp ${cls}">${esc(v == null ? "—" : v)}${ok === true ? " ✓" : ""}</span>`;
    };
    const row = (label, actual, key, test) => {
      const pred = P[key] || {};
      const cells = F.map((f) => {
        const v = pred[f];
        return `<td>${cell(v, v == null || actual == null || actual === "" ? null : test(v))}</td>`;
      }).join("");
      return `<tr><td><b>${label}</b></td><td><b>${esc(actual || "—")}</b></td>${cells}</tr>`;
    };
    const rows = [
      row("Record", a.record, "Record", (v) => v === a.record),
      row("Big Ten", a.conf, "Conference record", (v) => v === a.conf),
      row("Seed", a.seed, "Tourney seed", (v) => parseInt(v, 10) === parseInt(a.seed, 10)),
      row("NCAA finish", a.finishShort || a.finish, "Tourney finish", (v) => roundCode(v) === a.finishCode),
      row("Best win", a.bestWin, "Best win", (v) => String(v).toLowerCase() === String(a.bestWin).toLowerCase()),
      row("Worst loss", a.worstLoss, "Worst loss", (v) => String(v).toLowerCase() === String(a.worstLoss).toLowerCase()),
      row("MVP", a.mvp, "MVP", (v) => String(v).toLowerCase() === String(a.mvp).toLowerCase()),
    ].join("");
    return `<h3 class="ph">Predictions vs. actual</h3>
      <div class="table-wrap"><table class="cmp-table">
        <thead><tr><th>Stat</th><th>Actual</th>${F.map((f) => `<th>${esc(f)}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="hint">✓ = right. Best win, worst loss and MVP get marked once they're decided.</p>`;
  }

  // ---------- characters (sports-card busts that level up with points) ----------
  function lockerLevel(data, pts) {
    const L = levelFor(data, pts), ms = data.milestones || [];
    return L ? ms[L - 1].name : "Base look";
  }
  function levelFor(data, pts) {
    return (data.milestones || []).filter((m) => pts >= m.pts).length;
  }
  function leaderNames(lb) {
    const top = lb.rows.length ? Math.max(...lb.rows.map((r) => r.total)) : 0;
    return top > 0 ? lb.rows.filter((r) => r.total === top).map((r) => r.friend) : [];
  }
  function shade(hex, f) {
    const n = parseInt(hex.replace("#", ""), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function avatar(data, friend, px) {
    const c = (data.characters || {})[friend];
    if (!c) return "";
    const lb = S.leaderboard(data);
    const row = lb.rows.find((r) => r.friend === friend) || { total: 0 };
    const L = levelFor(data, row.total);
    const onFire = leaderNames(lb).includes(friend) && lb.gamesPlayed > 0;
    const sid = "av" + friend.replace(/\W/g, "") + px;
    const J = c.color, Jd = shade(J, 0.55), Jl = shade(J, 1.12);
    const name = friend.toUpperCase();
    const flames = onFire ? `
      <g class="flames">
        <path class="f1" d="M0 400 L0 330 Q18 300 14 262 Q40 292 48 252 Q62 290 82 236 Q96 286 110 246 Q124 282 142 226 Q160 282 176 240 Q190 270 200 214 Q212 270 226 240 Q240 282 258 226 Q276 282 290 246 Q304 286 318 236 Q338 290 352 252 Q360 292 386 330 L400 330 L400 400 Z" fill="url(#${sid}fl)" opacity=".92"/>
        <path class="f2" d="M0 400 L0 360 Q24 336 30 306 Q52 330 66 298 Q84 330 104 296 Q124 330 150 302 Q170 332 200 290 Q230 332 250 302 Q276 330 296 296 Q316 330 336 298 Q352 330 370 306 Q378 336 400 360 L400 400 Z" fill="#ffb300" opacity=".85"/>
      </g>` : "";
    return `<div class="avatar${onFire ? " on-fire" : ""}" style="width:${px}px;height:${px}px" aria-label="${esc(friend)}'s card">
      <svg viewBox="0 0 400 400">
        <defs>
          <linearGradient id="${sid}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22457d"/><stop offset="1" stop-color="#08142a"/></linearGradient>
          <radialGradient id="${sid}spot" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
          <linearGradient id="${sid}jer" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${Jl}"/><stop offset=".5" stop-color="${J}"/><stop offset="1" stop-color="${Jd}"/></linearGradient>
          <radialGradient id="${sid}skin" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#f6d2aa"/><stop offset=".7" stop-color="#e2a878"/><stop offset="1" stop-color="#c98a5c"/></radialGradient>
          <linearGradient id="${sid}hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d14"/><stop offset="1" stop-color="#140d08"/></linearGradient>
          <filter id="${sid}soft"><feGaussianBlur stdDeviation="6"/></filter>
          <linearGradient id="${sid}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b71c1c"/><stop offset=".35" stop-color="#ff6d00"/><stop offset=".7" stop-color="#ffb300"/><stop offset="1" stop-color="#fff59d"/></linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#${sid}bg)"/>
        <rect width="400" height="400" fill="url(#${sid}spot)"/>
        ${L >= 5 ? `<g opacity=".18"><polygon points="140,0 180,0 300,400 220,400" fill="#fff"/><polygon points="220,0 248,0 340,400 280,400" fill="#fff"/></g>` : ""}
        ${flames}
        <path d="M48 400 L48 304 Q52 260 116 244 L160 232 Q200 256 240 232 L284 244 Q348 260 352 304 L352 400 Z" fill="url(#${sid}jer)"/>
        <path d="M120 300 Q140 340 132 400 M280 300 Q262 340 270 400" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="5"/>
        <path d="M160 232 Q200 262 240 232" fill="none" stroke="#fff" stroke-width="6" opacity=".85"/>
        ${L >= 1 ? `<rect x="56" y="318" width="9" height="82" fill="#ffffff" opacity=".9"/><rect x="335" y="318" width="9" height="82" fill="#ffffff" opacity=".9"/>` : ""}
        ${L >= 3 ? `<path d="M60 316 Q200 300 340 316" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><path d="M60 330 Q200 314 340 330" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>` : ""}
        ${L >= 6 ? `<path d="M160 232 Q200 262 240 232" fill="none" stroke="#FFB81C" stroke-width="7"/>` : ""}
        <rect x="172" y="194" width="56" height="60" rx="18" fill="url(#${sid}skin)"/>
        <ellipse cx="152" cy="156" rx="10" ry="15" fill="#e2a878"/><ellipse cx="248" cy="156" rx="10" ry="15" fill="#e2a878"/>
        <ellipse cx="200" cy="150" rx="50" ry="58" fill="url(#${sid}skin)"/>
        <ellipse cx="180" cy="176" rx="18" ry="12" fill="#b0653a" opacity=".22" filter="url(#${sid}soft)"/>
        <ellipse cx="220" cy="176" rx="18" ry="12" fill="#b0653a" opacity=".22" filter="url(#${sid}soft)"/>
        <path d="M150 136 Q148 96 200 92 Q252 96 250 136 Q240 116 200 112 Q160 116 150 136 Z" fill="url(#${sid}hair)"/>
        ${L >= 3 ? `<rect x="150" y="122" width="100" height="6" rx="3" fill="${shade(J, 0.45)}"/>` : ""}
        <path d="M172 136 Q182 130 192 136" fill="none" stroke="#2a1d14" stroke-width="4" stroke-linecap="round"/>
        <path d="M208 136 Q218 130 228 136" fill="none" stroke="#2a1d14" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="182" cy="150" rx="7" ry="5" fill="#fff"/><ellipse cx="218" cy="150" rx="7" ry="5" fill="#fff"/>
        <circle cx="183" cy="151" r="3.6" fill="#2b1a10"/><circle cx="219" cy="151" r="3.6" fill="#2b1a10"/>
        <path d="M200 156 Q194 176 202 180" fill="none" stroke="#8a4f2c" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M186 194 Q200 202 214 194" fill="none" stroke="#7a2e22" stroke-width="3.2" stroke-linecap="round"/>
        ${L >= 2 ? `<rect x="128" y="300" width="144" height="34" rx="6" fill="#ffffff"/><text x="200" y="324" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" fill="${shade(J, 0.35)}" letter-spacing="2">${esc(name.slice(0, 9))}</text>` : ""}
        ${L >= 4 ? `<text x="200" y="392" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="92" font-weight="700" fill="#ffffff" opacity=".16">${c.number}</text><circle cx="268" cy="272" r="15" fill="#FFB81C"/><text x="268" y="279" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#0b1a33">C</text>` : ""}
      </svg></div>`;
  }

  function lockerRoomCard(data) {
    const lb = S.leaderboard(data);
    const ms = data.milestones || [];
    const cards = data.friends.map((f) => {
      const row = lb.rows.find((r) => r.friend === f) || { total: 0 };
      const L = levelFor(data, row.total);
      const cur = L ? ms[L - 1] : null;
      const next = ms[L];
      const leader = leaderNames(lb).includes(f) && lb.gamesPlayed > 0;
      return `<div class="locker-card">${avatar(data, f, 110)}
        <div class="locker-name">${esc(f)}${badge(f)}</div>
        <div class="locker-credits"><b>${row.total}</b> pts</div>
        <div class="locker-sub">${cur ? esc(cur.name) + " · " + esc(cur.look) : "Base look"}</div>
        <div class="locker-sub">${next ? (next.pts - row.total) + " pts to " + esc(next.name) : "Max level"}${leader ? " · 🔥 on fire" : ""}</div></div>`;
    }).join("");
    const ladder = ms.map((m, i) => `<li><span><b>${m.pts} pts</b> · ${esc(m.name)}</span><span>${esc(m.look)}</span></li>`).join("");
    return `<div class="card locker">
      <h3>🏆 Locker Room <small>your card levels up with points</small></h3>
      <p class="hint">Each new milestone adds to the look, and the points leader's card catches fire.</p>
      <div class="locker-grid">${cards}</div>
      <details><summary>Milestone ladder</summary><ul class="shop-list">${ladder}</ul></details>
    </div>`;
  }

  // ---------- watermelon corner (meme) ----------
  function melonSvg(frac) {
    const f = Math.max(0, Math.min(1, frac));
    const r = f > 0 ? 10 + 34 * f : 0;
    return `<svg class="melon" viewBox="0 0 140 100" role="img" aria-label="Watermelon ${Math.round(f * 100)}% eaten">
      <defs><mask id="bite-meter"><rect width="140" height="100" fill="#fff"/><circle cx="122" cy="24" r="${r}" fill="#000"/></mask></defs>
      <g mask="url(#bite-meter)">
        <ellipse cx="70" cy="62" rx="62" ry="34" fill="#2e7d32"/>
        <ellipse cx="70" cy="62" rx="54" ry="27" fill="#e8f5e9"/>
        <ellipse cx="70" cy="62" rx="50" ry="23" fill="#ff3b5c"/>
        <g fill="none" stroke="#f7d774" stroke-width="2.2" stroke-linecap="round">
          <path d="M34 56 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0"/>
          <path d="M36 63 q4 5 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0"/>
          <path d="M40 70 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0"/>
          <path d="M44 50 q4 4 8 0 t8 0 t8 0 t8 0 t8 0 t8 0"/>
        </g>
        <path d="M92 48 l9 -4" stroke="#43a047" stroke-width="3" stroke-linecap="round"/>
        <circle cx="46" cy="44" r="0" fill="none"/>
        <ellipse cx="104" cy="66" rx="5" ry="3.5" fill="#fff3c4" stroke="#f7d774" stroke-width="1"/><circle cx="104" cy="66" r="1.8" fill="#ff9800"/>
        <g fill="#1b1b1b"><circle cx="50" cy="60" r="2"/><circle cx="70" cy="54" r="2"/><circle cx="90" cy="60" r="2"/><circle cx="62" cy="70" r="2"/><circle cx="82" cy="70" r="2"/></g>
      </g></svg>`;
  }

  function melonCard(data) {
    const F = data.friends;
    const played = data.games.filter(S.isPlayed);
    const n = played.length;
    const wins = S.record(data.games).w;
    const frac = data.games.length ? wins / data.games.length : 0;
    let award;
    if (!n) {
      award = "Nobody's rotten yet. The first wrong pick gets the award.";
    } else {
      const c = F.map((f) => ({ f, c: played.filter((g) => g.picks[f] === S.outcome(g)).length }));
      const min = Math.min(...c.map((x) => x.c));
      const low = c.filter((x) => x.c === min).map((x) => x.f);
      award = low.length === F.length
        ? `Everyone is equally rotten (${min}/${n} right).`
        : `${low.map(esc).join(" &amp; ")} · ${min}/${n} picks right`;
    }
    return `<div class="card melon-card">
      <h3>🍉 The Watermelon Corner</h3>
      <div class="melon-row">
        ${melonSvg(frac)}
        <div>
          <div class="melon-pct">${Math.round(frac * 100)}% eaten</div>
          <p class="hint">The melon gets bitten a little more with every Illinois win (${wins}/${data.games.length} so far).</p>
        </div>
      </div>
      <div class="award"><b>Watermelon Award</b> <span class="award-sub">for the most wrong picks</span><div class="award-name">${award}</div></div>
    </div>`;
  }

  function exhibitHtml(data) {
    const m = (data.memes || {}).watermelon;
    if (!m) return "";
    return `<div class="card exhibit"><h3>🍉 ${esc(m.title)}</h3>
      <p class="hint">${esc(m.event)}</p>
      <div class="photos">${m.photos.map((src, i) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Exhibit photo ${i + 1}" loading="lazy"></a>`).join("")}</div>
      <p class="caption">${esc(m.caption)}</p></div>`;
  }

  function historyHtml(data) {
    const H = data.history || [];
    if (!H.length) return "";
    const chips = (obj) => Object.entries(obj).map(([n, g]) => `<span class="mg">${esc(n)} ${letterChip(g)}</span>`).join("");
    const preds = (p) => Object.entries(p).map(([q, a]) => `<h3 class="ph">${esc(q)}</h3><div class="q-answers">${
      Object.entries(a).map(([who, txt]) => `<div class="q-ans"><span class="who">${esc(who)}</span><span class="txt">${esc(txt)}</span></div>`).join("")}</div>`).join("");
    return `<h2 class="past">Past Seasons <small>from your old grade sheet</small></h2>` + exhibitHtml(data) + H.map((s) => `
      <div class="card">
        <h3>${esc(s.season)} <span class="badge">${esc(s.note || "")}</span></h3>
        <p class="hint">Season averages</p>
        <div class="mini-grades">${chips(s.averages.players)}</div>
        <p class="hint">Staff</p>
        <div class="mini-grades">${chips(s.averages.staff)}</div>
        ${s.games ? `<details><summary>Game-by-game grades (${s.games.length} games, swipe →)</summary>${gameTable(s)}</details>` : ""}
        ${s.actual ? `<p class="hint"><b>Actual:</b> ${esc(s.actual.record)} overall · ${esc(s.actual.conf)} Big Ten · ${esc(s.actual.seed)} seed · ${esc(s.actual.finish)}</p>` : ""}
        ${compareHtml(s, data)}
        <details><summary>Friends' old predictions (full list)</summary>${preds(s.predictions)}</details>
      </div>`).join("");
  }

  // ---------- boot ----------
  fetch("data.json?v=" + Date.now())
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      $("#season").textContent = data.season;
      THEMES = data.friendThemes || {};
      const lb = S.leaderboard(data);
      const av = S.averages(data);
      renderScoreboard(data, lb);
      renderStandings(data, lb, av);
      renderPicks(data);
      renderGrades(data, av);
      $("#tab-grades").insertAdjacentHTML("beforeend", historyHtml(data));
      renderLog(data);
      renderQuestions(data, lb);
      setupTabs();
    })
    .catch((e) => {
      document.querySelector("main").innerHTML = `<div class="empty"><div class="big">🧱</div><p><b>Air ball.</b> Couldn't load data.json (${esc(e.message)}).</p></div>`;
    });
})();
