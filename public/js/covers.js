"use strict";
/* Finds book covers that really exist. Tries Open Library, then Google Books, and only saves a link
   after the image has actually loaded, so the friends page never asks for a missing picture. */
S.cov = { running: false, stop: false, done: 0, total: 0, found: 0 };

const COV_TRIED = "shelf-cover-tried", COV_DAYS = 30;
function triedMap() { try { return JSON.parse(localStorage.getItem(COV_TRIED) || "{}"); } catch (e) { return {}; } }
function markTried(ids) { try { const m = triedMap(), now = Date.now(); ids.forEach(id => { m[id] = now; }); localStorage.setItem(COV_TRIED, JSON.stringify(m)); } catch (e) {} }
const recentlyTried = (m, id) => m[id] && Date.now() - m[id] < COV_DAYS * 864e5;

function loadable(url, ms) {
  return new Promise(res => {
    const img = new Image(); let done = false;
    const end = ok => { if (!done) { done = true; clearTimeout(t); res(ok); } };
    const t = setTimeout(() => end(false), ms || 8000);
    img.referrerPolicy = "no-referrer";
    img.onload = () => end(img.naturalWidth > 40 && img.naturalHeight > 40);
    img.onerror = () => end(false);
    img.src = url;
  });
}
async function getJson(url) {
  const r = await fetch(url, { referrerPolicy: "no-referrer" });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.json();
}
const https = u => String(u || "").replace(/^http:\/\//, "https://").replace(/&edge=curl/, "");
const gbCover = v => { const l = v && v.volumeInfo && v.volumeInfo.imageLinks; return l ? https(l.thumbnail || l.smallThumbnail || "") : ""; };

async function coverFromOpenLibrary(isbn) {
  try {
    const d = await getJson("https://openlibrary.org/api/books?bibkeys=ISBN:" + isbn + "&jscmd=data&format=json");
    const c = d["ISBN:" + isbn] && d["ISBN:" + isbn].cover;
    return c ? https(c.medium || c.large || c.small) : "";
  } catch (e) { return ""; }
}
async function coverFromGoogle(q, check) {
  const d = await getJson("https://www.googleapis.com/books/v1/volumes?maxResults=5&printType=books&q=" + encodeURIComponent(q) + "&fields=items(volumeInfo(title,authors,imageLinks))");
  for (const v of d.items || []) { const u = gbCover(v); if (u && (!check || check(v.volumeInfo))) return u; }
  return "";
}
async function findCover(item) {
  if (navigator.onLine === false) { const e = new Error("offline"); e.status = 0; throw e; }
  const isbn = cleanIsbn(item.isbn), cands = [];
  try {
    if (isbn.length >= 10) {
      cands.push(await coverFromOpenLibrary(isbn));
      if (!(await loadable(cands[0] || "data:,"))) cands.length = 0;
      else return cands[0];
      const g = await coverFromGoogle("isbn:" + isbn);
      if (g && await loadable(g)) return g;
    }
    const t = normTitle(item.title);
    if (t.length >= 4) {
      const q = "intitle:" + item.title + (item.creator ? " inauthor:" + item.creator : "");
      const g = await coverFromGoogle(q, vi => { const n = normTitle(vi.title); return n && (n === t || (Math.min(n.length, t.length) >= 6 && (n.includes(t) || t.includes(n)))) && (!item.creator || sameAuthor(item.creator, (vi.authors || []).join(" "))); });
      if (g && await loadable(g)) return g;
    }
  } catch (e) { if (e.status === 429 || e.status === 403 || e.status === 0) throw e; }
  return "";
}

/* Books worth checking: no cover, or an old unchecked Open Library link. Skips ones tried in the last 30 days. */
function coverCandidates() {
  const m = triedMap();
  return S.items.filter(i => i.kind === "book" && !recentlyTried(m, i.id) && (!i.coverUrl || /covers\.openlibrary\.org/.test(i.coverUrl)) && (cleanIsbn(i.isbn).length >= 10 || normTitle(i.title).length >= 4));
}
function covStatus(msg) { const el = document.getElementById("cov-status"); if (el) el.textContent = msg; const b = document.getElementById("cov-stop"); if (b) b.hidden = !S.cov.running; }

async function findCovers(list, quiet) {
  if (S.cov.running || !list.length) return;
  const c = S.cov; Object.assign(c, { running: true, stop: false, done: 0, total: list.length, found: 0 });
  const upd = [], flush = async () => { if (upd.length) { const b = upd.splice(0); await saveMany(b); } };
  let i = 0, blocked = false;
  const worker = async () => {
    while (i < list.length && !c.stop && !blocked) {
      const it = list[i++];
      try {
        const cur = S.items.find(x => x.id === it.id) || it;
        let url = "";
        if (cur.coverUrl && await loadable(cur.coverUrl)) url = cur.coverUrl;       // already works: keep it
        else url = await findCover(cur);
        if (url !== (cur.coverUrl || "")) { upd.push({ ...cur, coverUrl: url }); }
        if (url) c.found++;
      } catch (e) { blocked = true; i--; break; }
      c.done++; covStatus(`Checked ${c.done} of ${c.total} · ${c.found} covers found`);
      if (upd.length >= 20) await flush();
      await new Promise(r => setTimeout(r, 250));
    }
  };
  covStatus(`Checking ${c.total} book${c.total === 1 ? "" : "s"}…`);
  await Promise.all([worker(), worker(), worker()]);
  await flush();
  markTried(list.slice(0, c.done).map(x => x.id));
  c.running = false;
  const msg = blocked ? `Paused after ${c.done} books: the cover service asked us to slow down. Try again in an hour. ${c.found} covers found so far.`
    : c.stop ? `Stopped. ${c.found} covers found.` : `Done. ${c.found} of ${c.total} books now have a cover. The rest have none online.`;
  covStatus(msg); if (!quiet || c.found) toast(msg);
  if (S.tab === "data") render();
}
const autoCovers = ids => { const set = new Set(ids); findCovers(S.items.filter(i => set.has(i.id) && i.kind === "book" && !i.coverUrl), true); };

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  if (t.dataset.act === "fill-covers") findCovers(coverCandidates());
  else if (t.dataset.act === "cov-stop") { S.cov.stop = true; covStatus("Stopping…"); }
  else if (t.dataset.act === "cov-one") {         // in the add/edit form
    const g = x => document.getElementById(x).value.trim();
    t.disabled = true; t.textContent = "Looking…";
    let u = ""; try { u = await findCover({ isbn: g("i-isbn"), title: g("i-title"), creator: g("i-creator") }); } catch (e2) {}
    t.disabled = false; t.textContent = "Find cover";
    if (u) document.getElementById("i-cover").value = u; else toast("No cover found online for this one.");
  }
});
