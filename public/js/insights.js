"use strict";
/* Insights tab: analyses the whole library, learns your taste from finished books,
   and suggests what to read next. Everything is worked out in your browser from your own data. */

const aKey = a => nameTokens(a).join(" ");
const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const catName = c => { const x = BOOK_CLASSES.find(k => k[0] === c); return x ? x[1] : (c || "Uncategorised"); };
function bar(p, label) { return `<div class="prog" role="img" aria-label="${esc(label)}" style="height:8px"><span style="width:${Math.max(0, Math.min(100, p))}%"></span></div>`; }

/* ---------- Taste: what the finished books say about you ---------- */
function tasteProfile() {
  const done = books().filter(b => b.read === "read");
  const w = b => b.rating > 0 ? (b.rating - 2) / 3 : 0.5;          // 5 stars = 1, 3 stars = 0.33, 1 star = negative, unrated = 0.5
  const cat = {}, auth = {}, lang = {}, bestBy = {};
  const recentCut = ymd(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  const recent = done.filter(b => b.finishedOn && b.finishedOn >= recentCut), langSrc = recent.length >= 3 ? recent : done;
  done.forEach(b => {
    cat[b.cat || ""] = (cat[b.cat || ""] || 0) + w(b);
    const k = aKey(b.creator); if (k) { auth[k] = (auth[k] || 0) + w(b); if (w(b) >= 0.66 && (!bestBy[k] || b.rating > bestBy[k].rating)) bestBy[k] = b; }
  });
  langSrc.forEach(b => { lang[b.lang] = (lang[b.lang] || 0) + 1; });
  const top = Math.max(0.01, ...Object.values(cat));
  const catNorm = Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, Math.max(0, v) / top]));
  const langShare = Object.fromEntries(Object.entries(lang).map(([k, v]) => [k, v / langSrc.length]));
  const pagesDone = done.filter(b => b.pages).map(b => b.pages);
  return { done, enough: done.length >= 3, catNorm, auth, bestBy, langShare, medPages: median(pagesDone), nPages: pagesDone.length,
    favCats: Object.entries(cat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    favAuthors: Object.entries(auth).filter(([k, v]) => v >= 0.66 && bestBy[k]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => bestBy[k].creator) };
}

/* ---------- Scoring unread books ---------- */
function candidates() { return books().filter(b => b.read === "unread" && b.status !== "lent"); }
function scoreBooks(t) {
  const startedNext = new Set(seriesInfo().filter(s => s.started && s.next).map(s => s.next.id));
  const g = goalFor(thisYear()), behind = g && paceFor(thisYear(), finishedIn(thisYear()).length, g.target).state === "behind";
  return candidates().map(b => {
    let s = 0; const why = [];
    if (startedNext.has(b.id)) { s += 5; why.push(`Next in ${b.series}`); }
    if (b.queued) { s += 3; why.push("On your reading list"); }
    const ak = aKey(b.creator);
    if (t.bestBy[ak] && t.auth[ak] >= 0.66) { s += 4; why.push(`You liked ${t.bestBy[ak].title}`); }
    const cn = t.catNorm[b.cat || ""];
    if (t.enough && cn > 0.3) { s += 3 * cn; if (cn > 0.6) why.push(`You enjoy ${catName(b.cat)}`); }
    const ls = t.langShare[b.lang]; if (ls) { s += 1.5 * ls; if (ls > 0.7 && t.enough) why.push(`You mostly read ${b.lang}`); }
    if (b.pages && t.medPages && t.nPages >= 3) { const c = 1 - Math.min(1, Math.abs(b.pages - t.medPages) / t.medPages); s += 1.5 * c; if (c > 0.75) why.push(`About your usual length (${b.pages} pages)`); }
    if (behind && b.pages && b.pages < 250) { s += 2; why.push("Short, helps you catch up on your goal"); }
    const yrs = b.createdAt ? (Date.now() - new Date(b.createdAt)) / 31557600000 : 0;
    if (yrs >= 1) { s += Math.min(2, yrs * 0.5); if (yrs >= 2) why.push(`Waiting on your shelf since ${new Date(b.createdAt).getFullYear()}`); }
    return { b, s, why };
  }).sort((x, y) => y.s - x.s || x.b.title.localeCompare(y.b.title));
}
function topPicks(scored, n) {              // at most two books by the same author, so the list stays varied
  const out = [], per = {};
  for (const x of scored) { const k = aKey(x.b.creator) || x.b.id; if ((per[k] || 0) >= 2) continue; per[k] = (per[k] || 0) + 1; out.push(x); if (out.length >= n) break; }
  return out;
}
function branchOut(t) {                     // categories you own plenty of but have barely read
  const all = books(), by = {};
  all.forEach(b => { const k = b.cat || ""; (by[k] = by[k] || { own: 0, read: 0, list: [] }); by[k].own++; if (b.read === "read") by[k].read++; else if (b.read === "unread" && b.status !== "lent") by[k].list.push(b); });
  return Object.entries(by).filter(([, v]) => v.list.length >= 5 && v.read / v.own < 0.05).sort((a, b) => b[1].list.length - a[1].list.length).slice(0, 3)
    .map(([k, v]) => ({ cat: k, own: v.own, pick: v.list.slice().sort((a, b) => (a.pages || 9999) - (b.pages || 9999) || a.title.localeCompare(b.title))[0] }));
}

/* ---------- Rendering ---------- */
function pickRow(x, i) {
  const b = x.b;
  return `<div class="rbook"><div><strong>${i != null ? i + 1 + ". " : ""}${esc(b.title)}</strong><div class="note">${esc(b.creator)}${b.pages ? " · " + b.pages + " pages" : ""} · shelf ${esc(b.loc || "not set")}</div>
    ${x.why && x.why.length ? `<div class="meta" style="padding:6px 0 0">${x.why.slice(0, 3).map(w => `<span class="chip">${esc(w)}</span>`).join("")}</div>` : ""}</div>
    <div class="inline"><button class="btn small primary" data-act="rd-start" data-id="${b.id}">Start</button>${b.queued ? "" : `<button class="btn small" data-act="rl-add" data-id="${b.id}">Add to reading list</button>`}</div></div>`;
}
function snapshotPanel() {
  const all = S.items, bk = books(), gm = all.filter(i => i.kind === "game");
  const read = bk.filter(b => b.read === "read").length, unread = bk.filter(b => b.read === "unread").length, rd = bk.filter(b => b.read === "reading").length;
  const te = bk.filter(b => b.lang === "Telugu").length, noPages = bk.filter(b => !b.pages).length, noShelf = all.filter(i => !i.loc).length;
  const tile = (k, v, n) => `<div class="stat"><span>${k}</span><div class="big">${v}</div>${n ? `<span class="note">${n}</span>` : ""}</div>`;
  const yearsToRead = unread && finishedIn(thisYear()).length ? Math.round(unread / Math.max(1, finishedIn(thisYear()).length) * 10) / 10 : null;
  return `<div class="panel"><h2>Your library at a glance</h2><div class="stats">
    ${tile("Books", bk.length.toLocaleString("en-IN"), te + " Telugu, " + (bk.length - te) + " English")}${tile("Games", gm.length.toLocaleString("en-IN"))}
    ${tile("Read", read.toLocaleString("en-IN"), pct(read, bk.length) + "% of your books")}${tile("Still unread", unread.toLocaleString("en-IN"), rd ? rd + " in progress" : "")}
    ${tile("Lent out", all.filter(i => i.status === "lent").length)}${tile("Borrowed from others", (S.borrowed || []).filter(b => !b.returned_on).length)}</div>
    ${yearsToRead ? `<p style="margin:10px 0 0">At this year's pace (${finishedIn(thisYear()).length} books so far), your unread books would take about <strong>${yearsToRead} years</strong> to finish. Buying fewer and reading more is a fair plan.</p>` : ""}
    ${noPages || noShelf ? `<p class="note" style="margin:8px 0 0">${noPages ? noPages + " books have no page count, so length-based picks skip them. " : ""}${noShelf ? noShelf + " items have no shelf code." : ""}</p>` : ""}</div>`;
}
function tastePanel(t) {
  if (!t.enough) return `<div class="panel"><h2>Your reading taste</h2><p class="note" style="margin:0">I need at least 3 finished books to learn your taste. Mark books as read in the catalog, ideally with a rating and a finish date. Until then, picks come from your reading list, series and how long books have waited.</p></div>`;
  const lang = Object.entries(t.langShare).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + Math.round(v * 100) + "%").join(", ");
  return `<div class="panel"><h2>Your reading taste</h2><ul style="margin:0;padding-left:20px;display:grid;gap:4px">
    <li>You have finished <strong>${t.done.length}</strong> books.</li>
    ${t.favCats.length ? `<li>Favourite shelves: <strong>${t.favCats.map(c => esc(catName(c))).join(", ")}</strong>. Ratings count, so books you rated highly pull harder.</li>` : ""}
    ${t.favAuthors.length ? `<li>Authors you rate highly: <strong>${t.favAuthors.map(esc).join(", ")}</strong>.</li>` : ""}
    <li>Recently you read ${esc(lang)}.</li>
    ${t.medPages ? `<li>Typical length: about <strong>${Math.round(t.medPages)}</strong> pages.</li>` : ""}</ul></div>`;
}
function collectionPanel() {
  const bk = books(), by = {};
  bk.forEach(b => { const k = b.cat || ""; (by[k] = by[k] || { own: 0, read: 0 }); by[k].own++; if (b.read === "read") by[k].read++; });
  const rows = Object.entries(by).sort((a, b) => b[1].own - a[1].own), max = Math.max(1, ...rows.map(r => r[1].own));
  return `<div class="panel"><h2>Your books by shelf class</h2>${rows.length ? rows.map(([k, v]) => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(catName(k))}</span><span class="note">${v.own} owned · ${v.read} read (${pct(v.read, v.own)}%)</span></div>${bar(v.own / max * 100, catName(k) + ": " + v.own + " books")}</div>`).join("") : `<p class="note" style="margin:0">No books yet.</p>`}</div>`;
}
function gamesPanel() {
  const gm = S.items.filter(i => i.kind === "game");
  if (!gm.length) return `<div class="panel"><h2>Your games</h2><p class="note" style="margin:0">No games catalogued yet.</p></div>`;
  const count = f => gm.filter(f).length, sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const fit = n => count(g => (g.pmin || 1) <= n && (g.pmax || 1) >= n), max = Math.max(1, ...sizes.map(fit));
  const big = gm.filter(g => (g.pmax || 1) >= 7 && g.status !== "lent").sort((a, b) => (b.pmax || 0) - (a.pmax || 0) || a.title.localeCompare(b.title));
  const low = sizes.filter(n => n >= 6 && n <= 8 && fit(n) < 5);
  const mix = (arr, f) => arr.map(([k, t]) => `${t}: <strong>${count(f(k))}</strong>`).join(" · ");
  return `<div class="panel"><h2>Your games</h2>
    <p style="margin:0 0 6px">${gm.length} games · ${mix([["Board game", "Board"], ["Card game", "Card"]], k => g => g.gtype === k)}</p>
    <p style="margin:0 0 10px">By weight: ${mix([["Light", "Light"], ["Medium", "Medium"], ["Heavy", "Heavy"]], k => g => g.cx === k)} · By time: ${[["under 30 min", g => (g.mins || 0) < 30], ["30 to 60", g => g.mins >= 30 && g.mins <= 60], ["over 60", g => g.mins > 60]].map(([t, f]) => `${t}: <strong>${count(f)}</strong>`).join(" · ")}</p>
    <h3 style="margin:0 0 4px">How many games work for each group size</h3>
    ${sizes.map(n => `<div style="display:grid;grid-template-columns:70px 1fr 32px;gap:10px;align-items:center;margin:4px 0"><span class="note">${n} players</span>${bar(fit(n) / max * 100, n + " players: " + fit(n) + " games")}<span class="mono">${fit(n)}</span></div>`).join("")}
    <p style="margin:10px 0 0">${low.length ? `<span class="behind">Thin spots for your weekly group:</span> only ${low.map(n => fit(n) + " game" + (fit(n) === 1 ? "" : "s") + " for " + n + " players").join(", ")}. Look for party or team games when you next buy.` : "You are well covered for groups of 6 to 8."}</p>
    ${big.length ? `<details style="margin-top:8px"><summary>${big.length} on the shelf that take 7 or more players</summary><div class="meta" style="padding:8px 0 0">${big.slice(0, 40).map(g => `<span class="chip">${esc(g.title)} (${g.pmin || 1}–${g.pmax})</span>`).join("")}</div></details>` : ""}</div>`;
}
function renderInsights() {
  const t = tasteProfile(), scored = scoreBooks(t), picks = topPicks(scored, 8), cy = thisYear();
  const g = goalFor(cy), done = finishedIn(cy).length, behind = g && paceFor(cy, done, g.target).state === "behind";
  const quick = behind ? scored.filter(x => x.b.pages && x.b.pages < 250).sort((a, b) => a.b.pages - b.b.pages).slice(0, 4).map(x => ({ ...x, why: [`${x.b.pages} pages`] })) : [];
  const out = branchOut(t).map(o => ({ b: o.pick, why: [`You own ${o.own} ${catName(o.cat)} books and have read none`] }));
  const old = candidates().filter(b => b.createdAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 5).map(b => ({ b, why: ["Added " + b.createdAt.slice(0, 10)] }));
  const sec = (title, note, list) => list.length ? `<div class="panel"><h2>${title}</h2><p class="note" style="margin:0 0 6px">${note}</p>${list.map((x, i) => pickRow(x, i)).join("")}</div>` : "";
  if (!books().length) return `<div class="empty"><h2>Nothing to analyse yet</h2><p>Add books and games, then mark what you have read. This tab learns your taste from that.</p></div>`;
  return snapshotPanel() + tastePanel(t) +
    (picks.length ? sec("Read next: top picks for you", t.enough ? "Ranked by your taste, series you have started, your reading list, usual length and how long a book has waited. Each one says why." : "Taste needs a few finished books. For now: series, reading list and books that have waited longest.", picks)
      : `<div class="panel"><h2>Read next</h2><p class="note" style="margin:0">No unread book is available. Everything is read, in progress or lent out.</p></div>`) +
    sec("Quick reads to catch up", `You are behind your ${cy} goal (${done} of ${g ? g.target : 0}). These short unread books are the fastest way back on pace.`, quick) +
    sec("Branch out", "Shelves you own plenty of but have barely touched. The shortest unread book from each.", out) +
    sec("Waiting the longest", "Unread books that have been in your library longest.", old) +
    collectionPanel() + gamesPanel();
}
