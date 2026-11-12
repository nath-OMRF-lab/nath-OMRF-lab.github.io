/* Nath Lab site — shared behaviour */
(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---------- seeded random so decorations look the same every visit ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function el(name, attrs, parent) {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- butterfly made of SNP dots ---------- */
  const wings = document.getElementById("wing-dots");
  if (wings) {
    const r = rng(7);
    const colors = ["#d6c2f2", "#b794e6", "#9a6bd6", "#6fd8d2"];
    for (let i = 0; i < 950; i++) {
      const x = 10 + r() * 380;
      // denser toward the wing edges, like association peaks
      const y = 20 + r() * 300;
      const c = colors[Math.floor((x / 400) * 22) % 2 === 0 ? 0 : 1];
      el("circle", {
        cx: x.toFixed(1), cy: y.toFixed(1), r: (0.9 + r() * 2.1).toFixed(2),
        fill: r() < 0.06 ? colors[3] : (r() < 0.3 ? colors[2] : c),
        opacity: (0.55 + r() * 0.45).toFixed(2),
      }, wings);
    }
  }
  const helix = document.getElementById("helix");
  if (helix) {
    let a = "", b = "";
    for (let y = 118; y <= 268; y += 2) {
      const t = (y - 118) / 150 * Math.PI * 4;
      const xa = 200 + Math.sin(t) * 5, xb = 200 - Math.sin(t) * 5;
      a += (y === 118 ? "M" : "L") + xa.toFixed(2) + " " + y;
      b += (y === 118 ? "M" : "L") + xb.toFixed(2) + " " + y;
      if ((y - 118) % 10 === 0) el("line", { x1: xa, y1: y, x2: xb, y2: y, stroke: "#6fd8d2", "stroke-width": 1, opacity: .7 }, helix);
    }
    el("path", { d: a, fill: "none", stroke: "#ffffff", "stroke-width": 1.6 }, helix);
    el("path", { d: b, fill: "none", stroke: "#b794e6", "stroke-width": 1.6 }, helix);
  }

  /* ---------- illustrative Manhattan plot band ---------- */
  const mh = document.getElementById("manhattan");
  if (mh) {
    const W = 1200, H = 150, base = H - 14;
    // GRCh37 chromosome lengths (Mb)
    const len = [249, 243, 198, 191, 181, 171, 159, 146, 141, 136, 135, 134, 115, 107, 103, 90, 81, 78, 59, 63, 48, 51];
    const total = len.reduce((s, v) => s + v, 0);
    // lupus loci studied by the lab: [chr, relative position, peak height 0-1]
    const loci = [
      [1, 0.73, 0.62, "NCF2"], [2, 0.30, 0.55, "2p13.1"], [2, 0.67, 0.7, "IFIH1"],
      [6, 0.19, 1.0, "HLA"], [7, 0.74, 0.78, "IRF5"], [11, 0.90, 0.42, "ETS1", "end"],
      [12, 0.12, 0.74, "CDKN1B"], [12, 0.97, 0.66, "SLC15A4"], [15, 0.30, 0.64, "RASGRP1"],
      [16, 0.12, 0.4, "CLEC16A", "end"], [16, 0.34, 0.85, "ITGAM"], [19, 0.28, 0.6, "KLF2"],
    ];
    const r = rng(42);
    const g = el("g", {}, mh);
    let x0 = 0;
    const start = [];
    len.forEach((L, i) => {
      const w = (L / total) * W;
      start.push([x0, w]);
      const n = Math.round(L * 1.7);
      for (let k = 0; k < n; k++) {
        const y = -Math.log10(r()) * 0.12 * (base - 30);
        el("circle", { cx: (x0 + r() * w).toFixed(1), cy: (base - Math.min(y, base * .35)).toFixed(1), r: 1.5, fill: i % 2 ? "#9a6bd6" : "#d6c2f2", opacity: .75 }, g);
      }
      x0 += w;
    });
    // significance line
    const sig = base - (base - 30) * 0.45;
    el("line", { x1: 0, x2: W, y1: sig, y2: sig, stroke: "#6fd8d2", "stroke-dasharray": "4 5", "stroke-width": 1, opacity: .7 }, g);
    loci.forEach(([chr, pos, h, label, anchor]) => {
      const [sx, w] = start[chr - 1];
      const cx = sx + pos * w;
      const top = base - (base - 30) * h;
      for (let k = 0; k < 45; k++) {
        const u = r();
        const dx = (r() - 0.5) * 10 * (1 - u * 0.6);
        const y = base - (base - top) * Math.pow(u, 0.7);
        el("circle", { cx: (cx + dx).toFixed(1), cy: y.toFixed(1), r: 1.7, fill: y < sig ? "#ffffff" : (chr % 2 ? "#9a6bd6" : "#d6c2f2"), opacity: .9 }, g);
      }
      const t = el("text", { x: anchor ? cx + 4 : cx, y: top - 7, "text-anchor": anchor || "middle", fill: "#ffffff", "font-size": 11, "font-style": "italic", "font-family": "Inter, sans-serif", opacity: .92 }, g);
      t.textContent = label;
    });
    // chromosome ticks
    start.forEach(([sx, w], i) => {
      if (i < 20 || i === 21) {
        const t = el("text", { x: sx + w / 2, y: H - 2, "text-anchor": "middle", fill: "#b794e6", "font-size": 8, "font-family": "Inter, sans-serif" }, g);
        t.textContent = i + 1;
      }
    });
  }

  /* ---------- figures + lightbox ---------- */
  const lb = document.getElementById("lightbox");
  let lbList = [], lbIdx = 0, lastFocus = null;
  function showLb() {
    const f = lbList[lbIdx];
    lb.querySelector(".lb-img img").src = f.src;
    lb.querySelector(".lb-img img").alt = f.title;
    lb.querySelector(".lb-cap b").textContent = f.title;
    lb.querySelector(".lb-cap small").innerHTML = f.credit;
    lb.querySelector(".lb-count").textContent = (lbIdx + 1) + " / " + lbList.length;
    lb.querySelector(".lb-prev").disabled = lbIdx === 0;
    lb.querySelector(".lb-next").disabled = lbIdx === lbList.length - 1;
  }
  function openLb(list, idx) {
    if (!lb) return;
    lbList = list; lbIdx = idx; lastFocus = document.activeElement;
    lb.classList.add("open"); showLb();
    document.body.style.overflow = "hidden";
    lb.querySelector(".lb-close").focus();
  }
  function closeLb() {
    lb.classList.remove("open"); document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  if (lb) {
    lb.querySelector(".lb-close").addEventListener("click", closeLb);
    lb.querySelector(".lb-prev").addEventListener("click", () => { if (lbIdx > 0) { lbIdx--; showLb(); } });
    lb.querySelector(".lb-next").addEventListener("click", () => { if (lbIdx < lbList.length - 1) { lbIdx++; showLb(); } });
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowRight") lb.querySelector(".lb-next").click();
      if (e.key === "ArrowLeft") lb.querySelector(".lb-prev").click();
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function figuresFor(study, figs) {
    const credit = `${esc(study.authors)} (${study.year}) <i>${esc(study.journal)}</i>, ` +
      `<a href="https://doi.org/${study.doi}" target="_blank" rel="noopener">doi:${study.doi}</a>. ` +
      `Reproduced under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.`;
    return figs
      .filter((f) => f.article === study.id)
      .sort((a, b) => a.figure - b.figure || (a.continued ? 1 : 0) - (b.continued ? 1 : 0))
      .map((f) => {
        const t = f.title && f.title.length > 8 ? f.title : "";
        return {
          figure: f.figure,
          src: "assets/img/figures/" + f.file,
          title: `Figure ${f.figure}${f.continued ? " (continued)" : ""}${t ? ". " + t : ""}`,
          credit,
        };
      });
  }

  const containers = document.querySelectorAll("[data-studies]");
  if (containers.length) {
    Promise.all([
      fetch("assets/data/studies.json").then((r) => r.json()),
      fetch("assets/data/figures.json").then((r) => r.json()),
    ]).then(([studies, figs]) => {
      containers.forEach((box) => {
        const want = box.dataset.studies; // theme name, or comma list of ids, or "latest:N"
        let list;
        if (want.startsWith("latest:")) list = [...studies].sort((a, b) => b.year - a.year).slice(0, +want.split(":")[1]);
        else if (want.includes("_")) list = want.split(",").map((id) => studies.find((s) => s.id === id)).filter(Boolean);
        else list = studies.filter((s) => s.theme === want);
        box.innerHTML = "";
        list.forEach((s) => {
          const gallery = figuresFor(s, figs);
          const coverIdx = Math.max(0, gallery.findIndex((g) => g.figure === s.cover));
          const cover = gallery[coverIdx];
          const card = document.createElement("article");
          card.className = "card study";
          card.innerHTML = `
            <button class="study-fig" type="button" aria-label="Open figures from this study">
              <img src="${cover.src}" alt="${esc(cover.title)}" loading="lazy">
            </button>
            <div class="study-body">
              <div class="study-meta">${esc(s.journal)} · ${s.year}</div>
              <h3>${esc(s.title)}</h3>
              <p>${esc(s.summary)}</p>
              <div class="study-actions">
                <button class="btn btn-outline js-figs" type="button">View ${gallery.length} figures</button>
                <a class="btn btn-outline" href="https://doi.org/${s.doi}" target="_blank" rel="noopener">Read paper ↗</a>
              </div>
            </div>`;
          card.querySelector(".study-fig").addEventListener("click", () => openLb(gallery, coverIdx));
          card.querySelector(".js-figs").addEventListener("click", () => openLb(gallery, 0));
          box.appendChild(card);
        });
      });
    }).catch(() => {
      containers.forEach((b) => { b.innerHTML = '<p class="muted">Studies could not be loaded. If you opened this file directly, serve the folder over HTTP (e.g. <code>python -m http.server</code>).</p>'; });
    });
  }

  /* ---------- team as a planetary system (home page) ---------- */
  const sys = document.getElementById("orbit-system");
  const info = document.getElementById("orbit-info");
  if (sys && info) {
    fetch("assets/data/team.json").then((r) => r.json()).then((team) => {
      const face = (m, cls) => m.photo
        ? `<img class="${cls}" src="${m.photo}" alt="">`
        : `<div class="${cls} initials" aria-hidden="true">${esc(m.initials || "")}</div>`;
      function show(m, btn) {
        info.innerHTML = `${face(m, "oi-photo")}<h3>${esc(m.name)}</h3>
          <p class="oi-role">${esc(m.role)}</p><p>${esc(m.blurb)}</p>`;
        sys.querySelectorAll(".planet").forEach((p) => p.classList.toggle("active", p === btn));
      }
      function planet(m, cls) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "planet " + cls;
        b.setAttribute("aria-label", `${m.name}, ${m.role}`);
        b.innerHTML = face(m, "") + `<span class="planet-label">${esc(m.name.replace(/,? Ph\.D\./, ""))}</span>`;
        b.addEventListener("mouseenter", () => show(m, b));
        b.addEventListener("focus", () => show(m, b));
        b.addEventListener("click", () => { show(m, b); pinned = b; });
        sys.appendChild(b);
        return b;
      }
      let pinned = null, hovering = false;
      const sun = planet(team.pi, "sun");
      show(team.pi, sun);
      // orbit radii (fraction of system width), sizes and speeds (rad/s); inner orbit moves faster
      const rings = [{ r: 0.31, size: "15%", speed: 0.09 }, { r: 0.455, size: "13%", speed: 0.055 }];
      const bodies = [];
      team.orbits.forEach((members, ri) => {
        members.forEach((m, i) => {
          const el = planet(m, "");
          el.style.setProperty("--size", rings[ri].size);
          bodies.push({ el, ring: rings[ri], a0: (i / members.length) * Math.PI * 2 + ri * 0.6 });
        });
      });
      sys.addEventListener("mouseenter", () => { hovering = true; });
      sys.addEventListener("mouseleave", () => { hovering = false; });
      sys.addEventListener("focusin", () => { hovering = true; });
      sys.addEventListener("focusout", () => { hovering = false; });
      document.addEventListener("click", (e) => { if (!sys.contains(e.target)) pinned = null; });

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let t = 0, last = null;
      function place() {
        bodies.forEach((b) => {
          const a = b.a0 + t * b.ring.speed;
          b.el.style.left = (50 + Math.cos(a) * b.ring.r * 100) + "%";
          b.el.style.top = (50 + Math.sin(a) * b.ring.r * 100) + "%";
        });
      }
      function frame(now) {
        if (last !== null && !hovering && !pinned) t += Math.min(0.05, (now - last) / 1000);
        last = now; place();
        requestAnimationFrame(frame);
      }
      place();
      if (!still) requestAnimationFrame(frame);
    }).catch(() => { sys.parentElement.style.display = "none"; });
  }

  /* latest publications on the home page are written into index.html by build_site_assets.py */

  /* year in footer */
  document.querySelectorAll("[data-year]").forEach((n) => { n.textContent = new Date().getFullYear(); });
})();
