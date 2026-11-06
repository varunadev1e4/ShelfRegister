"use strict";
/* Printable labels: one QR label per bookcase or shelf, and call-number spine labels. */
S.lab = { type: "shelf", cols: 3, only: "", kind: "book" };

function qrSvg(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
const itemUrl = id => (CFG.PUBLIC_URL ? String(CFG.PUBLIC_URL).replace(/\/+$/, "") : location.origin) + "/?item=" + encodeURIComponent(id);
const shelfUrl = code => (CFG.PUBLIC_URL ? String(CFG.PUBLIC_URL).replace(/\/+$/, "") : location.origin) + "/?shelf=" + encodeURIComponent(code);
function labelFilter() {
  const parts = S.lab.only.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  return loc => !parts.length || parts.some(p => String(loc || "").toUpperCase().startsWith(p));
}
function labelItems() {
  const ok = labelFilter();
  return S.items.filter(i => (S.lab.kind === "both" || i.kind === S.lab.kind) && i.loc && ok(i.loc))
    .sort((a, b) => a.loc.localeCompare(b.loc, undefined, { numeric: true }) || callNumber(a).localeCompare(callNumber(b)) || a.title.localeCompare(b.title));
}
function shelfLabelsHTML() {
  const ok = labelFilter(), counts = {};
  S.items.forEach(i => { if (i.loc && ok(i.loc)) counts[i.loc] = (counts[i.loc] || 0) + 1; });
  const codes = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { n: codes.length, html: codes.map(c => `<div class="lab shelf-lab"><div class="qr">${qrSvg(shelfUrl(c))}</div>
    <div class="lab-text"><div class="lab-code">${esc(c)}</div><div class="lab-sub">${counts[c]} item${counts[c] === 1 ? "" : "s"}</div><div class="lab-sub">Scan to see this shelf</div></div></div>`).join("") };
}
function spineLabelsHTML() {
  const items = labelItems();
  return { n: items.length, html: items.map(i => { const parts = callNumber(i).split(/\s+·\s+|\s+/).filter(Boolean);
    return `<div class="lab spine-lab">${parts.map((p, k) => `<div class="${k === 0 ? "sp-a" : "sp-b"}">${esc(p)}</div>`).join("")}<div class="sp-loc">${esc(i.loc)}</div></div>`; }).join("") };
}
function itemLabel(i) {
  return `<div class="lab item-lab"><div class="qr">${qrSvg(itemUrl(i.id))}</div><div class="lab-text"><div class="il-title">${esc(i.title)}</div>${i.creator ? `<div class="lab-sub">${esc(i.creator)}</div>` : ""}<div class="lab-sub mono">${esc(callNumber(i))}${i.loc ? " · " + esc(i.loc) : ""}</div></div></div>`;
}
function itemLabelsHTML() {
  const items = labelItems();
  return { n: items.length, html: items.map(itemLabel).join("") };
}
function labelsBody() {
  const t = S.lab.type;
  if (t === "everything") {                       // every shelf label, then every item label
    const a = shelfLabelsHTML(), b = itemLabelsHTML(), n = a.n + b.n;
    return { n, html: n ? `${a.n ? `<div class="lab-grid shelf" style="--cols:${S.lab.cols}">${a.html}</div>` : ""}${b.n ? `<div class="lab-grid item" style="--cols:${S.lab.cols}">${b.html}</div>` : ""}` : emptyLabels() };
  }
  const r = t === "shelf" ? shelfLabelsHTML() : t === "item" ? itemLabelsHTML() : spineLabelsHTML();
  return { n: r.n, html: r.n ? `<div class="lab-grid ${t}" style="--cols:${S.lab.cols}">${r.html}</div>` : emptyLabels() };
}
const emptyLabels = () => `<div class="empty">No labels to print. Give items a shelf code first (for example A3), or widen the shelf filter.</div>`;

/* One label for one item, from the QR button on a catalog card. */
function openItemQr(id) {
  const it = byId(id); if (!it) return;
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="QR label">
    <h2>QR label</h2><p class="note" style="margin:-6px 0 10px">Scanning it opens this ${it.kind === "game" ? "game" : "book"} on your friends page.${it.hidden ? " It is hidden from friends right now, so friends will see nothing until you show it." : ""}</p>
    <div class="lab-grid item" style="--cols:1;max-width:340px;margin:0 auto">${itemLabel(it)}</div>
    <div class="acts"><button class="btn" data-act="close">Close</button><button class="btn primary" data-act="print-one" data-id="${esc(id)}">Print this label</button></div></div></div>`;
}
function printHTML(html) {
  let el = document.getElementById("print-area");
  const temp = !el; if (temp) { el = document.createElement("div"); el.id = "print-area"; document.body.appendChild(el); }
  const keep = el.innerHTML; el.innerHTML = html;
  const done = () => { if (temp) el.remove(); else el.innerHTML = keep; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); window.print();
}
function renderLabels() {
  const L = S.lab, shelves = new Set(S.items.map(i => i.loc).filter(Boolean)), body = labelsBody();
  const opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${t}</option>`;
  const colChoices = L.type === "spine" ? [4, 6, 8, 10] : [2, 3, 4];
  if (!colChoices.includes(L.cols)) L.cols = colChoices[1];
  return `<div class="panel no-print"><h2>Labels</h2>
    <p class="note" style="margin-top:0"><strong>All at once:</strong> choose “Everything” and press Print once. <strong>One by one:</strong> use the QR button on any book or game in the catalog, or type a shelf code below. Item QR labels open that single book on your friends page. Shelf labels carry a QR code. Scanning it with a phone opens your friends page showing only that shelf. Spine labels carry the call number for sticking on book spines. Print on plain paper and cut along the dashed lines, or on a sticker sheet.</p>
    <div class="grid2">
      <label>Type<select id="lab-type">${opt("everything", "Everything: all shelf and all item QR labels", L.type)}${opt("shelf", "Shelf labels with QR code", L.type)}${opt("item", "Book and game labels with QR code", L.type)}${opt("spine", "Spine labels with call numbers", L.type)}</select></label>
      <label>Only shelves starting with<input type="text" id="lab-only" value="${esc(L.only)}" placeholder="all, or e.g. A, B2"></label>
      ${L.type !== "shelf" ? `<label>Items<select id="lab-kind">${opt("book", "Books", L.kind)}${opt("game", "Games", L.kind)}${opt("both", "Books and games", L.kind)}</select></label>` : ""}
      <label>Labels per row<select id="lab-cols">${colChoices.map(n => opt(n, n, L.cols)).join("")}</select></label></div>
    <div class="acts" style="padding:12px 0 0;justify-content:flex-start;align-items:center"><button class="btn primary" data-act="print-labels"${body.n ? "" : " disabled"}>Print ${body.n} label${body.n === 1 ? "" : "s"}</button>
      <span class="note">${shelves.size} shelf code${shelves.size === 1 ? "" : "s"} in use${L.type !== "shelf" && body.n > 400 ? ". That is a lot of labels. Printing in one go works, but you can also filter to one bookcase at a time." : ""}</span></div></div>
    <div id="print-area">${body.html}</div>`;
}
function updateLabels() {
  const area = document.getElementById("print-area"); if (!area) return;
  const b = labelsBody(); area.innerHTML = b.html;
  const btn = document.querySelector('[data-act="print-labels"]'); if (btn) { btn.disabled = !b.n; btn.textContent = "Print " + b.n + " label" + (b.n === 1 ? "" : "s"); }
}
document.addEventListener("click", e => { const t = e.target.closest('[data-act="print-labels"]'); if (t) window.print(); });
document.addEventListener("click", e => { const t = e.target.closest('[data-act="qr"]'); if (t) openItemQr(t.dataset.id); const o = e.target.closest('[data-act="print-one"]'); if (o) { const it = byId(o.dataset.id); if (it) printHTML(`<div class="lab-grid item" style="--cols:1;max-width:90mm">${itemLabel(it)}</div>`); } });
document.addEventListener("input", e => { if (e.target.id === "lab-only") { S.lab.only = e.target.value; updateLabels(); } });
document.addEventListener("change", e => {
  const id = e.target.id || "", v = e.target.value;
  if (id === "lab-type") { S.lab.type = v; render(); }
  else if (id === "lab-kind") { S.lab.kind = v; updateLabels(); }
  else if (id === "lab-cols") { S.lab.cols = +v; updateLabels(); }
});
