"use strict";
/* Reading tracker: data, date maths and actions. Screens are in reading-view.js. */
S.goals = []; S.log = []; S.readingReady = false; S.readYear = new Date().getFullYear();

async function loadReading() {
  try {
    S.goals = (await fetchAll("reading_goals", "year")).map(g => ({ year: g.year, target: g.target }));
    S.log = (await fetchAll("reading_log", "log_date")).map(l => ({ id: l.id, itemId: l.item_id, date: l.log_date, pages: l.pages || 0 }));
    S.readingReady = true;
  } catch (e) { S.readingReady = false; }
}

/* ---------- Dates (all local, never UTC) ---------- */
const parseYMD = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const thisYear = () => new Date().getFullYear();
const daysInYear = y => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
const dayOfYear = d => Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5);
const daysBetween = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 864e5);
const goalFor = y => S.goals.find(g => g.year === y);

/* ---------- Derived numbers ---------- */
const books = () => S.items.filter(i => i.kind === "book");
const finishedIn = y => books().filter(i => i.read === "read" && i.finishedOn && i.finishedOn.startsWith(y + "-"));
const undatedFinished = () => books().filter(i => i.read === "read" && !i.finishedOn);
const readingNow = () => books().filter(i => i.read === "reading");
const queue = () => books().filter(i => i.queued && i.read !== "read").sort((a, b) => (a.queuePos ?? 1e9) - (b.queuePos ?? 1e9));

function paceFor(y, finished, target) {
  if (finished >= target) return { state: "done", text: "Goal reached. Every extra book is a bonus." };
  if (y < thisYear()) return { state: "missed", text: `Finished ${finished} of ${target}.` };
  if (y > thisYear()) return { state: "future", text: "This year has not started yet." };
  const now = new Date(), frac = dayOfYear(now) / daysInYear(y), expected = target * frac, diff = finished - expected;
  const left = target - finished, daysLeft = daysInYear(y) - dayOfYear(now) + 1;
  if (diff >= 0) return { state: "ok", text: `On pace, ${diff < 0.5 ? "right on target" : diff.toFixed(1) + " books ahead"}.` };
  const every = Math.max(1, Math.floor(daysLeft / left));
  return { state: "behind", text: `${(-diff).toFixed(1)} books behind pace. One book every ${every} day${every === 1 ? "" : "s"} gets you there.` };
}
function currentStreak() {
  const set = new Set(S.log.map(l => l.date));
  S.items.forEach(i => { if (i.finishedOn) set.add(i.finishedOn); });
  let d = new Date(); if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function monthCounts(y) {
  const out = Array(12).fill(0);
  finishedIn(y).forEach(i => { out[parseYMD(i.finishedOn).getMonth()]++; });
  return out;
}

/* ---------- Saving ---------- */
async function saveMany(list) {
  const ids = new Set(list.map(i => i.id));
  S.items = S.items.map(i => ids.has(i.id) ? list.find(x => x.id === i.id) : i); render();
  const { error } = await sb.from("items").upsert(list.map(toRow));
  if (error) { toast("Not saved: " + error.message); loadItems(); }
}
async function logPages(itemId, pages) {
  const row = { item_id: itemId, log_date: today(), pages };
  S.log.push({ id: "tmp", itemId, date: row.log_date, pages });
  const { error } = await sb.from("reading_log").insert(row);
  if (error) { S.log = S.log.filter(l => !(l.id === "tmp" && l.itemId === itemId)); toast("Progress saved, but the reading diary could not be updated."); }
}
async function saveGoal(year, target) {
  const { error } = await sb.from("reading_goals").upsert({ owner_id: S.session.user.id, year, target }, { onConflict: "owner_id,year" });
  if (error) return toast("Goal not saved: " + error.message);
  const g = goalFor(year); if (g) g.target = target; else S.goals.push({ year, target });
  render(); toast("Goal for " + year + " saved");
}

/* ---------- Actions ---------- */
const byId = id => S.items.find(i => i.id === id);
function startReading(id) { const it = byId(id); if (!it) return; saveItem({ ...it, read: "reading", startedOn: it.startedOn || today(), finishedOn: "", queued: false, queuePos: null }); toast("Started. Enjoy."); }
function addToList(id) { const it = byId(id); if (!it) return; const pos = Math.max(0, ...queue().map(q => q.queuePos || 0)) + 1; saveItem({ ...it, queued: true, queuePos: pos }); toast("Added to your reading list"); }
function removeFromList(id) { const it = byId(id); if (it) { saveItem({ ...it, queued: false, queuePos: null }); toast("Removed from the list"); } }
function moveInList(id, dir) {
  const q = queue(), i = q.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= q.length) return;
  [q[i], q[j]] = [q[j], q[i]];
  saveMany(q.map((x, n) => ({ ...x, queuePos: n + 1 })));
}
function saveProgress(id) {
  const it = byId(id), el = document.getElementById("pg-" + id); if (!it || !el) return;
  let n = Math.max(0, Math.floor(+el.value || 0)); if (it.pages) n = Math.min(n, it.pages);
  const delta = n - (it.curPage || 0);
  saveItem({ ...it, curPage: n, startedOn: it.startedOn || today() });
  if (delta > 0) logPages(id, delta);
  toast(it.pages && n >= it.pages ? "That is the last page. Tap Finished when you are done." : "Progress saved");
}
function openFinish(id) {
  const it = byId(id); if (!it) return;
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="finishform" role="dialog" aria-modal="true" aria-label="Finish book" style="width:min(420px,100%)">
    <h2>Finished “${esc(it.title)}”</h2>
    <div class="grid2"><label>Finished on<input type="date" id="fin-date" value="${today()}" required></label>
    <label>Rating<select id="fin-rating">${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}"${(it.rating || 0) === n ? " selected" : ""}>${n ? "★".repeat(n) : "No rating"}</option>`).join("")}</select></label></div>
    <div class="acts"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Mark finished</button></div></form></div>`;
  document.getElementById("finishform").onsubmit = e => {
    e.preventDefault();
    const date = document.getElementById("fin-date").value || today();
    const rest = it.pages ? Math.max(0, it.pages - (it.curPage || 0)) : 0;
    saveItem({ ...it, read: "read", finishedOn: date, rating: +document.getElementById("fin-rating").value, curPage: it.pages || it.curPage || 0, startedOn: it.startedOn || date, queued: false, queuePos: null });
    if (rest > 0) logPages(id, rest);
    closeModal(); toast("Finished. Nice one.");
  };
  document.getElementById("fin-date").focus();
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "rd-start") startReading(id);
  else if (a === "rl-add") addToList(id);
  else if (a === "rl-remove") removeFromList(id);
  else if (a === "rl-up") moveInList(id, -1);
  else if (a === "rl-down") moveInList(id, 1);
  else if (a === "rd-progress") saveProgress(id);
  else if (a === "rd-finish") openFinish(id);
  else if (a === "goal-save") { const v = Math.floor(+document.getElementById("goal-target").value); if (v > 0 && v < 1000) saveGoal(S.readYear, v); else toast("Enter a goal between 1 and 999 books."); }
});
document.addEventListener("input", e => { if (e.target.id === "rl-q") updateListSearch(); });
document.addEventListener("change", e => { if (e.target.id === "rd-year") { S.readYear = +e.target.value; render(); } });

/* CSV helpers: accept 2026-03-14 or 2026/03/14 (Goodreads), ignore anything else. */
function dateOnly(v) { const m = String(v || "").trim().replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? m[1] + "-" + pad2(+m[2]) + "-" + pad2(+m[3]) : ""; }
function readVal(v) { const s = norm(v).trim(); return s === "read" || s === "reading" ? s : s === "currently-reading" ? "reading" : "unread"; }
