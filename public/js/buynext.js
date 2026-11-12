"use strict";
/* Buy next: a wishlist, plus suggestions for books you do not own yet.
   Suggestions come from Open Library's public catalogue, based on authors you rate highly and the shelves you enjoy,
   plus missing volumes of series you own. Nothing about your library is sent except an author name or a subject word. */
S.wish = []; S.buy = { loading: false, list: [], at: 0, msg: "" };
const BUY_CACHE = "shelf-buy-cache", BUY_DAYS = 7;
const SUBJECTS = { FIC: "fiction", BIO: "biography", KID: "children", "000": "reference", "100": "philosophy", "200": "religion", "300": "business", "400": "language", "500": "science", "600": "technology", "700": "art", "800": "literature", "900": "history" };

async function loadWishlist() { try { S.wish = await fetchAll("wishlist", "created_at"); } catch (e) { S.needSchema = true; } }
const wishWant = () => S.wish.filter(w => w.status === "want");
const wishSkip = () => S.wish.filter(w => w.status === "skip");

function owned(title, author) {
  const t = normTitle(title); if (!t) return false;
  return S.items.concat(S.trash || []).some(i => i.kind === "book" && (() => { const n = normTitle(i.title); return n && (n === t || (Math.min(n.length, t.length) >= 8 && (n.includes(t) || t.includes(n)))); })() && sameAuthor(i.creator, author));
}
const known = (title, author) => owned(title, author) || S.wish.some(w => normTitle(w.title) === normTitle(title));
const buyLinks = (title, author) => { const q = encodeURIComponent((title + " " + (author || "")).trim());
  return `<a class="btn small" target="_blank" rel="noopener" href="https://www.amazon.in/s?i=stripbooks&k=${q}">Amazon.in</a> <a class="btn small" target="_blank" rel="noopener" href="https://www.flipkart.com/search?q=${q}">Flipkart</a>`; };

/* ---------- Finding suggestions ---------- */
async function olSearch(params) {
  const r = await fetch("https://openlibrary.org/search.json?" + params + "&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average,ratings_count", { referrerPolicy: "no-referrer" });
  if (!r.ok) throw new Error("Open Library answered " + r.status);
  return (await r.json()).docs || [];
}
const coverOf = d => d.cover_i ? "https://covers.openlibrary.org/b/id/" + d.cover_i + "-M.jpg" : "";
async function buildSuggestions(onStep) {
  const t = tasteProfile(), out = [], seen = new Set();
  const add = x => { const k = normTitle(x.title); if (!k || seen.has(k)) return false; seen.add(k); out.push(x); return true; };
  // 1. missing volumes of series you own (no network needed)
  seriesInfo().forEach(s => s.missing.slice(0, 3).forEach(n => add({ title: s.name + ", book " + n, author: (s.list[0] && s.list[0].creator) || "", why: `You own ${s.list.length} of this series and are missing #${n}`, kind: "series" })));
  // 2. more from authors you rate highly
  const authors = Object.entries(t.auth).filter(([k, v]) => v >= 0.66 && t.bestBy[k]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => t.bestBy[k]);
  for (const b of authors) {
    onStep("Looking up more by " + b.creator + "…");
    const docs = (await olSearch("author=" + encodeURIComponent(b.creator) + "&sort=editions&limit=30")).filter(d => (d.author_name || []).some(a => sameAuthor(b.creator, a)));
    let n = 0; for (const d of docs) { if (n >= 3) break; if (!owned(d.title, b.creator) && add({ title: d.title, author: (d.author_name || [b.creator])[0], year: d.first_publish_year, cover: coverOf(d), why: `You rated ${b.title} highly`, kind: "author", editions: d.edition_count })) n++; }
    await new Promise(r => setTimeout(r, 300));
  }
  // 3. well-rated books in the shelves you enjoy (English only: Open Library knows few Telugu titles)
  for (const c of t.favCats.filter(c => SUBJECTS[c])) {
    onStep("Looking up popular " + catName(c).toLowerCase() + "…");
    const docs = (await olSearch("subject=" + encodeURIComponent(SUBJECTS[c]) + "&language=eng&sort=rating&limit=40")).filter(d => (d.ratings_count || 0) >= 100 && (d.ratings_average || 0) >= 4);
    let n = 0; for (const d of docs) { if (n >= 4) break; const au = (d.author_name || [""])[0]; if (!owned(d.title, au) && add({ title: d.title, author: au, year: d.first_publish_year, cover: coverOf(d), why: `Well rated in ${catName(c)} (${(+d.ratings_average).toFixed(1)} from ${d.ratings_count} readers)`, kind: "shelf" })) n++; }
    await new Promise(r => setTimeout(r, 300));
  }
  // 4. well-rated books in your favourite genres (your own tags, searched as subjects)
  for (const g of t.favTags.filter(x => /^[a-z][a-z \-&']{2,30}$/i.test(x)).slice(0, 3)) {
    onStep("Looking up popular " + g.toLowerCase() + "…");
    const docs = (await olSearch("subject=" + encodeURIComponent(g.toLowerCase()) + "&language=eng&sort=rating&limit=40")).filter(d => (d.ratings_count || 0) >= 100 && (d.ratings_average || 0) >= 4);
    let n = 0; for (const d of docs) { if (n >= 4) break; const au = (d.author_name || [""])[0]; if (!owned(d.title, au) && add({ title: d.title, author: au, year: d.first_publish_year, cover: coverOf(d), why: `You enjoy ${g} (${(+d.ratings_average).toFixed(1)} from ${d.ratings_count} readers)`, kind: "genre" })) n++; }
    await new Promise(r => setTimeout(r, 300));
  }
  return out;
}
async function findSuggestions(force) {
  const b = S.buy; if (b.loading) return;
  if (!force) { try { const c = JSON.parse(localStorage.getItem(BUY_CACHE) || "null"); if (c && Date.now() - c.at < BUY_DAYS * 864e5) { Object.assign(b, { list: c.list, at: c.at, msg: "" }); return render(); } } catch (e) {} }
  Object.assign(b, { loading: true, msg: "Starting…" }); render();
  try {
    const list = await buildSuggestions(m => { b.msg = m; const el = document.getElementById("buy-msg"); if (el) el.textContent = m; });
    Object.assign(b, { list, at: Date.now(), msg: list.length ? "" : "Nothing new found. Rate more finished books so I can learn your taste." });
    try { localStorage.setItem(BUY_CACHE, JSON.stringify({ at: b.at, list })); } catch (e) {}
  } catch (e) { b.msg = "Could not reach Open Library (" + e.message + "). Check your connection and try again."; }
  b.loading = false; render();
}

/* ---------- Wishlist actions ---------- */
async function wishAdd(row, status) {
  const { data, error } = await sb.from("wishlist").insert({ title: row.title, author: row.author || null, note: row.note || row.why || null, cover_url: row.cover || null, status: status || "want" }).select().single();
  if (error) return toast("Not saved: " + error.message);
  S.wish.push(data); render();
}
async function wishRemove(id) {
  const { error } = await sb.from("wishlist").delete().eq("id", id);
  if (error) return toast("Not removed: " + error.message);
  S.wish = S.wish.filter(w => w.id !== id); render();
}
function wishBought(item) {                  // called when a new book is saved: drops the matching wishlist entry
  const m = S.wish.filter(w => w.status === "want" && normTitle(w.title) === normTitle(item.title));
  m.forEach(w => wishRemove(w.id));
}

/* ---------- Screen ---------- */
function renderBuyNext() {
  const want = wishWant(), b = S.buy, sugg = b.list.filter(x => !known(x.title, x.author) && !wishSkip().some(w => normTitle(w.title) === normTitle(x.title)));
  const gm = S.items.filter(i => i.kind === "game"), fit = n => gm.filter(g => (g.pmin || 1) <= n && (g.pmax || 1) >= n).length;
  const thin = [6, 7, 8].filter(n => fit(n) < 5);
  const wishRows = want.map(w => `<div class="rbook"><div style="display:flex;gap:10px;align-items:flex-start">${w.cover_url ? `<img src="${esc(w.cover_url)}" alt="" style="width:44px;border-radius:3px" onerror="this.remove()" referrerpolicy="no-referrer">` : ""}<div><strong>${esc(w.title)}</strong><div class="note">${esc(w.author || "")}${w.note ? (w.author ? " · " : "") + esc(w.note) : ""}</div></div></div>
    <div class="inline">${buyLinks(w.title, w.author)} <button class="btn small primary" data-act="bn-bought" data-id="${w.id}">Bought it</button> <button class="btn small" data-act="bn-remove" data-id="${w.id}">Remove</button></div></div>`).join("");
  const suggRows = sugg.map((x, n) => `<div class="rbook"><div style="display:flex;gap:10px;align-items:flex-start">${x.cover ? `<img src="${esc(x.cover)}" alt="" style="width:44px;border-radius:3px" onerror="this.remove()" referrerpolicy="no-referrer">` : ""}<div><strong>${esc(x.title)}</strong><div class="note">${esc(x.author || "")}${x.year ? " · " + x.year : ""}</div><div class="meta" style="padding:6px 0 0"><span class="chip">${esc(x.why)}</span></div></div></div>
    <div class="inline"><button class="btn small primary" data-act="bn-want" data-i="${n}">Add to wishlist</button> ${buyLinks(x.title, x.author)} <button class="btn small" data-act="bn-skip" data-i="${n}">Not interested</button></div></div>`).join("");
  return `<div class="panel"><h2>Wishlist</h2>${wishRows || `<p class="note" style="margin:0 0 8px">Nothing on your wishlist. Add suggestions below, or type one in.</p>`}
    <form id="wishform" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));align-items:end;margin-top:10px">
      <label>Title<input type="text" id="wf-title" required></label><label>Author<input type="text" id="wf-author"></label><label>Note<input type="text" id="wf-note"></label><button class="btn" type="submit">Add</button></form>
    <p class="note" style="margin:8px 0 0">When you add a book to the catalog that matches a wishlist entry, it leaves the wishlist by itself.</p></div>
  <div class="panel"><h2>Books you might want to buy</h2>
    <p class="note" style="margin:0 0 8px">Looks up more books by authors you rate highly and well-rated books in the shelves you enjoy, from Open Library's public catalogue, and lists missing volumes of series you own. Books you already own are left out. It works best with several finished books that have ratings. English books only; Open Library knows few Telugu titles.</p>
    <div class="acts" style="padding:0;justify-content:flex-start;align-items:center"><button class="btn primary" data-act="bn-find"${b.loading ? " disabled" : ""}>${b.list.length ? "Refresh suggestions" : "Find suggestions"}</button>
      <span class="note" id="buy-msg" role="status">${esc(b.msg || (b.at ? "Last looked up " + new Date(b.at).toLocaleDateString("en-IN") + "." : ""))}</span></div>
    ${suggRows ? `<div style="margin-top:8px">${suggRows}</div>` : ""}</div>
  ${gm.length ? `<div class="panel"><h2>Games to look for</h2><p style="margin:0">${thin.length ? `You have few games for ${thin.map(n => n + " players (" + fit(n) + ")").join(", ")}. Party and team games work well for a group of 7 or 8.` : "You are well covered for groups of 6 to 8."}</p>
    ${thin.length ? `<div class="acts" style="padding:8px 0 0;justify-content:flex-start"><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent("best party board games for " + Math.max(...thin) + " players")}">Search ideas</a></div>` : ""}</div>` : ""}`;
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, sugg = () => S.buy.list.filter(x => !known(x.title, x.author) && !wishSkip().some(w => normTitle(w.title) === normTitle(x.title)))[+t.dataset.i];
  if (a === "bn-find") findSuggestions(false);
  else if (a === "bn-want") { const x = sugg(); if (x) wishAdd(x, "want"); }
  else if (a === "bn-skip") { const x = sugg(); if (x) wishAdd(x, "skip"); }
  else if (a === "bn-remove") wishRemove(t.dataset.id);
  else if (a === "bn-bought") { const w = S.wish.find(x => x.id === t.dataset.id); if (w) openForm(null, { kind: "book", title: w.title, creator: w.author || "", coverUrl: w.cover_url || "" }); }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "wishform") return; e.preventDefault();
  const g = x => document.getElementById(x).value.trim(), title = g("wf-title"); if (!title) return;
  if (known(title, g("wf-author"))) return toast(owned(title, g("wf-author")) ? "You already own that one." : "Already on your wishlist.");
  wishAdd({ title, author: g("wf-author"), note: g("wf-note") }, "want");
});