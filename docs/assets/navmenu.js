// Turns the "Free tools" link in the site header into a dropdown of every tool.
// Without JavaScript the plain link to the tools hub still works.
(function () {
  const TOOLS = [
    ["Revenue", [
      ["rate-recommender.html", "Rate Recommender", "A rate for each of the next 30 days"],
      ["forecaster.html", "Occupancy Forecaster", "The next 30 to 90 days of occupancy"],
      ["overbooking.html", "Overbooking Calculator", "How many extra rooms to sell"],
      ["group-displacement.html", "Group Quote and Displacement", "Is this group worth it?"],
      ["kpi.html", "Hotel KPI Dashboard", "Occupancy, ADR, RevPAR and profit"],
    ]],
    ["Operations", [
      ["../schedule.html", "Staff Schedule Builder", "A week's schedule at the lowest cost"],
      ["housekeeping-board.html", "Housekeeping Board", "Today's room assignments"],
      ["labour.html", "Labour Productivity", "Hours and cost per occupied room"],
      ["night-audit.html", "Night Audit Assistant", "Checklist, balancing and daily report"],
      ["energy-estimator.html", "Peak-Energy Savings", "Ontario Global Adjustment savings"],
    ]],
  ];

  const link = [...document.querySelectorAll("header nav a")].find(a => /tools\/index\.html$/.test(a.getAttribute("href") || ""));
  if (!link) return;
  const base = link.getAttribute("href").replace(/index\.html$/, "");
  const here = location.pathname.split("/").pop();

  const css = document.createElement("style");
  css.textContent = `
  .nd-wrap { position: relative; display: inline-flex; }
  .nd-caret { display: inline-block; margin-left: 6px; font-size: 10px; transition: transform .15s; }
  .nd-wrap.open .nd-caret { transform: rotate(180deg); }
  .nd-menu { position: fixed; z-index: 1000; display: none; background: #fff; color: #1d2733; border: 1px solid #e3e8ee;
    border-radius: 12px; box-shadow: 0 16px 40px rgba(16, 24, 40, .18); padding: 14px; width: 560px; max-width: calc(100vw - 24px);
    font-family: inherit; }
  .nd-wrap.open .nd-menu { display: block; }
  .nd-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }
  .nd-group { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #2a78d6; margin: 2px 8px 4px; }
  .nd-menu a.nd-item { display: block; padding: 7px 8px; border-radius: 8px; color: #1d2733 !important; background: none !important;
    white-space: normal; font-size: 14px; font-weight: 600; text-decoration: none; }
  .nd-menu a.nd-item small { display: block; font-weight: 400; font-size: 12.5px; color: #5b6673; margin-top: 1px; }
  .nd-menu a.nd-item:hover, .nd-menu a.nd-item:focus { background: #eef5fd !important; }
  .nd-menu a.nd-item.here { background: #eef5fd !important; }
  .nd-all { display: block; margin-top: 10px; padding: 10px 8px 2px; border-top: 1px solid #e3e8ee; font-size: 14px; font-weight: 600;
    color: #2a78d6 !important; background: none !important; text-decoration: none; }
  @media (max-width: 640px) { .nd-cols { grid-template-columns: 1fr; } .nd-menu { max-height: calc(100vh - 80px); overflow-y: auto; } }
  @media print { .nd-menu { display: none !important; } }`;
  document.head.appendChild(css);

  const wrap = document.createElement("span");
  wrap.className = "nd-wrap";
  link.parentNode.insertBefore(wrap, link);
  wrap.appendChild(link);
  link.setAttribute("aria-haspopup", "true");
  link.setAttribute("aria-expanded", "false");
  link.insertAdjacentHTML("beforeend", '<span class="nd-caret" aria-hidden="true">▾</span>');

  const menu = document.createElement("div");
  menu.className = "nd-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = '<div class="nd-cols">' + TOOLS.map(([g, items]) =>
    `<div><div class="nd-group">${g}</div>` + items.map(([href, name, sub]) =>
      `<a class="nd-item${href.split("/").pop() === here ? " here" : ""}" role="menuitem" href="${base}${href}">${name}<small>${sub}</small></a>`).join("") + "</div>"
  ).join("") + `</div><a class="nd-all" href="${base}index.html">See all free tools →</a>`;
  wrap.appendChild(menu);

  function place() {
    const r = link.getBoundingClientRect();
    const w = Math.min(560, window.innerWidth - 24);
    menu.style.top = r.bottom + 8 + "px";
    menu.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + "px";
  }
  function open() { place(); wrap.classList.add("open"); link.setAttribute("aria-expanded", "true"); }
  function close() { wrap.classList.remove("open"); link.setAttribute("aria-expanded", "false"); }

  // Mouse users get the menu on hover and the hub on click; touch users tap to open the menu.
  const hover = matchMedia("(hover: hover)").matches;
  link.addEventListener("click", e => { if (hover) return; e.preventDefault(); wrap.classList.contains("open") ? close() : open(); });
  link.addEventListener("keydown", e => { if (e.key === "ArrowDown") { e.preventDefault(); open(); menu.querySelector("a").focus(); } });
  wrap.addEventListener("focusout", e => { if (!wrap.contains(e.relatedTarget)) close(); });
  let t;
  if (hover) {
    wrap.addEventListener("mouseenter", () => { clearTimeout(t); open(); });
    wrap.addEventListener("mouseleave", () => { t = setTimeout(close, 180); });
  }
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { close(); link.focus(); } });
  window.addEventListener("resize", () => wrap.classList.contains("open") && place());
  window.addEventListener("scroll", () => wrap.classList.contains("open") && place(), { passive: true });
  link.closest("nav").addEventListener("scroll", close, { passive: true });
})();
