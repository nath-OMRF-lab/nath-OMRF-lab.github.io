/* Nath Lab — interactive lupus loci page (five views over assets/data/loci.json) */
(function () {
  "use strict";
  if (!window.d3) return;

  const canvas = document.getElementById("viz-canvas");
  const card = document.getElementById("viz-card");
  const help = document.getElementById("viz-help");
  const controls = document.getElementById("viz-controls");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ROLE = {
    lab: { label: "Nath lab led", color: "#6fd8d2" },
    partner: { label: "Co-led with partners", color: "#f4c06a" },
    collab: { label: "Consortium co-author", color: "#b794e6" },
  };
  const ANC = {
    EA: { label: "European ancestry", lonlat: [10, 50] },
    AA: { label: "African American", lonlat: [-78, 37] },
    HA: { label: "Hispanic / Amerindian", lonlat: [-99, 19] },
    EAS: { label: "East Asian", lonlat: [116, 36] },
    IND: { label: "South Asian", lonlat: [78, 21] },
    EGY: { label: "Egyptian", lonlat: [31, 27] },
  };
  const PATHWAY = {
    "Region (linkage)": "#8f80ad",
    "Antigen presentation": "#f2a7cf",
    "Immune complexes & phagocytes": "#f4c06a",
    "B-cell signalling": "#6fd8d2",
    "T-cell signalling & cytokines": "#86b6ff",
    "Interferon & innate immunity": "#ff8f8f",
    "Autophagy & lysosome": "#b6e38a",
    "Cell cycle & apoptosis": "#e2a6ff",
    "Gene regulation": "#cfc6e0",
  };
  // GRCh37 chromosome lengths (Mb); 23 = X
  const LEN = [249, 243, 198, 191, 181, 171, 159, 146, 141, 136, 135, 134, 115, 107, 103, 90, 81, 78, 59, 63, 48, 51, 155];
  const CHR_NAME = (c) => (c === 23 ? "X" : String(c));

  let ALL = [], data = [], current = "timeline", cleanup = null;
  const roles = new Set(["lab", "partner", "collab"]);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isRegion = (d) => d.end - d.start > 1;
  const pos = (d) => (d.start + d.end) / 2;
  // peak height: kind of evidence, not significance
  function height(d) {
    const base = { Linkage: 0.38, "Candidate gene": 0.55, GWAS: 0.72, "Admixture mapping": 0.72, "Fine-mapping": 0.82 }[d.method] || 0.6;
    return Math.min(1, base + (d.variant !== "Not resolved" && d.variant !== "Region only" ? 0.16 : 0));
  }
  function paperLink(d) {
    return d.doi ? "https://doi.org/" + d.doi : "https://scholar.google.com/scholar?q=" + encodeURIComponent('"' + d.paper + '"');
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- side card ---------- */
  function intro() {
    card.innerHTML = `<span class="vc-kicker">How to read this</span>
      <h3>Point at or tap a locus</h3>
      <p>Details of each region or gene appear here: when it was reported, how it was found, which populations it was seen in, and the paper behind it.</p>
      <div class="vc-legend">${Object.entries(ROLE).map(([k, r]) => `<span><i style="background:${r.color}"></i>${r.label}</span>`).join("")}</div>`;
  }
  function showLocus(d) {
    const where = isRegion(d) ? `chr${CHR_NAME(d.chr)}: ${d.start}–${d.end} Mb` : `chr${CHR_NAME(d.chr)}: ${d.start} Mb`;
    card.innerHTML = `<span class="vc-kicker" style="color:${ROLE[d.role].color}">${ROLE[d.role].label}</span>
      <h3>${esc(d.label)}</h3>
      <dl>
        <dt>Reported</dt><dd>${d.year}</dd>
        <dt>Position</dt><dd>${where}</dd>
        <dt>Found by</dt><dd>${esc(d.method)}</dd>
        <dt>Variant</dt><dd>${esc(d.variant)}</dd>
        <dt>Biology</dt><dd><i class="dot" style="background:${PATHWAY[d.pathway]}"></i>${esc(d.pathway)}</dd>
        <dt>Phenotype</dt><dd>${esc(d.disease)}</dd>
        <dt>Populations</dt><dd>${d.ancestry.map((a) => ANC[a] ? ANC[a].label : a).join(", ")}</dd>
      </dl>
      <p class="vc-paper">${esc(d.paper)}</p>
      <div class="vc-actions">
        <a class="btn btn-outline-light" href="${paperLink(d)}" target="_blank" rel="noopener">${d.doi ? "Read paper ↗" : "Find paper ↗"}</a>
        ${d.study ? `<a class="btn btn-outline-light" href="research.html">See figures</a>` : ""}
      </div>`;
  }
  function showGroup(title, kicker, list) {
    card.innerHTML = `<span class="vc-kicker">${esc(kicker)}</span><h3>${esc(title)}</h3>
      <p>${list.length} loci</p>
      <div class="vc-chips">${list.map((d, i) => `<button type="button" data-i="${i}" style="--c:${ROLE[d.role].color}">${esc(d.label)}</button>`).join("")}</div>`;
    card.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => showLocus(list[+b.dataset.i])));
  }

  /* ---------- shared svg ---------- */
  function svg(w, h) {
    canvas.innerHTML = "";
    return d3.select(canvas).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img");
  }
  function glow(s) {
    const f = s.append("defs").append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    f.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "b");
    const m = f.append("feMerge"); m.append("feMergeNode").attr("in", "b"); m.append("feMergeNode").attr("in", "SourceGraphic");
  }

  /* ========== 1. discovery timeline (Manhattan) ========== */
  function timeline() {
    help.textContent = "Press play to watch the loci appear year by year, or drag the slider. Wide bands are linkage regions; peaks are genes.";
    const W = 1100, H = 500, base = 430, top = 130;
    const s = svg(W, H); glow(s);
    const total = d3.sum(LEN), x0 = []; let acc = 0;
    LEN.forEach((L) => { x0.push(acc); acc += L; });
    const X = (chr, mb) => 30 + ((x0[chr - 1] + mb) / total) * (W - 60);
    const Y = (h) => base - h * (base - top);

    const yearText = s.append("text").attr("class", "tl-year").attr("x", W - 34).attr("y", 52).attr("text-anchor", "end");
    const countText = s.append("text").attr("class", "tl-count").attr("x", W - 36).attr("y", 76).attr("text-anchor", "end");

    // background SNP cloud
    const r = rng(11), bg = s.append("g").attr("opacity", 0.5);
    LEN.forEach((L, i) => {
      for (let k = 0; k < Math.round(L * 1.4); k++) {
        const y = -Math.log10(r()) * 18;
        bg.append("circle").attr("cx", X(i + 1, r() * L)).attr("cy", base - Math.min(y, 70)).attr("r", 1.4)
          .attr("fill", i % 2 ? "#9a6bd6" : "#d6c2f2").attr("opacity", 0.55);
      }
    });
    // chromosome labels
    LEN.forEach((L, i) => s.append("text").attr("class", "tl-chr").attr("x", X(i + 1, L / 2)).attr("y", base + 22).text(CHR_NAME(i + 1)));
    s.append("line").attr("x1", 30).attr("x2", W - 30).attr("y1", base).attr("y2", base).attr("stroke", "#6b4f99");

    const g = s.append("g");
    const labelRows = [[], [], []];
    const items = data.map((d) => {
      const node = g.append("g").attr("class", "tl-locus").style("cursor", "pointer").attr("opacity", 0);
      const h = height(d), c = ROLE[d.role].color;
      if (isRegion(d)) {
        node.append("rect").attr("x", X(d.chr, d.start)).attr("width", Math.max(3, X(d.chr, d.end) - X(d.chr, d.start)))
          .attr("y", Y(h)).attr("height", base - Y(h)).attr("rx", 4).attr("fill", c).attr("opacity", 0.22);
        node.append("line").attr("x1", X(d.chr, d.start)).attr("x2", X(d.chr, d.end)).attr("y1", Y(h)).attr("y2", Y(h)).attr("stroke", c).attr("stroke-width", 2);
      } else {
        node.append("line").attr("class", "stem").attr("x1", X(d.chr, pos(d))).attr("x2", X(d.chr, pos(d))).attr("y1", base).attr("y2", Y(h)).attr("stroke", c).attr("stroke-width", 1.6).attr("opacity", 0.8);
        node.append("circle").attr("cx", X(d.chr, pos(d))).attr("cy", Y(h)).attr("r", d.role === "lab" ? 5.5 : 4).attr("fill", c).attr("filter", "url(#glow)");
      }
      // labels for lab-led loci, placed on rows to avoid collisions
      if (d.role === "lab" || h > 0.85) {
        const lx = X(d.chr, pos(d));
        let row = labelRows.findIndex((rw) => rw.every((v) => Math.abs(v - lx) > 62));
        if (row >= 0) {
          labelRows[row].push(lx);
          node.append("text").attr("class", "tl-label").attr("x", lx).attr("y", Y(h) - 10 - row * 13).text(d.label.replace(/ \(.+\)/, ""));
        }
      }
      node.append("rect").attr("x", isRegion(d) ? X(d.chr, d.start) : X(d.chr, pos(d)) - 7)
        .attr("width", isRegion(d) ? Math.max(14, X(d.chr, d.end) - X(d.chr, d.start)) : 14)
        .attr("y", Y(h) - 10).attr("height", base - Y(h) + 10).attr("fill", "transparent");
      node.on("mouseenter click", () => showLocus(d));
      return { d, node, shown: false };
    });

    const years = d3.range(2001, 2027);
    let yi = years.length - 1, timer = null;
    function setYear(y, animate) {
      yearText.text(y);
      let n = 0;
      items.forEach((it) => {
        const on = it.d.year <= y;
        if (on) n++;
        if (on && !it.shown) {
          it.shown = true;
          it.node.attr("opacity", 1);
          if (animate && !still) {
            it.node.attr("transform", `translate(0,${base}) scale(1,0.001) translate(0,${-base})`)
              .transition().duration(700).ease(d3.easeBackOut).attr("transform", null);
            const c = it.node.select("circle");
            if (!c.empty()) {
              g.append("circle").attr("cx", c.attr("cx")).attr("cy", c.attr("cy")).attr("r", 4).attr("fill", "none")
                .attr("stroke", ROLE[it.d.role].color).attr("stroke-width", 2)
                .transition().duration(1100).attr("r", 26).attr("opacity", 0).remove();
            }
          }
        } else if (!on && it.shown) {
          it.shown = false; it.node.interrupt().attr("opacity", 0).attr("transform", null);
        }
      });
      countText.text(`${n} loci reported`);
      slider.value = y;
    }

    controls.innerHTML = `<button class="btn btn-primary btn-sm" id="tl-play" type="button">▶ Play</button>
      <input type="range" id="tl-slider" min="2001" max="2026" step="1" aria-label="Year">
      <span class="tl-range"><span>2001</span><span>2026</span></span>`;
    const play = controls.querySelector("#tl-play"), slider = controls.querySelector("#tl-slider");
    function stop() { if (timer) { timer.stop(); timer = null; } play.textContent = "▶ Play"; }
    play.addEventListener("click", () => {
      if (timer) return stop();
      if (yi >= years.length - 1) { yi = 0; setYear(years[0] - 1, false); }
      play.textContent = "❚❚ Pause";
      timer = d3.interval(() => {
        setYear(years[yi], true);
        if (++yi >= years.length) { yi = years.length - 1; stop(); }
      }, 650);
    });
    slider.addEventListener("input", () => { stop(); yi = years.indexOf(+slider.value); setYear(+slider.value, true); });

    if (still) setYear(2026, false);
    else { yi = 0; setYear(2000, false); play.click(); }
    return stop;
  }

  /* ========== 2. genome ring ========== */
  function ring() {
    help.textContent = "Chromosomes form the ring. Spikes are loci; inner arcs join loci reported in the same paper. Hover to pause.";
    controls.innerHTML = "";
    const W = 1100, H = 600, cx = W / 2, cy = H / 2, R = 190;
    const s = svg(W, H); glow(s);
    const gap = 0.012, total = d3.sum(LEN), span = 2 * Math.PI - gap * LEN.length;
    const a0 = []; let acc = 0;
    LEN.forEach((L) => { a0.push(acc); acc += (L / total) * span + gap; });
    const A = (chr, mb) => a0[chr - 1] + (mb / total) * span;
    const rot = s.append("g").attr("transform", `translate(${cx},${cy})`);
    const inner = rot.append("g");

    const arc = d3.arc().innerRadius(R).outerRadius(R + 14);
    LEN.forEach((L, i) => {
      const seg = inner.append("path").attr("d", arc({ startAngle: a0[i], endAngle: a0[i] + (L / total) * span }))
        .attr("fill", i % 2 ? "#4b2d7a" : "#6229a0").attr("stroke", "#2a1050");
      const mid = a0[i] + (L / total) * span / 2;
      inner.append("text").attr("class", "ring-chr")
        .attr("transform", `rotate(${mid * 180 / Math.PI - 90}) translate(${R + 7},0) rotate(90)`).text(CHR_NAME(i + 1));
      seg.on("mouseenter", () => showGroup(`Chromosome ${CHR_NAME(i + 1)}`, "Chromosome", data.filter((d) => d.chr === i + 1)));
    });

    // chords: loci sharing a paper are linked to the first locus of that paper
    const byPaper = d3.group(data, (d) => d.paper);
    const chords = inner.append("g").attr("fill", "none");
    byPaper.forEach((list) => {
      if (list.length < 2) return;
      const hub = list[0];
      list.slice(1).forEach((d) => {
        const p1 = d3.pointRadial(A(hub.chr, pos(hub)), R - 4), p2 = d3.pointRadial(A(d.chr, pos(d)), R - 4);
        chords.append("path").attr("d", `M${p1[0]},${p1[1]} Q0,0 ${p2[0]},${p2[1]}`)
          .attr("stroke", ROLE[hub.role].color).attr("stroke-opacity", 0.28).attr("stroke-width", 1.2);
      });
    });

    data.forEach((d) => {
      const a = A(d.chr, pos(d)), len = 18 + height(d) * 70, c = ROLE[d.role].color;
      const g = inner.append("g").style("cursor", "pointer");
      if (isRegion(d)) {
        g.append("path").attr("d", d3.arc().innerRadius(R + 16).outerRadius(R + 16 + len * 0.5)({ startAngle: A(d.chr, d.start), endAngle: A(d.chr, d.end) }))
          .attr("fill", c).attr("opacity", 0.3);
      } else {
        const [x1, y1] = d3.pointRadial(a, R + 16), [x2, y2] = d3.pointRadial(a, R + 16 + len);
        g.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("stroke", c).attr("stroke-width", 1.5);
        g.append("circle").attr("cx", x2).attr("cy", y2).attr("r", d.role === "lab" ? 4.5 : 3.2).attr("fill", c).attr("filter", "url(#glow)");
        if (d.role === "lab") {
          const deg = a * 180 / Math.PI - 90, flip = deg > 90 && deg < 270;
          g.append("text").attr("class", "ring-label")
            .attr("transform", `rotate(${deg}) translate(${R + 22 + len},0)${flip ? " rotate(180)" : ""}`)
            .attr("text-anchor", flip ? "end" : "start").attr("dy", "0.32em").text(d.label.replace(/ \(.+\)/, ""));
        }
        g.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("stroke", "transparent").attr("stroke-width", 12);
      }
      g.on("mouseenter click", () => showLocus(d));
    });
    rot.append("text").attr("class", "ring-centre").attr("text-anchor", "middle").attr("y", -6).text(data.length);
    rot.append("text").attr("class", "ring-centre-sub").attr("text-anchor", "middle").attr("y", 18).text("loci shown");

    let angle = 0, paused = false, last = null;
    s.on("mouseenter", () => { paused = true; }).on("mouseleave", () => { paused = false; });
    const t = still ? null : d3.timer((now) => {
      if (last !== null && !paused) angle = (angle + (now - last) * 0.004) % 360;
      last = now;
      inner.attr("transform", `rotate(${angle})`);
    });
    return () => t && t.stop();
  }

  /* ========== 3. variant-to-biology flow (Sankey) ========== */
  function flow() {
    help.textContent = "How each locus was found, what kind of variant explains it, and the biology it touches. Particles flow in proportion to the number of loci.";
    controls.innerHTML = "";
    const W = 1100, H = 560;
    const s = svg(W, H);
    const cols = [(d) => d.method, (d) => d.variant, (d) => d.pathway];
    const names = new Map(), nodes = [], linksMap = new Map();
    const node = (col, name) => {
      const k = col + "|" + name;
      if (!names.has(k)) { names.set(k, nodes.length); nodes.push({ name, col, loci: [] }); }
      return names.get(k);
    };
    data.forEach((d) => {
      const ids = cols.map((f, i) => node(i, f(d)));
      ids.forEach((id) => nodes[id].loci.push(d));
      for (let i = 0; i < 2; i++) {
        const k = ids[i] + ">" + ids[i + 1];
        const l = linksMap.get(k) || { source: ids[i], target: ids[i + 1], value: 0, loci: [] };
        l.value++; l.loci.push(d); linksMap.set(k, l);
      }
    });
    const sk = d3.sankey().nodeWidth(14).nodePadding(16).extent([[190, 30], [W - 230, H - 30]])
      .nodeSort((a, b) => b.value - a.value);
    const graph = sk({ nodes: nodes.map((n) => ({ ...n })), links: [...linksMap.values()].map((l) => ({ ...l })) });
    const colColor = (n) => n.col === 2 ? PATHWAY[n.name] || "#cfc6e0" : n.col === 1 ? "#d6c2f2" : "#9a6bd6";

    const linkPath = d3.sankeyLinkHorizontal();
    const lg = s.append("g").attr("fill", "none");
    const paths = lg.selectAll("path").data(graph.links).join("path")
      .attr("d", linkPath).attr("stroke", (l) => colColor(l.target)).attr("stroke-opacity", 0.22)
      .attr("stroke-width", (l) => Math.max(1, l.width))
      .style("cursor", "pointer")
      .on("mouseenter", function (e, l) { d3.select(this).attr("stroke-opacity", 0.5); showGroup(`${l.source.name} → ${l.target.name}`, "Flow", l.loci); })
      .on("mouseleave", function () { d3.select(this).attr("stroke-opacity", 0.22); });

    const ng = s.append("g");
    ng.selectAll("rect").data(graph.nodes).join("rect")
      .attr("x", (n) => n.x0).attr("y", (n) => n.y0).attr("width", (n) => n.x1 - n.x0).attr("height", (n) => Math.max(2, n.y1 - n.y0))
      .attr("rx", 3).attr("fill", colColor).style("cursor", "pointer")
      .on("mouseenter click", (e, n) => showGroup(n.name, ["Found by", "Variant", "Biology"][n.col], n.loci));
    ng.selectAll("text").data(graph.nodes).join("text").attr("class", "flow-label")
      .attr("x", (n) => n.col === 0 ? n.x0 - 8 : n.x1 + 8).attr("y", (n) => (n.y0 + n.y1) / 2).attr("dy", "0.35em")
      .attr("text-anchor", (n) => n.col === 0 ? "end" : "start").text((n) => `${n.name} (${n.value})`);
    ["Found by", "Variant", "Biology"].forEach((t, i) => s.append("text").attr("class", "flow-head")
      .attr("x", [190, W / 2 - 20, W - 230][i]).attr("y", 18).attr("text-anchor", ["end", "middle", "start"][i]).text(t));

    if (still) return null;
    // particles
    const pg = s.append("g");
    const pts = [];
    const els = paths.nodes();
    const lens = els.map((p) => p.getTotalLength());
    const t = d3.timer((now) => {
      graph.links.forEach((l, i) => {
        if (Math.random() < 0.012 * l.value) {
          pts.push({ i, t0: now, off: (Math.random() - 0.5) * l.width * 0.8, dur: 2600 + Math.random() * 1200,
            el: pg.append("circle").attr("r", 1.8 + Math.random() * 1.2).attr("fill", colColor(l.target)).attr("opacity", 0.9) });
        }
      });
      for (let k = pts.length - 1; k >= 0; k--) {
        const p = pts[k], u = (now - p.t0) / p.dur;
        if (u >= 1) { p.el.remove(); pts.splice(k, 1); continue; }
        const pt = els[p.i].getPointAtLength(u * lens[p.i]);
        p.el.attr("cx", pt.x).attr("cy", pt.y + p.off);
      }
    });
    return () => t.stop();
  }

  /* ========== 4. populations (world map) ========== */
  let world = null;
  function map() {
    help.textContent = "Lines run from OMRF in Oklahoma City to the populations in which these loci were reported. Hover a population to list its loci.";
    controls.innerHTML = "";
    const W = 1100, H = 560;
    const s = svg(W, H); glow(s);
    const draw = () => {
      const countries = topojson.feature(world, world.objects.countries);
      const proj = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "Sphere" });
      const path = d3.geoPath(proj);
      s.append("path").attr("d", path({ type: "Sphere" })).attr("fill", "#22103f");
      s.append("path").attr("d", path(d3.geoGraticule10())).attr("fill", "none").attr("stroke", "#3a1f66").attr("stroke-width", 0.5);
      s.append("g").selectAll("path").data(countries.features).join("path").attr("d", path)
        .attr("fill", "#3a1868").attr("stroke", "#5b3a8f").attr("stroke-width", 0.4);

      const omrf = [-97.5, 35.47];
      const counts = Object.keys(ANC).map((k) => ({ k, loci: data.filter((d) => d.ancestry.includes(k)) })).filter((c) => c.loci.length);
      const rScale = d3.scaleSqrt().domain([0, d3.max(counts, (c) => c.loci.length)]).range([4, 26]);
      const arcs = s.append("g").attr("fill", "none");
      counts.forEach((c, i) => {
        const line = { type: "LineString", coordinates: [omrf, ANC[c.k].lonlat] };
        arcs.append("path").attr("d", path(line)).attr("stroke", "#6fd8d2").attr("stroke-opacity", 0.25).attr("stroke-width", 1.5);
        arcs.append("path").attr("class", still ? "" : "map-flow").attr("d", path(line)).attr("stroke", "#6fd8d2")
          .attr("stroke-width", 2).attr("stroke-dasharray", "4 14").style("animation-delay", `${-i * 0.4}s`);
      });
      const pg = s.append("g");
      counts.forEach((c) => {
        const [x, y] = proj(ANC[c.k].lonlat);
        const lab = c.loci.filter((d) => d.role === "lab").length;
        const g = pg.append("g").attr("transform", `translate(${x},${y})`).style("cursor", "pointer");
        g.append("circle").attr("r", rScale(c.loci.length)).attr("fill", "#b794e6").attr("fill-opacity", 0.35).attr("stroke", "#d6c2f2");
        g.append("circle").attr("r", rScale(lab)).attr("fill", "#6fd8d2").attr("fill-opacity", 0.7).attr("filter", "url(#glow)");
        g.append("text").attr("class", "map-label").attr("y", -rScale(c.loci.length) - 8).text(`${ANC[c.k].label} · ${c.loci.length}`);
        g.on("mouseenter click", () => showGroup(ANC[c.k].label, "Population", c.loci));
      });
      const [ox, oy] = proj(omrf);
      const o = s.append("g").attr("transform", `translate(${ox},${oy})`);
      if (!still) o.append("circle").attr("class", "map-pulse").attr("r", 6).attr("fill", "none").attr("stroke", "#fff");
      o.append("circle").attr("r", 5).attr("fill", "#fff");
      o.append("text").attr("class", "map-label map-omrf").attr("x", -10).attr("y", -10).attr("text-anchor", "end").text("OMRF");
      s.append("text").attr("class", "map-note").attr("x", 20).attr("y", H - 18)
        .text("Outer circle: all loci seen in that population · inner teal circle: lab-led");
    };
    if (world) draw();
    else d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json")
      .then((w) => { world = w; if (current === "map") draw(); })
      .catch(() => { canvas.innerHTML = '<p class="viz-error">The world map could not be loaded.</p>'; });
    return null;
  }

  /* ========== 5. gene network ========== */
  function network() {
    help.textContent = "Genes cluster by the biology they affect; lines join loci from the same paper. Drag a gene to pull it around.";
    controls.innerHTML = "";
    const W = 1100, H = 600;
    const s = svg(W, H); glow(s);
    const paths = Object.keys(PATHWAY).filter((p) => data.some((d) => d.pathway === p));
    const centre = {}, labelAt = {};
    paths.forEach((p, i) => {
      const a = (i / paths.length) * 2 * Math.PI - Math.PI / 2;
      centre[p] = [W / 2 + Math.cos(a) * 300, H / 2 + Math.sin(a) * 175];
      const c = Math.cos(a);
      // near the sides: text runs inward; near top/bottom: text runs outward so neighbours don't collide
      const anchor = Math.abs(c) > 0.55 ? (c < 0 ? "start" : "end") : Math.abs(c) < 0.05 ? "middle" : (c < 0 ? "end" : "start");
      labelAt[p] = [W / 2 + c * 520, H / 2 + Math.sin(a) * 285, anchor];
    });
    const nodes = data.map((d) => ({ d, x: centre[d.pathway][0] + (Math.random() - 0.5) * 40, y: centre[d.pathway][1] + (Math.random() - 0.5) * 40 }));
    const links = [];
    d3.group(nodes, (n) => n.d.paper).forEach((list) => list.slice(1).forEach((n) => links.push({ source: list[0], target: n })));

    const link = s.append("g").selectAll("line").data(links).join("line").attr("stroke", "#b794e6").attr("stroke-opacity", 0.16);
    const node = s.append("g").selectAll("g").data(nodes).join("g").style("cursor", "grab");
    node.append("circle").attr("r", (n) => n.d.role === "lab" ? 8 : 5.5).attr("fill", (n) => PATHWAY[n.d.pathway])
      .attr("stroke", (n) => ROLE[n.d.role].color).attr("stroke-width", (n) => n.d.role === "lab" ? 2.5 : 1).attr("filter", "url(#glow)");
    node.append("text").attr("class", "net-label").attr("dy", -11).text((n) => n.d.label.replace(/ \(.+\)/, ""));
    node.on("mouseenter click", (e, n) => {
      showLocus(n.d);
      const near = new Set([n]);
      links.forEach((l) => { if (l.source === n) near.add(l.target); if (l.target === n) near.add(l.source); });
      node.attr("opacity", (m) => near.has(m) ? 1 : 0.25);
      link.attr("stroke-opacity", (l) => l.source === n || l.target === n ? 0.8 : 0.08);
    }).on("mouseleave", () => { node.attr("opacity", 1); link.attr("stroke-opacity", 0.16); });

    s.append("g").selectAll("text").data(paths).join("text").attr("class", "net-hub")
      .attr("x", (p) => labelAt[p][0]).attr("y", (p) => labelAt[p][1]).attr("text-anchor", (p) => labelAt[p][2])
      .attr("fill", (p) => PATHWAY[p]).text((p) => p);
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).strength(0.015).distance(80))
      .force("charge", d3.forceManyBody().strength(-38))
      .force("x", d3.forceX((n) => centre[n.d.pathway][0]).strength(0.2))
      .force("y", d3.forceY((n) => centre[n.d.pathway][1]).strength(0.2))
      .force("collide", d3.forceCollide(13))
      .on("tick", () => {
        nodes.forEach((n) => { n.x = Math.max(20, Math.min(W - 20, n.x)); n.y = Math.max(20, Math.min(H - 20, n.y)); });
        link.attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y).attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
        node.attr("transform", (n) => `translate(${n.x},${n.y})`);
      });
    if (still) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); sim.on("tick")(); }
    else sim.alphaTarget(0.02); // keep a gentle drift
    node.call(d3.drag()
      .on("start", (e, n) => { if (!e.active) sim.alphaTarget(0.25).restart(); n.fx = n.x; n.fy = n.y; })
      .on("drag", (e, n) => { n.fx = e.x; n.fy = e.y; })
      .on("end", (e, n) => { if (!e.active) sim.alphaTarget(still ? 0 : 0.02); n.fx = null; n.fy = null; }));
    return () => sim.stop();
  }

  /* ---------- table + stats ---------- */
  function table() {
    const rows = [...ALL].sort((a, b) => a.year - b.year || a.chr - b.chr);
    document.getElementById("loci-table").innerHTML = `<thead><tr><th>Locus</th><th>Chr</th><th>Year</th><th>Found by</th><th>Variant</th><th>Biology</th><th>Populations</th><th>Lab role</th><th>Paper</th></tr></thead><tbody>` +
      rows.map((d) => `<tr><td><b>${esc(d.label)}</b></td><td>${CHR_NAME(d.chr)}</td><td>${d.year}</td><td>${esc(d.method)}</td><td>${esc(d.variant)}</td><td>${esc(d.pathway)}</td><td>${d.ancestry.join(", ")}</td><td>${ROLE[d.role].label}</td><td><a href="${paperLink(d)}" target="_blank" rel="noopener">${d.doi ? "DOI" : "Search"}</a></td></tr>`).join("") + "</tbody>";
    const genes = ALL.filter((d) => !isRegion(d));
    const stat = (n, t) => `<div><b>${n}</b><span>${t}</span></div>`;
    document.getElementById("loci-stats").innerHTML =
      stat(ALL.length, "loci and regions shown") +
      stat(ALL.filter((d) => d.role === "lab").length, "led by the Nath lab") +
      stat(genes.filter((d) => d.variant !== "Not resolved").length, "with a causal variant explained") +
      stat(new Set(ALL.flatMap((d) => d.ancestry)).size, "ancestral populations");
  }

  /* ---------- wiring ---------- */
  const VIEWS = { timeline, ring, flow, map, network };
  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    data = ALL.filter((d) => roles.has(d.role));
    intro();
    if (!data.length) { canvas.innerHTML = '<p class="viz-error">Choose at least one group above.</p>'; controls.innerHTML = ""; return; }
    cleanup = VIEWS[current]() || null;
  }
  document.querySelectorAll(".viz-tabs [data-view]").forEach((b) => b.addEventListener("click", () => {
    current = b.dataset.view;
    document.querySelectorAll(".viz-tabs [data-view]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    try { history.replaceState(null, "", "#" + current); } catch (e) { /* ignore */ }
    render();
  }));
  document.querySelectorAll(".viz-filters [data-role]").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.role;
    if (roles.has(r)) roles.delete(r); else roles.add(r);
    b.classList.toggle("on", roles.has(r));
    render();
  }));
  document.querySelectorAll(".viz-filters [data-role] i").forEach((i) => { i.style.background = ROLE[i.parentElement.dataset.role].color; });

  fetch("assets/data/loci.json").then((r) => r.json()).then((rows) => {
    ALL = rows;
    const h = location.hash.slice(1);
    if (VIEWS[h]) document.querySelector(`.viz-tabs [data-view="${h}"]`).click();
    else render();
    table();
  }).catch(() => { canvas.innerHTML = '<p class="viz-error">The loci data could not be loaded.</p>'; });
})();
