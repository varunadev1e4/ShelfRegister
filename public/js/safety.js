"use strict";
/* Safety: trash with undo, duplicate check on import, backups, restore, one-click fixes. */

async function loadMore() {
  S.needSchema = false;
  await Promise.all([loadSettings(), typeof loadLending === "function" ? loadLending() : 0, typeof loadRequests === "function" ? loadRequests() : 0]);
}
async function loadSettings() {
  try { const { data, error } = await sb.from("settings").select("*").limit(1); if (error) throw error; S.settings = data && data[0] ? data[0] : {}; }
  catch (e) { S.needSchema = true; }
}
function downloadText(filename, text, mime) {
  const blob = new Blob([(mime === "text/csv" ? "\ufeff" : "") + text], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function markBackup() {
  const d = today(); S.settings = { ...S.settings, last_backup: d };
  await sb.from("settings").upsert({ owner_id: S.session.user.id, last_backup: d }); render();
}

/* ---------- Banners above every tab ---------- */
function renderBanners() {
  const out = [];
  if (S.needSchema) out.push(`<div class="banner"><span><strong>Update the database.</strong> Some new features need the latest <span class="mono">supabase/schema.sql</span>. Run it in the Supabase SQL Editor (it is safe to run again), then reload.</span></div>`);
  const n = S.items.length + S.trash.length, last = S.settings && S.settings.last_backup;
  if (n && !S.needSchema && (!last || daysSince(last) > 30))
    out.push(`<div class="banner"><span>${last ? "Your last backup was " + daysSince(last) + " days ago." : "You have not downloaded a backup yet."} Supabase's free plan does not keep backups for you.</span><button class="btn small" data-act="backup-json">Download backup now</button></div>`);
  const od = typeof overdueItems === "function" ? overdueItems().length : 0;
  if (od && S.tab !== "lent") out.push(`<div class="banner"><span>${od} lent item${od === 1 ? " is" : "s are"} overdue.</span><button class="btn small" data-act="tab" data-tab="lent">See who</button></div>`);
  const nr = S.requests.filter(r => r.status === "new").length;
  if (nr && S.tab !== "requests") out.push(`<div class="banner"><span>${nr} new borrow request${nr === 1 ? "" : "s"} from friends.</span><button class="btn small" data-act="tab" data-tab="requests">Open requests</button></div>`);
  return out.join("");
}

/* ---------- Trash ---------- */
async function restoreItem(id) {
  const it = S.trash.find(i => i.id === id); if (!it) return;
  const { error } = await sb.from("items").update({ deleted_at: null }).eq("id", id);
  if (error) return toast("Not restored: " + error.message);
  S.trash = S.trash.filter(i => i.id !== id); S.items.push({ ...it, deletedAt: "" }); render(); toast("Restored “" + it.title + "”");
}
async function purgeItems(ids) {
  if (!ids.length) return;
  const { error } = await sb.from("items").delete().in("id", ids);
  if (error) return toast("Not deleted: " + error.message);
  S.trash = S.trash.filter(i => !ids.includes(i.id)); render();
}
function purgeOldTrash() {
  const old = S.trash.filter(i => (Date.now() - new Date(i.deletedAt).getTime()) > 30 * 864e5).map(i => i.id);
  if (old.length) purgeItems(old);
}

/* ---------- Import with duplicate check ---------- */
function importWithDupCheck(list) {
  const existing = dupIndex(allItems()), inFile = dupIndex([]), dupes = [], fresh = [];
  list.forEach(r => {
    const hit = existing.find(r), again = inFile.find(r);
    if (hit.length || again.length) dupes.push({ row: r, match: hit[0] || again[0], sameFile: !hit.length }); else fresh.push(r);
    inFile.add(r);
  });
  if (!dupes.length) { addMany(list); return; }
  S._imp = { list, fresh };
  const fileDupes = dupes.filter(d => d.sameFile).length;
  document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Possible duplicates">
    <h2>${dupes.length} of ${list.length} rows look like duplicates</h2>
    <p class="note" style="margin-top:0">${dupes.length - fileDupes} match items you already have${fileDupes ? ", and " + fileDupes + " repeat another row in the same file" : ""}. A match means the same ISBN, or the same title and author.</p>
    <div class="scroll" style="max-height:240px"><table><thead><tr><th>In the file</th><th>Matches</th></tr></thead><tbody>
    ${dupes.slice(0, 10).map(d => `<tr><td>${esc(d.row.title)}<div class="note">${esc(d.row.creator || "")}</div></td><td>${esc(d.match.title)}<div class="note">${d.sameFile ? "earlier in this file" : "shelf " + esc(d.match.loc || "not set")}</div></td></tr>`).join("")}
    </tbody></table></div>${dupes.length > 10 ? `<p class="note">…and ${dupes.length - 10} more.</p>` : ""}
    <div class="acts"><button class="btn" data-act="close">Cancel</button><button class="btn" data-act="imp-all">Import all ${list.length}</button><button class="btn primary" data-act="imp-skip"${fresh.length ? "" : " disabled"}>Skip duplicates, import ${fresh.length}</button></div></div></div>`;
}

/* ---------- Full backup and restore ---------- */
function backupObject() {
  return { app: "shelf-register", version: 2, exportedAt: new Date().toISOString(),
    items: [...S.items, ...S.trash].map(toRow),
    friends: S.friends.map(({ owner_id, ...r }) => r), loans: S.loans.map(({ owner_id, ...r }) => r),
    reading_goals: S.goals.map(g => ({ year: g.year, target: g.target })),
    reading_log: S.log.filter(l => l.id !== "tmp").map(l => ({ id: l.id, item_id: l.itemId, log_date: l.date, pages: l.pages })) };
}
function downloadBackupJSON() {
  downloadText("shelf-register-backup-" + today() + ".json", JSON.stringify(backupObject()), "application/json");
  markBackup(); toast("Backup downloaded");
}
function restoreFromFile(file) {
  const r = new FileReader();
  r.onerror = () => toast("Could not read that file.");
  r.onload = () => {
    let b; try { b = JSON.parse(String(r.result || "").replace(/^﻿/, "")); } catch (e) { return toast("That is not a backup file."); }
    if (!b || b.app !== "shelf-register" || !Array.isArray(b.items)) return toast("That is not a Shelf Register backup.");
    S._restore = b;
    document.getElementById("modal").innerHTML = `<div class="scrim" data-act="close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Restore backup" style="width:min(460px,100%)">
      <h2>Restore this backup?</h2><p>The file is from ${esc(String(b.exportedAt || "").slice(0, 10))} and holds ${b.items.length} items, ${(b.loans || []).length} loans, ${(b.friends || []).length} friends and ${(b.reading_goals || []).length} yearly goals.</p>
      <p class="note">Restoring adds or overwrites those records. It never deletes anything you have now. Items in the file replace items with the same id.</p>
      <div class="acts"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="restore-go">Restore</button></div></div></div>`;
  };
  r.readAsText(file);
}
async function restoreGo() {
  const b = S._restore; if (!b) return; closeModal(); setStatus("Restoring…");
  const up = async (table, rows, opts) => { for (let i = 0; i < rows.length; i += 500) { const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), opts); if (error) throw new Error(table + ": " + error.message); } };
  try {
    await up("items", b.items);
    await up("friends", b.friends || []);
    await up("loans", b.loans || []);
    await up("reading_goals", (b.reading_goals || []).map(g => ({ ...g, owner_id: S.session.user.id })), { onConflict: "owner_id,year" });
    await up("reading_log", b.reading_log || []);
    await loadItems(); toast("Backup restored");
  } catch (e) { toast("Restore stopped: " + e.message); await loadItems(); }
}

/* ---------- One-click fixes ---------- */
const needsCover = () => S.items.filter(i => i.kind === "book" && !i.coverUrl && cleanIsbn(i.isbn).length >= 10);
const needsSpelling = () => S.items.filter(i => i.kind === "book" && hasTelugu(i.title) && !i.titleEn);
function fillCovers() { const l = needsCover(); if (l.length) { saveMany(l.map(i => ({ ...i, coverUrl: isbnCover(i.isbn) }))); toast("Added cover links to " + l.length + " books"); } }
function fillSpellings() { const l = needsSpelling(); if (l.length) { saveMany(l.map(i => ({ ...i, titleEn: teluguToRoman(i.title), creatorEn: i.creatorEn || (hasTelugu(i.creator) ? teluguToRoman(i.creator) : "") }))); toast("Added English spellings to " + l.length + " books. Check a few and edit any that look off."); } }

/* ---------- Data tab ---------- */
function renderData() {
  const n = allItems().length, last = S.settings && S.settings.last_backup;
  const trash = S.trash.slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return `<div class="panel"><h2>Import a spreadsheet</h2>
    <p class="note" style="margin-top:0">Choose a CSV file with a header row. Columns understood: title, author, language, category, shelf, isbn, pages, series, notes. Add a “kind” column with the word game to import games. Telugu titles are detected, and their English spellings are filled in. Rows that match something you already own are shown to you before anything is added.</p>
    <input type="file" id="csvfile" accept=".csv,text/csv" aria-label="CSV file to import">
    <p class="note">Libib, Goodreads and most spreadsheet apps can export CSV.</p></div>
  <div class="panel"><h2>Backup</h2>
    <p class="note" style="margin-top:0">${n} item${n === 1 ? "" : "s"} in your Supabase database. ${last ? "Last backup: " + esc(last) + " (" + daysSince(last) + " days ago)." : "No backup downloaded yet."} The full backup holds items, loans, friends, goals and the reading diary. The CSV holds items only and opens in Excel.</p>
    <div class="acts" style="padding:0"><button class="btn primary" data-act="backup-json"${n ? "" : " disabled"}>Download full backup</button><button class="btn" data-act="export"${n ? "" : " disabled"}>Download items as CSV</button></div>
    <label style="margin-top:14px">Restore from a full backup<input type="file" id="restorefile" accept=".json,application/json" aria-label="Backup file to restore"></label></div>
  <div class="panel"><h2>Quick fixes</h2>
    <div class="acts" style="padding:0"><button class="btn" data-act="fill-covers"${needsCover().length ? "" : " disabled"}>Add cover links (${needsCover().length} books with an ISBN)</button>
    <button class="btn" data-act="fill-spellings"${needsSpelling().length ? "" : " disabled"}>Add English spellings (${needsSpelling().length} Telugu books)</button></div>
    <p class="note" style="margin-bottom:0">Covers come from Open Library by ISBN. A book with no cover there simply shows none.</p></div>
  <div class="panel"><h2>Trash</h2>${trash.length ? `<div class="scroll"><table><thead><tr><th>Item</th><th>Deleted</th><th></th></tr></thead><tbody>
    ${trash.map(i => `<tr><td>${esc(i.title)}<div class="note">${esc(i.creator || "")}</div></td><td class="mono">${esc(i.deletedAt.slice(0, 10))}</td><td style="white-space:nowrap"><button class="btn small" data-act="restore-item" data-id="${i.id}">Restore</button> <button class="btn small danger" data-act="purge-item" data-id="${i.id}">Delete forever</button></td></tr>`).join("")}</tbody></table></div>
    <div class="acts" style="padding:8px 0 0"><button class="btn small danger" data-act="empty-trash">Empty trash</button></div>` : `<p class="note" style="margin:0">Nothing in the trash. Deleted items wait here for 30 days, so a slip is never final.</p>`}</div>
  <div class="panel"><h2>Friends page</h2>
    <p class="note" style="margin-top:0">Friends see title, author, language, category, shelf, cover, series, your picks and whether an item is on the shelf. They never see your notes, quotes, ISBNs, reading status or who borrowed what.</p>
    <p class="mono" style="margin:0">${esc(location.origin)}/</p></div>`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "backup-json") downloadBackupJSON();
  else if (a === "restore-item") restoreItem(id);
  else if (a === "purge-item") purgeItems([id]);
  else if (a === "empty-trash") purgeItems(S.trash.map(i => i.id));
  else if (a === "restore-go") restoreGo();
  else if (a === "fill-covers") fillCovers();
  else if (a === "fill-spellings") fillSpellings();
  else if (a === "imp-all" && S._imp) { const l = S._imp.list; S._imp = null; closeModal(); addMany(l); }
  else if (a === "imp-skip" && S._imp) { const l = S._imp.fresh; S._imp = null; closeModal(); addMany(l); }
});
document.addEventListener("change", e => { if (e.target.id === "restorefile" && e.target.files[0]) restoreFromFile(e.target.files[0]); });
