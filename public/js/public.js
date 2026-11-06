/* Friends page: browse only. Reads the public_items view, which never holds private fields. */
const PREF = (() => { try { return JSON.parse(localStorage.getItem("shelf-prefs") || "{}"); } catch (e) { return {}; } })();
const P = { items: [], tab: "browse", q: "", kind: "all", lang: "all", cat: "all", stat: "all", letter: "", loc: "",
  sort: "title", view: PREF.view || "list", size: PREF.size || 25, page: 1,
  night: { players: 6, mins: 60, cx: "any", kind: "any" }, ready: false };
function savePrefs() { try { localStorage.setItem("shelf-prefs", JSON.stringify({ view: P.view, size: P.size })); } catch (e) {} }

/* ---------- Contact links ---------- */
function askLink(i, short) {
  const mode = CFG.REQUEST_MODE || "app", out = [];
  if (mode === "app" || mode === "both") out.push(`<button class="btn small ask" data-req="${esc(i.id)}">${short ? "Request" : "Request to borrow"}</button>`);
  if (mode === "whatsapp" || mode === "both") {
    const text = `Hi ${CFG.OWNER_NAME || ""}, can I borrow "${i.title}" (${callNumber(i)})?`.replace("Hi ,", "Hi,");
    const raw = String(CFG.CONTACT_WHATSAPP || ""), wa = raw.replace(/\D/g, "");
    if (wa && !/X/i.test(raw)) out.push(`<a class="btn small ask" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}">${short ? "WhatsApp" : "Ask on WhatsApp"}</a>`);
    if (CFG.CONTACT_EMAIL) out.push(`<a class="btn small ask" href="mailto:${encodeURIComponent(CFG.CONTACT_EMAIL)}?subject=${encodeURIComponent("Borrowing: " + i.title)}&body=${encodeURIComponent(text)}">${short ? "Email" : "Ask by email"}</a>`);
  }
  return out.join(" ");
}

/* ---------- Sorting keys and letters (leading "The/A/An" ignored, like a library shelf) ---------- */
const stripArticle = t => String(t || "").replace(/^\s*(the|a|an)\s+/i, "").trim();
function letterOf(s) {
  const c = String(s || "").trim().charAt(0);
  if (!c) return "#";
  if (/[ఀ-౿]/.test(c)) return "TE";
  return /[A-Za-z]/.test(c) ? c.toUpperCase() : "#";
}
const keyTitle = i => stripArticle(i.title);
const keyAuthor = i => String(i.creator || "").trim();
const sortKeyFor = i => P.sort === "author" ? keyAuthor(i) : keyTitle(i);
const SORTS = [["title","Title A–Z"],["title-desc","Title Z–A"],["author","Author A–Z"],["newest","Newest added"],["shelf","Shelf"]];
const cmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

let qCache = { q: null, toks: [] };
function queryTokens() { if (qCache.q !== P.q) qCache = { q: P.q, toks: phon(P.q).split(" ").filter(Boolean) }; return qCache.toks; }
function matches(i, skip) {
  if (P.kind !== "all" && i.kind !== P.kind) return false;
  if (P.lang !== "all" && (i.kind !== "book" || i.lang !== P.lang)) return false;
  if (skip !== "cat" && P.cat !== "all" && i.cat !== P.cat) return false;
  if (P.loc && String(i.loc || "").toUpperCase() !== P.loc) return false;
  if (P.stat === "shelf" && i.status === "lent") return false;
  if (skip !== "letter" && P.letter && (P.sort === "title" || P.sort === "title-desc" || P.sort === "author") && letterOf(sortKeyFor(i)) !== P.letter) return false;
  const toks = queryTokens(); if (!toks.length) return true;
  if (!i._k) i._k = phon([i.title, i.titleEn, i.creator, i.creatorEn, i.cat, catLabel(i), i.loc, i.series, callNumber(i)].join(" "));
  return toks.every(t => i._k.includes(t));
}
function sorted(list) {
  const s = P.sort, out = list.slice();
  if (s === "title") out.sort((a, b) => cmp(keyTitle(a), keyTitle(b)));
  else if (s === "title-desc") out.sort((a, b) => cmp(keyTitle(b), keyTitle(a)));
  else if (s === "author") out.sort((a, b) => (!keyAuthor(a) - !keyAuthor(b)) || cmp(keyAuthor(a), keyAuthor(b)) || cmp(keyTitle(a), keyTitle(b)));
  else if (s === "newest") out.sort((a, b) => cmp(b.createdAt || "", a.createdAt || "") || cmp(keyTitle(a), keyTitle(b)));
  else if (s === "shelf") out.sort((a, b) => (!a.loc - !b.loc) || cmp(a.loc || "", b.loc || "") || cmp(keyTitle(a), keyTitle(b)));
  return out;
}

/* ---------- Cards and rows ---------- */
function chipsFor(i) {
  const m = [];
  if (i.status === "lent") m.push(`<span class="chip lent">Lent out</span>`);
  if (i.kind === "book") m.push(`<span class="chip">${esc(i.lang)}</span>`);
  else { m.push(`<span class="chip">${esc(i.gtype)}</span>`); if (i.pmin) m.push(`<span class="chip">${i.pmin}${i.pmax && i.pmax !== i.pmin ? "–" + i.pmax : ""} players</span>`); if (i.mins) m.push(`<span class="chip">${i.mins} min</span>`); }
  const c = catLabel(i); if (c) m.push(`<span class="chip">${esc(c)}</span>`);
  if (i.series) m.push(`<span class="chip">${esc(i.series)}${i.seriesNo != null ? " #" + esc(i.seriesNo) : ""}</span>`);
  if (i.pick) m.push(`<span class="chip">★ Pick</span>`);
  return m.join("");
}
const coverImg = (i, cls) => i.coverUrl ? `<img class="cover ${cls}" src="${esc(i.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "";
function pcard(i, note) {
  return `<article class="card${i.coverUrl ? " has-cover" : ""}">${coverImg(i, "c-card")}<div class="call"><span>${esc(callNumber(i))}</span><span>${esc(i.loc || "")}</span></div>
    <h3>${esc(i.title)}</h3>${i.titleEn ? `<div class="by">${esc(i.titleEn)}</div>` : ""}${i.creator ? `<div class="by">${esc(i.creator)}${i.creatorEn ? " · " + esc(i.creatorEn) : ""}</div>` : ""}
    ${note ? `<p class="pick">“${esc(note)}”</p>` : ""}<div class="meta">${chipsFor(i)}</div><div class="acts">${askLink(i)}</div></article>`;
}
function prow(i) {
  return `<div class="row"><div class="r-main">${coverImg(i, "c-row")}<div class="r-text"><strong>${esc(i.title)}</strong>${i.titleEn ? `<span class="by">${esc(i.titleEn)}</span>` : ""}${i.creator ? `<span class="by">${esc(i.creator)}${i.creatorEn ? " · " + esc(i.creatorEn) : ""}</span>` : ""}</div></div>
    <div class="r-meta">${chipsFor(i)}</div>
    <div class="r-side"><span class="r-loc" title="Shelf">${esc(i.loc || "")}</span><span class="r-ask">${askLink(i, true)}</span></div></div>`;
}

/* ---------- Browse: the controls are drawn once, the results region is redrawn on every change ---------- */
function pbrowse() {
  const o = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(t)}</option>`;
  return `<div class="bar">
      <input type="search" id="q" placeholder="Search title, author, category or shelf" value="${esc(P.q)}" aria-label="Search">
      <select id="f-kind" aria-label="Type">${o("all","Books and games",P.kind)}${o("book","Books",P.kind)}${o("game","Games",P.kind)}</select>
      <select id="f-lang" aria-label="Language">${o("all","Any language",P.lang)}${LANGS.map(l => o(l, l, P.lang)).join("")}</select>
      <select id="f-stat" aria-label="Availability">${o("all","Everything",P.stat)}${o("shelf","Available now",P.stat)}</select>
      <select id="f-sort" aria-label="Sort by">${SORTS.map(([v, t]) => o(v, "Sort: " + t, P.sort)).join("")}</select>
    </div>
    <div class="catbar" id="catbar" aria-label="Categories"></div>
    <div class="az" id="az" aria-label="Jump to letter"></div>
    <div class="active" id="active"></div>
    <div class="bar" style="align-items:center;margin-bottom:8px">
      <p class="count" id="count" style="margin:0"></p>
      <div class="seg viewtog" role="group" aria-label="View"><button data-view="list" aria-pressed="${P.view === "list"}">List</button><button data-view="cards" aria-pressed="${P.view === "cards"}">Cards</button></div>
      <select id="f-size" aria-label="Items per page" style="width:auto">${[25, 50, 100].map(n => o(n, n + " per page", P.size)).join("")}</select>
    </div>
    <div id="results"></div><div class="pager" id="pager"></div>`;
}
function pupdate() {
  if (!document.getElementById("results")) return;
  // category chips with counts (counts ignore the category filter itself, so you can switch)
  const counts = {}; let total = 0;
  P.items.forEach(i => { if (matches(i, "cat") && i.cat) { counts[i.cat] = (counts[i.cat] || 0) + 1; total++; } });
  const labelOf = c => (BOOK_CLASSES.find(b => b[0] === c) || [c, c])[1];
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (P.cat !== "all" && !counts[P.cat]) cats.unshift(P.cat);
  document.getElementById("catbar").innerHTML =
    `<button class="catbtn" data-cat="all" aria-pressed="${P.cat === "all"}">All<span class="n">${total}</span></button>` +
    cats.map(c => `<button class="catbtn" data-cat="${esc(c)}" aria-pressed="${P.cat === c}">${esc(labelOf(c))}<span class="n">${counts[c] || 0}</span></button>`).join("");
  // A–Z jump bar, only when sorting by title or author
  const az = document.getElementById("az"), byLetter = P.sort === "title" || P.sort === "title-desc" || P.sort === "author";
  if (byLetter) {
    const have = new Set(P.items.filter(i => matches(i, "letter")).map(i => letterOf(sortKeyFor(i))));
    const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].concat(["#", "TE"]);
    az.hidden = false;
    az.innerHTML = `<button data-letter="" aria-pressed="${!P.letter}">All</button>` + letters.map(l => `<button data-letter="${l}" aria-pressed="${P.letter === l}"${have.has(l) || P.letter === l ? "" : " disabled"}>${l === "TE" ? "తె" : l}</button>`).join("");
  } else { az.hidden = true; az.innerHTML = ""; }
  // results
  const list = sorted(P.items.filter(i => matches(i)));
  const pages = Math.max(1, Math.ceil(list.length / P.size));
  if (P.page > pages) P.page = pages;
  const start = (P.page - 1) * P.size, shown = list.slice(start, start + P.size);
  document.getElementById("count").textContent = list.length
    ? (list.length === P.items.length ? list.length + " items" : list.length + " of " + P.items.length + " items") + " · showing " + (start + 1) + "–" + (start + shown.length)
    : "No matches";
  const r = document.getElementById("results");
  r.innerHTML = !shown.length ? `<div class="empty">Nothing matches. Try fewer words, or clear the filters.</div>`
    : P.view === "cards" ? `<div class="list">${shown.map(pcard).join("")}</div>` : `<div class="rows">${shown.map(prow).join("")}</div>`;
  // active filters
  const act = [];
  if (P.kind !== "all") act.push(["kind", P.kind === "book" ? "Books" : "Games"]);
  if (P.lang !== "all") act.push(["lang", P.lang]);
  if (P.stat === "shelf") act.push(["stat", "Available now"]);
  if (P.cat !== "all") act.push(["cat", labelOf(P.cat)]);
  if (P.loc) act.push(["loc", "Shelf " + P.loc]);
  if (P.letter) act.push(["letter", "Starts with " + (P.letter === "TE" ? "తె" : P.letter)]);
  if (P.q.trim()) act.push(["q", "“" + P.q.trim() + "”"]);
  document.getElementById("active").innerHTML = act.length ? act.map(([k, t]) => `<span class="chip">${esc(t)}<button data-clear="${k}" aria-label="Remove filter ${esc(t)}">×</button></span>`).join("") + `<button class="btn small" data-clear="all">Clear all</button>` : "";
  // pager
  const pg = document.getElementById("pager");
  pg.innerHTML = pages <= 1 ? "" : `<button class="btn" data-page="${P.page - 1}"${P.page <= 1 ? " disabled" : ""}>Previous</button>
    <label style="flex-direction:row;align-items:center;gap:8px">Page <select id="pg" aria-label="Page">${Array.from({ length: pages }, (_, k) => `<option value="${k + 1}"${k + 1 === P.page ? " selected" : ""}>${k + 1}</option>`).join("")}</select> of ${pages}</label>
    <button class="btn" data-page="${P.page + 1}"${P.page >= pages ? " disabled" : ""}>Next</button>`;
}
function toResultsTop() { const el = document.getElementById("count"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }

/* ---------- Game night ---------- */
function ppicks() {
  const picks = P.items.filter(i => i.pick).sort((a, b) => cmp(keyTitle(a), keyTitle(b)));
  return `<p class="hero">${esc(CFG.OWNER_NAME ? CFG.OWNER_NAME + "'s" : "The owner's")} recommendations, each with a line on why. Tap Request to borrow one.</p>
    <p class="count">${picks.length} pick${picks.length === 1 ? "" : "s"}</p><div class="list">${picks.map(i => pcard(i, i.pickNote)).join("")}</div>`;
}
function pnight() {
  const n = P.night, games = P.items.filter(i => i.kind === "game");
  const fits = games.filter(g => (g.pmin || 1) <= n.players && (g.pmax || 99) >= n.players && (g.mins || 0) <= n.mins &&
    (n.cx === "any" || g.cx === n.cx) && (n.kind === "any" || g.gtype === n.kind) && g.status !== "lent");
  const o = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${t}</option>`;
  return `<div class="panel"><h2>What can we play?</h2><div class="grid2">
    <label>Players<input type="number" id="n-players" min="1" max="30" value="${n.players}"></label>
    <label>Minutes available<input type="number" id="n-mins" min="10" max="600" step="10" value="${n.mins}"></label>
    <label>Weight<select id="n-cx">${o("any","Any",n.cx)}${o("Light","Light",n.cx)}${o("Medium","Medium",n.cx)}${o("Heavy","Heavy",n.cx)}</select></label>
    <label>Kind<select id="n-kind">${o("any","Board and card",n.kind)}${o("Board game","Board games",n.kind)}${o("Card game","Card games",n.kind)}</select></label></div></div>
    <p class="count">${fits.length} of ${games.length} games fit</p>
    <div class="list">${fits.map(i => pcard(i)).join("") || `<div class="empty" style="grid-column:1/-1">No game fits that group. Try more minutes or any weight.</div>`}</div>`;
}

/* ---------- Page ---------- */
function prender() {
  const view = document.getElementById("view");
  document.getElementById("tabs").innerHTML = [["browse", "Browse"], ...(P.items.some(i => i.pick) ? [["picks", "Picks"]] : []), ["night", "Game night"]].map(([k, t]) =>
    `<button class="tab" role="tab" aria-selected="${P.tab === k}" data-tab="${k}">${t}${k === "browse" && P.items.length ? `<span class="n">${P.items.length}</span>` : ""}</button>`).join("");
  if (!P.ready) { view.innerHTML = `<div class="empty">Loading the shelves…</div>`; return; }
  if (!P.items.length) { view.innerHTML = `<div class="empty"><h2>Nothing to show yet</h2><p>Nothing has been added to the shared shelves.</p></div>`; return; }
  const had = document.activeElement && document.activeElement.id;
  view.innerHTML = P.tab === "browse" ? pbrowse() : P.tab === "picks" ? ppicks() : pnight();
  if (P.tab === "browse") pupdate();
  if (had) { const el = document.getElementById(had); if (el) { el.focus(); if (el.type === "search") { const n = el.value.length; el.setSelectionRange(n, n); } } }
}
function resetPage() { P.page = 1; }
document.addEventListener("click", e => {
  const t = e.target.closest("[data-tab],[data-cat],[data-letter],[data-clear],[data-view],[data-page],[data-req],[data-close]"); if (!t) return;
  const d = t.dataset;
  if (d.req) { openRequest(d.req); return; }
  if (d.close !== undefined) { if (t.classList.contains("scrim") && e.target !== t) return; closeModal(); return; }
  if (d.tab) { P.tab = d.tab; prender(); return; }
  if (d.cat !== undefined) { P.cat = d.cat; resetPage(); pupdate(); }
  else if (d.letter !== undefined) { P.letter = d.letter; resetPage(); pupdate(); }
  else if (d.view) { P.view = d.view; savePrefs(); document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === P.view))); pupdate(); }
  else if (d.page) { P.page = +d.page; pupdate(); toResultsTop(); }
  else if (d.clear) {
    if (d.clear === "all") { P.q = ""; P.kind = "all"; P.lang = "all"; P.stat = "all"; P.cat = "all"; P.letter = ""; P.loc = ""; if (location.search) history.replaceState(null, "", location.pathname); }
    else { P[d.clear] = ["q", "letter", "loc"].includes(d.clear) ? "" : "all"; if (d.clear === "loc" && location.search) history.replaceState(null, "", location.pathname); }
    resetPage(); prender();
  }
});
document.addEventListener("input", e => {
  const id = e.target.id || "";
  if (id === "q") { P.q = e.target.value; resetPage(); pupdate(); }
  else if (id.startsWith("n-")) { const k = id.slice(2); P.night[k] = (k === "players" || k === "mins") ? (+e.target.value || 1) : e.target.value; clearTimeout(P._t); P._t = setTimeout(prender, 300); }
});
document.addEventListener("change", e => {
  const id = e.target.id || "", v = e.target.value;
  if (id === "f-kind") { P.kind = v; resetPage(); pupdate(); }
  else if (id === "f-lang") { P.lang = v; resetPage(); pupdate(); }
  else if (id === "f-stat") { P.stat = v; resetPage(); pupdate(); }
  else if (id === "f-sort") { P.sort = v; if (!(v === "title" || v === "title-desc" || v === "author")) P.letter = ""; resetPage(); pupdate(); }
  else if (id === "f-size") { P.size = +v; savePrefs(); resetPage(); pupdate(); }
  else if (id === "pg") { P.page = +v; pupdate(); toResultsTop(); }
});
/* ---------- Borrow request form ---------- */
function closeModal() { const m = document.getElementById("modal"); if (m) m.innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
document.addEventListener("error", e => { const el = e.target; if (el && el.classList && el.classList.contains("cover")) { const c = el.closest(".card"); if (c) c.classList.remove("has-cover"); el.remove(); } }, true);
function reqLog() { try { return JSON.parse(localStorage.getItem("shelf-reqlog") || "{}"); } catch (e) { return {}; } }
function openRequest(id) {
  const it = P.items.find(i => i.id === id); if (!it) return;
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("shelf-who") || "{}"); } catch (e) {}
  const owner = CFG.OWNER_NAME || "the owner";
  document.getElementById("modal").innerHTML = `<div class="scrim" data-close><form class="sheet" id="reqform" role="dialog" aria-modal="true" aria-label="Request to borrow" style="width:min(460px,100%)">
    <h2>Request “${esc(it.title)}”</h2>
    ${it.status === "lent" ? `<p class="note" style="margin-top:0">It is lent out right now. Your request still goes through, and ${esc(owner)} will let you know when it is back.</p>` : ""}
    <label style="margin-bottom:10px">Your name<input type="text" id="rq-name" required maxlength="80" value="${esc(saved.name || "")}" autocomplete="name"></label>
    <label style="margin-bottom:10px">WhatsApp number or email<input type="text" id="rq-contact" required maxlength="120" value="${esc(saved.contact || "")}" autocomplete="off"></label>
    <label>Message (optional)<textarea id="rq-msg" rows="2" maxlength="500"></textarea></label>
    <div style="position:absolute;left:-9999px" aria-hidden="true"><label>Website<input type="text" id="rq-web" tabindex="-1" autocomplete="off"></label></div>
    <p id="rq-err" role="alert" style="color:var(--bad);margin:8px 0 0" hidden></p>
    <div class="acts"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" id="rq-send">Send request</button></div></form></div>`;
  const err = document.getElementById("rq-err"), btn = document.getElementById("rq-send");
  const fail = m => { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = "Send request"; };
  const done = name => { document.getElementById("reqform").innerHTML = `<h2>Request sent</h2><p>Thanks${name ? ", " + esc(name.split(" ")[0]) : ""}. ${esc(owner)} will get in touch about “${esc(it.title)}”.</p><div class="acts"><button type="button" class="btn primary" data-close>Close</button></div>`; };
  document.getElementById("reqform").onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const name = document.getElementById("rq-name").value.trim(), contact = document.getElementById("rq-contact").value.trim(), message = document.getElementById("rq-msg").value.trim();
    if (document.getElementById("rq-web").value) return done(name);          // a bot filled the hidden field: pretend it worked
    if (!name) return fail("Please tell me your name.");
    if (contact.length < 3) return fail("Please add a WhatsApp number or email so I can reach you.");
    const log = reqLog(), day = ymd(new Date());
    if (log.last && Date.now() - log.last < 15000) return fail("Please wait a few seconds before sending another.");
    if (log.day === day && log.n >= 5) return fail("You have sent several requests today. Please try again tomorrow.");
    btn.disabled = true; btn.textContent = "Sending…";
    const { error } = await sb.from("borrow_requests").insert({ item_id: it.id, requester_name: name, contact, message: message || null });
    if (error) return fail(error.message && error.message.length < 140 && !/violates|policy|constraint/i.test(error.message) ? error.message : "Could not send the request. Please try again later.");
    try { localStorage.setItem("shelf-who", JSON.stringify({ name, contact })); localStorage.setItem("shelf-reqlog", JSON.stringify({ last: Date.now(), day, n: (log.day === day ? log.n : 0) + 1 })); } catch (e2) {}
    done(name);
  };
  document.getElementById("rq-name").focus();
}
async function pstart() {
  document.title = CFG.LIBRARY_NAME || "Shelf Register";
  document.getElementById("title").textContent = CFG.LIBRARY_NAME || "Shelf Register";
  if (!sb) { document.getElementById("view").innerHTML = `<div class="empty"><h2>Not connected yet</h2><p>The owner still needs to add the Supabase details in config.js.</p></div>`; return; }
  const sp = new URLSearchParams(location.search).get("shelf"); if (sp) P.loc = sp.trim().toUpperCase();
  prender();
  try { P.items = (await fetchAll("public_items", "title")).map(fromRow); }
  catch (e) { document.getElementById("view").innerHTML = `<div class="empty"><h2>Could not load the shelves</h2><p>Check your connection and reload.</p></div>`; return; }
  P.ready = true; prender();
  const lentN = P.items.filter(i => i.status === "lent").length;
  setStatus(P.items.length + " items" + (lentN ? " · " + lentN + " lent out" : ""));
}
pstart();
