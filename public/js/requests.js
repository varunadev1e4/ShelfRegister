"use strict";
/* Owner inbox for borrow requests sent from the friends page. */

async function loadRequests() {
  try { S.requests = await fetchAll("borrow_requests", "created_at"); }
  catch (e) { S.needSchema = true; }
}
const whenText = iso => { try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return String(iso || "").slice(0, 10); } };

function contactLink(r) {
  const c = String(r.contact || "").trim();
  const text = `Hi ${String(r.requester_name || "").split(" ")[0]}, about "${r.item_title || "the book"}": `;
  if (c.includes("@")) return { label: "Reply by email", href: "mailto:" + encodeURIComponent(c) + "?subject=" + encodeURIComponent("Re: " + (r.item_title || "your request")) + "&body=" + encodeURIComponent(text) };
  const ph = phoneDigits(c);
  return ph.length >= 10 ? { label: "Reply on WhatsApp", href: "https://wa.me/" + ph + "?text=" + encodeURIComponent(text) } : null;
}
function requestCard(r) {
  const it = S.items.find(i => i.id === r.item_id), link = contactLink(r), isNew = r.status === "new";
  const state = !it ? `<span class="chip">Item no longer in the catalog</span>` : it.status === "lent" ? `<span class="chip lent">Lent to ${esc(it.lentTo || "someone")} right now</span>` : `<span class="chip">On the shelf${it.loc ? " · " + esc(it.loc) : ""}</span>`;
  return `<div class="panel" style="margin-bottom:10px"><div style="display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:space-between;align-items:baseline">
      <h3 style="margin:0;overflow-wrap:anywhere">${esc(r.item_title || "Item")}</h3><span class="note mono">${esc(whenText(r.created_at))}</span></div>
    <p style="margin:6px 0"><strong>${esc(r.requester_name)}</strong> · <span class="mono" style="user-select:all">${esc(r.contact)}</span></p>
    ${r.message ? `<p style="margin:0 0 8px;overflow-wrap:anywhere">“${esc(r.message)}”</p>` : ""}
    <div class="meta" style="padding:0 0 8px">${state}${!isNew ? `<span class="chip">${r.status === "done" ? "Handled" : "Declined"}</span>` : ""}</div>
    <div class="acts" style="padding:0">
      ${isNew && it && it.status !== "lent" ? `<button class="btn small primary" data-act="rq-lend" data-id="${r.id}">Lend to ${esc(r.requester_name.split(" ")[0])}</button>` : ""}
      ${link ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(link.href)}">${link.label}</a>` : ""}
      ${isNew ? `<button class="btn small" data-act="rq-done" data-id="${r.id}">Mark handled</button><button class="btn small" data-act="rq-decline" data-id="${r.id}">Decline</button>` : `<button class="btn small" data-act="rq-reopen" data-id="${r.id}">Reopen</button>`}
      <button class="btn small danger" data-act="rq-delete" data-id="${r.id}">Delete</button></div></div>`;
}
function renderRequests() {
  const all = S.requests.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const fresh = all.filter(r => r.status === "new"), old = all.filter(r => r.status !== "new");
  if (!all.length) return `<div class="empty"><h2>No requests yet</h2><p>When a friend taps Request on the friends page, it lands here with their name and contact. They never see each other's requests.</p></div>`;
  return `<p class="count">${fresh.length} new · ${old.length} handled</p>
    ${fresh.length ? fresh.map(requestCard).join("") : `<div class="empty" style="margin-bottom:14px">All caught up.</div>`}
    ${old.length ? `<details><summary style="cursor:pointer;margin:6px 0 10px">Handled and declined (${old.length})</summary>${old.map(requestCard).join("")}</details>` : ""}`;
}
async function setRequestStatus(id, status) {
  const r = S.requests.find(x => x.id === id); if (!r) return;
  const prev = r.status; r.status = status; render();
  const { error } = await sb.from("borrow_requests").update({ status }).eq("id", id);
  if (error) { r.status = prev; render(); toast("Not saved: " + error.message); }
}
async function deleteRequest(id) {
  const prev = S.requests; S.requests = S.requests.filter(x => x.id !== id); render();
  const { error } = await sb.from("borrow_requests").delete().eq("id", id);
  if (error) { S.requests = prev; render(); toast("Not deleted: " + error.message); }
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "rq-done") setRequestStatus(id, "done");
  else if (a === "rq-decline") setRequestStatus(id, "declined");
  else if (a === "rq-reopen") setRequestStatus(id, "new");
  else if (a === "rq-delete") deleteRequest(id);
  else if (a === "rq-lend") { const r = S.requests.find(x => x.id === id); if (r) { S._lendReq = r.id; openLend(r.item_id, r.requester_name); } }
});
/* Check for new requests every two minutes while the owner app is open. */
setInterval(async () => {
  if (!S.session || !S.ready || document.hidden) return;
  const before = S.requests.filter(r => r.status === "new").length;
  await loadRequests();
  const now = S.requests.filter(r => r.status === "new").length;
  if (now > before) { toast("New borrow request"); render(); }
}, 120000);
