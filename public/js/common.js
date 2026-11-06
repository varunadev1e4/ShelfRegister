"use strict";
/* Shared by the owner app (admin.html) and the friends page (index.html). */
const BOOK_CLASSES = [
  ["FIC","Fiction"],["BIO","Biography & memoir"],["KID","Children's"],
  ["000","General, reference"],["100","Philosophy, psychology"],["200","Religion, spirituality"],
  ["300","Social sciences, business"],["400","Language"],["500","Science, maths"],
  ["600","Technology, health"],["700","Arts, hobbies"],["800","Literature, poetry, essays"],
  ["900","History, geography"]
];
const GAME_TYPES = ["Board game","Card game"];
const GAME_CATS = ["Party","Strategy","Family","Co-op","Two-player","Classic","Word","Trivia","Collectible"];
const LANGS = ["English","Telugu"];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? "").toLowerCase();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const today = () => ymd(new Date());   // local date, so late-night entries land on the right day
const daysSince = d => d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5)) : 0;

function setStatus(t) { const el = document.getElementById("status"); if (el) el.textContent = t; }
let toastTimer;
function toast(msg, action) {
  const el = document.getElementById("toast"); if (!el) return;
  el.textContent = msg;
  if (action) { const b = document.createElement("button"); b.className = "toastbtn"; b.textContent = action.label; b.onclick = () => { el.hidden = true; action.fn(); }; el.append(" ", b); }
  el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, action ? 9000 : 3500);
}

function callNumber(i) {
  if (i.kind !== "book") return (i.gtype === "Card game" ? "CARD" : "BOARD") + " · " + String(i.cat || "—").slice(0, 3).toUpperCase();
  const lang = i.lang === "Telugu" ? "TE" : "EN";
  const a = String(i.creator || i.title || "").replace(/[^A-Za-zఀ-౿]/g, "");
  return lang + " " + (i.cat || "FIC") + " " + (a.slice(0, 3) || "—").toUpperCase();
}
function catLabel(i) {
  if (i.kind === "game") return i.cat || "";
  const c = BOOK_CLASSES.find(x => x[0] === i.cat); return c ? c[1] : "";
}

/* ---------- Supabase ---------- */
const CFG = window.CONFIG || {};
const configured = !!CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("YOUR-PROJECT") && !!CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("YOUR-ANON");
const sb = configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

/* database row <-> app item */
function fromRow(r) {
  return { id: r.id, kind: r.kind, title: r.title, creator: r.creator || "", lang: r.lang || "English", cat: r.cat || "",
    loc: r.loc || "", isbn: r.isbn || "", read: r.read_status || "unread", rating: r.rating || 0, notes: r.notes || "",
    gtype: r.gtype || "Board game", pmin: r.pmin, pmax: r.pmax, mins: r.mins, cx: r.cx || "Medium",
    status: r.status || "shelf", lentTo: r.lent_to || "", lentOn: r.lent_on || "", hidden: !!r.hidden,
    pages: r.pages || null, curPage: r.current_page || 0, startedOn: r.started_on || "", finishedOn: r.finished_on || "",
    queued: !!r.queued, queuePos: r.queue_pos ?? null, createdAt: r.created_at || "",
    titleEn: r.title_en || "", creatorEn: r.creator_en || "", coverUrl: r.cover_url || "", series: r.series || "", seriesNo: r.series_no ?? null,
    pick: !!r.pick, pickNote: r.pick_note || "", dueOn: r.due_on || "", quotes: Array.isArray(r.quotes) ? r.quotes : [], deletedAt: r.deleted_at || "" };
}
function toRow(i) {
  const book = i.kind === "book";
  return { id: i.id, kind: i.kind, title: i.title, creator: book ? (i.creator || null) : null, lang: book ? (i.lang || null) : null,
    cat: i.cat || null, loc: i.loc || null, isbn: book ? (i.isbn || null) : null, read_status: book ? (i.read || "unread") : null,
    rating: book ? (i.rating || 0) : null, notes: i.notes || null, gtype: book ? null : (i.gtype || null),
    pmin: book ? null : (i.pmin ?? null), pmax: book ? null : (i.pmax ?? null), mins: book ? null : (i.mins ?? null), cx: book ? null : (i.cx || null),
    status: i.status || "shelf", lent_to: i.lentTo || null, lent_on: i.lentOn || null, hidden: !!i.hidden,
    pages: book ? (i.pages || null) : null, current_page: book ? (i.curPage || 0) : null,
    started_on: book ? (i.startedOn || null) : null, finished_on: book ? (i.finishedOn || null) : null,
    queued: book ? !!i.queued : false, queue_pos: book && i.queued ? (i.queuePos ?? null) : null,
    title_en: book ? (i.titleEn || null) : null, creator_en: book ? (i.creatorEn || null) : null, cover_url: book ? (i.coverUrl || null) : null,
    series: book ? (i.series || null) : null, series_no: book && i.series ? (i.seriesNo ?? null) : null,
    pick: !!i.pick, pick_note: i.pick ? (i.pickNote || null) : null, due_on: i.dueOn || null,
    quotes: book ? (i.quotes || []) : [], deleted_at: i.deletedAt || null };
}
/* Supabase returns at most 1000 rows per request, so read in pages. */
async function fetchAll(table, orderCol) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.from(table).select("*").order(orderCol).range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

/* ---------- Telugu: English spelling and phonetic search ---------- */
const TE_V = { "అ":"a","ఆ":"aa","ఇ":"i","ఈ":"ee","ఉ":"u","ఊ":"oo","ఋ":"ru","ఎ":"e","ఏ":"e","ఐ":"ai","ఒ":"o","ఓ":"o","ఔ":"au" };
const TE_M = { "ా":"aa","ి":"i","ీ":"ee","ు":"u","ూ":"oo","ృ":"ru","ె":"e","ే":"e","ై":"ai","ొ":"o","ో":"o","ౌ":"au" };
const TE_C = { "క":"k","ఖ":"kh","గ":"g","ఘ":"gh","ఙ":"ng","చ":"ch","ఛ":"chh","జ":"j","ఝ":"jh","ఞ":"ny","ట":"t","ఠ":"th","డ":"d","ఢ":"dh","ణ":"n","త":"t","థ":"th","ద":"d","ధ":"dh","న":"n","ప":"p","ఫ":"ph","బ":"b","భ":"bh","మ":"m","య":"y","ర":"r","ల":"l","వ":"v","శ":"sh","ష":"sh","స":"s","హ":"h","ళ":"l","ఱ":"r" };
const hasTelugu = s => /[\u0C00-\u0C7F]/.test(String(s || ""));
function teluguToRoman(str) {
  const ch = [...String(str || "")]; let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (TE_C[c]) { out += TE_C[c]; const n = ch[i + 1]; if (n === "్") i++; else if (TE_M[n]) { out += TE_M[n]; i++; } else out += "a"; }
    else if (TE_V[c]) out += TE_V[c];
    else if (c === "ం" || c === "ఁ") out += "m";
    else if (c === "ః") out += "h";
    else if (TE_M[c]) out += TE_M[c];
    else out += c;
  }
  return out.replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, m => m.toUpperCase());
}
/* A loose "sounds like" key, so "veyi padagalu", "Vēyi Paḍagaḷu" and "veeyi padagalu" all match. */
function phon(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/w/g, "v").replace(/z/g, "j").replace(/sh/g, "s").replace(/ch/g, "c").replace(/([bcdgjkpt])h/g, "$1")
    .replace(/(.)\1+/g, "$1").replace(/[^a-z0-9\u0C00-\u0C7F ]+/g, " ").replace(/\s+/g, " ").trim();
}
function phonMatch(query, haystack) {
  const toks = phon(query).split(" ").filter(Boolean); if (!toks.length) return true;
  const h = phon(haystack); return toks.every(t => h.includes(t));
}

/* ---------- ISBN and covers ---------- */
const cleanIsbn = s => String(s || "").replace(/[^0-9Xx]/g, "").toUpperCase();
const isbnCover = isbn => { const c = cleanIsbn(isbn); return c.length >= 10 ? "https://covers.openlibrary.org/b/isbn/" + c + "-M.jpg?default=false" : ""; };

/* ---------- Duplicate detection ---------- */
const normTitle = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^\s*(the|a|an)\s+/, "").replace(/[^a-z0-9\u0C00-\u0C7F]+/g, "");
const nameTokens = a => String(a || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9\u0C00-\u0C7F]+/).filter(Boolean);
function sameAuthor(a, b) {
  const x = nameTokens(a), y = nameTokens(b); if (!x.length || !y.length) return true;
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  return small.every(t => big.includes(t));
}
function dupIndex(pool) {
  const byTitle = new Map(), byIsbn = new Map();
  pool.forEach(o => {
    const k = o.kind + "|" + normTitle(o.title); if (normTitle(o.title)) { if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(o); }
    const c = cleanIsbn(o.isbn); if (c.length >= 10) { if (!byIsbn.has(c)) byIsbn.set(c, []); byIsbn.get(c).push(o); }
  });
  return { find(item) {
    const out = new Set(), c = cleanIsbn(item.isbn);
    if (c.length >= 10) (byIsbn.get(c) || []).forEach(o => { if (o.id !== item.id) out.add(o); });
    (byTitle.get(item.kind + "|" + normTitle(item.title)) || []).forEach(o => { if (o.id !== item.id && (item.kind === "game" || sameAuthor(item.creator, o.creator))) out.add(o); });
    return [...out];
  }, add(item) { const k = item.kind + "|" + normTitle(item.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(item); const c = cleanIsbn(item.isbn); if (c.length >= 10) { if (!byIsbn.has(c)) byIsbn.set(c, []); byIsbn.get(c).push(item); } } };
}
