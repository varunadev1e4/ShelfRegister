"use strict";
/* Things you borrow from other people: who, since when, due date, returned. Private to you. */
S.borrowed = [];
async function loadBorrowed() {
  try { S.borrowed = await fetchAll("borrowed", "borrowed_on"); } catch (e) { S.needSchema = true; }
}
const openBorrows = () => S.borrowed.filter(b => !b.returned_on);
const lateBorrows = () => openBorrows().filter(b => b.due_on && b.due_on < today());

function lenderMessage(b) {   // "I'm returning it" / "can I keep it a bit longer" starter, opened in WhatsApp
  const f = typeof friendByName === "function" ? friendByName(b.from_name) : null;
  const ph = phoneDigits(b.from_phone || (f && f.phone)), who = (b.from_name || "").split(" ")[0] || "there";
  const late = b.due_on && b.due_on < today();
  const text = late ? `Hi ${who}, sorry, I still have "${b.title}". Is it okay if I keep it a little longer? I will return it soon.`
                    : `Hi ${who}, about "${b.title}" that I borrowed from you. I will return it soon. Thanks again!`;
  return "https://wa.me/" + ph + "?text=" + encodeURIComponent(text);
}
function openBorrow(id) {
  const b = id ? S.borrowed.find(x => x.id === id) : null;
  const names = [...new Set([...S.friends.map(f => f.name), ...S.borrowed.map(x => x.from_name)])].sort();
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="bform" role="dialog" aria-modal="true" aria-label="${b ? "Edit borrowed item" : "Add borrowed item"}" style="width:min(480px,100%)">
    <h2>${b ? "Edit" : "I borrowed something"}</h2>
    <label style="margin-bottom:10px">Title<input type="text" id="b-title" required value="${esc(b ? b.title : "")}"></label>
    <label style="margin-bottom:10px">Author (optional)<input type="text" id="b-author" value="${esc(b ? b.author || "" : "")}"></label>
    <label style="margin-bottom:10px">Borrowed from<input type="text" id="b-from" list="b-dl" required autocomplete="off" value="${esc(b ? b.from_name : "")}"><datalist id="b-dl">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist></label>
    <label style="margin-bottom:10px">Their phone (optional, for WhatsApp)<input type="text" id="b-phone" value="${esc(b ? b.from_phone || "" : "")}" placeholder="10 digits, or with country code"></label>
    <div class="grid2"><label>Borrowed on<input type="date" id="b-date" value="${esc(b ? b.borrowed_on : today())}"></label>
    <label>Return by<input type="date" id="b-due" value="${esc(b ? b.due_on || "" : addDays(today(), 30))}"></label></div>
    <label style="margin-top:10px">Notes<input type="text" id="b-notes" value="${esc(b ? b.notes || "" : "")}"></label>
    <div class="acts">${b ? `<button type="button" class="btn danger" data-act="bw-del" data-id="${b.id}" style="margin-right:auto">Delete</button>` : ""}<button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Save</button></div></form></div>`;
  document.getElementById("bform").onsubmit = async e => {
    e.preventDefault();
    const g = x => document.getElementById(x).value.trim();
    const row = { title: g("b-title"), author: g("b-author") || null, from_name: g("b-from"), from_phone: g("b-phone") || null, borrowed_on: g("b-date") || today(), due_on: g("b-due") || null, notes: g("b-notes") || null };
    if (!row.title || !row.from_name) return;
    closeModal();
    if (b) {
      Object.assign(b, row); render();
      const { error } = await sb.from("borrowed").update(row).eq("id", b.id);
      return toast(error ? "Not saved: " + error.message : "Saved");
    }
    const { data, error } = await sb.from("borrowed").insert(row).select().single();
    if (error) return toast("Not saved: " + error.message);
    S.borrowed.push(data); render(); toast("Added. Remember to return it to " + row.from_name);
  };
  document.getElementById("b-title").focus();
}
async function bwReturn(id) {
  const b = S.borrowed.find(x => x.id === id); if (!b) return;
  b.returned_on = today(); render();
  const { error } = await sb.from("borrowed").update({ returned_on: today() }).eq("id", id);
  if (error) { b.returned_on = null; render(); return toast("Not saved: " + error.message); }
  toast("Marked as returned", { label: "Undo", fn: async () => { b.returned_on = null; render(); await sb.from("borrowed").update({ returned_on: null }).eq("id", id); } });
}
async function bwExtend(id, days) {
  const b = S.borrowed.find(x => x.id === id); if (!b) return;
  const base = b.due_on && b.due_on > today() ? b.due_on : today(), due = addDays(base, days);
  b.due_on = due; render();
  await sb.from("borrowed").update({ due_on: due }).eq("id", id); toast("Now due " + due);
}
function renderBorrowed() {
  const open = openBorrows().sort((a, b) => (a.due_on || "9999").localeCompare(b.due_on || "9999")), done = S.borrowed.filter(b => b.returned_on).sort((a, b) => b.returned_on.localeCompare(a.returned_on));
  const late = lateBorrows().length;
  const by = {}; open.forEach(b => (by[b.from_name] = by[b.from_name] || []).push(b));
  return `<div class="bar" style="align-items:center"><button class="btn primary" data-act="bw-add">I borrowed something</button>
    <span class="count" style="margin:0">${open.length} to return${late ? ` · <span class="behind">${late} overdue</span>` : ""}</span></div>` +
    (open.length ? Object.entries(by).map(([who, list]) => `<div class="panel"><h2>${esc(who)}</h2><div class="scroll"><table><thead><tr><th>Item</th><th>Since</th><th>Return by</th><th></th></tr></thead><tbody>
      ${list.map(b => { const lt = b.due_on && b.due_on < today(), n = lt ? daysBetween(b.due_on, today()) : 0;
        return `<tr><td>${esc(b.title)}${b.author ? `<div class="note">${esc(b.author)}</div>` : ""}${b.notes ? `<div class="note">${esc(b.notes)}</div>` : ""}</td><td class="mono">${esc(b.borrowed_on)}</td>
        <td>${b.due_on ? `<span class="mono">${esc(b.due_on)}</span>${lt ? `<div class="behind">${n} day${n === 1 ? "" : "s"} overdue</div>` : ""}` : `<span class="note">no date</span>`}</td>
        <td style="white-space:nowrap"><button class="btn small primary" data-act="bw-return" data-id="${b.id}">Returned</button> <button class="btn small" data-act="bw-extend" data-id="${b.id}">+7 days</button> <a class="btn small" target="_blank" rel="noopener" href="${esc(lenderMessage(b))}">Message</a> <button class="btn small" data-act="bw-edit" data-id="${b.id}">Edit</button></td></tr>`; }).join("")}
      </tbody></table></div></div>`).join("")
    : `<div class="empty"><h2>Nothing borrowed right now</h2><p>When you borrow a book or game from someone, add it here with a return date, so it goes back on time.</p></div>`) +
    (done.length ? `<details class="panel"><summary><strong>Returned (${done.length})</strong></summary><div class="scroll"><table><thead><tr><th>Item</th><th>From</th><th>Borrowed</th><th>Returned</th></tr></thead><tbody>
      ${done.map(b => `<tr><td>${esc(b.title)}</td><td>${esc(b.from_name)}</td><td class="mono">${esc(b.borrowed_on)}</td><td class="mono">${esc(b.returned_on)}</td></tr>`).join("")}</tbody></table></div></details>` : "");
}
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "bw-add") openBorrow();
  else if (a === "bw-edit") openBorrow(id);
  else if (a === "bw-return") bwReturn(id);
  else if (a === "bw-extend") bwExtend(id, 7);
  else if (a === "bw-del") {
    const { error } = await sb.from("borrowed").delete().eq("id", id);
    if (error) return toast("Not deleted: " + error.message);
    S.borrowed = S.borrowed.filter(b => b.id !== id); closeModal(); render(); toast("Deleted");
  }
});
