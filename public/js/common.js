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
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = d => d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5)) : 0;

function setStatus(t) { const el = document.getElementById("status"); if (el) el.textContent = t; }
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast"); if (!el) return;
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
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
    status: r.status || "shelf", lentTo: r.lent_to || "", lentOn: r.lent_on || "", hidden: !!r.hidden };
}
function toRow(i) {
  const book = i.kind === "book";
  return { id: i.id, kind: i.kind, title: i.title, creator: book ? (i.creator || null) : null, lang: book ? (i.lang || null) : null,
    cat: i.cat || null, loc: i.loc || null, isbn: book ? (i.isbn || null) : null, read_status: book ? (i.read || "unread") : null,
    rating: book ? (i.rating || 0) : null, notes: i.notes || null, gtype: book ? null : (i.gtype || null),
    pmin: book ? null : (i.pmin ?? null), pmax: book ? null : (i.pmax ?? null), mins: book ? null : (i.mins ?? null), cx: book ? null : (i.cx || null),
    status: i.status || "shelf", lent_to: i.lentTo || null, lent_on: i.lentOn || null, hidden: !!i.hidden };
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
