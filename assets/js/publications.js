/* Publications page: search, filter, sort */
(function () {
  "use strict";
  const list = document.getElementById("pub-list");
  const count = document.getElementById("pub-count");
  const q = document.getElementById("pub-q");
  const era = document.getElementById("pub-era");
  const sort = document.getElementById("pub-sort");
  const lab = document.getElementById("pub-lab");
  let pubs = [];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const markNath = (a) => esc(a).replace(/\b(SK Nath|S Nath|PDSK Nath)\b/g, "<mark>$1</mark>");
  const findUrl = (t) => "https://scholar.google.com/scholar?q=" + encodeURIComponent('"' + t + '"');

  function inEra(y) {
    if (era.value === "all") return true;
    if (!y) return false;
    const e = +era.value;
    if (e === 1990) return y < 2000;
    if (e === 2020) return y >= 2020;
    return y >= e && y < e + 10;
  }

  function row(p) {
    return `<div class="pub">
      <div>
        <div class="pub-title"><a href="${findUrl(p.title)}" target="_blank" rel="noopener">${esc(p.title)}</a></div>
        <div class="pub-authors">${markNath(p.authors)}</div>
        ${p.venue ? `<div class="pub-venue">${esc(p.venue)}</div>` : ""}
      </div>
      <div class="pub-side">
        ${p.citations ? `<span class="cites" title="Google Scholar citations">${p.citations.toLocaleString()} cited</span>` : ""}
        ${p.lab ? `<div><span class="badge-lab">Nath lab-led</span></div>` : ""}
      </div>
    </div>`;
  }

  function render() {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let items = pubs.filter((p) => {
      if (lab.checked && !p.lab) return false;
      if (!inEra(p.year)) return false;
      const hay = (p.title + " " + p.authors + " " + p.venue).toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    count.textContent = `${items.length} of ${pubs.length} publications`;
    if (!items.length) { list.innerHTML = '<p class="muted">No publications match.</p>'; return; }
    if (sort.value === "cites") {
      items = [...items].sort((a, b) => b.citations - a.citations);
      list.innerHTML = items.map(row).join("");
      return;
    }
    const groups = new Map();
    items.forEach((p) => {
      const k = p.year || "Undated";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    });
    list.innerHTML = [...groups].map(([y, ps]) =>
      `<div class="year-group"><h2>${y}</h2>${ps.map(row).join("")}</div>`).join("");
  }

  fetch("assets/data/publications.json").then((r) => r.json()).then((data) => {
    pubs = data;
    document.getElementById("pub-total").textContent = pubs.length;
    render();
  }).catch(() => {
    list.innerHTML = '<p class="muted">Publications could not be loaded. If you opened this file directly, serve the folder over HTTP (e.g. <code>python -m http.server</code>).</p>';
  });
  [q, era, sort, lab].forEach((n) => n.addEventListener("input", render));
})();
