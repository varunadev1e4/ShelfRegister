/* Friends page: browse only. Reads the public_items view, which never holds private fields. */
const P = { items: [], tab: "browse", q: "", kind: "all", lang: "all", cat: "all", stat: "all",
  night: { players: 6, mins: 60, cx: "any", kind: "any" }, ready: false };

function askLink(i) {
  const text = `Hi ${CFG.OWNER_NAME || ""}, can I borrow "${i.title}" (${callNumber(i)})?`.replace("Hi ,", "Hi,");
  const out = [];
  const wa = String(CFG.CONTACT_WHATSAPP || "").replace(/\D/g, "");
  if (wa && !/^9?1?X+$/i.test(CFG.CONTACT_WHATSAPP)) out.push(`<a class="btn small ask" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}">Ask on WhatsApp</a>`);
  if (CFG.CONTACT_EMAIL) out.push(`<a class="btn small ask" href="mailto:${encodeURIComponent(CFG.CONTACT_EMAIL)}?subject=${encodeURIComponent("Borrowing: " + i.title)}&body=${encodeURIComponent(text)}">Ask by email</a>`);
  return out.join("");
}
function pcard(i) {
  const lent = i.status === "lent", meta = [];
  if (lent) meta.push(`<span class="chip lent">Lent out right now</span>`);
  if (i.kind === "book") meta.push(`<span class="chip">${esc(i.lang)}</span>`);
  else { meta.push(`<span class="chip">${esc(i.gtype)}</span>`); if (i.pmin) meta.push(`<span class="chip">${i.pmin}${i.pmax && i.pmax !== i.pmin ? "–" + i.pmax : ""} players</span>`); if (i.mins) meta.push(`<span class="chip">${i.mins} min</span>`); }
  const c = catLabel(i); if (c) meta.push(`<span class="chip">${esc(c)}</span>`);
  return `<article class="card"><div class="call"><span>${esc(callNumber(i))}</span><span>${esc(i.loc || "")}</span></div>
    <h3>${esc(i.title)}</h3>${i.creator ? `<div class="by">${esc(i.creator)}</div>` : ""}
    <div class="meta">${meta.join("")}</div><div class="acts">${askLink(i)}</div></article>`;
}
function pfiltered() {
  const q = norm(P.q).trim();
  return P.items.filter(i => {
    if (P.kind !== "all" && i.kind !== P.kind) return false;
    if (P.lang !== "all" && (i.kind !== "book" || i.lang !== P.lang)) return false;
    if (P.cat !== "all" && i.cat !== P.cat) return false;
    if (P.stat === "shelf" && i.status === "lent") return false;
    return !q || norm([i.title, i.creator, i.cat, i.loc, callNumber(i)].join(" ")).includes(q);
  }).sort((a, b) => norm(a.title).localeCompare(norm(b.title)));
}
function pbrowse() {
  const cats = [...new Set(P.items.map(i => i.cat).filter(Boolean))];
  const o = (v, t, cur) => `<option value="${esc(v)}"${cur === v ? " selected" : ""}>${esc(t)}</option>`;
  return `<p class="hero">Browse what is on ${esc(CFG.OWNER_NAME ? CFG.OWNER_NAME + "'s" : "the")} shelves. Found something? Use the ask button on its card.</p>
    <div class="bar"><input type="search" id="q" placeholder="Search title, author, category" value="${esc(P.q)}" aria-label="Search">
    <select id="f-kind" aria-label="Type">${o("all","Books and games",P.kind)}${o("book","Books",P.kind)}${o("game","Games",P.kind)}</select>
    <select id="f-lang" aria-label="Language">${o("all","Any language",P.lang)}${LANGS.map(l => o(l, l, P.lang)).join("")}</select>
    <select id="f-cat" aria-label="Category">${o("all","Any category",P.cat)}${cats.map(c => o(c, (BOOK_CLASSES.find(b => b[0] === c) || [c, c])[1], P.cat)).join("")}</select>
    <select id="f-stat" aria-label="Availability">${o("all","Everything",P.stat)}${o("shelf","Available now",P.stat)}</select></div>
    <p class="count" id="count"></p><div class="list" id="results"></div>`;
}
function pupdate() {
  const r = document.getElementById("results"); if (!r) return;
  const list = pfiltered(), shown = list.slice(0, 120);
  document.getElementById("count").textContent = list.length + (list.length === 1 ? " match" : " matches") + (list.length > shown.length ? " · showing first " + shown.length + ", search to narrow" : "");
  r.innerHTML = shown.length ? shown.map(pcard).join("") : `<div class="empty" style="grid-column:1/-1">Nothing matches. Try fewer words.</div>`;
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
    <div class="list">${fits.map(pcard).join("") || `<div class="empty" style="grid-column:1/-1">No game fits that group. Try more minutes or any weight.</div>`}</div>`;
}
function prender() {
  const view = document.getElementById("view");
  document.getElementById("tabs").innerHTML = [["browse","Browse"],["night","Game night"]].map(([k, t]) =>
    `<button class="tab" role="tab" aria-selected="${P.tab === k}" data-tab="${k}">${t}${k === "browse" && P.items.length ? `<span class="n">${P.items.length}</span>` : ""}</button>`).join("");
  if (!P.ready) { view.innerHTML = `<div class="empty">Loading the shelves…</div>`; return; }
  if (!P.items.length) { view.innerHTML = `<div class="empty"><h2>Nothing to show yet</h2><p>The owner has not added anything to the shared shelves.</p></div>`; return; }
  const had = document.activeElement && document.activeElement.id;
  view.innerHTML = P.tab === "browse" ? pbrowse() : pnight();
  if (P.tab === "browse") pupdate();
  if (had) { const el = document.getElementById(had); if (el) { el.focus(); if (el.type === "search") { const n = el.value.length; el.setSelectionRange(n, n); } } }
}
document.addEventListener("click", e => { const t = e.target.closest("[data-tab]"); if (t) { P.tab = t.dataset.tab; prender(); } });
document.addEventListener("input", e => {
  const id = e.target.id || "";
  if (id === "q") { P.q = e.target.value; pupdate(); }
  else if (id.startsWith("n-")) { const k = id.slice(2); P.night[k] = (k === "players" || k === "mins") ? (+e.target.value || 1) : e.target.value; clearTimeout(P._t); P._t = setTimeout(prender, 300); }
});
document.addEventListener("change", e => {
  const map = { "f-kind": "kind", "f-lang": "lang", "f-cat": "cat", "f-stat": "stat" };
  if (map[e.target.id]) { P[map[e.target.id]] = e.target.value; pupdate(); }
});
async function pstart() {
  document.title = CFG.LIBRARY_NAME || "Shelf Register";
  document.getElementById("title").textContent = CFG.LIBRARY_NAME || "Shelf Register";
  if (!sb) { document.getElementById("view").innerHTML = `<div class="empty"><h2>Not connected yet</h2><p>The owner still needs to add the Supabase details in config.js.</p></div>`; return; }
  prender();
  try { P.items = (await fetchAll("public_items", "title")).map(fromRow); }
  catch (e) { document.getElementById("view").innerHTML = `<div class="empty"><h2>Could not load the shelves</h2><p>Check your connection and reload.</p></div>`; return; }
  P.ready = true; prender();
  const lentN = P.items.filter(i => i.status === "lent").length;
  setStatus(P.items.length + " items" + (lentN ? " · " + lentN + " lent out" : ""));
}
pstart();
