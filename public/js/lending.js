"use strict";
/* Lending: due dates, overdue reminders, friends list and loan history. */

async function loadLending() {
  try {
    S.friends = await fetchAll("friends", "name");
    S.loans = await fetchAll("loans", "lent_on");
  } catch (e) { S.needSchema = true; }
}

const loanDays = () => +CFG.LOAN_DAYS || 14;
const addDays = (ymdStr, n) => { const d = parseYMD(ymdStr); d.setDate(d.getDate() + n); return ymd(d); };
const lentItems = () => S.items.filter(i => i.status === "lent");
const overdueItems = () => lentItems().filter(i => i.dueOn && i.dueOn < today());
const daysOverdue = i => daysBetween(i.dueOn, today());
const friendByName = n => S.friends.find(f => norm(f.name) === norm(n));

/* ---------- WhatsApp reminder ---------- */
function phoneDigits(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 10 ? String(CFG.DEFAULT_COUNTRY_CODE || "91") + d : d.replace(/^0+/, "");
}
function reminderLink(i) {
  const f = friendByName(i.lentTo), who = (i.lentTo || "").split(" ")[0] || "there";
  const when = !i.dueOn ? "" : i.dueOn < today() ? ` It was due on ${i.dueOn}.` : ` It is due on ${i.dueOn}.`;
  const text = `Hi ${who}, a friendly reminder about "${i.title}", which you borrowed on ${i.lentOn}.${when} Could you bring it back when you can? Thanks!`;
  const ph = phoneDigits(f && f.phone);
  return `https://wa.me/${ph}?text=${encodeURIComponent(text)}`;
}

/* ---------- Lending and returning ---------- */
function openLend(id, who) {
  const it = byId(id); if (!it) return;
  const names = [...new Set([...S.friends.map(f => f.name), ...S.loans.map(l => l.friend_name)])].sort();
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="lendform" role="dialog" aria-modal="true" aria-label="Lend item" style="width:min(460px,100%)">
    <h2>Lend “${esc(it.title)}”</h2>
    <label style="margin-bottom:10px">Who is borrowing it<input type="text" id="l-who" list="friends-dl" required value="${esc(who || "")}" autocomplete="off"><datalist id="friends-dl">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist></label>
    <div class="grid2"><label>Lent on<input type="date" id="l-date" value="${today()}"></label>
    <label>Due back<input type="date" id="l-due" value="${addDays(today(), loanDays())}"></label></div>
    <p class="note" id="l-hint" style="margin:8px 0 0"></p>
    <div class="acts"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Lend out</button></div></form></div>`;
  const date = document.getElementById("l-date"), due = document.getElementById("l-due"), hint = document.getElementById("l-hint");
  date.onchange = () => { if (date.value) due.value = addDays(date.value, loanDays()); };
  document.getElementById("l-who").oninput = e => { const f = friendByName(e.target.value.trim()); hint.textContent = e.target.value.trim() && !f ? "New name. They will be added to your Friends list." : ""; };
  document.getElementById("lendform").onsubmit = e => {
    e.preventDefault();
    lendItem(it, document.getElementById("l-who").value.trim(), date.value || today(), due.value || "");
    closeModal();
  };
  document.getElementById("l-who").focus();
}
async function lendItem(it, who, lentOn, dueOn) {
  if (!who) return;
  saveItem({ ...it, status: "lent", lentTo: who, lentOn, dueOn });
  S.loans.push({ id: "tmp" + uid(), item_id: it.id, friend_name: who, lent_on: lentOn, due_on: dueOn || null, returned_on: null });
  const { error } = await sb.from("loans").insert({ item_id: it.id, friend_name: who, lent_on: lentOn, due_on: dueOn || null });
  if (error) toast("Lent, but the loan history could not be saved.");
  let added = false;
  if (!friendByName(who)) {
    const row = { name: who }; S.friends.push({ id: "tmp" + uid(), ...row, phone: null, note: null });
    const r = await sb.from("friends").insert(row); added = !r.error;
  }
  toast(added ? "Lent to " + who + ". Add their phone in Friends to send reminders." : "Lent to " + who);
  const rq = S._lendReq && S.requests.find(r => r.id === S._lendReq && r.item_id === it.id);
  if (rq) setRequestStatus(rq.id, "done");
  S._lendReq = null;
}
async function returnItem(id) {
  const it = byId(id); if (!it) return;
  const { lentTo, lentOn, dueOn, ...rest } = it;
  saveItem({ ...rest, status: "shelf", lentTo: "", lentOn: "", dueOn: "" });
  S.loans.forEach(l => { if (l.item_id === id && !l.returned_on) l.returned_on = today(); });
  await sb.from("loans").update({ returned_on: today() }).eq("item_id", id).is("returned_on", null);
  toast("Marked as returned");
}
async function extendDue(id, days) {
  const it = byId(id); if (!it) return;
  const base = it.dueOn && it.dueOn > today() ? it.dueOn : today(), due = addDays(base, days);
  saveItem({ ...it, dueOn: due });
  S.loans.forEach(l => { if (l.item_id === id && !l.returned_on) l.due_on = due; });
  await sb.from("loans").update({ due_on: due }).eq("item_id", id).is("returned_on", null);
  toast("Now due " + due);
}

/* ---------- Lent out tab ---------- */
function renderLent() {
  const lent = lentItems().sort((a, b) => (a.dueOn || "9999").localeCompare(b.dueOn || "9999"));
  if (!lent.length) return `<div class="empty"><h2>Nothing is lent out</h2><p>When a friend borrows a book or game, use “Lend out” on its card. It will be listed here with its due date.</p></div>`;
  const od = overdueItems().length, by = {};
  lent.forEach(i => (by[i.lentTo || "Unknown"] = by[i.lentTo || "Unknown"] || []).push(i));
  return `<p class="count">${lent.length} item${lent.length > 1 ? "s" : ""} out with ${Object.keys(by).length} friend${Object.keys(by).length > 1 ? "s" : ""}${od ? " · " + od + " overdue" : ""}</p>` +
    Object.entries(by).map(([who, list]) => `<div class="panel"><h2>${esc(who)}</h2><div class="scroll"><table><thead><tr><th>Item</th><th>Out since</th><th>Due back</th><th></th></tr></thead><tbody>
      ${list.map(i => { const late = i.dueOn && i.dueOn < today();
        return `<tr><td>${esc(i.title)}<div class="note mono">${esc(callNumber(i))}</div></td><td class="mono">${esc(i.lentOn || "")}</td>
        <td>${i.dueOn ? `<span class="mono">${esc(i.dueOn)}</span>${late ? `<div class="behind">${daysOverdue(i)} day${daysOverdue(i) === 1 ? "" : "s"} overdue</div>` : ""}` : `<span class="note">no date</span>`}</td>
        <td style="white-space:nowrap"><a class="btn small" target="_blank" rel="noopener" href="${esc(reminderLink(i))}">Remind</a> <button class="btn small" data-act="extend" data-id="${i.id}">+7 days</button> <button class="btn small" data-act="return" data-id="${i.id}">Returned</button></td></tr>`; }).join("")}
      </tbody></table></div></div>`).join("");
}

/* ---------- Friends tab ---------- */
function friendStats(name) {
  const loans = S.loans.filter(l => norm(l.friend_name) === norm(name));
  const has = lentItems().filter(i => norm(i.lentTo) === norm(name));
  return { loans, has, late: has.filter(i => i.dueOn && i.dueOn < today()).length };
}
function renderFriends() {
  const names = new Map();
  S.friends.forEach(f => names.set(norm(f.name), f.name));
  S.loans.forEach(l => { if (!names.has(norm(l.friend_name))) names.set(norm(l.friend_name), l.friend_name); });
  const list = [...names.values()].map(n => ({ name: n, f: friendByName(n), ...friendStats(n) }))
    .sort((a, b) => (b.has.length - a.has.length) || a.name.localeCompare(b.name));
  const titleOf = id => { const it = S.items.concat(S.trash).find(i => i.id === id); return it ? it.title : "(deleted item)"; };
  return `<div class="panel"><h2>Add a friend</h2><form id="friendform" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));align-items:end">
      <label>Name<input type="text" id="fr-name" required></label><label>Phone (for WhatsApp reminders)<input type="text" id="fr-phone" placeholder="10 digits, or with country code"></label>
      <label>Note<input type="text" id="fr-note"></label><button class="btn primary" type="submit">Add friend</button></form></div>
    ${list.length ? list.map(x => `<div class="panel"><div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;justify-content:space-between"><h2 style="margin:0">${esc(x.name)}</h2>
      <span>${x.f ? `<button class="btn small" data-act="fr-edit" data-id="${x.f.id}">Edit</button>` : ""}</span></div>
      <p class="note" style="margin:4px 0 8px">${x.f && x.f.phone ? "Phone " + esc(x.f.phone) + " · " : '<span class="behind">No phone yet</span> · '}${x.has.length} out now${x.late ? `, <span class="behind">${x.late} overdue</span>` : ""} · ${x.loans.length} borrowed in total${x.f && x.f.note ? " · " + esc(x.f.note) : ""}</p>
      ${x.has.length ? `<div>${x.has.map(i => `<span class="chip lent" style="margin-right:6px">${esc(i.title)}${i.dueOn ? " · due " + esc(i.dueOn) : ""}</span>`).join("")}</div>` : ""}
      ${x.loans.length ? `<details style="margin-top:8px"><summary>Borrowing history</summary><div class="scroll"><table><thead><tr><th>Item</th><th>Lent</th><th>Due</th><th>Returned</th></tr></thead><tbody>
        ${x.loans.slice().sort((a, b) => b.lent_on.localeCompare(a.lent_on)).map(l => `<tr><td>${esc(titleOf(l.item_id))}</td><td class="mono">${esc(l.lent_on)}</td><td class="mono">${esc(l.due_on || "")}</td><td class="mono">${l.returned_on ? esc(l.returned_on) : "<span class='note'>not yet</span>"}</td></tr>`).join("")}</tbody></table></div></details>` : ""}</div>`).join("")
    : `<div class="empty"><h2>No friends yet</h2><p>Add a friend above, or just lend something. Anyone you lend to is added here automatically.</p></div>`}`;
}
function openFriend(id) {
  const f = S.friends.find(x => x.id === id); if (!f) return;
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><form class="sheet" id="fedit" role="dialog" aria-modal="true" aria-label="Edit friend" style="width:min(420px,100%)">
    <h2>Edit friend</h2><label style="margin-bottom:10px">Name<input type="text" id="fe-name" required value="${esc(f.name)}"></label>
    <label style="margin-bottom:10px">Phone<input type="text" id="fe-phone" value="${esc(f.phone || "")}"></label><label>Note<input type="text" id="fe-note" value="${esc(f.note || "")}"></label>
    <div class="acts"><button type="button" class="btn danger" data-act="fr-del" data-id="${f.id}" style="margin-right:auto">Delete friend</button><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Save</button></div></form></div>`;
  document.getElementById("fedit").onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById("fe-name").value.trim(), old = f.name;
    const row = { name, phone: document.getElementById("fe-phone").value.trim() || null, note: document.getElementById("fe-note").value.trim() || null };
    const { error } = await sb.from("friends").update(row).eq("id", id);
    if (error) return toast("Not saved: " + error.message);
    Object.assign(f, row);
    if (name !== old) {   // keep history and current loans pointing at the new name
      S.loans.forEach(l => { if (l.friend_name === old) l.friend_name = name; });
      await sb.from("loans").update({ friend_name: name }).eq("friend_name", old);
      const cur = lentItems().filter(i => i.lentTo === old); if (cur.length) saveMany(cur.map(i => ({ ...i, lentTo: name })));
    }
    closeModal(); render(); toast("Saved");
  };
}
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "extend") extendDue(id, 7);
  else if (a === "fr-edit") openFriend(id);
  else if (a === "fr-del") {
    const { error } = await sb.from("friends").delete().eq("id", id);
    if (error) return toast("Not deleted: " + error.message);
    S.friends = S.friends.filter(f => f.id !== id); closeModal(); render(); toast("Friend removed. Their loan history is kept.");
  }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "friendform") return;
  e.preventDefault();
  const name = document.getElementById("fr-name").value.trim(); if (!name) return;
  if (friendByName(name)) return toast(name + " is already on your list.");
  const row = { name, phone: document.getElementById("fr-phone").value.trim() || null, note: document.getElementById("fr-note").value.trim() || null };
  const { error } = await sb.from("friends").insert(row);
  if (error) return toast("Not saved: " + error.message);
  S.friends.push({ id: "tmp" + uid(), ...row }); await loadLending(); render(); toast("Added " + name);
});
