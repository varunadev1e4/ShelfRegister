"use strict";
/* Reading tab screens. */
function goalPanel(y) {
  const g = goalFor(y), done = finishedIn(y).length, cy = thisYear();
  const prev = S.goals.filter(x => x.year < y).sort((a, b) => b.year - a.year)[0];
  const form = `<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><label style="max-width:150px">${g ? "Change goal" : "Books to read in " + y}<input type="number" id="goal-target" min="1" max="999" value="${g ? g.target : (prev ? prev.target : 24)}"></label>
    <button class="btn${g ? "" : " primary"}" data-act="goal-save">${g ? "Save" : "Set " + y + " goal"}</button></div>`;
  if (!g) return `<div class="panel goal"><h2>${y} reading goal</h2>
    <p class="note" style="margin:0">${y === cy ? "A new year starts a fresh goal. " : ""}${prev ? `Your ${prev.year} goal was ${prev.target} books. ` : ""}Pick a target for ${y}.</p>${form}
    <p style="margin:0">Finished so far in ${y}: <strong>${done}</strong></p></div>`;
  const pct = Math.min(100, Math.round(done / g.target * 100)), p = paceFor(y, done, g.target);
  const good = p.state === "done" || p.state === "ok";
  return `<div class="panel goal"><h2>${y} reading goal</h2>
    <div><span class="big">${done}</span> <span class="note">of ${g.target} books · ${pct}%</span></div>
    <div class="prog${good ? "" : " over"}" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${g.target}" aria-label="Books finished toward the ${y} goal"><span style="width:${pct}%"></span></div>
    <p class="${p.state === "future" ? "note" : good ? "ok" : "behind"}" style="margin:0">${esc(p.text)}</p>${form}
    ${y === cy ? `<p class="note" style="margin:0">The goal starts fresh on 1 January. Earlier years stay in the year list above.</p>` : ""}</div>`;
}
function chartPanel(y) {
  const c = monthCounts(y), g = goalFor(y), pace = g ? g.target / 12 : 0;
  const max = Math.max(1, Math.ceil(Math.max(...c, pace)));
  const W = 480, H = 180, L = 30, R = 8, T = 16, B = 26, pw = W - L - R, ph = H - T - B, bw = pw / 12;
  const Y = v => T + ph - (v / max) * ph;
  const bars = c.map((n, m) => { const h = (n / max) * ph, x = L + m * bw + bw * 0.18, w = bw * 0.64;
    return (n ? `<rect class="bar" x="${x.toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2"/><text class="val" x="${(x + w / 2).toFixed(1)}" y="${(T + ph - h - 4).toFixed(1)}" text-anchor="middle">${n}</text>` : "") +
      `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${"JFMAMJJASOND"[m]}</text>`; }).join("");
  const label = c.map((n, m) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m] + " " + n).join(", ");
  return `<div class="panel"><h2>Books finished each month, ${y}</h2>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Books finished per month in ${y}: ${label}">
      <line class="axis" x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}"/>
      <text x="${L - 6}" y="${Y(0) + 4}" text-anchor="end">0</text><text x="${L - 6}" y="${Y(max) + 4}" text-anchor="end">${max}</text>
      ${g ? `<path class="pace" d="M${L} ${Y(pace).toFixed(1)} H${W - R}"/>` : ""}${bars}</svg>
    <p class="note" style="margin:6px 0 0">${g ? `Dashed line: ${pace % 1 ? pace.toFixed(1) : pace} ${pace === 1 ? "book" : "books"} a month, the pace your ${g.target}-book goal needs.` : "Set a goal to see the monthly pace it needs."}</p></div>`;
}
function statsRow(y) {
  const fin = finishedIn(y), cy = thisYear();
  const pages = fin.reduce((s, b) => s + (b.pages || 0), 0);
  const timed = fin.filter(b => b.startedOn && b.finishedOn).map(b => Math.max(1, daysBetween(b.startedOn, b.finishedOn)));
  const rated = fin.filter(b => b.rating > 0);
  const en = fin.filter(b => b.lang === "English").length, te = fin.filter(b => b.lang === "Telugu").length;
  const mo = cy + "-" + pad2(new Date().getMonth() + 1);
  const tiles = [["Books finished", fin.length], ["Pages read", pages ? pages.toLocaleString("en-IN") : "—"],
    ["Days per book", timed.length ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length) : "—"],
    ["Average rating", rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) + " ★" : "—"],
    ["English / Telugu", en + " / " + te]];
  if (y === cy) { tiles.push(["Reading streak", currentStreak() + (currentStreak() === 1 ? " day" : " days")]); tiles.push(["Pages this month", S.log.filter(l => l.date.startsWith(mo)).reduce((s, l) => s + l.pages, 0).toLocaleString("en-IN")]); }
  return `<div class="stats">${tiles.map(([k, v]) => `<div class="stat"><span>${k}</span><div class="big">${v}</div></div>`).join("")}</div>`;
}
function nowPanel() {
  const now = readingNow();
  const rows = now.map(b => { const pct = b.pages ? Math.min(100, Math.round((b.curPage || 0) / b.pages * 100)) : null;
    return `<div class="rbook"><div><strong>${esc(b.title)}</strong><div class="note">${esc(b.creator)}${b.startedOn ? " · started " + esc(b.startedOn) + ", day " + (daysBetween(b.startedOn, today()) + 1) : ""}</div></div>
      ${pct !== null ? `<div class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress in ${esc(b.title)}"><span style="width:${pct}%"></span></div><div class="note">Page ${b.curPage || 0} of ${b.pages} · ${pct}%</div>` : `<div class="note">Add the page count with Edit to see a progress bar.</div>`}
      <div class="inline"><label style="flex-direction:row;align-items:center;gap:6px;color:var(--fg)">Page <input type="number" id="pg-${b.id}" min="0" value="${b.curPage || 0}" aria-label="Current page"></label>
      <button class="btn small" data-act="rd-progress" data-id="${b.id}">Save page</button><button class="btn small primary" data-act="rd-finish" data-id="${b.id}">Finished</button><button class="btn small" data-act="edit" data-id="${b.id}">Edit</button></div></div>`; }).join("");
  return `<div class="panel"><h2>Reading now</h2>${rows || `<p class="note" style="margin:0">Nothing in progress. Start a book from your reading list.</p>`}</div>`;
}
function listPanel() {
  const q = queue();
  const rows = q.map((b, n) => `<div class="rbook"><div><strong>${n + 1}. ${esc(b.title)}</strong><div class="note">${esc(b.creator)}${b.pages ? " · " + b.pages + " pages" : ""} · shelf ${esc(b.loc || "not set")}</div></div>
    <div class="inline"><button class="btn small primary" data-act="rd-start" data-id="${b.id}">Start</button>
    <button class="btn small" data-act="rl-up" data-id="${b.id}" aria-label="Move up"${n === 0 ? " disabled" : ""}>↑</button><button class="btn small" data-act="rl-down" data-id="${b.id}" aria-label="Move down"${n === q.length - 1 ? " disabled" : ""}>↓</button>
    <button class="btn small" data-act="rl-remove" data-id="${b.id}">Remove</button></div></div>`).join("");
  return `<div class="panel"><h2>Reading list</h2>${rows || `<p class="note" style="margin:0 0 8px">Your list is empty. Search below, or use “+ Reading list” on any book in the catalog.</p>`}
    <label style="margin-top:10px">Add a book<input type="search" id="rl-q" placeholder="Part of a title or author" autocomplete="off"></label><div id="rl-results"></div></div>`;
}
function updateListSearch() {
  const el = document.getElementById("rl-q"), out = document.getElementById("rl-results"); if (!el || !out) return;
  const q = norm(el.value).trim();
  if (q.length < 2) { out.innerHTML = ""; return; }
  const hits = books().filter(b => b.read === "unread" && !b.queued && norm(b.title + " " + b.creator).includes(q)).slice(0, 8);
  out.innerHTML = hits.length ? hits.map(b => `<div class="rbook"><div class="inline" style="justify-content:space-between;flex-wrap:nowrap"><span style="min-width:0;overflow-wrap:anywhere"><strong>${esc(b.title)}</strong> <span class="note">${esc(b.creator)} · ${esc(b.loc || "no shelf")}</span></span><button class="btn small" data-act="rl-add" data-id="${b.id}">Add</button></div></div>`).join("")
    : `<p class="note">No unread book matches “${esc(el.value.trim())}”.</p>`;
}
function finishedPanel(y) {
  const fin = finishedIn(y).sort((a, b) => b.finishedOn.localeCompare(a.finishedOn)), undated = undatedFinished().length;
  return `<div class="panel"><h2>Finished in ${y}</h2>${fin.length ? `<div class="scroll"><table><thead><tr><th>Book</th><th>Finished</th><th>Days</th><th>Rating</th></tr></thead><tbody>
    ${fin.map(b => `<tr><td>${esc(b.title)}<div class="note">${esc(b.creator)}</div></td><td class="mono">${esc(b.finishedOn)}</td><td>${b.startedOn ? Math.max(1, daysBetween(b.startedOn, b.finishedOn)) : "—"}</td><td>${b.rating ? "★".repeat(b.rating) : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="note" style="margin:0">No books finished in ${y} yet.</p>`}
    ${undated ? `<p class="note" style="margin:10px 0 0">${undated} book${undated === 1 ? " is" : "s are"} marked as read without a finish date, so ${undated === 1 ? "it does" : "they do"} not count toward any year. Open one with Edit in the catalog and add the date.</p>` : ""}</div>`;
}
function renderReading() {
  if (!S.readingReady) return `<div class="panel"><h2>One more setup step</h2><p>The reading tracker needs the updated database. In Supabase open <strong>SQL Editor</strong>, paste the latest <span class="mono">supabase/schema.sql</span> from this project and run it. It is safe to run again. Then reload this page.</p></div>`;
  const y = S.readYear, cy = thisYear();
  const years = [...new Set([cy, y, ...S.goals.map(g => g.year), ...books().filter(b => b.finishedOn).map(b => +b.finishedOn.slice(0, 4))])].sort((a, b) => b - a);
  return `<div class="bar" style="align-items:center"><label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg)">Year <select id="rd-year" style="width:auto">${years.map(n => `<option value="${n}"${n === y ? " selected" : ""}>${n}${n === cy ? " (this year)" : ""}</option>`).join("")}</select></label></div>
    <div class="two">${goalPanel(y)}${chartPanel(y)}</div>${statsRow(y)}
    <div class="two">${nowPanel()}${listPanel()}</div>${finishedPanel(y)}`;
}
