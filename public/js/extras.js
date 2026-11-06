"use strict";
/* Notes and quotes, series, and the "what should I read next?" picker. */
S.pickCfg = { lang: "any", len: "any", from: "any" }; S.pickId = null; S.qPick = null; S.readView = "tracker";

/* ---------- Notes and quotes ---------- */
function openNotes(id) {
  const it = byId(id); if (!it) return;
  let quotes = (it.quotes || []).map(q => ({ ...q }));
  const draw = () => {
    document.getElementById("nt-quotes").innerHTML = quotes.length ? quotes.map((q, n) => `<div class="rbook"><div style="font-family:var(--serif);font-style:italic;overflow-wrap:anywhere">“${esc(q.t)}”</div>
      <div class="inline note" style="justify-content:space-between"><span>${q.p ? "page " + esc(q.p) + " · " : ""}${esc(q.d || "")}</span><button type="button" class="btn small" data-qdel="${n}">Remove</button></div></div>`).join("")
      : `<p class="note" style="margin:0">No quotes saved yet.</p>`;
  };
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="notesform" role="dialog" aria-modal="true" aria-label="Notes and quotes">
    <h2>Notes and quotes</h2><p class="note" style="margin:-6px 0 10px">${esc(it.title)}. Only you see these.</p>
    <label style="margin-bottom:12px">Notes<textarea id="nt-notes" rows="3">${esc(it.notes || "")}</textarea></label>
    <h3 style="margin-bottom:6px">Favourite quotes</h3><div id="nt-quotes"></div>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 90px;margin-top:10px;align-items:end">
      <label>Add a quote<textarea id="nt-q" rows="2" maxlength="600"></textarea></label><label>Page<input type="number" id="nt-p" min="1"></label></div>
    <div class="acts" style="justify-content:flex-start;padding-top:8px"><button type="button" class="btn small" id="nt-add">Add quote</button></div>
    <div class="acts"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Save</button></div></form></div>`;
  draw();
  document.getElementById("nt-add").onclick = () => {
    const t = document.getElementById("nt-q").value.trim(), p = document.getElementById("nt-p").value;
    if (!t) return;
    quotes.push({ id: uid(), t, p: p ? +p : null, d: today() });
    document.getElementById("nt-q").value = ""; document.getElementById("nt-p").value = ""; draw();
  };
  document.getElementById("nt-quotes").onclick = e => { const b = e.target.closest("[data-qdel]"); if (b) { quotes.splice(+b.dataset.qdel, 1); draw(); } };
  document.getElementById("notesform").onsubmit = e => {
    e.preventDefault();
    const pending = document.getElementById("nt-q").value.trim();           // a quote typed but not added yet is kept
    if (pending) quotes.push({ id: uid(), t: pending, p: +document.getElementById("nt-p").value || null, d: today() });
    saveItem({ ...it, notes: document.getElementById("nt-notes").value.trim(), quotes }); closeModal(); toast("Saved");
  };
  document.getElementById("nt-notes").focus();
}
function quotesPanel() {
  const all = books().flatMap(b => (b.quotes || []).map(q => ({ ...q, book: b })));
  if (!all.length) return `<div class="panel"><h2>Favourite quotes</h2><p class="note" style="margin:0">Save lines you love with <strong>Notes</strong> on any book, in the catalog or under Reading now. A random one shows up here for you to revisit.</p></div>`;
  if (S.qPick == null || S.qPick >= all.length) S.qPick = Math.floor(Math.random() * all.length);
  const q = all[S.qPick], nb = new Set(all.map(x => x.book.id)).size;
  return `<div class="panel"><h2>A quote to revisit</h2>
    <blockquote style="margin:0 0 6px;font-family:var(--serif);font-style:italic;font-size:18px;overflow-wrap:anywhere">“${esc(q.t)}”</blockquote>
    <p class="note" style="margin:0 0 10px">${esc(q.book.title)}${q.book.creator ? ", " + esc(q.book.creator) : ""}${q.p ? " · page " + esc(q.p) : ""}</p>
    <div class="acts" style="padding:0;justify-content:flex-start"><button class="btn small" data-act="q-next">Another quote</button><span class="note">${all.length} saved from ${nb} book${nb === 1 ? "" : "s"}</span></div></div>`;
}

/* ---------- Series ---------- */
function seriesInfo() {
  const g = {};
  books().filter(b => b.series).forEach(b => (g[b.series] = g[b.series] || []).push(b));
  return Object.entries(g).map(([name, list]) => {
    list.sort((a, b) => (a.seriesNo ?? 1e9) - (b.seriesNo ?? 1e9) || a.title.localeCompare(b.title));
    const nums = new Set(list.map(b => b.seriesNo).filter(n => n != null && Number.isInteger(n)));
    const max = Math.max(0, ...nums), missing = []; for (let n = 1; n <= max; n++) if (!nums.has(n)) missing.push(n);
    const read = list.filter(b => b.read === "read").length, started = read > 0 || list.some(b => b.read === "reading");
    const next = list.find(b => b.read === "unread");
    return { name, list, missing, read, started, next, done: read === list.length };
  }).sort((a, b) => (b.started && !b.done) - (a.started && !a.done) || a.done - b.done || a.name.localeCompare(b.name));
}
function renderSeries() {
  const info = seriesInfo();
  if (!info.length) return `<div class="empty"><h2>No series yet</h2><p>Open a book with Edit and fill in Series and Number in series. Books in the same series are then grouped here, with what to read next and any volumes you are missing.</p></div>`;
  return `<p class="count">${info.length} series · ${info.filter(s => s.started && !s.done).length} in progress</p>` + info.map(s => {
    const pct = Math.round(s.read / s.list.length * 100);
    return `<div class="panel"><div style="display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between;align-items:baseline"><h2 style="margin:0">${esc(s.name)}</h2>
      <span class="note">${s.read} of ${s.list.length} read${s.done ? " · finished" : ""}</span></div>
      <div class="prog" style="margin:8px 0" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(s.name)} progress"><span style="width:${pct}%"></span></div>
      <div class="meta" style="padding:0 0 6px">${s.list.map(b => `<span class="chip${b.read === "read" ? "" : b.read === "reading" ? " lent" : " sample"}">${b.seriesNo != null ? "#" + esc(b.seriesNo) + " " : ""}${esc(b.title)}${b.read === "read" ? " ✓" : b.read === "reading" ? " (reading)" : ""}</span>`).join("")}</div>
      ${s.missing.length ? `<p class="behind" style="margin:4px 0">Missing ${s.missing.length === 1 ? "volume" : "volumes"}: ${s.missing.map(n => "#" + n).join(", ")}</p>` : ""}
      ${s.next ? `<div class="inline" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"><span>${s.started ? "Next up" : "Start with"}: <strong>${s.next.seriesNo != null ? "#" + esc(s.next.seriesNo) + " " : ""}${esc(s.next.title)}</strong></span>
        <button class="btn small primary" data-act="rd-start" data-id="${s.next.id}">Start</button>${s.next.queued ? "" : `<button class="btn small" data-act="rl-add" data-id="${s.next.id}">Add to reading list</button>`}</div>` : ""}</div>`;
  }).join("");
}

/* ---------- What should I read next? ---------- */
function pickPool() {
  const c = S.pickCfg; let pool = books().filter(b => b.read === "unread");
  if (c.from === "list") pool = pool.filter(b => b.queued);
  else if (c.from === "series") { const ids = new Set(seriesInfo().filter(s => s.started && s.next).map(s => s.next.id)); pool = pool.filter(b => ids.has(b.id)); }
  if (c.lang !== "any") pool = pool.filter(b => b.lang === c.lang);
  if (c.len === "short") pool = pool.filter(b => b.pages && b.pages < 250);
  else if (c.len === "medium") pool = pool.filter(b => b.pages && b.pages >= 250 && b.pages <= 450);
  else if (c.len === "long") pool = pool.filter(b => b.pages && b.pages > 450);
  return pool;
}
function pickPanel() {
  const c = S.pickCfg, pool = pickPool(), o = (v, t, cur) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`;
  const cur = S.pickId && pool.find(b => b.id === S.pickId);
  return `<div class="panel"><h2>What should I read next?</h2><div class="grid2">
    <label>From<select id="pk-from">${o("any", "Any unread book", c.from)}${o("list", "My reading list", c.from)}${o("series", "Next in a series I started", c.from)}</select></label>
    <label>Language<select id="pk-lang">${o("any", "Any", c.lang)}${o("English", "English", c.lang)}${o("Telugu", "Telugu", c.lang)}</select></label>
    <label>Length<select id="pk-len">${o("any", "Any", c.len)}${o("short", "Short, under 250 pages", c.len)}${o("medium", "Medium, 250 to 450", c.len)}${o("long", "Long, over 450", c.len)}</select></label></div>
    <p class="note" style="margin:8px 0">${pool.length} book${pool.length === 1 ? "" : "s"} match.${c.len !== "any" ? " Books with no page count are left out when you pick a length." : ""}</p>
    ${cur ? `<div class="card" style="margin-bottom:8px"><div class="call"><span>${esc(callNumber(cur))}</span><span>shelf ${esc(cur.loc || "not set")}</span></div><h3>${esc(cur.title)}</h3><div class="by">${esc(cur.creator)}${cur.pages ? " · " + cur.pages + " pages" : ""}</div>
      <div class="acts"><button class="btn small primary" data-act="rd-start" data-id="${cur.id}">Start reading</button>${cur.queued ? "" : `<button class="btn small" data-act="rl-add" data-id="${cur.id}">Add to reading list</button>`}</div></div>` : ""}
    <button class="btn${cur ? "" : " primary"}" data-act="pk-go"${pool.length ? "" : " disabled"}>${cur ? "Pick another" : "Pick for me"}</button></div>`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act;
  if (a === "notes") openNotes(t.dataset.id);
  else if (a === "q-next") { S.qPick = null; render(); }
  else if (a === "pk-go") { const pool = pickPool().filter(b => b.id !== S.pickId); const all = pool.length ? pool : pickPool(); S.pickId = all[Math.floor(Math.random() * all.length)].id; render(); }
  else if (a === "rv-open") { S.readView = "review"; render(); }
  else if (a === "rv-close") { S.readView = "tracker"; render(); }
});
document.addEventListener("change", e => {
  const id = e.target.id || "", map = { "pk-from": "from", "pk-lang": "lang", "pk-len": "len" };
  if (map[id]) { S.pickCfg[map[id]] = e.target.value; S.pickId = null; render(); }
});
