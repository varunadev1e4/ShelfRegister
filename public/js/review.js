"use strict";
/* Year in review: a one-page summary of a reading year. */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function bestStreak(y) {
  const set = new Set();
  S.log.forEach(l => { if (String(l.date).startsWith(y + "-")) set.add(l.date); });
  finishedIn(y).forEach(b => set.add(b.finishedOn));
  let best = 0, run = 0, prev = null;
  [...set].sort().forEach(d => { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}
const topBy = (list, key, dir) => list.slice().sort((a, b) => dir * (key(b) - key(a)))[0];
function renderReview(y) {
  const back = `<div class="bar"><button class="btn" data-act="rv-close">Back to the tracker</button></div>`;
  const fin = finishedIn(y).sort((a, b) => a.finishedOn.localeCompare(b.finishedOn));
  if (!fin.length) return back + `<div class="empty"><h2>${y} in books</h2><p>No finished books with a finish date in ${y} yet. Mark books as finished with a date and this page fills in.</p></div>`;
  const g = goalFor(y), pages = fin.reduce((s, b) => s + (b.pages || 0), 0);
  const timed = fin.filter(b => b.startedOn).map(b => ({ b, d: Math.max(1, daysBetween(b.startedOn, b.finishedOn)) }));
  const withPages = fin.filter(b => b.pages), rated = fin.filter(b => b.rating > 0);
  const months = monthCounts(y), busiest = months.indexOf(Math.max(...months));
  const authors = {}; fin.forEach(b => { if (b.creator) authors[b.creator] = (authors[b.creator] || 0) + 1; });
  const topAuthor = Object.entries(authors).sort((a, b) => b[1] - a[1])[0];
  const cats = {}; fin.forEach(b => { const c = catLabel(b) || "Other"; cats[c] = (cats[c] || 0) + 1; });
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${esc(c)} (${n})`).join(", ");
  const en = fin.filter(b => b.lang === "English").length, te = fin.filter(b => b.lang === "Telugu").length;
  const quotes = books().reduce((s, b) => s + (b.quotes || []).filter(q => String(q.d || "").startsWith(y + "-")).length, 0);
  const best = rated.length ? rated.slice().sort((a, b) => b.rating - a.rating || (b.pages || 0) - (a.pages || 0)).slice(0, 3) : [];
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "";
  const bk = (b, extra) => `<strong>${esc(b.title)}</strong>${extra ? " <span class='note'>" + extra + "</span>" : ""}`;
  const longest = withPages.length ? topBy(withPages, b => b.pages, 1) : null, shortest = withPages.length ? topBy(withPages, b => b.pages, -1) : null;
  const fast = timed.length ? topBy(timed, x => x.d, -1) : null, slow = timed.length ? topBy(timed, x => x.d, 1) : null;
  return back + `<div class="panel review-hero"><div class="note" style="letter-spacing:.08em;text-transform:uppercase">Year in review</div>
      <h2 style="font-size:30px;margin:2px 0 10px">${y} in books</h2>
      <div><span class="big" style="font-size:56px">${fin.length}</span> <span style="font-size:18px">book${fin.length === 1 ? "" : "s"} finished${pages ? ", " + pages.toLocaleString("en-IN") + " pages" : ""}</span></div>
      ${g ? `<p class="${fin.length >= g.target ? "ok" : "behind"}" style="margin:8px 0 0">${fin.length >= g.target ? "You beat your goal of " + g.target + " books." : "Your goal was " + g.target + " books. You reached " + Math.round(fin.length / g.target * 100) + "% of it."}</p>` : ""}</div>
    ${chartPanel(y)}
    <div class="panel"><h2>Highlights</h2><dl class="facts">
      ${row("Longest book", longest && bk(longest, longest.pages + " pages"))}
      ${row("Shortest book", shortest && shortest !== longest && bk(shortest, shortest.pages + " pages"))}
      ${row("Fastest read", fast && bk(fast.b, fast.d + (fast.d === 1 ? " day" : " days")))}
      ${row("Slowest read", slow && slow.b !== (fast && fast.b) && bk(slow.b, slow.d + " days"))}
      ${row("Highest rated", best.length && best.map(b => bk(b, "★".repeat(b.rating))).join("<br>"))}
      ${row("Most-read author", topAuthor && topAuthor[1] > 1 && `<strong>${esc(topAuthor[0])}</strong> <span class="note">${topAuthor[1]} books</span>`)}
      ${row("Busiest month", months[busiest] > 0 && `<strong>${MONTHS[busiest]}</strong> <span class="note">${months[busiest]} book${months[busiest] === 1 ? "" : "s"}</span>`)}
      ${row("Longest reading streak", bestStreak(y) > 1 && `<strong>${bestStreak(y)} days</strong> in a row`)}
      ${row("Languages", `${en} English, ${te} Telugu`)}
      ${row("Favourite categories", catList)}
      ${row("Average rating", rated.length && (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) + " ★ across " + rated.length + " rated")}
      ${row("Quotes saved", quotes > 0 && quotes)}
      ${row("First book finished", bk(fin[0], fin[0].finishedOn))}
      ${row("Latest book finished", fin.length > 1 && bk(fin[fin.length - 1], fin[fin.length - 1].finishedOn))}
    </dl></div>`;
}
