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
        <div><div class="lb-name">${esc(r.friend)}${badge(r.friend)}</div>
          <div class="lb-detail">Picks ${r.correct}-${r.wrong}${played.length ? ` (${pct}%)` : ""} · bonus ${r.bonusPts} · predicted ${imp.text}</div>
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
      </div>`;
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
      renderLog(data);
      renderQuestions(data, lb);
      setupTabs();
    })
    .catch((e) => {
      document.querySelector("main").innerHTML = `<div class="empty"><div class="big">🧱</div><p><b>Air ball.</b> Couldn't load data.json (${esc(e.message)}).</p></div>`;
    });
})();
