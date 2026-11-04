/* ---------- Catalog view ---------- */
function filtered() {
  const q = norm(S.q).trim();
  return allItems().filter(i => {
    if (S.kind !== "all" && i.kind !== S.kind) return false;
    if (S.lang !== "all" && (i.kind !== "book" || i.lang !== S.lang)) return false;
    if (S.cat !== "all" && i.cat !== S.cat) return false;
    if (S.loc !== "all" && (i.loc || "") !== S.loc) return false;
    if (S.stat === "lent" && i.status !== "lent") return false;
    if (S.stat === "shelf" && i.status === "lent") return false;
    if (S.stat === "unread" && !(i.kind === "book" && (i.read || "unread") === "unread")) return false;
    if (!q) return true;
    return norm([i.title, i.creator, i.isbn, i.loc, i.notes, i.cat, i.lentTo, callNumber(i)].join(" ")).includes(q);
  }).sort((a, b) => norm(callNumber(a) + a.title).localeCompare(norm(callNumber(b) + b.title)));
}
function cardHTML(i) {
  const lent = i.status === "lent";
  const meta = [];
  if (lent) meta.push(`<span class="chip lent">With ${esc(i.lentTo || "a friend")} · ${daysSince(i.lentOn)}d</span>`);
  if (i.kind === "book") { meta.push(`<span class="chip">${esc(i.lang)}</span>`); if (i.read === "read") meta.push(`<span class="chip">Read${i.rating ? " · " + "★".repeat(i.rating) : ""}</span>`); if (i.read === "reading") meta.push(`<span class="chip">Reading</span>`); }
  else { meta.push(`<span class="chip">${esc(i.gtype)}</span>`); if (i.pmin) meta.push(`<span class="chip">${i.pmin}${i.pmax && i.pmax !== i.pmin ? "–" + i.pmax : ""} players</span>`); if (i.mins) meta.push(`<span class="chip">${i.mins} min</span>`); }
  const c = catLabel(i); if (c) meta.push(`<span class="chip">${esc(c)}</span>`);
  if (i.hidden) meta.push(`<span class="chip sample">Hidden from friends</span>`);
  return `<article class="card">
    <div class="call"><span>${esc(callNumber(i))}</span><span>${esc(i.loc || "no shelf")}</span></div>
    <h3>${esc(i.title)}</h3>
    ${i.creator ? `<div class="by">${esc(i.creator)}</div>` : ""}
    <div class="meta">${meta.join("")}</div>
    ${S.canWrite ? `<div class="acts">
      ${lent ? `<button class="btn small" data-act="return" data-id="${i.id}">Mark returned</button>` : `<button class="btn small" data-act="lend" data-id="${i.id}">Lend out</button>`}
      <button class="btn small" data-act="edit" data-id="${i.id}">Edit</button>
    </div>` : ""}
  </article>`;
}
function renderCatalog() {
  const items = allItems();
  if (!items.length) {
    return `<div class="empty"><h2>Your shelves are empty</h2>
      <p>Add books and games one at a time, or import a whole spreadsheet under the Data tab. Each item gets a call number and a shelf location, so you can find it later.</p>
      <div class="acts">${S.canWrite ? `<button class="btn primary" data-act="add">Add an item</button><button class="btn" data-act="tab" data-tab="data">Import a spreadsheet</button>` : ""}</div></div>`;
  }
  const locs = [...new Set(items.map(i => i.loc).filter(Boolean))].sort();
  const cats = [...new Set(items.map(i => i.cat).filter(Boolean))];
  const opt = (v, t, cur) => `<option value="${esc(v)}"${cur === v ? " selected" : ""}>${esc(t)}</option>`;
  return `<div class="bar">
      <input type="search" id="q" placeholder="Search title, author, shelf, friend, call number" value="${esc(S.q)}" aria-label="Search the catalog">
      <select id="f-kind" aria-label="Type">${opt("all","Books and games",S.kind)}${opt("book","Books only",S.kind)}${opt("game","Games only",S.kind)}</select>
      <select id="f-lang" aria-label="Language">${opt("all","Any language",S.lang)}${LANGS.map(l => opt(l, l, S.lang)).join("")}</select>
      <select id="f-cat" aria-label="Category">${opt("all","Any category",S.cat)}${cats.map(c => opt(c, (BOOK_CLASSES.find(b => b[0] === c) || [c, c])[1], S.cat)).join("")}</select>
      <select id="f-loc" aria-label="Shelf">${opt("all","Any shelf",S.loc)}${locs.map(l => opt(l, l, S.loc)).join("")}</select>
      <select id="f-stat" aria-label="Status">${opt("all","Any status",S.stat)}${opt("shelf","On the shelf",S.stat)}${opt("lent","Lent out",S.stat)}${opt("unread","Unread books",S.stat)}</select>
      ${S.canWrite ? `<button class="btn primary" data-act="add">Add item</button>` : ""}
    </div>
    <p class="count" id="count"></p><div class="list" id="results"></div>`;
}
function updateResults() {
  const r = document.getElementById("results"); if (!r) return;
  const list = filtered();
  const shown = list.slice(0, 120);
  document.getElementById("count").textContent = list.length + (list.length === 1 ? " match" : " matches") + (list.length > shown.length ? " · showing first " + shown.length + ", narrow the search to see more" : "");
  r.innerHTML = shown.length ? shown.map(cardHTML).join("") : `<div class="empty" style="grid-column:1/-1">Nothing matches. Try fewer words or reset the filters.</div>`;
}

/* ---------- Add / edit sheet ---------- */
function openForm(id) {
  const it = id ? allItems().find(i => i.id === id) : null;
  const kind = it ? it.kind : (S.kind === "game" ? "game" : "book");
  const v = it || { kind, title: "", creator: "", lang: "English", cat: kind === "book" ? "FIC" : "Party", loc: "", isbn: "", read: "unread", rating: 0, notes: "", gtype: "Board game", pmin: 2, pmax: 4, mins: 45, cx: "Medium" };
  const locs = [...new Set(allItems().map(i => i.loc).filter(Boolean))].sort();
  const isBook = v.kind === "book";
  const sel = (arr, cur) => arr.map(a => { const [val, txt] = Array.isArray(a) ? a : [a, a]; return `<option value="${esc(val)}"${cur === val ? " selected" : ""}>${esc(txt)}</option>`; }).join("");
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="itemform" role="dialog" aria-modal="true" aria-label="${it ? "Edit item" : "Add item"}">
    <h2>${it ? "Edit item" : "Add item"}</h2>
    <div class="grid2" style="margin-bottom:10px">
      <label>Type<select id="i-kind" ${it ? "disabled" : ""}><option value="book"${isBook ? " selected" : ""}>Book</option><option value="game"${!isBook ? " selected" : ""}>Game</option></select></label>
      <label>Shelf location<input type="text" id="i-loc" list="locs" placeholder="e.g. A3 = case A, shelf 3" value="${esc(v.loc)}"><datalist id="locs">${locs.map(l => `<option value="${esc(l)}">`).join("")}</datalist></label>
    </div>
    <label style="margin-bottom:10px">Title<input type="text" id="i-title" required value="${esc(v.title)}"></label>
    <div id="fields-book" ${isBook ? "" : "hidden"}>
      <div class="grid2" style="margin-bottom:10px">
        <label>Author<input type="text" id="i-creator" value="${esc(isBook ? v.creator : "")}"></label>
        <label>Language<select id="i-lang">${sel(LANGS, v.lang)}</select></label>
        <label>Category<select id="i-bcat">${sel(BOOK_CLASSES.map(c => [c[0], c[0] + " · " + c[1]]), isBook ? v.cat : "FIC")}</select></label>
        <label>ISBN (optional)<input type="text" id="i-isbn" value="${esc(v.isbn)}"></label>
        <label>Reading<select id="i-read">${sel([["unread","Not read yet"],["reading","Reading now"],["read","Finished"]], v.read || "unread")}</select></label>
        <label>Rating<select id="i-rating">${sel([["0","No rating"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]], String(v.rating || 0))}</select></label>
      </div>
    </div>
    <div id="fields-game" ${isBook ? "hidden" : ""}>
      <div class="grid2" style="margin-bottom:10px">
        <label>Kind<select id="i-gtype">${sel(GAME_TYPES, v.gtype)}</select></label>
        <label>Category<select id="i-gcat">${sel(GAME_CATS, !isBook ? v.cat : "Party")}</select></label>
        <label>Players from<input type="number" id="i-pmin" min="1" max="30" value="${v.pmin || 2}"></label>
        <label>Players up to<input type="number" id="i-pmax" min="1" max="30" value="${v.pmax || 4}"></label>
        <label>Minutes<input type="number" id="i-mins" min="5" max="600" step="5" value="${v.mins || 45}"></label>
        <label>Weight<select id="i-cx">${sel(["Light","Medium","Heavy"], v.cx || "Medium")}</select></label>
      </div>
    </div>
    <label>Notes (private, friends never see these)<textarea id="i-notes" rows="2">${esc(v.notes)}</textarea></label>
    <label style="flex-direction:row;align-items:center;gap:8px;margin-top:10px;color:var(--fg)"><input type="checkbox" id="i-hidden" style="width:auto"${v.hidden ? " checked" : ""}> Hide this item from the friends page</label>
    <div class="acts">
      ${it ? `<button type="button" class="btn danger" data-act="delete" data-id="${it.id}" style="margin-right:auto">Delete</button>` : ""}
      <button type="button" class="btn" data-act="close">Cancel</button>
      <button type="submit" class="btn primary">${it ? "Save changes" : "Add to catalog"}</button>
    </div></form></div>`;
  const kindSel = document.getElementById("i-kind");
  kindSel.onchange = () => { const b = kindSel.value === "book"; document.getElementById("fields-book").hidden = !b; document.getElementById("fields-game").hidden = b; };
  document.getElementById("itemform").onsubmit = e => {
    e.preventDefault();
    const g = x => document.getElementById(x).value;
    const k = it ? it.kind : g("i-kind");
    const base = { ...(it || {}), id: it ? it.id : uid(), kind: k, title: g("i-title").trim(), loc: g("i-loc").trim().toUpperCase(), notes: g("i-notes").trim(), status: it ? it.status : "shelf", hidden: document.getElementById("i-hidden").checked };
    if (k === "book") Object.assign(base, { creator: g("i-creator").trim(), lang: g("i-lang"), cat: g("i-bcat"), isbn: g("i-isbn").trim(), read: g("i-read"), rating: +g("i-rating") });
    else Object.assign(base, { gtype: g("i-gtype"), cat: g("i-gcat"), pmin: +g("i-pmin") || 1, pmax: Math.max(+g("i-pmax") || 1, +g("i-pmin") || 1), mins: +g("i-mins") || 30, cx: g("i-cx") });
    if (!base.title) return;
    saveItem(base); closeModal(); toast(it ? "Saved" : "Added to the catalog");
  };
  document.getElementById("i-title").focus();
}
function openLend(id) {
  const it = allItems().find(i => i.id === id); if (!it) return;
  const names = [...new Set(allItems().map(i => i.lentTo).filter(Boolean))];
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="lendform" role="dialog" aria-modal="true" aria-label="Lend item" style="width:min(420px,100%)">
    <h2>Lend “${esc(it.title)}”</h2>
    <div class="grid2"><label>Who is borrowing it<input type="text" id="l-who" list="friends" required><datalist id="friends">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist></label>
    <label>Date<input type="date" id="l-date" value="${today()}"></label></div>
    <div class="acts"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Lend out</button></div></form></div>`;
  document.getElementById("lendform").onsubmit = e => {
    e.preventDefault();
    saveItem({ ...it, status: "lent", lentTo: document.getElementById("l-who").value.trim(), lentOn: document.getElementById("l-date").value || today() });
    closeModal(); toast("Marked as lent");
  };
  document.getElementById("l-who").focus();
}
function returnItem(id) {
  const it = allItems().find(i => i.id === id); if (!it) return;
  const { lentTo, lentOn, ...rest } = it; saveItem({ ...rest, status: "shelf" }); toast("Marked as returned");
}
function closeModal() { document.getElementById("modal").innerHTML = ""; }
/* ---------- Game night ---------- */
function renderNight() {
  const n = S.night;
  const games = allItems().filter(i => i.kind === "game");
  const fits = games.filter(g =>
    (g.pmin || 1) <= n.players && (g.pmax || 99) >= n.players && (g.mins || 0) <= n.mins &&
    (n.cx === "any" || g.cx === n.cx) && (n.kind === "any" || g.gtype === n.kind) && g.status !== "lent");
  const o = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${t}</option>`;
  return `<div class="panel"><h2>What can we play tonight?</h2>
    <p class="note" style="margin:0 0 10px">Set who is here and how long you have. Only games that are on the shelf and fit the group are listed.</p>
    <div class="grid2">
      <label>Players<input type="number" id="n-players" min="1" max="30" value="${n.players}"></label>
      <label>Minutes available<input type="number" id="n-mins" min="10" max="600" step="10" value="${n.mins}"></label>
      <label>Weight<select id="n-cx">${o("any","Any",n.cx)}${o("Light","Light",n.cx)}${o("Medium","Medium",n.cx)}${o("Heavy","Heavy",n.cx)}</select></label>
      <label>Kind<select id="n-kind">${o("any","Board and card",n.kind)}${o("Board game","Board games",n.kind)}${o("Card game","Card games",n.kind)}</select></label>
    </div></div>
    <p class="count">${games.length ? fits.length + " of " + games.length + " games fit" : ""}</p>
    ${games.length ? `<div class="list">${fits.sort((a, b) => (b.pmax || 0) - (a.pmax || 0)).map(cardHTML).join("") || `<div class="empty" style="grid-column:1/-1">No game fits that group. Try more minutes or any weight.</div>`}</div>`
      : `<div class="empty"><h2>No games catalogued yet</h2><p>Add a game with its player count and playing time, and it will show up here.</p></div>`}`;
}

/* ---------- Lent out ---------- */
function renderLent() {
  const lent = allItems().filter(i => i.status === "lent").sort((a, b) => new Date(a.lentOn) - new Date(b.lentOn));
  if (!lent.length) return `<div class="empty"><h2>Nothing is lent out</h2><p>When a friend borrows a book or game, use “Lend out” on its card. It will be listed here with the number of days.</p></div>`;
  const by = {};
  lent.forEach(i => (by[i.lentTo || "Unknown"] = by[i.lentTo || "Unknown"] || []).push(i));
  return `<p class="count">${lent.length} item${lent.length > 1 ? "s" : ""} out with ${Object.keys(by).length} friend${Object.keys(by).length > 1 ? "s" : ""}</p>` +
    Object.entries(by).map(([who, list]) => `<div class="panel"><h2>${esc(who)}</h2><div class="scroll"><table><thead><tr><th>Item</th><th>Call no.</th><th>Out since</th><th></th></tr></thead><tbody>
      ${list.map(i => `<tr><td>${esc(i.title)}</td><td class="mono">${esc(callNumber(i))}</td><td>${esc(i.lentOn || "")} · ${daysSince(i.lentOn)} days</td><td>${S.canWrite ? `<button class="btn small" data-act="return" data-id="${i.id}">Returned</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div></div>`).join("");
}

/* ---------- Shelves ---------- */
function renderShelves() {
  const items = allItems();
  if (!items.length) return `<div class="empty"><h2>No shelves to show yet</h2><p>Give each item a shelf code like A3 (case A, shelf 3). This page then shows how full each shelf is.</p></div>`;
  const by = {};
  items.forEach(i => { const k = i.loc || "(no shelf)"; (by[k] = by[k] || []).push(i); });
  const keys = Object.keys(by).sort((a, b) => a === "(no shelf)" ? 1 : b === "(no shelf)" ? -1 : a.localeCompare(b, undefined, { numeric: true }));
  const books = items.filter(i => i.kind === "book"), games = items.filter(i => i.kind === "game");
  return `<div class="stats">
    <div class="stat"><span>English books</span><div class="big">${books.filter(b => b.lang === "English").length}</div></div>
    <div class="stat"><span>Telugu books</span><div class="big">${books.filter(b => b.lang === "Telugu").length}</div></div>
    <div class="stat"><span>Board games</span><div class="big">${games.filter(g => g.gtype === "Board game").length}</div></div>
    <div class="stat"><span>Card games</span><div class="big">${games.filter(g => g.gtype === "Card game").length}</div></div>
    <div class="stat"><span>Lent out</span><div class="big">${items.filter(i => i.status === "lent").length}</div></div></div>
    <div class="panel"><h2>By shelf</h2><div class="scroll"><table><thead><tr><th>Shelf</th><th>Items</th><th>Mix</th><th></th></tr></thead><tbody>
    ${keys.map(k => { const l = by[k]; const b = l.filter(i => i.kind === "book").length; return `<tr><td class="mono">${esc(k)}</td><td>${l.length}</td><td class="note">${b} books, ${l.length - b} games</td><td>${k === "(no shelf)" ? "" : `<button class="btn small" data-act="viewshelf" data-loc="${esc(k)}">View</button>`}</td></tr>`; }).join("")}
    </tbody></table></div></div>`;
}
/* ---------- Guide: how libraries organise, mapped to this app ---------- */
function renderGuide() {
  return `<div class="guide">
  <div class="panel"><h2>How libraries find things</h2>
    <p>Every library gives each item a <strong>call number</strong>, a short code that says what it is and where it sits on the shelf. The shelf is then sorted by that code, so any book can be found without a search. Three systems do almost all of this work:</p>
    <div class="scroll"><table><thead><tr><th>System</th><th>Used by</th><th>Idea</th></tr></thead><tbody>
      <tr><td><strong>Dewey Decimal</strong></td><td>School, public and small libraries</td><td>Ten classes of knowledge, numbered 000 to 900, refined with decimals. Easy to learn.</td></tr>
      <tr><td><strong>Library of Congress</strong></td><td>University and research libraries</td><td>Letters for subjects (Q science, P literature, D history), then numbers. Better for very large, specialised collections.</td></tr>
      <tr><td><strong>Cutter number</strong></td><td>Added to either system</td><td>A short code from the author's name, so books in one class sit in author order.</td></tr>
    </tbody></table></div>
    <p>Behind the shelves is the <strong>catalog record</strong>: title, author, subject, ISBN, location and status. Libraries store these as MARC records and let you search by any field. This app keeps the same fields, which is why search covers title, author, shelf and call number together.</p>
  </div>
  <div class="panel"><h2>The scheme this app uses</h2>
    <p>Full Dewey is too fine for 2,000 books at home, so the app uses the ten main classes plus three shortcuts that home libraries need:</p>
    <ul><li><strong>FIC</strong> fiction, <strong>BIO</strong> biography and memoir, <strong>KID</strong> children's books.</li>
    <li>Non-fiction uses Dewey's ten classes: 000 general, 100 philosophy, 200 religion, 300 social sciences, 400 language, 500 science, 600 technology and health, 700 arts and hobbies, 800 literature, 900 history.</li></ul>
    <p>The call number is built for you: <span class="mono">EN FIC ORW</span> is an English fiction book by an author starting “Orw”. Telugu books start with <span class="mono">TE</span>, so they stay together as their own section. Games get <span class="mono">BOARD</span> or <span class="mono">CARD</span> plus a category.</p>
  </div>
  <div class="panel"><h2>Shelf codes and the physical room</h2>
    <ul><li>Letter each bookcase (A, B, C) and number its shelves from the top (A1, A2 ...). Write the code in the Shelf field. <span class="mono">B4</span> means case B, fourth shelf.</li>
    <li>Shelve in call-number order inside each case. A book is then found by its call number, even before you search.</li>
    <li>Keep Telugu together in one case or two. Keep board games in their own case, and card games in labelled bins with codes like <span class="mono">G1</span>.</li>
    <li>Stick a small label with the call number on each spine, as libraries do. For 2,000 books, label as you shelve.</li></ul>
  </div>
  <div class="panel"><h2>Adding 2,000 items without typing them all</h2>
    <ul><li>Scan barcodes with a free catalog app such as Libib or Goodreads, then export a CSV and import it on the Data tab.</li>
    <li>Or type titles into a spreadsheet and import that. Columns it understands: title, author, language, category, shelf, isbn, notes.</li>
    <li>Add the shelf code last, one bookcase at a time, as you put books on the shelf.</li></ul>
  </div></div>`;
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const csvCell = v => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const COLS = ["kind","title","creator","lang","cat","loc","isbn","read","rating","gtype","pmin","pmax","mins","cx","status","lentTo","lentOn","notes"];
function toCSV() { return [COLS.join(","), ...allItems().map(i => COLS.map(c => csvCell(i[c])).join(","))].join("\n"); }
function guessClass(raw) {
  const s = norm(raw).trim(); if (!s) return "FIC";
  const hit = BOOK_CLASSES.find(c => norm(c[0]) === s || norm(c[1]).startsWith(s));
  if (hit) return hit[0];
  if (/fiction|novel/.test(s)) return "FIC"; if (/biograph|memoir/.test(s)) return "BIO"; if (/child|kid/.test(s)) return "KID";
  if (/histor|geograph/.test(s)) return "900"; if (/scien|math/.test(s)) return "500"; if (/religio|spirit/.test(s)) return "200";
  if (/philos|psych|self/.test(s)) return "100"; if (/poet|essay|literat/.test(s)) return "800"; if (/art|hobby|music/.test(s)) return "700";
  if (/tech|health|medic|comput/.test(s)) return "600"; if (/business|econom|politic|social/.test(s)) return "300";
  return "FIC";
}
function importCSV(text) {
  const rows = parseCSV(text); if (rows.length < 2) return toast("That file has no rows to import.");
  const head = rows[0].map(h => norm(h).trim());
  const col = (...names) => head.findIndex(h => names.includes(h));
  const ix = { title: col("title","name"), creator: col("author","creator","creators","authors"), lang: col("language","lang"), cat: col("cat","category","class","genre","subject","tags"),
    loc: col("shelf","location","loc"), isbn: col("isbn","ean_isbn13","isbn13"), notes: col("notes","description"), kind: col("kind","type"), gtype: col("gtype"),
    pmin: col("pmin","min players"), pmax: col("pmax","max players"), mins: col("mins","minutes"), read: col("read","reading") };
  if (ix.title < 0) return toast("No title column found. The first row must name its columns, for example title, author.");
  const get = (r, k) => ix[k] >= 0 ? (r[ix[k]] || "").trim() : "";
  const list = rows.slice(1).map(r => {
    const title = get(r, "title"); if (!title) return null;
    const kind = /game/i.test(get(r, "kind")) ? "game" : "book";
    const base = { id: uid(), kind, title, loc: get(r, "loc").toUpperCase(), notes: get(r, "notes"), status: "shelf" };
    if (kind === "game") return Object.assign(base, { gtype: /card/i.test(get(r, "kind") + get(r, "gtype")) ? "Card game" : "Board game", cat: GAME_CATS.find(c => norm(c) === norm(get(r, "cat"))) || "Party", pmin: +get(r, "pmin") || 2, pmax: +get(r, "pmax") || 4, mins: +get(r, "mins") || 45, cx: "Medium" });
    const lang = /tel/i.test(get(r, "lang")) || /[ఀ-౿]/.test(title) ? "Telugu" : "English";
    return Object.assign(base, { creator: get(r, "creator"), lang, cat: guessClass(get(r, "cat")), isbn: get(r, "isbn"), read: ["read","reading"].includes(norm(get(r, "read"))) ? norm(get(r, "read")) : "unread", rating: 0 });
  }).filter(Boolean);
  if (!list.length) return toast("No usable rows found.");
  addMany(list); toast("Imported " + list.length + " items");
}

/* ---------- State ---------- */
const S = {
  items: [], tab: "catalog",
  q: "", kind: "all", lang: "all", cat: "all", loc: "all", stat: "all",
  night: { players: 6, mins: 60, cx: "any", kind: "any" },
  ready: false, canWrite: true, session: null
};
const allItems = () => S.items;

/* ---------- Saving to Supabase (screen updates first, then rolls back if the save fails) ---------- */
async function loadItems() {
  try {
    S.items = (await fetchAll("items", "created_at")).map(fromRow);
    S.ready = true; render();
  } catch (e) { S.ready = true; render(); toast("Could not load the catalog: " + (e.message || "network error")); }
}
async function saveItem(item) {
  const idx = S.items.findIndex(i => i.id === item.id);
  const prev = idx >= 0 ? S.items[idx] : null;
  if (idx >= 0) S.items[idx] = item; else S.items.push(item);
  render();
  const { error } = await sb.from("items").upsert(toRow(item));
  if (error) {
    if (prev) S.items[idx] = prev; else S.items = S.items.filter(i => i.id !== item.id);
    render(); toast("Not saved: " + error.message);
  }
}
async function deleteItem(id) {
  const prev = S.items; S.items = S.items.filter(i => i.id !== id); render();
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) { S.items = prev; render(); toast("Not deleted: " + error.message); }
}
async function addMany(list) {
  setStatus("Importing " + list.length + " items…");
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await sb.from("items").insert(list.slice(i, i + 500).map(toRow));
    if (error) { toast("Import stopped after " + i + " items: " + error.message); await loadItems(); return; }
  }
  await loadItems(); toast("Imported " + list.length + " items");
}

/* ---------- Sign in ---------- */
function renderLogin() {
  return `<form class="panel login" id="loginform"><h2>Owner sign in</h2>
    <p class="note" style="margin-top:0">This page edits the catalog. Friends use the main page instead.</p>
    <label style="margin-bottom:10px">Email<input type="text" id="login-email" autocomplete="username" required></label>
    <label style="margin-bottom:12px">Password<input type="password" id="login-pass" autocomplete="current-password" required style="background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:8px 10px;width:100%"></label>
    <button class="btn primary" type="submit">Sign in</button> <span id="login-msg" class="note"></span></form>`;
}
async function signIn(e) {
  e.preventDefault();
  const msg = document.getElementById("login-msg"); msg.textContent = "Signing in…";
  const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("login-email").value.trim(), password: document.getElementById("login-pass").value });
  if (error) msg.textContent = "That email and password did not match.";
}

/* ---------- Data tab ---------- */
function renderData() {
  const n = allItems().length;
  return `<div class="panel"><h2>Import a spreadsheet</h2>
    <p class="note" style="margin-top:0">Choose a CSV file with a header row. Columns understood: title, author, language, category, shelf, isbn, notes. Add a “kind” column with the word game to import games. Telugu titles are detected automatically. Importing the same file twice adds every row twice, so import each file once.</p>
    <input type="file" id="csvfile" accept=".csv,text/csv" aria-label="CSV file to import">
    <p class="note">Libib, Goodreads and most spreadsheet apps can export CSV.</p></div>
  <div class="panel"><h2>Download a backup</h2>
    <p class="note" style="margin-top:0">${n} item${n === 1 ? "" : "s"} are stored in your Supabase database. A CSV copy opens in Excel or Google Sheets.</p>
    <button class="btn primary" data-act="export"${n ? "" : " disabled"}>Download CSV</button></div>
  <div class="panel"><h2>Friends page</h2>
    <p class="note" style="margin-top:0">Friends see title, author, language, category, shelf, and whether an item is on the shelf. They never see your notes, ISBNs, reading status or who borrowed what. Tick “Hide from the friends page” on any item you want kept private.</p>
    <p class="mono" style="margin:0">${esc(location.origin)}/</p></div>`;
}
function exportCSV() {
  const blob = new Blob(["﻿" + toCSV()], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "shelf-register-" + today() + ".csv";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Render + events ---------- */
const TABS = [["catalog","Catalog"],["night","Game night"],["lent","Lent out"],["shelves","Shelves"],["guide","How it works"],["data","Data"]];
function render() {
  const view = document.getElementById("view"), tabs = document.getElementById("tabs");
  if (!S.session) { tabs.innerHTML = ""; view.innerHTML = renderLogin(); document.getElementById("loginform").onsubmit = signIn; setStatus(""); return; }
  const items = allItems(), lentN = items.filter(i => i.status === "lent").length;
  tabs.innerHTML = TABS.map(([k, t]) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-act="tab" data-tab="${k}">${t}${k === "catalog" && items.length ? `<span class="n">${items.length}</span>` : ""}${k === "lent" && lentN ? `<span class="n">${lentN}</span>` : ""}</button>`).join("");
  const had = document.activeElement && document.activeElement.id;
  view.innerHTML = !S.ready ? `<div class="empty">Loading your catalog…</div>` :
    S.tab === "catalog" ? renderCatalog() : S.tab === "night" ? renderNight() : S.tab === "lent" ? renderLent() :
    S.tab === "shelves" ? renderShelves() : S.tab === "guide" ? renderGuide() : renderData();
  if (S.tab === "catalog" && S.ready) updateResults();
  if (had) { const el = document.getElementById(had); if (el && el.focus && view.contains(el)) { el.focus(); if (el.type === "search") { const n = el.value.length; el.setSelectionRange(n, n); } } }
  if (S.ready) setStatus(items.length + " items · signed in as " + (S.session.user.email || "owner"));
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const act = t.dataset.act, id = t.dataset.id;
  if (act === "close-bg") { if (e.target === t) closeModal(); return; }
  if (act === "tab") { S.tab = t.dataset.tab; render(); }
  else if (act === "add") openForm();
  else if (act === "edit") openForm(id);
  else if (act === "lend") openLend(id);
  else if (act === "return") returnItem(id);
  else if (act === "close") closeModal();
  else if (act === "delete") { if (t.dataset.sure) { deleteItem(id); closeModal(); toast("Deleted"); } else { t.dataset.sure = "1"; t.textContent = "Tap again to delete"; } }
  else if (act === "viewshelf") { S.tab = "catalog"; S.loc = t.dataset.loc; render(); }
  else if (act === "export") exportCSV();
  else if (act === "signout") sb.auth.signOut();
});
document.addEventListener("input", e => {
  const id = e.target.id || "";
  if (id === "q") { S.q = e.target.value; updateResults(); }
  else if (id.startsWith("n-")) { const k = id.slice(2); S.night[k] = (k === "players" || k === "mins") ? (+e.target.value || 1) : e.target.value; clearTimeout(S._nt); S._nt = setTimeout(render, (k === "players" || k === "mins") ? 300 : 0); }
});
document.addEventListener("change", e => {
  const id = e.target.id || "";
  const map = { "f-kind": "kind", "f-lang": "lang", "f-cat": "cat", "f-loc": "loc", "f-stat": "stat" };
  if (map[id]) { S[map[id]] = e.target.value; updateResults(); }
  else if (id === "csvfile" && e.target.files[0]) {
    const r = new FileReader();
    r.onload = () => importCSV(String(r.result || "")); r.onerror = () => toast("Could not read that file.");
    r.readAsText(e.target.files[0]);
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------- Start ---------- */
async function start() {
  if (!sb) { document.getElementById("view").innerHTML = `<div class="empty"><h2>Not connected yet</h2><p>Open <span class="mono">public/config.js</span> and paste your Supabase project URL and anon key, then redeploy. The README has the steps.</p></div>`; return; }
  document.getElementById("signout").onclick = () => sb.auth.signOut();
  sb.auth.onAuthStateChange((_ev, session) => {
    const was = !!S.session; S.session = session;
    document.getElementById("signout").hidden = !session;
    if (session && !was) { S.ready = false; render(); loadItems(); }
    else if (!session) { S.items = []; S.ready = false; render(); }
  });
  const { data } = await sb.auth.getSession();
  if (!data.session) render();
}
start();
