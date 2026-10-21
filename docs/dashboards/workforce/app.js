// Hotel Workforce Suite: app shell, store, routing and shared helpers.
"use strict";
(() => {
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, MON, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const KEY = "hbi.workforce.v1";
const UIKEY = "hbi.workforce.ui.v1";

// ---------- Store ----------
let S;
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1 && s.emps) return s; } } catch (e) { /* storage unavailable */ }
  return WF.seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep working in memory */ } }
function resetDemo() { S = WF.seed(); save(); ui.week = weekStart(today()); ui.period = periodStart(today()); go("#/home"); toast("Demo data reset to a fresh sample"); }
S = load();
save();

const ui = Object.assign({ week: weekStart(today()), period: periodStart(today()), dept: "all", schedMode: null, hideDemo: false, tsQ: "", peopleQ: "", peopleDept: "all", peopleStatus: "active", repRange: "pp", apprTab: "all", toMonth: today().slice(0, 7) }, (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })());
ui.week = weekStart(today()); ui.period = periodStart(today()); ui.toMonth = today().slice(0, 7);
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ hideDemo: ui.hideDemo, schedMode: ui.schedMode })); } catch (e) { /* ignore */ } };

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const E = (id) => S.emps.find((e) => e.id === id);
const nm = (e) => (e ? `${e.first} ${e.last}` : "Open shift");
const nmId = (id) => nm(E(id));
const posName = (p) => POS[p]?.name || p;
const dept = (id) => S.depts.find((d) => d.id === id) || { name: id, color: "#888" };
const prop = (id) => S.props.find((p) => p.id === id) || { name: "All properties", short: "All properties" };
const initials = (e) => (e ? e.first[0] + e.last[0] : "?");
const AVC = ["#2a78d6", "#1baf7a", "#eb6834", "#8b5cf6", "#c2410c", "#0e7490", "#1f4e79", "#b45309", "#be185d", "#4d7c0f"];
const avColor = (e) => AVC[(e ? e.no : 0) % AVC.length];
const av = (e, cls = "") => `<span class="av ${cls}" style="background:${avColor(e)}">${esc(initials(e))}</span>`;
const h2 = (m) => (m / 60).toFixed(1);
const h1 = (m) => { const h = m / 60; return (Math.round(h * 10) / 10).toLocaleString("en-CA") + " h"; };
const m0 = (v) => money(v, 0);
const pct = (v, d = 0) => (v * 100).toFixed(d) + "%";
const role = () => S.me.role;
const me = () => E(S.me.emp);
const isMgr = () => role() !== "employee";
const scope = () => (role() === "employee" ? me().prop : S.me.prop);
const inScope = (pid) => scope() === "all" || pid === scope();
const rate = (e, pos) => (e ? (e.pay === "salary" ? e.wage / 2080 : e.wage) : POS[pos]?.wage || (POS[pos]?.salary || 50000) / 2080);
const shiftCost = (s) => (shiftMin(s) / 60) * rate(E(s.emp), s.pos);
const onLeave = (empId, d) => S.timeoff.find((t) => t.emp === empId && t.status === "approved" && d >= t.from && d <= t.to);
const isPublished = (pid, ws) => !!S.published[pid + "|" + ws];
const activeEmps = () => S.emps.filter((e) => e.status !== "terminated");
const typeName = { vac: "Vacation", sick: "Sick", per: "Personal" };
const balKey = { vac: "vac", sick: "sick", per: "per" };
function log(what) { S.audit.unshift({ at: new Date().toISOString(), who: `${nm(me())} (${roleName(role())})`, what }); if (S.audit.length > 400) S.audit.length = 400; }
const roleName = (r) => ({ manager: "Manager", hr: "HR & Payroll", employee: "Employee" }[r]);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
function csv(name, rows) {
  const body = rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Time and attendance helpers ----------
const shiftsOn = (empId, d) => S.shifts.filter((s) => s.emp === empId && s.date === d);
const openPunch = (empId) => S.punches.find((c) => c.emp === empId && !c.out && (c.date === today() || (c.date === addDays(today(), -1) && toMin(c.in) > nowMin())));
function exceptionsFor(empId, d) {
  const T = today();
  const out = [];
  const g = S.settings.graceMin;
  const sh = shiftsOn(empId, d);
  const pu = S.punches.filter((c) => c.emp === empId && c.date === d);
  for (const c of pu) {
    const s = S.shifts.find((x) => x.id === c.shift) || sh[0];
    if (!s) out.push({ k: "unsched", t: "Unscheduled", cls: "warn" });
    else {
      const late = span(s.start, c.in); if (late > g && late < 600) out.push({ k: "late", t: `Late ${late} min`, cls: "warn" });
      if (c.out) { const early = span(c.out, s.end); if (early > 15 && early < 600) out.push({ k: "early", t: `Left ${early} min early`, cls: "warn" }); }
    }
    if (!c.out && (d < addDays(T, -1) || (d === addDays(T, -1) && !(toMin(c.in) > nowMin())))) out.push({ k: "missed", t: "Missed punch out", cls: "bad" });
    if (c.out && span(c.in, c.out) > S.settings.breakAfterHrs * 60 && !c.brk) out.push({ k: "nobreak", t: "No meal break", cls: "warn" });
  }
  if (!pu.length && sh.length && d < T && !onLeave(empId, d)) out.push({ k: "noshow", t: "No-show", cls: "bad" });
  return out;
}
function weekMinutes(empId, ws) { // worked (actual) plus remaining scheduled minutes in the week
  const T = today(); let m = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const pu = S.punches.filter((c) => c.emp === empId && c.date === d);
    if (d < T || (d === T && pu.length)) m += pu.reduce((a, c) => a + punchMin(c), 0);
    else m += shiftsOn(empId, d).reduce((a, s) => a + shiftMin(s), 0);
  }
  return m;
}
function pending() {
  const inS = (empId) => { const e = E(empId); return e && inScope(e.prop); };
  if (role() === "employee") {
    const id = S.me.emp;
    return { to: S.timeoff.filter((t) => t.emp === id && t.status === "pending"), sw: S.swaps.filter((w) => w.status === "pending" && (w.from === id || w.to === id)), co: S.corrections.filter((c) => c.emp === id && c.status === "pending"), n: 0 };
  }
  const to = S.timeoff.filter((t) => t.status === "pending" && inS(t.emp));
  const sw = S.swaps.filter((w) => w.status === "pending" && inS(w.from || w.to));
  const co = S.corrections.filter((c) => c.status === "pending" && inS(c.emp));
  return { to, sw, co, n: to.length + sw.length + co.length };
}

// ---------- Navigation ----------
const NAV = {
  manager: [["Overview", [["home", "🏠", "Home"], ["approvals", "✅", "Approvals"]]], ["Time", [["schedule", "📅", "Schedule"], ["clock", "⏱️", "Time clock"], ["timesheets", "🧾", "Timesheets"], ["timeoff", "🌴", "Time off"]]], ["People", [["people", "👥", "People"], ["onboarding", "🚀", "Onboarding"]]], ["Insights", [["reports", "📊", "Reports"], ["settings", "⚙️", "Settings"]]]],
  hr: [["Overview", [["home", "🏠", "Home"], ["approvals", "✅", "Approvals"]]], ["Time", [["schedule", "📅", "Schedule"], ["clock", "⏱️", "Time clock"], ["timesheets", "🧾", "Timesheets"], ["timeoff", "🌴", "Time off"]]], ["Pay", [["payroll", "💵", "Payroll"]]], ["People", [["people", "👥", "People"], ["onboarding", "🚀", "Onboarding"]]], ["Insights", [["reports", "📊", "Reports"], ["settings", "⚙️", "Settings"]]]],
  employee: [["Me", [["home", "🏠", "Home"], ["schedule", "📅", "My schedule"], ["clock", "⏱️", "Clock in/out"], ["timesheets", "🧾", "My timesheet"], ["timeoff", "🌴", "Time off"], ["pay", "💵", "Pay"], ["profile", "👤", "My profile"]]]],
};
const TABS = { manager: ["home", "schedule", "clock", "approvals", "people"], hr: ["home", "schedule", "timesheets", "payroll", "approvals"], employee: ["home", "schedule", "clock", "timeoff", "pay"] };
const TABLBL = { home: "Home", schedule: "Schedule", clock: "Clock", approvals: "Approvals", people: "People", timesheets: "Time", payroll: "Payroll", timeoff: "Time off", pay: "Pay" };
const TITLES = { home: "Home", schedule: "Schedule", clock: "Time clock", timesheets: "Timesheets", timeoff: "Time off", payroll: "Payroll", approvals: "Approvals", people: "People", person: "Employee profile", onboarding: "Onboarding", reports: "Reports", settings: "Settings", pay: "Pay", profile: "My profile" };

function renderShell(route) {
  const p = pending();
  const items = NAV[role()];
  const icon = {}; items.forEach(([, l]) => l.forEach(([k, i, t]) => (icon[k] = [i, t])));
  const sect = route === "person" ? (role() === "employee" ? "profile" : "people") : route;
  $("#side-nav").innerHTML = items.map(([g, list]) => `<div class="grp">${g}</div>` + list.map(([k, i, t]) =>
    `<a href="#/${k}" class="${sect === k ? "on" : ""}"><span class="ic">${i}</span>${t}${k === "approvals" && p.n ? `<span class="cnt">${p.n}</span>` : ""}</a>`).join("")).join("");
  $("#tabbar").innerHTML = TABS[role()].map((k) => `<a href="#/${k}" class="${sect === k ? "on" : ""}"><span class="ic">${icon[k][0]}</span>${TABLBL[k]}${k === "approvals" && p.n ? `<span class="cnt">${p.n}</span>` : ""}</a>`).join("");
  $("#top-title").textContent = route === "home" ? (role() === "employee" ? "My home" : S.company) : (role() === "employee" && icon[route] ? icon[route][1] : TITLES[route] || "");
  const m = me();
  $("#who-av").outerHTML = `<span class="av" id="who-av" style="background:${avColor(m)}">${esc(initials(m))}</span>`;
  $("#who-name").textContent = nm(m);
  $("#who-role").textContent = role() === "employee" ? posName(m.pos) : roleName(role());
  const pw = $("#prop-pick-wrap");
  if (role() === "employee") pw.style.display = "none";
  else {
    pw.style.display = "";
    $("#prop-pick").innerHTML = (role() === "hr" ? `<option value="all">All properties</option>` : "") + S.props.map((x) => `<option value="${x.id}">${esc(x.short)}</option>`).join("");
    $("#prop-pick").value = S.me.prop;
  }
  $("#bell-n").textContent = isMgr() && p.n ? p.n : "";
  $("#bell").style.display = isMgr() ? "" : "none";
  $("#demo-bar").style.display = ui.hideDemo ? "none" : "";
}

// ---------- Modal and toast ----------
let modalClose = null;
function modal({ title, body, foot = "", wide = false, onMount }) {
  const mc = $("#modal-card");
  mc.className = "modal-card" + (wide ? " wide" : "");
  mc.innerHTML = `<div class="mh"><h2>${title}</h2><button class="icon-btn" data-x aria-label="Close">✕</button></div><div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ""}`;
  $("#modal").hidden = false; $("#scrim").hidden = false;
  document.body.style.overflow = "hidden";
  $("[data-x]", mc).onclick = closeModal;
  modalClose = null;
  if (onMount) onMount(mc);
  const f = mc.querySelector("input, select, textarea, .mf .btn.primary"); if (f && innerWidth > 640) f.focus();
}
function closeModal() { $("#modal").hidden = true; $("#scrim").hidden = true; document.body.style.overflow = ""; if (modalClose) modalClose(); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
let tt;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2600); }
function confirmBox(title, text, okLabel, ok, danger = false) {
  modal({ title, body: `<p>${text}</p>`, foot: `<button class="btn" data-x2>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" id="cf-ok">${okLabel}</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#cf-ok", m).onclick = () => { closeModal(); ok(); }; } });
}

// ---------- Charts ----------
let charts = [];
function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return;
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  const dark = document.documentElement.dataset.theme === "dark";
  Chart.defaults.color = dark ? "#b4c0cd" : "#4a5561";
  Chart.defaults.borderColor = dark ? "#263443" : "#e2e6eb";
  const g = dark ? "#263443" : "#eef1f4";
  const sc = cfg.options && cfg.options.scales;
  if (sc) Object.values(sc).forEach((a) => { if (a.grid && a.grid.color) a.grid.color = g; });
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } } }, cfg.options || {});
  charts.push(new Chart(canvas, cfg));
}

// ---------- Router ----------
const VIEWS = {};
const ACT = {};
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  charts.forEach((c) => c.destroy()); charts = [];
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  let r = parts[0] || "home";
  if (r === "profile") { r = "person"; parts[1] = S.me.emp; }
  const allowed = new Set(NAV[role()].flatMap(([, l]) => l.map(([k]) => k)).concat(["person"]));
  if (!allowed.has(r) && !(r === "person")) r = "home";
  if (r === "person" && role() === "employee") parts[1] = S.me.emp;
  renderShell(r === "person" && role() === "employee" ? "profile" : r);
  const v = $("#view");
  v.innerHTML = "";
  (VIEWS[r] || VIEWS.home)(v, parts.slice(1));
  $("#side").classList.remove("open");
  if (!$("#scrim").hidden && $("#modal").hidden) $("#scrim").hidden = true;
}
function refresh() { save(); const y = scrollY; render(); scrollTo(0, y); }
window.addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const fn = ACT[a.dataset.act];
  if (fn) { e.preventDefault(); fn(a, e); }
});

// ---------- Top bar controls ----------
$("#menu-btn").onclick = () => { $("#side").classList.add("open"); $("#scrim").hidden = false; };
$("#scrim").onclick = () => { if (!$("#modal").hidden) return closeModal(); $("#side").classList.remove("open"); $("#scrim").hidden = true; };
$("#prop-pick").onchange = (e) => { S.me.prop = e.target.value; save(); render(); };
$("#bell").onclick = () => go("#/approvals");
$("#theme-btn").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("nihal.theme", t); } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event("themechange"));
};
window.addEventListener("themechange", () => { if (charts.length) render(); });
$("#demo-x").onclick = () => { ui.hideDemo = true; saveUI(); $("#demo-bar").style.display = "none"; };
$("#who-btn").onclick = () => {
  const P = S.personas;
  const opt = (r, id, t, s) => { const e = E(id); return `<button class="role-opt ${role() === r && S.me.emp === id ? "on" : ""}" data-r="${r}" data-id="${id}">${av(e)}<span><b>${t}</b><small>${esc(nm(e))} · ${esc(s)}</small></span></button>`; };
  const emps = activeEmps().filter((e) => e.status === "active").sort((a, b) => a.prop.localeCompare(b.prop) || a.last.localeCompare(b.last));
  modal({
    title: "View as",
    body: `<p class="muted">Switch between the three ways people use the system. Everything stays in sync, so an approval made as a manager shows up for the employee.</p>
      ${opt("manager", P.manager, "Hotel manager", "General Manager, " + prop(E(P.manager).prop).short)}
      ${opt("hr", P.hr, "HR and payroll", "Company-wide HR and payroll")}
      ${opt("employee", P.employee, "Employee", posName(E(P.employee).pos) + ", " + prop(E(P.employee).prop).short)}
      <div class="field mt"><label for="any-emp">Or view as any employee</label><select id="any-emp"><option value="">Choose a person…</option>${S.props.map((p) => `<optgroup label="${esc(p.short)}">${emps.filter((e) => e.prop === p.id).map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div class="banner info mt"><span>Demo PINs for the time-clock kiosk: <b>${esc(nm(E(P.employee)))}</b> is <b>${E(P.employee).pin}</b>. Every PIN is on the person's profile.</span></div>`,
    foot: `<button class="btn danger left" id="rs">Reset demo data</button><button class="btn" data-x2>Close</button>`,
    onMount: (m) => {
      $$(".role-opt", m).forEach((b) => (b.onclick = () => setRole(b.dataset.r, b.dataset.id)));
      $("#any-emp", m).onchange = (e) => e.target.value && setRole("employee", e.target.value);
      $("[data-x2]", m).onclick = closeModal;
      $("#rs", m).onclick = () => confirmBox("Reset demo data?", "This replaces everything in this browser with a fresh sample company. Your changes will be lost.", "Reset", resetDemo, true);
    },
  });
};
function setRole(r, id) {
  S.me.role = r; S.me.emp = id;
  S.me.prop = r === "hr" ? "all" : E(id).prop;
  save(); closeModal(); go("#/home"); toast(`Now viewing as ${nmId(id)} (${roleName(r)})`);
}
// Keep the live clocks ticking
setInterval(() => { $$("[data-clock]").forEach((el) => (el.textContent = new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }))); }, 15000);

// Expose to the view files
Object.assign(window, { WFAPP: { get S() { return S; }, ui, save, refresh, render, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, avColor, initials, h1, h2, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, isPublished, activeEmps, typeName, balKey, roleName, greeting, shiftsOn, openPunch, exceptionsFor, weekMinutes, pending, resetDemo, setModalClose: (f) => (modalClose = f) } });
})();
// Home dashboards and the scheduler.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, isPublished, activeEmps, typeName, roleName, greeting, shiftsOn, openPunch, exceptionsFor, weekMinutes, pending } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;

// ---------- Live status of today's shifts ----------
function liveBoard(pid) {
  const T = today(), Y = addDays(T, -1), n = nowMin(), g = S().settings.graceMin;
  const rows = [];
  const sh = S().shifts.filter((s) => s.emp && (pid === "all" || s.prop === pid) && (s.date === T || (s.date === Y && toMin(s.end) <= toMin(s.start) && n < toMin(s.end))));
  for (const s of sh) {
    const c = S().punches.find((x) => x.shift === s.id) || S().punches.find((x) => x.emp === s.emp && x.date === s.date);
    const startAbs = (s.date === Y ? -1440 : 0) + toMin(s.start);
    const endAbs = startAbs + span(s.start, s.end);
    let st, cls, ord;
    if (onLeave(s.emp, s.date)) { st = "On leave"; cls = ""; ord = 6; }
    else if (c && !c.out && c.brkStart) { st = "On break"; cls = "warn"; ord = 1; }
    else if (c && !c.out) { const late = span(s.start, c.in); st = late > g && late < 600 ? `In · ${late} min late` : "In"; cls = "good"; ord = 0; }
    else if (c && c.out) { st = "Done"; cls = ""; ord = 5; }
    else if (n > startAbs + g && n < endAbs) { st = "Not in yet"; cls = "bad"; ord = 2; }
    else if (n >= endAbs) { st = "No-show"; cls = "bad"; ord = 2; }
    else { st = "Starts " + fmtT(s.start); cls = "info"; ord = 3; }
    rows.push({ s, c, st, cls, ord });
  }
  // Clocked in without a shift
  S().punches.filter((c) => !c.out && c.date === T && !c.shift && (pid === "all" || E(c.emp).prop === pid)).forEach((c) => rows.push({ s: { emp: c.emp, dept: E(c.emp).dept, start: c.in, end: c.in, pos: E(c.emp).pos }, c, st: "In · unscheduled", cls: "warn", ord: 0 }));
  rows.sort((a, b) => a.ord - b.ord || a.s.start.localeCompare(b.s.start));
  return rows;
}

function dayCost(pid, d) { return S().shifts.filter((s) => s.prop === pid && s.date === d).reduce((a, s) => a + shiftCost(s), 0); }
function budgetFor(pid, d) { return pid === "all" ? S().props.reduce((a, p) => a + (S().budget[p.id][d] || 0), 0) : S().budget[pid]?.[d] || 0; }
function costFor(pid, d) { return pid === "all" ? S().props.reduce((a, p) => a + dayCost(p.id, d), 0) : dayCost(pid, d); }

// ---------- Home ----------
VIEWS.home = (v) => (role() === "employee" ? homeEmployee(v) : homeManager(v));

function homeManager(v) {
  const T = today(), pid = scope(), p = pending();
  const board = liveBoard(pid);
  const inNow = board.filter((r) => r.ord <= 1).length;
  const notIn = board.filter((r) => r.ord === 2 && r.st === "Not in yet").length;
  const cost = costFor(pid, T), bud = budgetFor(pid, T);
  const ws = weekStart(T);
  const openNext = S().shifts.filter((s) => !s.emp && inScope(s.prop) && s.date >= T && s.date <= addDays(T, 7)).length;
  const scopeEmps = activeEmps().filter((e) => inScope(e.prop) && e.pay === "hourly" && e.status === "active");
  const otRisk = scopeEmps.map((e) => ({ e, m: weekMinutes(e.id, ws) })).filter((x) => x.m > S().settings.otWeekly * 60 - 60).sort((a, b) => b.m - a.m);
  const ps = periodStart(T);
  const exc = [];
  for (let d = ps; d < T; d = addDays(d, 1)) for (const e of scopeEmps) for (const x of exceptionsFor(e.id, d)) exc.push({ e, d, x });
  exc.sort((a, b) => b.d.localeCompare(a.d));
  const soon = (md) => { for (let i = 0; i < 8; i++) if (addDays(T, i).slice(5) === md) return i; return -1; };
  const events = [];
  activeEmps().filter((e) => inScope(e.prop) && e.status === "active").forEach((e) => {
    const b = soon(e.birthday); if (b >= 0) events.push({ e, i: b, t: "🎂 Birthday" });
    const a = soon(e.hire.slice(5)); const yrs = Number(T.slice(0, 4)) - Number(e.hire.slice(0, 4)); if (a >= 0 && yrs > 0) events.push({ e, i: a, t: `🎉 ${yrs} year${yrs > 1 ? "s" : ""} with us` });
  });
  events.sort((a, b) => a.i - b.i);
  const certs = [];
  activeEmps().filter((e) => inScope(e.prop)).forEach((e) => e.certs.forEach((c) => { const dd = diffDays(T, c.exp); if (dd < 45) certs.push({ e, c, dd }); }));
  certs.sort((a, b) => a.dd - b.dd);
  const items = [...p.to.map((t) => ({ k: "to", o: t, d: t.created })), ...p.sw.map((w) => ({ k: "sw", o: w, d: w.created })), ...p.co.map((c) => ({ k: "co", o: c, d: c.created }))].sort((a, b) => b.d.localeCompare(a.d));

  v.innerHTML = `
  <div class="card hello banner" style="margin-bottom:16px">
    <div><h1>${greeting()}, ${esc(me().first)}</h1><p>${fmtDY(T)} · ${esc(pid === "all" ? "All " + S().props.length + " hotels" : prop(pid).name)}${HOLIDAYS[T] ? " · " + HOLIDAYS[T] : ""}</p></div>
    <div class="toolbar"><a class="btn" href="#/schedule">Open schedule</a><a class="btn" href="#/timesheets">Timesheets</a></div>
  </div>
  <div class="grid g4 keep2">
    <div class="kpi ok"><div class="l">On the clock now</div><div class="v">${inNow}</div><div class="s">${notIn ? `<span style="color:var(--bad);font-weight:600">${notIn} not in yet</span>` : "Everyone due is in"}</div></div>
    <div class="kpi ${cost > bud ? "alert" : ""}"><div class="l">Labour cost today</div><div class="v">${m0(cost)}</div><div class="s">Budget ${m0(bud)} · ${cost > bud ? m0(cost - bud) + " over" : m0(bud - cost) + " under"}</div><div class="bar"><i class="${cost > bud ? "over" : "good"}" style="width:${Math.min(100, (cost / Math.max(bud, 1)) * 100)}%"></i></div></div>
    <a class="kpi" href="#/approvals" style="color:inherit;text-decoration:none"><div class="l">Waiting for approval</div><div class="v">${p.n}</div><div class="s">${p.to.length} time off · ${p.sw.length} shift changes · ${p.co.length} punch fixes</div></a>
    <div class="kpi ${otRisk.length ? "alert" : ""}"><div class="l">Overtime risk this week</div><div class="v">${otRisk.length}</div><div class="s">${openNext} open shift${openNext === 1 ? "" : "s"} in the next 7 days</div></div>
  </div>

  <div class="grid g-main mt">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Who's working today</h2><span class="muted" style="font-size:13px">Live · <span data-clock>${new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}</span></span></div>
        <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th>Shift</th><th>Status</th></tr></thead><tbody>
        ${board.length ? board.slice(0, 14).map((r) => { const e = E(r.s.emp); return `<tr class="click" data-act="open-person" data-id="${e.id}"><td><div style="display:flex;gap:8px;align-items:center">${av(e, "sm")}<span><b style="font-size:13.5px">${esc(nm(e))}</b><br><small>${esc(posName(e.pos))}</small></span></div></td><td class="hide-sm"><span class="dot" style="background:${dept(e.dept).color}"></span>${esc(dept(e.dept).name)}</td><td class="nowrap">${fmtT(r.s.start)}–${fmtT(r.s.end)}</td><td><span class="pill ${r.cls}">${esc(r.st)}</span></td></tr>`; }).join("") : `<tr><td colspan="4" class="empty">No shifts today.</td></tr>`}
        </tbody></table></div>
        ${board.length > 14 ? `<p class="muted" style="margin:10px 0 0;font-size:13px">Showing 14 of ${board.length}. <a href="#/clock">See everyone on the time clock board</a>.</p>` : ""}
      </div>
      <div class="card">
        <div class="card-h"><h2>Labour cost vs budget, this week</h2><span class="muted" style="font-size:13px">Scheduled wages against the forecast-based budget</span></div>
        <div class="chart"><canvas id="ch-week"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Attendance exceptions this pay period</h2><a href="#/timesheets" class="btn sm">Review timesheets</a></div>
        ${exc.length ? `<div class="list">${exc.slice(0, 8).map(({ e, d, x }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${fmtD(d)} · ${esc(posName(e.pos))}</small></div><span class="pill ${x.cls}">${esc(x.t)}</span></div>`).join("")}</div>${exc.length > 8 ? `<p class="muted" style="font-size:13px;margin:8px 0 0">${exc.length - 8} more on the timesheets page.</p>` : ""}` : `<div class="empty">No exceptions. Nice.</div>`}
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Approvals</h2><a href="#/approvals" class="btn sm">See all</a></div>
        ${items.length ? `<div class="list">${items.slice(0, 5).map(approvalLine).join("")}</div>` : `<div class="empty">You're all caught up.</div>`}
      </div>
      <div class="card">
        <div class="card-h"><h2>Overtime watch</h2><span class="muted" style="font-size:13px">Over ${S().settings.otWeekly - 1} h this week</span></div>
        ${otRisk.length ? `<div class="list">${otRisk.slice(0, 6).map(({ e, m }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))}</small></div><span class="pill ${m > S().settings.otWeekly * 60 ? "bad" : "warn"}">${h1(m)}</span></div>`).join("")}</div>` : `<div class="empty">Nobody is close to overtime.</div>`}
      </div>
      <div class="card">
        <h2>This week</h2>
        ${events.length ? `<div class="list">${events.slice(0, 6).map(({ e, i, t }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${t} · ${i === 0 ? "today" : fmtD(addDays(T, i))}</small></div></div>`).join("")}</div>` : `<div class="empty">No birthdays or anniversaries this week.</div>`}
      </div>
      <div class="card">
        <div class="card-h"><h2>Certifications due</h2><span class="muted" style="font-size:13px">Next 45 days</span></div>
        ${certs.length ? `<div class="list">${certs.slice(0, 6).map(({ e, c, dd }) => `<div class="li"><div class="grow"><b>${esc(nm(e))}</b><small>${esc(c.name)}</small></div><span class="pill ${dd < 0 ? "bad" : "warn"}">${dd < 0 ? "Expired " + fmtDs(c.exp) : "Due " + fmtDs(c.exp)}</span></div>`).join("")}</div>` : `<div class="empty">Nothing due.</div>`}
      </div>
      ${annCard(pid)}
    </div>
  </div>`;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  chart($("#ch-week"), { type: "bar", data: { labels: days.map((d) => DOW[dow(d)] + " " + d.slice(8)), datasets: [
    { label: "Scheduled cost", data: days.map((d) => Math.round(costFor(pid, d))), backgroundColor: days.map((d) => (d === T ? "#1f4e79" : "#2a78d6")), borderRadius: 5, order: 2 },
    { label: "Budget", type: "line", data: days.map((d) => budgetFor(pid, d)), borderColor: "#eb6834", backgroundColor: "#eb6834", pointRadius: 3, tension: 0.25, order: 1 }] },
    options: { scales: { y: { ticks: { callback: (x) => "$" + (x / 1000).toFixed(1) + "k" }, grid: { color: "#eef1f4" } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m0(c.raw)}` } } } } });
}

function annCard(pid) {
  const list = S().announcements.filter((a) => !a.prop || pid === "all" || a.prop === pid).slice(0, 3);
  return `<div class="card"><div class="card-h"><h2>Announcements</h2>${isMgr() ? `<button class="btn sm" data-act="new-ann">Post</button>` : ""}</div>
    ${list.map((a) => `<div class="li" style="align-items:flex-start"><div class="grow"><b>${esc(a.title)}</b><small style="white-space:normal">${esc(a.body)}</small><small>${fmtD(a.date)} · ${a.prop ? esc(prop(a.prop).short) : "All hotels"}</small></div></div>`).join("") || `<div class="empty">No announcements.</div>`}</div>`;
}
ACT["new-ann"] = () => modal({
  title: "Post an announcement",
  body: `<div class="fields"><div class="field full"><label>Title</label><input id="an-t" type="text" maxlength="80"></div><div class="field full"><label>Message</label><textarea id="an-b" maxlength="400"></textarea></div>
    <div class="field full"><label>Who sees it</label><select id="an-p"><option value="">All hotels</option>${S().props.filter((p) => inScope(p.id)).map((p) => `<option value="${p.id}" ${scope() === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div></div>`,
  foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="an-ok">Post</button>`,
  onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#an-ok", m).onclick = () => {
    const t = $("#an-t", m).value.trim(); if (!t) return toast("Add a title");
    S().announcements.unshift({ id: uid("a"), date: today(), prop: $("#an-p", m).value || null, title: t, body: $("#an-b", m).value.trim() });
    log(`Posted announcement "${t}"`); closeModal(); refresh(); toast("Announcement posted"); }; },
});

function approvalLine({ k, o }) {
  if (k === "to") { const e = E(o.emp); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${typeName[o.type]} · ${fmtDs(o.from)}${o.to !== o.from ? "–" + fmtDs(o.to) : ""} · ${o.hours} h</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="to" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="to" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`; }
  if (k === "sw") { const s = S().shifts.find((x) => x.id === o.shift); const e = E(o.type === "pickup" ? o.to : o.from); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${o.type === "swap" ? "Swap to " + esc(nmId(o.to)) : o.type === "pickup" ? "Pick up open shift" : "Give away shift"} · ${s ? fmtDs(s.date) + " " + fmtT(s.start) : ""}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="sw" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="sw" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`; }
  const e = E(o.emp);
  return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>Punch fix · ${fmtDs(o.date)} · ${o.field === "out" ? "Out" : "In"} ${fmtT(o.to)}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="co" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="co" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`;
}
A.approvalLine = approvalLine;

function homeEmployee(v) {
  const T = today(), e = me(), ps = periodStart(T);
  const next = S().shifts.filter((s) => s.emp === e.id && (s.date > T || (s.date === T && (toMin(s.end) > nowMin() || toMin(s.end) <= toMin(s.start)))) && isPublished(s.prop, weekStart(s.date))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const c = openPunch(e.id);
  const pay = payFor(S(), e, ps);
  const workedM = pay.reg + pay.ot + pay.hol;
  const myWeek = [...Array(7)].map((_, i) => addDays(weekStart(T), i));
  const opens = S().shifts.filter((s) => !s.emp && s.prop === e.prop && s.dept === e.dept && s.date >= T && isPublished(s.prop, weekStart(s.date)) && !S().swaps.some((w) => w.shift === s.id && w.status === "pending" && w.to === e.id)).slice(0, 4);
  const reqs = [...S().timeoff.filter((t) => t.emp === e.id).map((t) => ({ d: t.created, t: `${typeName[t.type]} ${fmtDs(t.from)}${t.to !== t.from ? "–" + fmtDs(t.to) : ""}`, st: t.status })),
    ...S().swaps.filter((w) => w.from === e.id || w.to === e.id).map((w) => { const s = S().shifts.find((x) => x.id === w.shift); return { d: w.created, t: `${w.type === "pickup" ? "Pick up" : w.type === "swap" ? "Swap" : "Give away"} ${s ? fmtDs(s.date) : ""}`, st: w.status }; }),
    ...S().corrections.filter((k) => k.emp === e.id).map((k) => ({ d: k.created, t: `Punch fix ${fmtDs(k.date)}`, st: k.status }))].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
  const n0 = next[0];
  v.innerHTML = `
  <div class="card hello banner" style="margin-bottom:16px">
    <div><h1>${greeting()}, ${esc(e.first)}</h1><p>${esc(posName(e.pos))} · ${esc(prop(e.prop).name)}</p></div>
    <div class="toolbar">${c ? `<span class="status-chip ${c.brkStart ? "brk" : "in"}">${c.brkStart ? "On break" : "Clocked in at " + fmtT(c.in)}</span>` : ""}<a class="btn" href="#/clock">${c ? "Clock out or break" : "Clock in"}</a></div>
  </div>
  <div class="grid g4 keep2">
    <div class="kpi"><div class="l">Next shift</div><div class="v" style="font-size:20px">${n0 ? (n0.date === T ? "Today" : fmtD(n0.date)) : "None"}</div><div class="s">${n0 ? `${fmtT(n0.start)}–${fmtT(n0.end)} · ${esc(dept(n0.dept).name)}` : "Nothing scheduled"}</div></div>
    <div class="kpi"><div class="l">Hours this pay period</div><div class="v">${h1(workedM)}</div><div class="s">${fmtDs(ps)}–${fmtDs(addDays(ps, 13))}${pay.ot ? ` · ${h1(pay.ot)} overtime` : ""}</div></div>
    <div class="kpi"><div class="l">Vacation balance</div><div class="v">${e.bal.vac} h</div><div class="s">Sick ${e.bal.sick} h · Personal ${e.bal.per} h</div></div>
    <a class="kpi" href="#/pay" style="color:inherit;text-decoration:none"><div class="l">Next pay · ${fmtDs(payDate(ps))}</div><div class="v">${money(pay.net, 0)}</div><div class="s">Estimated take-home so far</div></a>
  </div>
  <div class="grid g-main mt">
    <div class="stack">
      <div class="card"><div class="card-h"><h2>My week</h2><a class="btn sm" href="#/schedule">Full schedule</a></div>
        <div class="list">${myWeek.map((d) => { const sh = shiftsOn(e.id, d).filter((s) => isPublished(s.prop, weekStart(s.date))); const lv = onLeave(e.id, d);
          return `<div class="li"><div style="width:62px;flex:none"><b style="font-size:13.5px;${d === T ? "color:var(--brand-2)" : ""}">${DOW[dow(d)]}</b><br><small>${fmtDs(d)}</small></div><div class="grow">${lv ? `<span class="pill violet">${typeName[lv.type]}</span>` : sh.length ? sh.map((s) => `<b>${fmtT(s.start)} – ${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}${s.note ? " · " + esc(s.note) : ""}</small>`).join("") : `<small>Day off</small>`}</div>${HOLIDAYS[d] ? `<span class="pill good">${HOLIDAYS[d]}</span>` : ""}</div>`; }).join("")}</div></div>
      <div class="card"><div class="card-h"><h2>Open shifts you can pick up</h2></div>
        ${opens.length ? `<div class="list">${opens.map((s) => `<div class="li"><div class="grow"><b>${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}</small></div><button class="btn sm primary" data-act="pickup" data-id="${s.id}">Request</button></div>`).join("")}</div>` : `<div class="empty">No open shifts in your department right now.</div>`}</div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-h"><h2>My requests</h2><a class="btn sm" href="#/timeoff">Request time off</a></div>
        ${reqs.length ? `<div class="list">${reqs.map((r) => `<div class="li"><div class="grow"><b>${esc(r.t)}</b><small>Sent ${fmtDs(r.d)}</small></div><span class="pill ${r.st === "approved" ? "good" : r.st === "denied" ? "bad" : r.st === "cancelled" ? "" : "warn"}">${r.st}</span></div>`).join("")}</div>` : `<div class="empty">No requests yet.</div>`}</div>
      ${annCard(e.prop)}
    </div>
  </div>`;
}
ACT.pickup = (b) => {
  const s = S().shifts.find((x) => x.id === b.dataset.id);
  S().swaps.push({ id: uid("w"), type: "pickup", shift: s.id, from: null, to: S().me.emp, status: "pending", note: "", created: today() });
  log(`Asked to pick up the open shift on ${fmtD(s.date)} ${fmtT(s.start)}`); refresh(); toast("Request sent to your manager");
};

// ---------- Schedule ----------
VIEWS.schedule = (v) => (role() === "employee" ? scheduleEmployee(v) : scheduleManager(v));

function schedProp() { return scope() === "all" ? null : scope(); }

function scheduleManager(v) {
  const pid = schedProp();
  if (!pid) {
    v.innerHTML = `<div class="ph"><div><h1>Schedule</h1><p>Schedules are built per hotel. Pick one to open it.</p></div></div><div class="grid g3">${S().props.map((p) => `<button class="card" style="text-align:left;cursor:pointer" data-act="pick-prop" data-id="${p.id}"><h2>${esc(p.name)}</h2><p class="muted">${p.rooms} rooms · ${activeEmps().filter((e) => e.prop === p.id).length} staff</p></button>`).join("")}</div>`;
    return;
  }
  const ws = ui.week, T = today();
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const pub = isPublished(pid, ws);
  const mode = ui.schedMode || (innerWidth <= 640 ? "list" : "grid");
  const depts = S().depts.filter((d) => ui.dept === "all" || d.id === ui.dept);
  const wkShifts = S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= days[6] && (ui.dept === "all" || s.dept === ui.dept));
  const open = wkShifts.filter((s) => !s.emp);
  const tot = wkShifts.reduce((a, s) => a + shiftMin(s), 0);
  const cost = wkShifts.reduce((a, s) => a + shiftCost(s), 0);
  const bud = ui.dept === "all" ? days.reduce((a, d) => a + (S().budget[pid][d] || 0), 0) : null;
  const past = days[6] < T;
  const conflicts = wkShifts.filter((s) => s.emp && shiftWarnings(s).length).length;

  v.innerHTML = `
  <div class="ph"><div><h1>Schedule · ${esc(prop(pid).short)}</h1><p>Week of ${fmtDY(ws)} · ${pub ? `<span class="pill good">Published</span>` : `<span class="pill warn">Draft, not visible to staff</span>`}</p></div>
    <div class="toolbar">
      <div class="seg"><button data-act="wk" data-n="-7" aria-label="Previous week">‹</button><button data-act="wk" data-n="0">This week</button><button data-act="wk" data-n="7" aria-label="Next week">›</button></div>
      <select id="sc-dept" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.dept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
      <div class="seg"><button data-act="mode" data-m="grid" class="${mode === "grid" ? "on" : ""}">Grid</button><button data-act="mode" data-m="list" class="${mode === "list" ? "on" : ""}">By day</button></div>
    </div></div>
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Scheduled hours</div><div class="v">${h1(tot)}</div><div class="s">${wkShifts.filter((s) => s.emp).length} shifts · ${new Set(wkShifts.map((s) => s.emp).filter(Boolean)).size} people</div></div>
    <div class="kpi ${bud && cost > bud ? "alert" : ""}"><div class="l">Labour cost</div><div class="v">${m0(cost)}</div><div class="s">${bud ? `Budget ${m0(bud)} · ${cost > bud ? m0(cost - bud) + " over" : m0(bud - cost) + " under"}` : "Budget is set for the whole hotel"}</div></div>
    <div class="kpi ${open.length ? "alert" : ""}"><div class="l">Open shifts</div><div class="v">${open.length}</div><div class="s">${open.length ? "Need someone" : "Fully covered"}</div></div>
    <div class="kpi ${conflicts ? "alert" : "ok"}"><div class="l">Rule warnings</div><div class="v">${conflicts}</div><div class="s">Overtime, rest, leave or availability</div></div>
  </div>
  <div class="toolbar no-print" style="margin-bottom:12px">
    ${past ? `<span class="muted">This week is in the past and is read only.</span>` : `
    <button class="btn primary" data-act="add-shift">+ Add shift</button>
    <button class="btn" data-act="autofill" ${open.length ? "" : "disabled"}>Auto-fill open shifts</button>
    <button class="btn" data-act="copy-week">Copy last week</button>
    ${pub ? "" : `<button class="btn good" data-act="publish">Publish week</button>`}`}
    <button class="btn" data-act="sched-csv">Export CSV</button>
    <button class="btn" onclick="window.print()">Print</button>
  </div>
  <div id="sched-body"></div>
  <div class="legend">${S().depts.map((d) => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join("")}<span><i style="background:#fff5ef;border:1px dashed #eb6834"></i>Open shift</span><span><i style="background:#fff8de;border-left:3px solid #8a6d00"></i>Time off</span><span><i style="background:repeating-linear-gradient(135deg,#fff,#fff 3px,#dcebfb 3px,#dcebfb 6px)"></i>Draft</span></div>`;
  $("#sc-dept").onchange = (e) => { ui.dept = e.target.value; A.render(); };
  const body = $("#sched-body");
  if (mode === "grid") body.innerHTML = gridHTML(pid, days, depts, pub);
  else body.innerHTML = listHTML(pid, days, depts, pub);
}

function shiftChip(s, pub) {
  const w = shiftWarnings(s);
  return `<span class="shift ${s.emp ? "" : "open"} ${pub ? "" : "draft"}" style="--c:${dept(s.dept).color}" data-act="edit-shift" data-id="${s.id}" title="${esc(w.join(". "))}">${fmtT(s.start)}–${fmtT(s.end)}${w.length ? " ⚠️" : ""}<small>${s.emp ? esc(posName(s.pos)) : "Open · " + esc(posName(s.pos))}</small></span>`;
}

function gridHTML(pid, days, depts, pub) {
  const T = today(), ws = days[0];
  let rows = "";
  for (const d of depts) {
    const staff = activeEmps().filter((e) => e.prop === pid && e.dept === d.id && e.hire <= days[6]).sort((a, b) => (a.pay === "salary" ? -1 : 0) - (b.pay === "salary" ? -1 : 0) || a.pos.localeCompare(b.pos) || a.last.localeCompare(b.last));
    const open = S().shifts.filter((s) => !s.emp && s.prop === pid && s.dept === d.id && s.date >= ws && s.date <= days[6]);
    rows += `<tr class="dept-row"><td class="emp" colspan="9"><span class="dot" style="background:${d.color}"></span>${esc(d.name)}</td></tr>`;
    if (open.length) rows += `<tr><td class="emp"><b style="color:#c2410c">Open shifts</b><small>${open.length} to fill</small></td>${days.map((day) => `<td class="cell ${day === T ? "today" : ""}">${open.filter((s) => s.date === day).map((s) => shiftChip(s, pub)).join("")}</td>`).join("")}<td></td></tr>`;
    for (const e of staff) {
      const wm = days.reduce((a, day) => a + shiftsOn(e.id, day).reduce((b, s) => b + shiftMin(s), 0), 0);
      rows += `<tr><td class="emp"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))} · ${e.type}${e.status === "onboarding" ? " · new" : ""}</small></td>${days.map((day) => {
        const lv = onLeave(e.id, day);
        const sh = shiftsOn(e.id, day);
        const unav = e.avail[dow(day)] === "off";
        return `<td class="cell ${day === T ? "today" : ""} ${unav && !sh.length ? "off" : ""}" data-act="cell" data-emp="${e.id}" data-d="${day}">${lv ? `<span class="shift lv"><small style="font-weight:700;color:#6b4e00">${typeName[lv.type]}${lv.status === "pending" ? " (asked)" : ""}</small></span>` : ""}${sh.map((s) => shiftChip(s, pub)).join("")}</td>`;
      }).join("")}<td class="n ${wm > S().settings.otWeekly * 60 ? "over" : ""}" style="font-weight:600">${(wm / 60).toFixed(1)}</td></tr>`;
    }
  }
  const all = ui.dept === "all";
  const foot = `<tfoot>
    <tr><td class="emp">Hours</td>${days.map((d) => `<td>${(S().shifts.filter((s) => s.prop === pid && s.date === d && (all || s.dept === ui.dept)).reduce((a, s) => a + shiftMin(s), 0) / 60).toFixed(1)}</td>`).join("")}<td></td></tr>
    <tr><td class="emp">Cost</td>${days.map((d) => `<td>${m0(S().shifts.filter((s) => s.prop === pid && s.date === d && (all || s.dept === ui.dept)).reduce((a, s) => a + shiftCost(s), 0))}</td>`).join("")}<td></td></tr>
    ${all ? `<tr><td class="emp">Budget</td>${days.map((d) => { const c = dayCost(pid, d), b = S().budget[pid][d] || 0; return `<td>${m0(b)}<br><span class="${c > b ? "over" : "under"}">${c > b ? "+" : "−"}${m0(Math.abs(c - b))}</span></td>`; }).join("")}<td></td></tr>` : ""}
    <tr><td class="emp">Forecast occupancy</td>${days.map((d) => `<td>${S().forecast[pid][d] != null ? pct(S().forecast[pid][d]) : "–"}</td>`).join("")}<td></td></tr></tfoot>`;
  return `<div class="sched-wrap"><table class="sched"><thead><tr><th class="emp">Employee</th>${days.map((d) => `<th class="${d === T ? "today" : ""}">${DOW[dow(d)]} ${d.slice(8)}${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}</th>`).join("")}<th>Hrs</th></tr></thead><tbody>${rows}</tbody>${foot}</table></div>`;
}

function listHTML(pid, days, depts, pub) {
  const T = today();
  return `<div class="day-list">${days.map((d) => {
    const sh = S().shifts.filter((s) => s.prop === pid && s.date === d && depts.some((x) => x.id === s.dept)).sort((a, b) => a.start.localeCompare(b.start) || a.dept.localeCompare(b.dept));
    return `<div class="day ${d === T ? "today" : ""}"><h3><span>${fmtD(d)}${HOLIDAYS[d] ? " · " + HOLIDAYS[d] : ""}</span><span class="muted" style="font-weight:500">${sh.length} shifts · ${m0(sh.reduce((a, s) => a + shiftCost(s), 0))}</span></h3>
      ${sh.map((s) => { const e = E(s.emp); const w = shiftWarnings(s); return `<div class="mshift ${s.emp ? "" : "open"}" style="--c:${s.emp ? dept(s.dept).color : "#eb6834"}" data-act="edit-shift" data-id="${s.id}"><span class="tm">${fmtT(s.start)}–${fmtT(s.end)}</span><div class="grow"><b>${s.emp ? esc(nm(e)) : `<span style="color:#c2410c">Open shift</span>`}${w.length ? " ⚠️" : ""}</b><small>${esc(posName(s.pos))} · ${esc(dept(s.dept).name)}${pub ? "" : " · draft"}</small></div></div>`; }).join("") || `<div class="muted" style="font-size:13px">No shifts.</div>`}</div>`;
  }).join("")}</div>`;
}

function shiftWarnings(s, ignoreId) {
  const w = [];
  if (!s.emp) return w;
  const e = E(s.emp);
  if (!e) return w;
  const lv = onLeave(e.id, s.date); if (lv) w.push(`${e.first} is on ${typeName[lv.type].toLowerCase()} leave`);
  if (e.avail[dow(s.date)] === "off") w.push(`${e.first} is not available on ${DOW[dow(s.date)]}s`);
  const same = S().shifts.filter((x) => x.emp === e.id && x.date === s.date && x.id !== s.id && x.id !== ignoreId);
  const a0 = toMin(s.start), a1 = a0 + span(s.start, s.end);
  if (same.some((x) => { const b0 = toMin(x.start), b1 = b0 + span(x.start, x.end); return a0 < b1 && b0 < a1; })) w.push("Overlaps another shift");
  const prev = S().shifts.filter((x) => x.emp === e.id && x.date === addDays(s.date, -1) && x.id !== s.id);
  for (const x of prev) { const endAbs = toMin(x.start) + span(x.start, x.end) - 1440; if (a0 - endAbs < 600 && a0 - endAbs >= 0) w.push(`Only ${Math.round((a0 - endAbs) / 60)} h rest after the previous shift`); }
  if (e.pay === "hourly") {
    const ws = weekStart(s.date);
    let m = 0; for (let i = 0; i < 7; i++) m += shiftsOn(e.id, addDays(ws, i)).filter((x) => x.id !== s.id && x.id !== ignoreId).reduce((a, x) => a + shiftMin(x), 0);
    m += shiftMin(s);
    if (m > S().settings.otWeekly * 60) w.push(`Puts ${e.first} at ${h1(m)} this week (overtime)`);
  }
  return w;
}
A.shiftWarnings = shiftWarnings;

ACT["pick-prop"] = (b) => { S().me.prop = b.dataset.id; save(); A.render(); };
ACT.wk = (b) => { const n = Number(b.dataset.n); ui.week = n ? addDays(ui.week, n) : weekStart(today()); A.render(); };
ACT.mode = (b) => { ui.schedMode = b.dataset.m; A.render(); };
ACT.cell = (b, ev) => { if (ev.target.closest(".shift")) return; if (b.dataset.d < today()) return; shiftEditor(null, { emp: b.dataset.emp, date: b.dataset.d }); };
ACT["add-shift"] = () => shiftEditor(null, { date: ui.week < today() ? today() : ui.week });
ACT["edit-shift"] = (b) => { const s = S().shifts.find((x) => x.id === b.dataset.id); if (role() === "employee") return myShiftActions(s); shiftEditor(s); };

function shiftEditor(s, pre = {}) {
  const pid = schedProp();
  const isNew = !s;
  const T = today();
  const base = s || { emp: pre.emp || null, prop: pid, dept: pre.emp ? E(pre.emp).dept : ui.dept !== "all" ? ui.dept : "fo", pos: pre.emp ? E(pre.emp).pos : null, date: pre.date || T, start: "09:00", end: "17:00", brk: 30, note: "" };
  if (!base.pos) base.pos = Object.keys(POS).find((k) => POS[k].dept === base.dept && POS[k].wage && !/s$|sup/.test(k)) || Object.keys(POS).find((k) => POS[k].dept === base.dept);
  const readOnly = s && s.date < T;
  const staff = activeEmps().filter((e) => e.prop === base.prop).sort((a, b) => a.dept.localeCompare(b.dept) || a.last.localeCompare(b.last));
  modal({
    title: isNew ? "Add a shift" : readOnly ? "Shift (past, read only)" : "Edit shift",
    body: `<div class="fields">
      <div class="field"><label>Department</label><select id="f-dept" ${readOnly ? "disabled" : ""}>${S().depts.map((d) => `<option value="${d.id}" ${d.id === base.dept ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="f-pos" ${readOnly ? "disabled" : ""}></select></div>
      <div class="field full"><label>Employee</label><select id="f-emp" ${readOnly ? "disabled" : ""}></select><small id="f-sug"></small></div>
      <div class="field"><label>Date</label><input type="date" id="f-date" value="${base.date}" min="${T}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>Unpaid break (min)</label><input type="number" id="f-brk" min="0" max="120" step="5" value="${base.brk}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>Start</label><input type="time" id="f-st" value="${base.start}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>End</label><input type="time" id="f-en" value="${base.end}" ${readOnly ? "disabled" : ""}></div>
      <div class="field full"><label>Note for the employee</label><input type="text" id="f-note" maxlength="120" value="${esc(base.note)}" placeholder="e.g. VIP arrival, cover the lobby bar" ${readOnly ? "disabled" : ""}></div>
    </div>
    <div id="f-warn"></div>
    <p class="muted" id="f-sum" style="margin:10px 0 0;font-size:13px"></p>`,
    foot: readOnly ? `<button class="btn" data-x2>Close</button>` : `${isNew ? "" : `<button class="btn danger left" id="f-del">Delete</button>`}<button class="btn" data-x2>Cancel</button><button class="btn primary" id="f-ok">${isNew ? "Add shift" : "Save"}</button>`,
    onMount: (m) => {
      const fd = $("#f-dept", m), fp = $("#f-pos", m), fe = $("#f-emp", m);
      const fillPos = () => { fp.innerHTML = Object.entries(POS).filter(([, p]) => p.dept === fd.value).map(([k, p]) => `<option value="${k}" ${k === base.pos ? "selected" : ""}>${esc(p.name)}</option>`).join(""); };
      const fillEmp = () => {
        const cur = fe.value || base.emp || "";
        const list = staff.filter((e) => e.dept === fd.value);
        const others = staff.filter((e) => e.dept !== fd.value);
        fe.innerHTML = `<option value="">Open shift (anyone can pick it up)</option><optgroup label="${esc(dept(fd.value).name)}">${list.map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup><optgroup label="Other departments (cross-trained)">${others.map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup>`;
        fe.value = cur;
      };
      const draft = () => ({ id: s ? s.id : "_new", emp: fe.value || null, prop: base.prop, dept: fd.value, pos: fp.value, date: $("#f-date", m).value, start: $("#f-st", m).value, end: $("#f-en", m).value, brk: Number($("#f-brk", m).value) || 0, note: $("#f-note", m).value.trim() });
      const upd = () => {
        const d = draft();
        if (!d.start || !d.end || !d.date) return;
        const w = shiftWarnings(d, s && s.id);
        $("#f-warn", m).innerHTML = w.length ? `<div class="banner warn mt" style="display:block">${w.map((x) => `<div>⚠️ ${esc(x)}</div>`).join("")}</div>` : "";
        $("#f-sum", m).textContent = `${h1(shiftMin(d))} paid · estimated cost ${money((shiftMin(d) / 60) * rate(E(d.emp), d.pos))}`;
        if (!d.emp) {
          const best = suggest(d);
          $("#f-sug", m).innerHTML = best.length ? "Suggested: " + best.map((x) => `<a href="#" data-sug="${x.e.id}">${esc(nm(x.e))}</a> (${h1(x.m)} this week)`).join(", ") : "";
          $$("[data-sug]", m).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); fe.value = a.dataset.sug; upd(); }));
        } else $("#f-sug", m).textContent = "";
      };
      fillPos(); fillEmp();
      fd.onchange = () => { base.pos = null; fillPos(); fillEmp(); upd(); };
      fe.onchange = () => { const e = E(fe.value); if (e && e.dept === fd.value) fp.value = e.pos; upd(); };
      $$("input, select", m).forEach((x) => x.addEventListener("input", upd));
      upd();
      $("[data-x2]", m).onclick = closeModal;
      if (readOnly) return;
      $("#f-ok", m).onclick = () => {
        const d = draft();
        if (!d.date || !d.start || !d.end) return toast("Fill in the date and times");
        if (d.date < today()) return toast("Pick today or a later date");
        if (s) { Object.assign(s, d); log(`Edited shift ${fmtD(d.date)} ${fmtT(d.start)} (${nmId(d.emp)})`); }
        else { d.id = uid("s"); S().shifts.push(d); log(`Added shift ${fmtD(d.date)} ${fmtT(d.start)} for ${d.emp ? nmId(d.emp) : "open"}`); }
        if (isPublished(d.prop, weekStart(d.date)) && d.emp) toast(`${nmId(d.emp)} will be notified`); else toast(isNew ? "Shift added" : "Shift saved");
        closeModal(); refresh();
      };
      if (!isNew) $("#f-del", m).onclick = () => { S().shifts = S().shifts.filter((x) => x.id !== s.id); S().swaps = S().swaps.filter((w) => w.shift !== s.id); log(`Deleted shift ${fmtD(s.date)} ${fmtT(s.start)}`); closeModal(); refresh(); toast("Shift deleted"); };
    },
  });
}

function suggest(d) {
  const ws = weekStart(d.date);
  return activeEmps().filter((e) => e.prop === d.prop && e.dept === d.dept && e.pay === "hourly" && e.status === "active")
    .map((e) => ({ e, m: [...Array(7)].reduce((a, _, i) => a + shiftsOn(e.id, addDays(ws, i)).reduce((b, x) => b + shiftMin(x), 0), 0) }))
    .filter(({ e }) => !shiftWarnings({ ...d, emp: e.id }).length)
    .sort((a, b) => a.m - b.m).slice(0, 3);
}

ACT.autofill = () => {
  const pid = schedProp(), ws = ui.week, T = today();
  const open = S().shifts.filter((s) => !s.emp && s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.date >= T && (ui.dept === "all" || s.dept === ui.dept));
  let n = 0;
  for (const s of open) { const b = suggest(s)[0]; if (b) { s.emp = b.e.id; n++; } }
  log(`Auto-filled ${n} open shifts for the week of ${fmtDs(ws)}`);
  refresh();
  toast(n ? `Filled ${n} of ${open.length} open shifts without overtime or rule breaks` : "No one is free without breaking a rule. Try posting them as open shifts.");
};
ACT["copy-week"] = () => {
  const pid = schedProp(), ws = ui.week, prev = addDays(ws, -7), T = today();
  confirmBox("Copy last week?", `This replaces the shifts from ${fmtDs(ws)} onward in ${ui.dept === "all" ? "every department" : dept(ui.dept).name} with last week's pattern. Shifts for anyone on approved leave become open shifts. The week goes back to draft.`, "Copy last week", () => {
    const inD = (s) => ui.dept === "all" || s.dept === ui.dept;
    S().shifts = S().shifts.filter((s) => !(s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.date >= T && inD(s)));
    let n = 0;
    S().shifts.filter((s) => s.prop === pid && s.date >= prev && s.date < ws && inD(s)).forEach((s) => {
      const d = addDays(s.date, 7); if (d < T) return;
      const emp = s.emp && E(s.emp)?.status !== "terminated" && !onLeave(s.emp, d) ? s.emp : null;
      S().shifts.push({ ...s, id: uid("s"), date: d, emp }); n++;
    });
    S().published[pid + "|" + ws] = false;
    log(`Copied ${n} shifts from the week of ${fmtDs(prev)}`); refresh(); toast(`Copied ${n} shifts. Review, then publish.`);
  });
};
ACT.publish = () => {
  const pid = schedProp(), ws = ui.week;
  const people = new Set(S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.emp).map((s) => s.emp)).size;
  S().published[pid + "|" + ws] = true;
  log(`Published the schedule for the week of ${fmtDs(ws)} at ${prop(pid).short}`); refresh(); toast(`Published. ${people} people can now see their shifts.`);
};
ACT["sched-csv"] = () => {
  const pid = schedProp(), ws = ui.week;
  const rows = [["Date", "Day", "Department", "Position", "Employee", "Start", "End", "Break (min)", "Paid hours", "Est. cost", "Note"]];
  S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .forEach((s) => rows.push([s.date, DOW[dow(s.date)], dept(s.dept).name, posName(s.pos), s.emp ? nmId(s.emp) : "OPEN", s.start, s.end, s.brk, (shiftMin(s) / 60).toFixed(2), shiftCost(s).toFixed(2), s.note]));
  csv(`schedule-${pid}-${ws}.csv`, rows);
};

// Employee schedule
function scheduleEmployee(v) {
  const e = me(), T = today();
  const ws = ui.week;
  const days = [...Array(14)].map((_, i) => addDays(ws, i));
  const team = ui.team || false;
  v.innerHTML = `
  <div class="ph"><div><h1>My schedule</h1><p>${fmtDs(ws)} – ${fmtDY(days[13])}</p></div>
    <div class="toolbar"><div class="seg"><button data-act="wk" data-n="-7" aria-label="Previous week">‹</button><button data-act="wk" data-n="0">Today</button><button data-act="wk" data-n="7" aria-label="Next week">›</button></div>
    <div class="seg"><button data-act="team" data-t="0" class="${team ? "" : "on"}">Mine</button><button data-act="team" data-t="1" class="${team ? "on" : ""}">My team</button></div>
    <button class="btn" data-act="avail">My availability</button></div></div>
  <div class="day-list">${days.map((d) => {
    const pub = isPublished(e.prop, weekStart(d));
    const lv = onLeave(e.id, d);
    let sh = S().shifts.filter((s) => s.prop === e.prop && s.date === d && (team ? s.dept === e.dept : s.emp === e.id));
    if (!pub) sh = [];
    sh.sort((a, b) => a.start.localeCompare(b.start));
    return `<div class="day ${d === T ? "today" : ""}"><h3><span>${fmtD(d)}${HOLIDAYS[d] ? " · " + HOLIDAYS[d] : ""}</span>${!pub ? `<span class="muted" style="font-weight:500">Not published yet</span>` : ""}</h3>
      ${lv ? `<div class="mshift" style="--c:#8a6d00"><div class="grow"><b>${typeName[lv.type]} (approved)</b></div></div>` : ""}
      ${sh.map((s) => { const mine = s.emp === e.id; const pend = S().swaps.find((w) => w.shift === s.id && w.status === "pending");
        return `<div class="mshift" style="--c:${mine ? dept(s.dept).color : s.emp ? "#cfd6de" : "#eb6834"}" ${mine || !s.emp ? `data-act="edit-shift" data-id="${s.id}"` : ""}><span class="tm">${fmtT(s.start)}–${fmtT(s.end)}</span><div class="grow"><b>${mine ? "You" : s.emp ? esc(nmId(s.emp)) : "Open shift"}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}${s.note ? " · " + esc(s.note) : ""}</small></div>${pend ? `<span class="pill warn">${pend.type === "pickup" ? "Pick-up asked" : "Change asked"}</span>` : mine && d >= T ? `<span class="muted" style="font-size:12px">Swap ›</span>` : !s.emp ? `<span class="pill info">Pick up</span>` : ""}</div>`; }).join("")}
      ${!lv && !sh.length && pub ? `<div class="muted" style="font-size:13px">${team ? "No shifts." : "Day off"}</div>` : ""}</div>`;
  }).join("")}</div>`;
}
ACT.team = (b) => { ui.team = b.dataset.t === "1"; A.render(); };

function myShiftActions(s) {
  const e = me(), T = today();
  if (!s.emp) { if (s.date < T) return; return confirmBox("Pick up this shift?", `${fmtD(s.date)}, ${fmtT(s.start)} to ${fmtT(s.end)} as ${esc(posName(s.pos))}. Your manager will approve it.`, "Send request", () => ACT.pickup({ dataset: { id: s.id } })); }
  if (s.emp !== e.id || s.date < T) return;
  const mates = activeEmps().filter((x) => x.prop === e.prop && x.dept === e.dept && x.id !== e.id && x.status === "active" && x.pay === "hourly");
  modal({
    title: "Change this shift",
    body: `<p><b>${fmtD(s.date)}, ${fmtT(s.start)} – ${fmtT(s.end)}</b><br><span class="muted">${esc(posName(s.pos))}</span></p>
      <div class="field"><label>What would you like to do?</label><select id="sw-t"><option value="swap">Swap with a co-worker</option><option value="drop">Give it away (post as an open shift)</option></select></div>
      <div class="field mt" id="sw-who"><label>Co-worker</label><select id="sw-to">${mates.map((x) => `<option value="${x.id}">${esc(nm(x))} · ${esc(posName(x.pos))}${shiftsOn(x.id, s.date).length ? " (already working)" : ""}</option>`).join("")}</select></div>
      <div class="field mt"><label>Reason (optional)</label><input type="text" id="sw-n" maxlength="120"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="sw-ok">Send to manager</button>`,
    onMount: (m) => {
      $("#sw-t", m).onchange = (ev) => ($("#sw-who", m).style.display = ev.target.value === "swap" ? "" : "none");
      $("[data-x2]", m).onclick = closeModal;
      $("#sw-ok", m).onclick = () => {
        const t = $("#sw-t", m).value;
        S().swaps.push({ id: uid("w"), type: t, shift: s.id, from: e.id, to: t === "swap" ? $("#sw-to", m).value : null, status: "pending", note: $("#sw-n", m).value, created: today() });
        log(`Asked to ${t === "swap" ? "swap" : "give away"} the shift on ${fmtD(s.date)}`); closeModal(); refresh(); toast("Sent to your manager for approval");
      };
    },
  });
}

ACT.avail = () => {
  const e = me();
  modal({
    title: "My availability",
    body: `<p class="muted">Tell your manager which days you can work. The scheduler warns them before booking you on a day you marked unavailable.</p>
      <table><tbody>${DOW.map((d, i) => `<tr><td><b>${d}</b></td><td><div class="seg" data-i="${i}">${[["any", "Any time"], ["am", "Mornings"], ["pm", "Evenings"], ["off", "Not available"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${e.avail[i] === k ? "on" : ""}">${l}</button>`).join("")}</div></td></tr>`).join("")}</tbody></table>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="av-ok">Save</button>`,
    onMount: (m) => {
      const a = [...e.avail];
      $$(".seg", m).forEach((g) => $$("button", g).forEach((b) => (b.onclick = () => { a[g.dataset.i] = b.dataset.v; $$("button", g).forEach((x) => x.classList.toggle("on", x === b)); })));
      $("[data-x2]", m).onclick = closeModal;
      $("#av-ok", m).onclick = () => { e.avail = a; log("Updated availability"); closeModal(); refresh(); toast("Availability saved"); };
    },
  });
};

Object.assign(A, { liveBoard, costFor, budgetFor, dayCost });
})();
// Time clock, timesheets, payroll and pay stubs.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, activeEmps, typeName, shiftsOn, openPunch, exceptionsFor } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;
const nowHM = () => toHM(nowMin());
const clockStr = () => new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

// ---------- Punch actions ----------
function clockIn(empId) {
  const T = today(), n = nowMin();
  const sh = shiftsOn(empId, T).filter((x) => Math.abs(toMin(x.start) - n) <= 240).sort((a, b) => Math.abs(toMin(a.start) - n) - Math.abs(toMin(b.start) - n))[0];
  S().punches.push({ id: uid("c"), emp: empId, date: T, in: nowHM(), out: null, brk: 0, brkStart: null, shift: sh ? sh.id : null, edited: false, note: "", tips: 0 });
  log(`${nmId(empId)} clocked in`);
  return sh;
}
function clockOut(empId) {
  const c = openPunch(empId); if (!c) return;
  if (c.brkStart) { c.brk += span(c.brkStart, nowHM()); c.brkStart = null; }
  c.out = nowHM(); log(`${nmId(empId)} clocked out`);
}
function breakToggle(empId) {
  const c = openPunch(empId); if (!c) return;
  if (c.brkStart) { c.brk += span(c.brkStart, nowHM()); c.brkStart = null; log(`${nmId(empId)} ended break`); }
  else { c.brkStart = nowHM(); log(`${nmId(empId)} started break`); }
}

// ---------- Time clock ----------
VIEWS.clock = (v) => (role() === "employee" ? clockEmployee(v) : clockManager(v));

function clockCard(empId, kiosk) {
  const e = E(empId), c = openPunch(empId), T = today();
  const sh = shiftsOn(empId, T)[0];
  const worked = c ? punchMin(c) : 0;
  return `<div class="clock-face"><div class="t" data-clock>${clockStr()}</div><div class="d">${fmtDY(T)}</div></div>
    <div style="text-align:center;margin-top:10px">${c ? `<span class="status-chip ${c.brkStart ? "brk" : "in"}">● ${c.brkStart ? "On break since " + fmtT(c.brkStart) : "Clocked in at " + fmtT(c.in)}</span>` : `<span class="status-chip out">○ Not clocked in</span>`}</div>
    <p class="muted" style="text-align:center;margin:10px 0 0;font-size:13.5px">${kiosk ? `<b style="color:var(--ink)">${esc(nm(e))}</b> · ` : ""}${sh ? `Today's shift ${fmtT(sh.start)} – ${fmtT(sh.end)}` : "No shift scheduled today"}${c ? ` · ${h1(worked)} so far` : ""}</p>
    <div class="clock-actions">${c ? `<button class="btn lg" data-act="brk" data-id="${empId}">${c.brkStart ? "End break" : "Start break"}</button><button class="btn lg primary" data-act="cout" data-id="${empId}">Clock out</button>` : `<button class="btn lg primary" style="grid-column:1/-1" data-act="cin" data-id="${empId}">Clock in</button>`}</div>`;
}
ACT.cin = (b) => { const sh = clockIn(b.dataset.id); const late = sh ? nowMin() - toMin(sh.start) : 0; afterPunch(b, `${nmId(b.dataset.id)} clocked in at ${clockStr()}${sh && late > S().settings.graceMin && late < 600 ? ` (${late} min late)` : ""}`); };
ACT.cout = (b) => { clockOut(b.dataset.id); afterPunch(b, `${nmId(b.dataset.id)} clocked out at ${clockStr()}`); };
ACT.brk = (b) => { breakToggle(b.dataset.id); afterPunch(b, openPunch(b.dataset.id)?.brkStart ? "Break started. Enjoy." : "Welcome back"); };
function afterPunch(b, msg) { const inModal = b.closest("#modal"); if (inModal) closeModal(); refresh(); toast(msg); }

function clockEmployee(v) {
  const e = me(), T = today();
  const op = openPunch(e.id);
  const recent = S().punches.filter((c) => c.emp === e.id && c.date < T && c !== op).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  v.innerHTML = `<div class="grid g2">
    <div class="card">${clockCard(e.id)}<p class="muted" style="font-size:12.5px;margin:14px 0 0;text-align:center">In production this checks the hotel's Wi-Fi or a geofence before accepting a punch.</p></div>
    <div class="card"><div class="card-h"><h2>Recent punches</h2><a href="#/timesheets" class="btn sm">My timesheet</a></div>
      <div class="list">${recent.map((c) => { const x = exceptionsFor(e.id, c.date); return `<div class="li"><div class="grow"><b>${fmtD(c.date)}</b><small>${fmtT(c.in)} – ${c.out ? fmtT(c.out) : "missing"} · break ${c.brk} min · ${h1(punchMin(c))}</small></div>${x.length ? `<span class="pill ${x[0].cls}">${esc(x[0].t)}</span>` : ""}<button class="btn sm" data-act="fix" data-id="${c.id}">Fix</button></div>`; }).join("") || `<div class="empty">No punches yet.</div>`}</div></div></div>`;
}

function clockManager(v) {
  const pid = scope();
  const board = A.liveBoard(pid);
  const grp = { in: board.filter((r) => r.ord === 0), brk: board.filter((r) => r.ord === 1), late: board.filter((r) => r.ord === 2), up: board.filter((r) => r.ord === 3), done: board.filter((r) => r.ord === 5) };
  const col = (t, list, cls) => `<div class="card"><div class="card-h"><h3>${t}</h3><span class="pill ${cls}">${list.length}</span></div><div class="list">${list.map((r) => { const e = E(r.s.emp); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))} · ${fmtT(r.s.start)}–${fmtT(r.s.end)}${r.c ? ` · in ${fmtT(r.c.in)}` : ""}${r.c && r.c.out ? ` · out ${fmtT(r.c.out)}` : ""}</small></div>${r.ord <= 2 ? `<button class="btn sm" data-act="kiosk-for" data-id="${e.id}">${r.ord === 2 ? "Clock in" : "Punch"}</button>` : ""}</div>`; }).join("") || `<div class="empty">Nobody.</div>`}</div></div>`;
  v.innerHTML = `<div class="ph"><div><h1>Time clock</h1><p>${esc(pid === "all" ? "All hotels" : prop(pid).name)} · live status of today's shifts</p></div><div class="toolbar"><button class="btn primary" data-act="kiosk">Open kiosk mode</button></div></div>
    <div class="grid g4 keep2" style="margin-bottom:16px">
      <div class="kpi ok"><div class="l">Clocked in</div><div class="v">${grp.in.length}</div></div>
      <div class="kpi"><div class="l">On break</div><div class="v">${grp.brk.length}</div></div>
      <div class="kpi ${grp.late.length ? "alert" : ""}"><div class="l">Late or missing</div><div class="v">${grp.late.length}</div></div>
      <div class="kpi"><div class="l">Still to start</div><div class="v">${grp.up.length}</div></div>
    </div>
    <div class="grid g2">${col("Clocked in", grp.in, "good")}${col("Late or not in", grp.late, "bad")}${col("On break", grp.brk, "warn")}${col("Starting later", grp.up, "info")}</div>
    <div class="card mt">${col("Finished today", grp.done, "").replace(/^<div class="card">|<\/div>$/g, "")}</div>`;
}
ACT["kiosk-for"] = (b) => modal({ title: "Punch for " + esc(nmId(b.dataset.id)), body: clockCard(b.dataset.id, true) + `<p class="muted" style="font-size:12.5px;margin-top:12px">A manager punch is recorded as an edit in the audit log.</p>` });
ACT.kiosk = () => {
  let pin = "";
  const draw = (m) => {
    $("#pd", m).innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i < pin.length ? "f" : ""}"></i>`).join("");
  };
  modal({
    title: "Kiosk: enter your PIN",
    body: `<div class="clock-face"><div class="t" data-clock style="font-size:36px">${clockStr()}</div><div class="d">${esc(prop(scope() === "all" ? "p1" : scope()).name)}</div></div>
      <div class="pin-dots" id="pd"></div><div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>
      <p class="muted" style="text-align:center;font-size:12.5px;margin:12px 0 0">Demo: ${esc(nmId(S().personas.employee))} uses PIN ${E(S().personas.employee).pin}. Each PIN is on the person's profile.</p>`,
    onMount: (m) => {
      draw(m);
      const press = (k) => {
        if (k === "⌫") pin = pin.slice(0, -1);
        else if (k === "✓" || pin.length === 4) return;
        else pin += k;
        draw(m);
        if (pin.length === 4) {
          const e = activeEmps().find((x) => x.pin === pin && (scope() === "all" || x.prop === scope()));
          if (!e) { toast("PIN not recognised at this hotel"); pin = ""; setTimeout(() => draw(m), 150); return; }
          $(".mb", m).innerHTML = clockCard(e.id, true);
          $(".mh h2", m).textContent = "Hello, " + e.first;
        }
      };
      $$(".pinpad button", m).forEach((b) => (b.onclick = () => press(b.dataset.k)));
      const kd = (ev) => { if (/^[0-9]$/.test(ev.key)) press(ev.key); if (ev.key === "Backspace") press("⌫"); };
      document.addEventListener("keydown", kd);
      A.setModalClose(() => document.removeEventListener("keydown", kd));
    },
  });
};

// ---------- Punch correction (employee) ----------
ACT.fix = (b) => {
  const c = S().punches.find((x) => x.id === b.dataset.id);
  const sh = S().shifts.find((x) => x.id === c.shift);
  modal({
    title: "Ask for a punch fix",
    body: `<p><b>${fmtD(c.date)}</b> · in ${fmtT(c.in)}, out ${c.out ? fmtT(c.out) : "missing"}${sh ? ` · scheduled ${fmtT(sh.start)}–${fmtT(sh.end)}` : ""}</p>
      <div class="fields"><div class="field"><label>Which punch?</label><select id="fx-f"><option value="out" ${c.out ? "" : "selected"}>Clock out</option><option value="in">Clock in</option></select></div>
      <div class="field"><label>Correct time</label><input type="time" id="fx-t" value="${c.out || (sh ? sh.end : "")}"></div>
      <div class="field full"><label>Reason</label><input type="text" id="fx-r" maxlength="140" placeholder="e.g. The kiosk was down when I left"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="fx-ok">Send to manager</button>`,
    onMount: (m) => {
      $("#fx-f", m).onchange = (ev) => ($("#fx-t", m).value = ev.target.value === "in" ? c.in : c.out || (sh ? sh.end : ""));
      $("[data-x2]", m).onclick = closeModal;
      $("#fx-ok", m).onclick = () => {
        const f = $("#fx-f", m).value, t = $("#fx-t", m).value, r = $("#fx-r", m).value.trim();
        if (!t) return toast("Enter the correct time"); if (!r) return toast("Add a short reason");
        S().corrections.push({ id: uid("k"), emp: c.emp, punch: c.id, date: c.date, field: f, from: c[f], to: t, reason: r, status: "pending", created: today() });
        log(`Asked for a punch fix on ${fmtD(c.date)}`); closeModal(); refresh(); toast("Sent to your manager");
      };
    },
  });
};

// ---------- Timesheets ----------
const periods = () => { const cur = periodStart(today()); return [addDays(cur, -14), cur]; };
const pLabel = (ps) => `${fmtDs(ps)} – ${fmtDY(addDays(ps, 13))}`;
const tsKey = (empId, ps) => empId + "|" + ps;
function periodExc(empId, ps) { const T = today(); const out = []; for (let d = ps; d <= addDays(ps, 13) && d < T; d = addDays(d, 1)) exceptionsFor(empId, d).forEach((x) => out.push({ d, ...x })); return out; }
A.periodExc = periodExc;

VIEWS.timesheets = (v) => {
  if (role() === "employee") return timesheetDetail(v, S().me.emp, ui.period);
  const ps = ui.period, pe = addDays(ps, 13);
  const locked = S().payruns[ps]?.status === "finalized";
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (ui.dept === "all" || e.dept === ui.dept) && (!ui.tsQ || nm(e).toLowerCase().includes(ui.tsQ.toLowerCase())));
  const rows = emps.map((e) => { const p = payFor(S(), e, ps); const x = periodExc(e.id, ps); return { e, p, x, ok: !!S().tsApproved[tsKey(e.id, ps)] }; });
  const showOnly = ui.tsShow || "all";
  const vis = rows.filter((r) => showOnly === "all" || (showOnly === "exc" && r.x.length) || (showOnly === "todo" && !r.ok));
  const tot = rows.reduce((a, r) => ({ reg: a.reg + r.p.reg, ot: a.ot + r.p.ot, hol: a.hol + r.p.hol }), { reg: 0, ot: 0, hol: 0 });
  const approved = rows.filter((r) => r.ok).length;
  const clean = rows.filter((r) => !r.ok && !r.x.length).length;
  v.innerHTML = `<div class="ph"><div><h1>Timesheets</h1><p>Pay period ${pLabel(ps)} · ${locked ? `<span class="pill good">Paid, locked</span>` : ps === periodStart(today()) ? `<span class="pill info">Open</span>` : `<span class="pill warn">Closed, waiting for payroll</span>`}</p></div>
    <div class="toolbar"><select id="ts-p" aria-label="Pay period">${periods().map((p) => `<option value="${p}" ${p === ps ? "selected" : ""}>${pLabel(p)}</option>`).join("")}</select>
    <select id="ts-d" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.dept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <input type="search" id="ts-q" placeholder="Search name" value="${esc(ui.tsQ)}" style="width:150px"></div></div>
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Regular hours</div><div class="v">${h1(tot.reg)}</div></div>
    <div class="kpi ${tot.ot ? "alert" : ""}"><div class="l">Overtime hours</div><div class="v">${h1(tot.ot)}</div><div class="s">Over ${S().settings.otWeekly} h a week, paid at 1.5×</div></div>
    <div class="kpi"><div class="l">Holiday hours worked</div><div class="v">${h1(tot.hol)}</div><div class="s">Paid at 1.5× plus holiday pay</div></div>
    <div class="kpi ${approved === rows.length ? "ok" : ""}"><div class="l">Approved</div><div class="v">${approved} / ${rows.length}</div><div class="bar"><i class="good" style="width:${(approved / Math.max(1, rows.length)) * 100}%"></i></div></div>
  </div>
  <div class="card">
    <div class="card-h"><div class="seg"><button data-act="ts-show" data-s="all" class="${showOnly === "all" ? "on" : ""}">Everyone</button><button data-act="ts-show" data-s="exc" class="${showOnly === "exc" ? "on" : ""}">With exceptions</button><button data-act="ts-show" data-s="todo" class="${showOnly === "todo" ? "on" : ""}">Not approved</button></div>
    <div class="toolbar">${locked ? "" : `<button class="btn good" data-act="ts-bulk" ${clean ? "" : "disabled"}>Approve ${clean} without exceptions</button>`}<button class="btn" data-act="ts-csv">Export CSV</button></div></div>
    <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th class="n">Regular</th><th class="n">Overtime</th><th class="n hide-sm">Holiday</th><th class="n hide-sm">Time off</th><th>Exceptions</th><th>Status</th></tr></thead><tbody>
    ${vis.map((r) => `<tr class="click" data-act="ts-open" data-id="${r.e.id}"><td><b>${esc(nm(r.e))}</b><br><small>${esc(posName(r.e.pos))}${r.e.pay === "salary" ? " · salaried" : ""}</small></td><td class="hide-sm"><span class="dot" style="background:${dept(r.e.dept).color}"></span>${esc(dept(r.e.dept).name)}</td><td class="n">${(r.p.reg / 60).toFixed(2)}</td><td class="n" style="${r.p.ot ? "color:var(--bad);font-weight:600" : ""}">${(r.p.ot / 60).toFixed(2)}</td><td class="n hide-sm">${(r.p.hol / 60).toFixed(2)}</td><td class="n hide-sm">${r.p.ptoHrs ? r.p.ptoHrs.toFixed(2) : "–"}</td><td>${r.x.length ? `<span class="pill ${r.x.some((x) => x.cls === "bad") ? "bad" : "warn"}">${r.x.length}</span>` : `<span class="muted">–</span>`}</td><td>${r.ok ? `<span class="pill good">Approved</span>` : `<span class="pill">Pending</span>`}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No timesheets match.</td></tr>`}
    </tbody></table></div></div>`;
  $("#ts-p").onchange = (e) => { ui.period = e.target.value; A.render(); };
  $("#ts-d").onchange = (e) => { ui.dept = e.target.value; A.render(); };
  $("#ts-q").oninput = (e) => { ui.tsQ = e.target.value; clearTimeout(ui._t); ui._t = setTimeout(() => { A.render(); const q = $("#ts-q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
};
ACT["ts-show"] = (b) => { ui.tsShow = b.dataset.s; A.render(); };
ACT["ts-bulk"] = () => {
  const ps = ui.period, pe = addDays(ps, 13); let n = 0;
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (ui.dept === "all" || e.dept === ui.dept)).forEach((e) => { if (!S().tsApproved[tsKey(e.id, ps)] && !periodExc(e.id, ps).length) { S().tsApproved[tsKey(e.id, ps)] = { by: S().me.emp, at: today() }; n++; } });
  log(`Approved ${n} timesheets for ${pLabel(ps)}`); refresh(); toast(`${n} timesheets approved`);
};
ACT["ts-csv"] = () => {
  const ps = ui.period;
  const rows = [["Employee #", "Name", "Hotel", "Department", "Position", "Regular h", "Overtime h", "Holiday h", "Time off h", "Exceptions", "Approved"]];
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= addDays(ps, 13)).forEach((e) => { const p = payFor(S(), e, ps); rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, posName(e.pos), (p.reg / 60).toFixed(2), (p.ot / 60).toFixed(2), (p.hol / 60).toFixed(2), p.ptoHrs, periodExc(e.id, ps).length, S().tsApproved[tsKey(e.id, ps)] ? "Yes" : "No"]); });
  csv(`timesheets-${ps}.csv`, rows);
};
ACT["ts-open"] = (b) => { const id = b.dataset.id; modal({ title: esc(nmId(id)) + " · timesheet", wide: true, body: `<div id="tsd"></div>`, onMount: (m) => timesheetDetail($("#tsd", m), id, ui.period, true) }); };

function timesheetDetail(v, empId, ps, inModal) {
  const e = E(empId), T = today(), mgr = isMgr();
  const locked = S().payruns[ps]?.status === "finalized";
  const p = payFor(S(), e, ps);
  const days = [...Array(14)].map((_, i) => addDays(ps, i));
  const ok = S().tsApproved[tsKey(empId, ps)];
  const canEdit = mgr && !locked;
  const head = inModal ? "" : `<div class="ph"><div><h1>My timesheet</h1><p>Pay period ${pLabel(ps)}</p></div><div class="toolbar"><select id="ts-p" aria-label="Pay period">${periods().map((x) => `<option value="${x}" ${x === ps ? "selected" : ""}>${pLabel(x)}</option>`).join("")}</select></div></div>`;
  v.innerHTML = `${head}
  ${inModal ? `<div class="toolbar" style="justify-content:space-between;margin-bottom:12px"><span>${esc(posName(e.pos))} · ${esc(prop(e.prop).short)} · ${pLabel(ps)}</span>${ok ? `<span class="pill good">Approved ${fmtDs(ok.at)}</span>` : `<span class="pill">Not approved</span>`}</div>` : ""}
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Regular</div><div class="v">${h1(p.reg)}</div></div>
    <div class="kpi ${p.ot ? "alert" : ""}"><div class="l">Overtime</div><div class="v">${h1(p.ot)}</div></div>
    <div class="kpi"><div class="l">Holiday worked</div><div class="v">${h1(p.hol)}</div></div>
    <div class="kpi"><div class="l">Paid time off</div><div class="v">${p.ptoHrs} h</div></div>
  </div>
  <div class="tw"><table><thead><tr><th>Day</th><th>Scheduled</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Hours</th><th>Notes</th>${!mgr ? "<th></th>" : ""}</tr></thead><tbody>
  ${days.map((d) => {
    const pu = S().punches.filter((c) => c.emp === empId && c.date === d);
    const sh = shiftsOn(empId, d);
    const lv = onLeaveAny(empId, d);
    const x = d <= T ? exceptionsFor(empId, d) : [];
    const sched = sh.map((s) => `${fmtT(s.start)}–${fmtT(s.end)}`).join(", ") || (lv ? typeName[lv.type] : `<span class="muted">Off</span>`);
    const wk = d === addDays(ps, 7) ? ` style="border-top:2px solid var(--line-2)"` : "";
    if (!pu.length) return `<tr${wk}><td class="nowrap"><b>${fmtD(d)}</b>${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}</td><td class="nowrap">${sched}</td><td>–</td><td>–</td><td class="n">–</td><td class="n">${lv ? "8.00" : "–"}</td><td>${x.map((y) => `<span class="pill ${y.cls}">${esc(y.t)}</span>`).join(" ")}${lv ? `<span class="pill violet">${typeName[lv.type]}</span>` : ""}${canEdit && d <= T && !lv ? ` <button class="btn sm" data-act="add-punch" data-emp="${empId}" data-d="${d}">+ Punch</button>` : ""}</td>${!mgr ? "<td></td>" : ""}</tr>`;
    return pu.map((c, i) => `<tr${i ? "" : wk}><td class="nowrap">${i ? "" : `<b>${fmtD(d)}</b>${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}`}</td><td class="nowrap">${i ? "" : sched}</td>
      <td>${canEdit ? `<input type="time" value="${c.in}" data-pe="in" data-id="${c.id}" style="width:118px">` : fmtT(c.in)}</td>
      <td>${canEdit ? `<input type="time" value="${c.out || ""}" data-pe="out" data-id="${c.id}" style="width:118px">` : c.out ? fmtT(c.out) : c.date === T ? `<span class="pill good">In now</span>` : `<span class="pill bad">Missing</span>`}</td>
      <td class="n">${canEdit ? `<input type="number" min="0" max="180" value="${c.brk}" data-pe="brk" data-id="${c.id}" style="width:70px">` : c.brk + "m"}</td>
      <td class="n"><b>${(punchMin(c) / 60).toFixed(2)}</b></td>
      <td>${x.map((y) => `<span class="pill ${y.cls}">${esc(y.t)}</span>`).join(" ")}${c.edited ? ` <span class="pill info" title="${esc(c.note)}">Edited</span>` : ""}${c.tips ? ` <small>Tips ${money(c.tips)}</small>` : ""}</td>
      ${!mgr ? `<td>${d < T ? `<button class="btn sm" data-act="fix" data-id="${c.id}">Fix</button>` : ""}</td>` : ""}</tr>`).join("");
  }).join("")}
  </tbody><tfoot><tr><td colspan="5">Total</td><td class="n">${((p.reg + p.ot + p.hol) / 60).toFixed(2)}</td><td colspan="${mgr ? 1 : 2}"></td></tr></tfoot></table></div>
  ${mgr ? `<div class="toolbar" style="justify-content:flex-end;margin-top:14px">${locked ? `<span class="muted">This period has been paid and is locked.</span>` : ok ? `<button class="btn" data-act="ts-unapprove" data-id="${empId}">Remove approval</button>` : `<button class="btn good" data-act="ts-approve" data-id="${empId}">Approve timesheet</button>`}</div>` : `<p class="muted" style="font-size:13px;margin-top:12px">${ok ? "Your manager approved this timesheet." : "Your manager approves timesheets at the end of the pay period. Spot a mistake? Use Fix to ask for a correction."}</p>`}`;
  const tp = $("#ts-p", v); if (tp) tp.onchange = (ev) => { ui.period = ev.target.value; A.render(); };
  $$("[data-pe]", v).forEach((inp) => (inp.onchange = () => {
    const c = S().punches.find((x) => x.id === inp.dataset.id);
    const f = inp.dataset.pe, old = c[f];
    c[f] = f === "brk" ? Math.max(0, Number(inp.value) || 0) : inp.value || null;
    c.edited = true; c.note = `Edited by ${nm(me())} on ${fmtDs(today())}`;
    delete S().tsApproved[tsKey(empId, ps)];
    log(`Edited ${nm(e)}'s ${f === "brk" ? "break" : "punch " + f} on ${fmtD(c.date)}: ${old ?? "blank"} → ${c[f] ?? "blank"}`);
    save(); timesheetDetail(v, empId, ps, inModal); toast("Punch updated");
  }));
  const ap = $("[data-act=ts-approve]", v), un = $("[data-act=ts-unapprove]", v);
  if (ap) ap.onclick = (ev) => { ev.stopPropagation(); S().tsApproved[tsKey(empId, ps)] = { by: S().me.emp, at: today() }; log(`Approved ${nm(e)}'s timesheet for ${pLabel(ps)}`); save(); if (inModal) { closeModal(); A.render(); } else timesheetDetail(v, empId, ps, inModal); toast("Timesheet approved"); };
  if (un) un.onclick = (ev) => { ev.stopPropagation(); delete S().tsApproved[tsKey(empId, ps)]; log(`Removed approval of ${nm(e)}'s timesheet`); save(); timesheetDetail(v, empId, ps, inModal); };
  $$("[data-act=add-punch]", v).forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation();
    const d = b.dataset.d, sh = shiftsOn(empId, d)[0];
    S().punches.push({ id: uid("c"), emp: empId, date: d, in: sh ? sh.start : "09:00", out: sh ? sh.end : "17:00", brk: sh ? sh.brk : 30, brkStart: null, shift: sh ? sh.id : null, edited: true, note: `Added by ${nm(me())}`, tips: 0 });
    delete S().tsApproved[tsKey(empId, ps)];
    log(`Added a punch for ${nm(e)} on ${fmtD(d)}`); save(); timesheetDetail(v, empId, ps, inModal);
  }));
}
function onLeaveAny(empId, d) { return S().timeoff.find((t) => t.emp === empId && t.status === "approved" && d >= t.from && d <= t.to); }

// ---------- Payroll ----------
VIEWS.payroll = (v) => {
  const ps = ui.period, pe = addDays(ps, 13), T = today();
  const run = S().payruns[ps];
  const locked = run?.status === "finalized";
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (e.status === "active" || S().punches.some((c) => c.emp === e.id && c.date >= ps && c.date <= pe)));
  const rows = emps.map((e) => ({ e, p: payFor(S(), e, ps), ok: !!S().tsApproved[tsKey(e.id, ps)] }));
  const sum = (k) => rows.reduce((a, r) => a + r.p[k], 0);
  const approved = rows.filter((r) => r.ok).length;
  const closed = pe < T;
  const step = locked ? 4 : approved < rows.length ? 1 : 2;
  const byDept = S().depts.map((d) => { const rr = rows.filter((r) => r.e.dept === d.id); return { d, n: rr.length, gross: rr.reduce((a, r) => a + r.p.gross, 0), ot: rr.reduce((a, r) => a + r.p.otPay, 0), er: rr.reduce((a, r) => a + r.p.employer, 0) }; }).filter((x) => x.n);
  v.innerHTML = `<div class="ph"><div><h1>Payroll</h1><p>${esc(scope() === "all" ? "All hotels" : prop(scope()).name)} · bi-weekly · period ${pLabel(ps)} · pay date ${fmtDY(payDate(ps))}</p></div>
    <div class="toolbar"><select id="pr-p" aria-label="Pay period">${periods().map((p) => `<option value="${p}" ${p === ps ? "selected" : ""}>${pLabel(p)}</option>`).join("")}</select><button class="btn" data-act="pr-csv">Export register</button>${locked ? "" : `<button class="btn primary" data-act="pr-final" ${closed ? "" : "disabled title='The period is still open'"}>Finalize pay run</button>`}</div></div>
  <div class="steps"><div class="${step > 1 ? "done" : "cur"}"><b>Step 1</b>Timesheets approved ${approved}/${rows.length}</div><div class="${step > 2 ? "done" : step === 2 ? "cur" : ""}"><b>Step 2</b>Review the register</div><div class="${locked ? "done" : ""}"><b>Step 3</b>Finalize ${locked ? fmtDs(run.at) : ""}</div><div class="${locked ? "done" : ""}"><b>Step 4</b>Deposit ${fmtDs(payDate(ps))}</div></div>
  ${!closed ? `<div class="banner info" style="margin-bottom:14px"><span>This period is still open, so the figures are a running estimate up to today. You can finalize after ${fmtDY(pe)}.</span></div>` : ""}
  ${!locked && closed && approved < rows.length ? `<div class="banner warn" style="margin-bottom:14px"><span>${rows.length - approved} timesheets still need approval before you finalize.</span><a class="btn sm" href="#/timesheets">Go to timesheets</a></div>` : ""}
  <div class="grid g4 keep2">
    <div class="kpi"><div class="l">Gross pay</div><div class="v">${m0(sum("gross"))}</div><div class="s">${rows.length} employees</div></div>
    <div class="kpi"><div class="l">Net pay (deposits)</div><div class="v">${m0(sum("net"))}</div><div class="s">After ${m0(sum("ded"))} deductions</div></div>
    <div class="kpi"><div class="l">Employer cost on top</div><div class="v">${m0(sum("employer"))}</div><div class="s">CPP, EI, EHT and WSIB</div></div>
    <div class="kpi ${sum("otPay") ? "alert" : ""}"><div class="l">Overtime pay</div><div class="v">${m0(sum("otPay"))}</div><div class="s">${pct(sum("otPay") / Math.max(1, sum("gross")), 1)} of gross</div></div>
  </div>
  <div class="stack mt">
    <div class="card"><div class="card-h"><h2>Pay register</h2><span class="muted" style="font-size:13px">Select a row for the pay stub</span></div>
      <div class="tw"><table><thead><tr><th>Employee</th><th class="n hide-sm">Hours</th><th class="n hide-sm">OT h</th><th class="n">Gross</th><th class="n hide-sm">CPP</th><th class="n hide-sm">EI</th><th class="n hide-sm">Tax</th><th class="n hide-sm">Other</th><th class="n">Net</th><th class="hide-sm"></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-act="stub" data-id="${r.e.id}" data-ps="${ps}"><td><b>${esc(nm(r.e))}</b><br><small>${esc(posName(r.e.pos))} · ${r.e.pay === "salary" ? "salary" : money(r.e.wage) + "/h"}</small></td><td class="n hide-sm">${r.e.pay === "salary" ? "–" : ((r.p.reg + r.p.ot + r.p.hol) / 60).toFixed(1)}</td><td class="n hide-sm">${r.p.ot ? (r.p.ot / 60).toFixed(1) : "–"}</td><td class="n">${money(r.p.gross)}</td><td class="n hide-sm">${money(r.p.cpp)}</td><td class="n hide-sm">${money(r.p.ei)}</td><td class="n hide-sm">${money(r.p.tax)}</td><td class="n hide-sm">${money(r.p.ben + r.p.union)}</td><td class="n"><b>${money(r.p.net)}</b></td><td class="hide-sm">${r.ok ? "" : `<span class="pill warn" title="Timesheet not approved">!</span>`}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td class="n hide-sm"></td><td class="n hide-sm">${(sum("ot") / 60).toFixed(1)}</td><td class="n">${money(sum("gross"))}</td><td class="n hide-sm">${money(sum("cpp"))}</td><td class="n hide-sm">${money(sum("ei"))}</td><td class="n hide-sm">${money(sum("tax"))}</td><td class="n hide-sm">${money(sum("ben") + sum("union"))}</td><td class="n">${money(sum("net"))}</td><td class="hide-sm"></td></tr></tfoot></table></div></div>
    <div class="grid g2">
      <div class="card"><h2>By department</h2><div class="chart sm"><canvas id="pr-ch"></canvas></div>
        <div class="tw"><table><thead><tr><th>Department</th><th class="n">Gross</th><th class="n">OT</th></tr></thead><tbody>${byDept.map((x) => `<tr><td><span class="dot" style="background:${x.d.color}"></span>${esc(x.d.name)}</td><td class="n">${m0(x.gross)}</td><td class="n">${m0(x.ot)}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="card"><h3>Remittances due</h3><dl class="kv"><dt>CPP (employee + employer)</dt><dd>${money(sum("cpp") * 2)}</dd><dt>EI (employee + employer)</dt><dd>${money(sum("ei") * 2.4)}</dd><dt>Income tax withheld</dt><dd>${money(sum("tax"))}</dd><dt>Union dues</dt><dd>${money(sum("union"))}</dd></dl>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">Deductions use simplified 2026 rates for the demo. A production system would use the CRA payroll tables and send a bank deposit file.</p></div>
    </div>
  </div>`;
  $("#pr-p").onchange = (e) => { ui.period = e.target.value; A.render(); };
  chart($("#pr-ch"), { type: "doughnut", data: { labels: byDept.map((x) => x.d.name), datasets: [{ data: byDept.map((x) => Math.round(x.gross)), backgroundColor: byDept.map((x) => x.d.color), borderWidth: 0 }] }, options: { cutout: "62%", plugins: { legend: { position: "right" }, tooltip: { callbacks: { label: (c) => `${c.label}: ${m0(c.raw)}` } } } } });
};
ACT["pr-final"] = () => {
  const ps = ui.period, pe = addDays(ps, 13);
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe);
  const un = emps.filter((e) => !S().tsApproved[tsKey(e.id, ps)]).length;
  confirmBox("Finalize this pay run?", `${un ? `<b>${un} timesheets are not approved.</b> They will be paid as recorded. ` : ""}This locks every timesheet in ${pLabel(ps)}, releases pay stubs to employees and schedules deposits for ${fmtDY(payDate(ps))}.`, "Finalize", () => {
    S().payruns[ps] = { status: "finalized", at: today(), by: S().me.emp };
    emps.forEach((e) => { if (!S().tsApproved[tsKey(e.id, ps)]) S().tsApproved[tsKey(e.id, ps)] = { by: S().me.emp, at: today(), auto: true }; });
    log(`Finalized the pay run for ${pLabel(ps)}`); refresh(); toast("Pay run finalized. Stubs released.");
  });
};
ACT["pr-csv"] = () => {
  const ps = ui.period, pe = addDays(ps, 13);
  const rows = [["Employee #", "Name", "Hotel", "Department", "Pay type", "Rate", "Regular h", "OT h", "Holiday h", "Regular $", "OT $", "Holiday $", "Time off $", "Vacation pay $", "Tips $", "Salary $", "Gross", "CPP", "EI", "Income tax", "Benefits", "Union", "Net", "Employer cost"]];
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe).forEach((e) => { const p = payFor(S(), e, ps); rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, e.pay, e.wage, (p.reg / 60).toFixed(2), (p.ot / 60).toFixed(2), (p.hol / 60).toFixed(2), p.regPay.toFixed(2), p.otPay.toFixed(2), (p.holPremPay + p.holPay).toFixed(2), p.ptoPay.toFixed(2), p.vacPay.toFixed(2), p.tips.toFixed(2), p.salary.toFixed(2), p.gross.toFixed(2), p.cpp.toFixed(2), p.ei.toFixed(2), p.tax.toFixed(2), p.ben.toFixed(2), p.union.toFixed(2), p.net.toFixed(2), p.employer.toFixed(2)]); });
  csv(`pay-register-${ps}.csv`, rows);
};

function stubHTML(e, ps) {
  const p = payFor(S(), e, ps);
  const line = (l, h, r, a) => (a ? `<tr><td>${l}</td><td class="n">${h ?? ""}</td><td class="n">${r ?? ""}</td><td class="n">${money(a)}</td></tr>` : "");
  const final = S().payruns[ps]?.status === "finalized";
  return `<div class="stub"><div class="stub-h"><div><b>${esc(S().company)}</b><small>${esc(prop(e.prop).name)}</small></div><div style="text-align:right"><b>${final ? "Pay statement" : "Estimate (period still open)"}</b><small>Period ${pLabel(ps)} · paid ${fmtDY(payDate(ps))}</small></div></div>
    <div class="stub-b"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px"><div><b>${esc(nm(e))}</b><br><small>#${e.no} · ${esc(posName(e.pos))} · ${esc(dept(e.dept).name)}</small></div><div style="text-align:right"><small>Net pay</small><div class="net">${money(p.net)}</div></div></div>
    <div class="tw"><table><thead><tr><th>Earnings</th><th class="n">Hours</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>
      ${line("Salary", null, null, p.salary)}${line("Regular", (p.reg / 60).toFixed(2), money(e.wage), p.regPay)}${line("Overtime 1.5×", (p.ot / 60).toFixed(2), money(e.wage * 1.5), p.otPay)}${line("Holiday worked 1.5×", (p.hol / 60).toFixed(2), money(e.wage * 1.5), p.holPremPay)}${line("Public holiday pay", null, null, p.holPay)}${line("Paid time off", p.ptoHrs.toFixed(2), money(e.wage), p.ptoPay)}${line(`Vacation pay ${S().settings.vacPayPct}%`, null, null, p.vacPay)}${line("Tips declared", null, null, p.tips)}
      </tbody><tfoot><tr><td colspan="3">Gross pay</td><td class="n">${money(p.gross)}</td></tr></tfoot></table></div>
    <div class="tw mt"><table><thead><tr><th>Deductions</th><th class="n">Amount</th></tr></thead><tbody>
      <tr><td>CPP contributions</td><td class="n">${money(p.cpp)}</td></tr><tr><td>EI premiums</td><td class="n">${money(p.ei)}</td></tr><tr><td>Income tax (federal + Ontario)</td><td class="n">${money(p.tax)}</td></tr>${p.ben ? `<tr><td>Health and dental</td><td class="n">${money(p.ben)}</td></tr>` : ""}${p.union ? `<tr><td>Union dues</td><td class="n">${money(p.union)}</td></tr>` : ""}
      </tbody><tfoot><tr><td>Total deductions</td><td class="n">${money(p.ded)}</td></tr></tfoot></table></div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Balances: vacation ${e.bal.vac} h · sick ${e.bal.sick} h · personal ${e.bal.per} h. Demo deductions use simplified rates.</p></div></div>`;
}
ACT.stub = (b) => { const e = E(b.dataset.id); modal({ title: "Pay stub", wide: true, body: stubHTML(e, b.dataset.ps), foot: `<button class="btn" onclick="window.print()">Print</button><button class="btn primary" data-x2>Close</button>`, onMount: (m) => ($("[data-x2]", m).onclick = closeModal) }); };

// ---------- Employee pay ----------
VIEWS.pay = (v) => {
  const e = me(), cur = periodStart(today());
  const list = [cur, addDays(cur, -14)];
  const finals = Object.keys(S().payruns).filter((k) => S().payruns[k].status === "finalized").sort().reverse();
  const ytd = finals.reduce((a, ps) => { const p = payFor(S(), e, ps); return { g: a.g + p.gross, n: a.n + p.net }; }, { g: 0, n: 0 });
  const sel = ui.payPs && list.includes(ui.payPs) ? ui.payPs : finals[0] || cur;
  v.innerHTML = `<div class="ph"><div><h1>Pay</h1><p>Bi-weekly · direct deposit to the account ending 4821</p></div></div>
  <div class="grid g-main"><div class="card" id="stub-box">${stubHTML(e, sel)}</div>
  <div class="stack"><div class="card"><h2>Pay statements</h2><div class="list">${list.map((ps) => { const p = payFor(S(), e, ps); const f = S().payruns[ps]?.status === "finalized"; return `<div class="li" style="cursor:pointer" data-act="pay-sel" data-ps="${ps}"><div class="grow"><b>${fmtDY(payDate(ps))}</b><small>${pLabel(ps)}</small></div><span class="pill ${f ? "good" : "info"}">${f ? "Paid" : "Estimate"}</span><b>${money(p.net, 0)}</b></div>`; }).join("")}</div></div>
  <div class="card"><h3>Shown in this demo</h3><dl class="kv"><dt>Gross paid</dt><dd>${money(ytd.g)}</dd><dt>Net paid</dt><dd>${money(ytd.n)}</dd></dl><p class="muted" style="font-size:12.5px;margin:10px 0 0">Year-end tax slips (T4) appear here in a full version.</p></div></div></div>`;
};
ACT["pay-sel"] = (b) => { ui.payPs = b.dataset.ps; A.render(); };

Object.assign(A, { clockIn, clockOut, tsKey, pLabel, periods, stubHTML });
})();
// Time off, approvals, people, onboarding, reports and settings.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, activeEmps, typeName, roleName, shiftsOn, exceptionsFor, pending } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, MON, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;
const stPill = (s) => `<span class="pill ${s === "approved" ? "good" : s === "denied" ? "bad" : s === "pending" ? "warn" : ""}">${s}</span>`;
const workdays = (from, to) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) n++; return n; };

// ---------- Time off ----------
VIEWS.timeoff = (v) => (role() === "employee" ? timeoffEmployee(v) : timeoffManager(v));

function calendarHTML(month, filter) {
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const start = weekStart(first);
  const T = today();
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i >= 35 && d.slice(0, 7) !== month) break;
    const evs = S().timeoff.filter((t) => t.status !== "denied" && t.status !== "cancelled" && d >= t.from && d <= t.to && filter(E(t.emp)));
    cells += `<div class="cd ${d.slice(0, 7) !== month ? "out" : ""} ${d === T ? "today" : ""}"><div class="dn">${Number(d.slice(8))}</div>${HOLIDAYS[d] ? `<span class="ev hol">${HOLIDAYS[d]}</span>` : ""}${evs.slice(0, 3).map((t) => `<span class="ev ${t.status === "pending" ? "pend" : t.type}" title="${esc(nmId(t.emp))}: ${typeName[t.type]} (${t.status})">${esc(E(t.emp).first)} ${esc(E(t.emp).last[0])}.</span>`).join("")}${evs.length > 3 ? `<span class="ev" style="color:var(--ink-3)">+${evs.length - 3} more</span>` : ""}</div>`;
  }
  return `<div class="card-h"><h2>${MON[mo - 1]} ${y}</h2><div class="seg"><button data-act="mo" data-n="-1" aria-label="Previous month">‹</button><button data-act="mo" data-n="0">Today</button><button data-act="mo" data-n="1" aria-label="Next month">›</button></div></div>
    <div class="cal">${DOW.map((d) => `<div class="dow">${d}</div>`).join("")}${cells}</div>
    <div class="legend"><span><i class="ev vac" style="background:#dcebfb"></i>Vacation</span><span><i style="background:#fde3cf"></i>Sick</span><span><i style="background:var(--violet-soft)"></i>Personal</span><span><i style="border:1px dashed #b88a1b"></i>Asked, not approved</span><span><i style="background:#e7f5ec"></i>Stat holiday</span></div>`;
}
ACT.mo = (b) => { const n = Number(b.dataset.n); if (!n) ui.toMonth = today().slice(0, 7); else { let [y, m] = ui.toMonth.split("-").map(Number); m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.toMonth = `${y}-${String(m).padStart(2, "0")}`; } A.render(); };

function timeoffEmployee(v) {
  const e = me();
  const mine = S().timeoff.filter((t) => t.emp === e.id).sort((a, b) => b.from.localeCompare(a.from));
  v.innerHTML = `<div class="ph"><div><h1>Time off</h1><p>Your balances, requests and who else is off in ${esc(dept(e.dept).name)}.</p></div><button class="btn primary" data-act="req-to">Request time off</button></div>
  <div class="grid g3">${[["vac", "Vacation", "Accrues each pay period"], ["sick", "Sick", "Resets every January"], ["per", "Personal", "Unpaid, for appointments"]].map(([k, l, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${e.bal[k]} h</div><div class="s">${(e.bal[k] / 8).toFixed(1)} days · ${s}</div></div>`).join("")}</div>
  <div class="grid g-main mt"><div class="card">${calendarHTML(ui.toMonth, (x) => x.prop === e.prop && x.dept === e.dept)}</div>
  <div class="card"><h2>My requests</h2><div class="list">${mine.map((t) => `<div class="li"><div class="grow"><b>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? " – " + fmtDs(t.to) : ""}</b><small>${t.hours} h${t.note ? " · " + esc(t.note) : ""}</small></div>${stPill(t.status)}${t.status === "pending" ? `<button class="btn sm" data-act="cancel-to" data-id="${t.id}">Cancel</button>` : ""}</div>`).join("") || `<div class="empty">No requests yet.</div>`}</div></div></div>`;
}
ACT["cancel-to"] = (b) => { const t = S().timeoff.find((x) => x.id === b.dataset.id); t.status = "cancelled"; log(`Cancelled a time-off request for ${fmtDs(t.from)}`); refresh(); toast("Request cancelled"); };
ACT["req-to"] = () => {
  const e = me(), T = today();
  modal({
    title: "Request time off",
    body: `<div class="fields"><div class="field full"><label>Type</label><select id="to-t"><option value="vac">Vacation (${e.bal.vac} h left)</option><option value="sick">Sick (${e.bal.sick} h left)</option><option value="per">Personal (${e.bal.per} h left)</option></select></div>
      <div class="field"><label>From</label><input type="date" id="to-f" value="${addDays(T, 7)}" min="${T}"></div><div class="field"><label>To</label><input type="date" id="to-e" value="${addDays(T, 7)}" min="${T}"></div>
      <div class="field"><label>Hours per day</label><input type="number" id="to-h" value="8" min="1" max="12"></div>
      <div class="field full"><label>Note for your manager</label><input type="text" id="to-n" maxlength="140"></div></div><div id="to-i" class="mt"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="to-ok">Send request</button>`,
    onMount: (m) => {
      const upd = () => {
        const f = $("#to-f", m).value, t = $("#to-e", m).value, k = $("#to-t", m).value, hpd = Number($("#to-h", m).value) || 8;
        if (!f || !t || t < f) { $("#to-i", m).innerHTML = `<div class="banner warn">The end date must be on or after the start date.</div>`; return; }
        const hours = workdays(f, t) * hpd;
        const sh = S().shifts.filter((s) => s.emp === e.id && s.date >= f && s.date <= t).length;
        const over = hours > e.bal[k];
        $("#to-i", m).innerHTML = `<div class="banner ${over ? "warn" : "info"}" style="display:block">${hours} hours over ${workdays(f, t)} day${workdays(f, t) > 1 ? "s" : ""}.${sh ? ` You have ${sh} shift${sh > 1 ? "s" : ""} then; ${sh > 1 ? "they" : "it"} will be offered to co-workers if approved.` : ""}${over ? `<br><b>This is more than your balance.</b> Your manager can still approve it as unpaid.` : ""}</div>`;
      };
      $$("input,select", m).forEach((x) => x.addEventListener("input", upd)); upd();
      $("[data-x2]", m).onclick = closeModal;
      $("#to-ok", m).onclick = () => {
        const f = $("#to-f", m).value, t = $("#to-e", m).value;
        if (!f || !t || t < f) return toast("Check the dates");
        const r = { id: uid("t"), emp: e.id, type: $("#to-t", m).value, from: f, to: t, hours: workdays(f, t) * (Number($("#to-h", m).value) || 8), status: "pending", note: $("#to-n", m).value.trim(), created: today(), decidedBy: null };
        S().timeoff.push(r); log(`Requested ${typeName[r.type].toLowerCase()} ${fmtDs(f)}–${fmtDs(t)}`); closeModal(); refresh(); toast("Request sent to your manager");
      };
    },
  });
};

function timeoffManager(v) {
  const p = pending();
  const scoped = activeEmps().filter((e) => inScope(e.prop) && e.status === "active");
  const liab = scoped.reduce((a, e) => a + e.bal.vac * A.rate(e), 0);
  const upcoming = S().timeoff.filter((t) => t.status === "approved" && t.to >= today() && inScope(E(t.emp).prop)).sort((a, b) => a.from.localeCompare(b.from));
  v.innerHTML = `<div class="ph"><div><h1>Time off</h1><p>Requests, the team calendar and balances.</p></div><button class="btn" data-act="bal-csv">Export balances</button></div>
  <div class="grid g4 keep2"><div class="kpi ${p.to.length ? "alert" : ""}"><div class="l">Waiting for you</div><div class="v">${p.to.length}</div></div><div class="kpi"><div class="l">Off today</div><div class="v">${upcoming.filter((t) => t.from <= today()).length}</div></div><div class="kpi"><div class="l">Approved, upcoming</div><div class="v">${upcoming.filter((t) => t.from > today()).length}</div></div><div class="kpi"><div class="l">Vacation liability</div><div class="v">${m0(liab)}</div><div class="s">Unused vacation hours × pay rate</div></div></div>
  <div class="grid g-main mt"><div class="card">${calendarHTML(ui.toMonth, (x) => inScope(x.prop) && (ui.dept === "all" || x.dept === ui.dept))}</div>
  <div class="stack"><div class="card"><h2>Requests to decide</h2>${p.to.length ? `<div class="list">${p.to.map((t) => toCard(t)).join("")}</div>` : `<div class="empty">Nothing waiting.</div>`}</div>
  <div class="card"><h2>Coming up</h2><div class="list">${upcoming.slice(0, 6).map((t) => `<div class="li">${av(E(t.emp), "sm")}<div class="grow"><b>${esc(nmId(t.emp))}</b><small>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? "–" + fmtDs(t.to) : ""}</small></div></div>`).join("") || `<div class="empty">Nobody.</div>`}</div></div></div></div>`;
}
function toCard(t) {
  const e = E(t.emp);
  const sh = S().shifts.filter((s) => s.emp === e.id && s.date >= t.from && s.date <= t.to).length;
  const others = S().timeoff.filter((x) => x.id !== t.id && x.status === "approved" && E(x.emp).dept === e.dept && E(x.emp).prop === e.prop && x.from <= t.to && x.to >= t.from).length;
  const over = t.type !== "per" && t.hours > e.bal[t.type];
  return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · ${typeName[t.type]}</b><small>${fmtD(t.from)}${t.to !== t.from ? " – " + fmtD(t.to) : ""} · ${t.hours} h</small><small style="white-space:normal">${t.note ? "“" + esc(t.note) + "” · " : ""}${sh} shift${sh === 1 ? "" : "s"} to cover · ${others ? `<b style="color:var(--warn)">${others} other${others > 1 ? "s" : ""} in ${esc(dept(e.dept).name)} off</b>` : "no one else off"}${over ? ` · <b style="color:var(--bad)">over balance (${e.bal[t.type]} h)</b>` : ""}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="to" data-id="${t.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="to" data-id="${t.id}">Deny</button></div></div>`;
}
ACT["bal-csv"] = () => { const rows = [["Employee #", "Name", "Hotel", "Department", "Vacation h", "Sick h", "Personal h", "Vacation liability $"]]; activeEmps().filter((e) => inScope(e.prop)).forEach((e) => rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, e.bal.vac, e.bal.sick, e.bal.per, (e.bal.vac * A.rate(e)).toFixed(2)])); csv("time-off-balances.csv", rows); };

// ---------- Approvals ----------
function decide(k, id, ok) {
  const by = S().me.emp;
  if (k === "to") {
    const t = S().timeoff.find((x) => x.id === id); const e = E(t.emp);
    t.status = ok ? "approved" : "denied"; t.decidedBy = by;
    if (ok) {
      if (t.type !== "per") e.bal[t.type] = Math.max(0, e.bal[t.type] - t.hours);
      let n = 0; S().shifts.forEach((s) => { if (s.emp === e.id && s.date >= t.from && s.date <= t.to && s.date >= today()) { s.emp = null; n++; } });
      log(`Approved ${nm(e)}'s ${typeName[t.type].toLowerCase()} ${fmtDs(t.from)}–${fmtDs(t.to)}${n ? `; ${n} shifts posted as open` : ""}`);
      return n ? `Approved. ${n} shift${n > 1 ? "s are" : " is"} now open for others.` : "Approved";
    }
    log(`Denied ${nm(e)}'s ${typeName[t.type].toLowerCase()} request`); return "Request denied";
  }
  if (k === "sw") {
    const w = S().swaps.find((x) => x.id === id); const s = S().shifts.find((x) => x.id === w.shift);
    w.status = ok ? "approved" : "denied";
    if (ok && s) { if (w.type === "drop") s.emp = null; else s.emp = w.to; if (w.type === "pickup") S().swaps.filter((x) => x.shift === s.id && x.id !== w.id && x.status === "pending").forEach((x) => (x.status = "denied")); }
    log(`${ok ? "Approved" : "Denied"} ${w.type} of the ${s ? fmtD(s.date) : ""} shift`); return ok ? "Shift updated" : "Request denied";
  }
  const c = S().corrections.find((x) => x.id === id);
  c.status = ok ? "approved" : "denied";
  if (ok) { const p = S().punches.find((x) => x.id === c.punch); if (p) { p[c.field] = c.to; p.edited = true; p.note = `Fix approved by ${nm(me())}: ${c.reason}`; } delete S().tsApproved[A.tsKey(c.emp, periodStart(c.date))]; }
  log(`${ok ? "Approved" : "Denied"} ${nmId(c.emp)}'s punch fix for ${fmtD(c.date)}`); return ok ? "Punch corrected" : "Request denied";
}
ACT.appr = (b) => { const m = decide(b.dataset.k, b.dataset.id, true); refresh(); toast(m); };
ACT.deny = (b) => { const m = decide(b.dataset.k, b.dataset.id, false); refresh(); toast(m); };

VIEWS.approvals = (v) => {
  const p = pending(), tab = ui.apprTab;
  const tabs = [["all", "All", p.n], ["to", "Time off", p.to.length], ["sw", "Shift changes", p.sw.length], ["co", "Punch fixes", p.co.length]];
  const swCard = (w) => { const s = S().shifts.find((x) => x.id === w.shift); const e = E(w.type === "pickup" ? w.to : w.from); const warn = s && w.to ? A.shiftWarnings({ ...s, emp: w.to }) : [];
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · ${w.type === "swap" ? "Swap with " + esc(nmId(w.to)) : w.type === "pickup" ? "Pick up an open shift" : "Give away a shift"}</b><small>${s ? `${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)} · ${esc(posName(s.pos))}` : "Shift removed"}${w.note ? " · “" + esc(w.note) + "”" : ""}</small>${warn.length ? `<small style="color:var(--warn);white-space:normal">⚠️ ${esc(warn.join(". "))}</small>` : ""}</div><div class="act"><button class="btn sm good" data-act="appr" data-k="sw" data-id="${w.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="sw" data-id="${w.id}">Deny</button></div></div>`; };
  const coCard = (c) => { const e = E(c.emp); const pu = S().punches.find((x) => x.id === c.punch);
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · Punch fix</b><small>${fmtD(c.date)} · clock ${c.field} ${c.from ? fmtT(c.from) : "missing"} → <b>${fmtT(c.to)}</b>${pu ? ` · punched in ${fmtT(pu.in)}` : ""}</small><small style="white-space:normal">“${esc(c.reason)}”</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="co" data-id="${c.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="co" data-id="${c.id}">Deny</button></div></div>`; };
  const sect = (t, list, f) => list.length ? `<div class="card"><h2>${t}</h2><div class="list">${list.map(f).join("")}</div></div>` : "";
  const recent = [...S().timeoff, ...S().swaps, ...S().corrections].filter((x) => x.status === "approved" || x.status === "denied").length;
  v.innerHTML = `<div class="ph"><div><h1>Approvals</h1><p>Everything waiting for a decision at ${esc(scope() === "all" ? "all hotels" : prop(scope()).short)}. Employees see the result right away.</p></div></div>
    <div class="tabs" style="margin-top:0">${tabs.map(([k, l, n]) => `<button data-act="atab" data-t="${k}" class="${tab === k ? "on" : ""}">${l} ${n ? `<span class="pill warn">${n}</span>` : ""}</button>`).join("")}</div>
    <div class="stack">${(tab === "all" || tab === "to") ? sect("Time off", p.to, toCard) : ""}${(tab === "all" || tab === "sw") ? sect("Shift swaps and pick-ups", p.sw, swCard) : ""}${(tab === "all" || tab === "co") ? sect("Punch corrections", p.co, coCard) : ""}
    ${(tab === "all" ? p.n : tab === "to" ? p.to.length : tab === "sw" ? p.sw.length : p.co.length) ? "" : `<div class="card empty">🎉 You're all caught up. ${recent} decisions made so far.</div>`}</div>`;
};
ACT.atab = (b) => { ui.apprTab = b.dataset.t; A.render(); };

// ---------- People ----------
VIEWS.people = (v, args) => {
  if (args && args[0]) return VIEWS.person(v, args);
  const q = ui.peopleQ.toLowerCase();
  const list = S().emps.filter((e) => inScope(e.prop) && (ui.peopleDept === "all" || e.dept === ui.peopleDept) && (ui.peopleStatus === "all" || e.status === ui.peopleStatus) && (!q || (nm(e) + " " + posName(e.pos) + " " + e.no).toLowerCase().includes(q)))
    .sort((a, b) => a.last.localeCompare(b.last));
  const all = S().emps.filter((e) => inScope(e.prop) && e.status !== "terminated");
  v.innerHTML = `<div class="ph"><div><h1>People</h1><p>${all.length} people at ${esc(scope() === "all" ? "all hotels" : prop(scope()).short)} · ${all.filter((e) => e.type === "FT").length} full time · ${all.filter((e) => e.type === "PT").length} part time</p></div>
    <div class="toolbar"><button class="btn primary" data-act="new-emp">+ Add new hire</button><button class="btn" data-act="ppl-csv">Export</button></div></div>
  <div class="card"><div class="toolbar" style="margin-bottom:12px"><input type="search" id="pq" placeholder="Search name, job or number" value="${esc(ui.peopleQ)}" style="flex:1;min-width:180px">
    <select id="pd" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.peopleDept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <select id="pst" aria-label="Status">${[["active", "Active"], ["onboarding", "Onboarding"], ["terminated", "Former"], ["all", "Everyone"]].map(([k, l]) => `<option value="${k}" ${ui.peopleStatus === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="tw"><table><thead><tr><th>Name</th><th class="hide-sm">Department</th><th class="hide-sm">Hotel</th><th class="hide-sm">Type</th><th class="hide-sm">Hired</th><th>Status</th></tr></thead><tbody>
  ${list.map((e) => `<tr class="click" data-act="open-person" data-id="${e.id}"><td><div style="display:flex;gap:10px;align-items:center">${av(e)}<span><b>${esc(nm(e))}</b><br><small>${esc(posName(e.pos))} · #${e.no}</small></span></div></td><td class="hide-sm"><span class="dot" style="background:${dept(e.dept).color}"></span>${esc(dept(e.dept).name)}</td><td class="hide-sm">${esc(prop(e.prop).short)}</td><td class="hide-sm">${e.type === "FT" ? "Full time" : "Part time"}</td><td class="hide-sm nowrap">${fmtDY(e.hire)}</td><td>${statusPill(e)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No one matches.</td></tr>`}
  </tbody></table></div></div>`;
  const rerender = () => { A.render(); const x = $("#pq"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
  $("#pq").oninput = (e) => { ui.peopleQ = e.target.value; clearTimeout(ui._p); ui._p = setTimeout(rerender, 250); };
  $("#pd").onchange = (e) => { ui.peopleDept = e.target.value; A.render(); };
  $("#pst").onchange = (e) => { ui.peopleStatus = e.target.value; A.render(); };
};
const statusPill = (e) => `<span class="pill ${e.status === "active" ? "good" : e.status === "onboarding" ? "info" : ""}">${e.status === "active" ? "Active" : e.status === "onboarding" ? "Onboarding" : "Former"}</span>`;
ACT["open-person"] = (b) => { if (!isMgr()) return; closeModal(); go("#/people/" + b.dataset.id); };
ACT["ppl-csv"] = () => { const rows = [["Employee #", "First", "Last", "Hotel", "Department", "Position", "Type", "Pay type", "Rate", "Hire date", "Status", "Email", "Phone"]]; S().emps.filter((e) => inScope(e.prop)).forEach((e) => rows.push([e.no, e.first, e.last, prop(e.prop).short, dept(e.dept).name, posName(e.pos), e.type, e.pay, e.wage, e.hire, e.status, e.email, e.phone])); csv("people.csv", rows); };

VIEWS.person = (v, args) => {
  const e = E(args[0]); if (!e) { v.innerHTML = `<div class="empty">Not found. <a href="#/people">Back to people</a></div>`; return; }
  const self = role() === "employee";
  const tab = ui.pTab || "overview";
  const T = today();
  const yrs = (diffDays(e.hire, T) / 365.25);
  const up = S().shifts.filter((s) => s.emp === e.id && s.date >= T && s.date <= addDays(T, 13)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const ps = periodStart(T);
  const pay = payFor(S(), e, ps);
  const exc = A.periodExc(e.id, ps);
  const tabs = [["overview", "Overview"], ["job", "Job and pay"], ["time", "Time off"], ["certs", "Certifications"], ["sched", "Schedule"]];
  const body = {
    overview: `<div class="grid g2"><div class="card"><h3>Contact</h3><dl class="kv"><dt>Email</dt><dd>${esc(e.email)}</dd><dt>Phone</dt><dd>${esc(e.phone)}</dd><dt>Address</dt><dd>${esc(e.address || "Not provided")}</dd><dt>Birthday</dt><dd>${MON[Number(e.birthday.slice(0, 2)) - 1]} ${Number(e.birthday.slice(3))}</dd></dl></div>
      <div class="card"><h3>Emergency contact</h3><dl class="kv"><dt>Name</dt><dd>${esc(e.emergency.name || "Not provided")}</dd><dt>Relationship</dt><dd>${esc(e.emergency.rel || "–")}</dd><dt>Phone</dt><dd>${esc(e.emergency.phone || "–")}</dd></dl></div>
      <div class="card"><h3>This pay period</h3><dl class="kv"><dt>Hours worked</dt><dd>${h1(pay.reg + pay.ot + pay.hol)}</dd><dt>Overtime</dt><dd>${h1(pay.ot)}</dd><dt>Exceptions</dt><dd>${exc.length ? exc.map((x) => `<span class="pill ${x.cls}">${fmtDs(x.d)} ${esc(x.t)}</span>`).join(" ") : "None"}</dd></dl>${isMgr() ? `<button class="btn sm mt" data-act="ts-open" data-id="${e.id}">Open timesheet</button>` : ""}</div>
      <div class="card"><h3>Availability</h3><dl class="kv">${DOW.map((d, i) => `<dt>${d}</dt><dd>${{ any: "Any time", am: "Mornings", pm: "Evenings", off: "Not available" }[e.avail[i]]}</dd>`).join("")}</dl>${self ? `<button class="btn sm mt" data-act="avail">Change</button>` : ""}</div></div>`,
    job: `<div class="grid g2"><div class="card"><h3>Job</h3><dl class="kv"><dt>Position</dt><dd>${esc(posName(e.pos))}</dd><dt>Department</dt><dd>${esc(dept(e.dept).name)}</dd><dt>Hotel</dt><dd>${esc(prop(e.prop).name)}</dd><dt>Employment</dt><dd>${e.type === "FT" ? "Full time" : "Part time"}${e.union ? " · unionized" : ""}</dd><dt>Hire date</dt><dd>${fmtDY(e.hire)} (${yrs >= 1 ? yrs.toFixed(1) + " years" : Math.max(0, Math.round(yrs * 12)) + " months"})</dd><dt>Employee #</dt><dd>${e.no}</dd>${isMgr() ? `<dt>Time clock PIN</dt><dd>${e.pin}</dd>` : ""}</dl></div>
      <div class="card"><h3>Pay</h3><dl class="kv"><dt>Pay type</dt><dd>${e.pay === "salary" ? "Salary" : "Hourly"}</dd><dt>Rate</dt><dd>${e.pay === "salary" ? money(e.wage, 0) + " a year" : money(e.wage) + " an hour"}</dd><dt>Pay frequency</dt><dd>Every two weeks</dd><dt>Overtime</dt><dd>${e.pay === "salary" ? "Exempt (manager)" : `After ${S().settings.otWeekly} h a week at 1.5×`}</dd>${e.type === "PT" ? `<dt>Vacation pay</dt><dd>${S().settings.vacPayPct}% on each cheque</dd>` : ""}<dt>Benefits</dt><dd>${e.type === "FT" ? "Health and dental" : "Not eligible"}</dd></dl></div></div>`,
    time: `<div class="grid g3">${[["vac", "Vacation"], ["sick", "Sick"], ["per", "Personal"]].map(([k, l]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${e.bal[k]} h</div></div>`).join("")}</div>
      <div class="card mt"><h3>History</h3><div class="list">${S().timeoff.filter((t) => t.emp === e.id).sort((a, b) => b.from.localeCompare(a.from)).map((t) => `<div class="li"><div class="grow"><b>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? " – " + fmtDs(t.to) : ""}</b><small>${t.hours} h${t.note ? " · " + esc(t.note) : ""}</small></div>${stPill(t.status)}</div>`).join("") || `<div class="empty">No time off yet.</div>`}</div>${isMgr() ? `<button class="btn sm mt" data-act="adj-bal" data-id="${e.id}">Adjust balances</button>` : ""}</div>`,
    certs: `<div class="card"><div class="card-h"><h3>Certifications and training</h3>${isMgr() ? `<button class="btn sm" data-act="add-cert" data-id="${e.id}">+ Add</button>` : ""}</div><div class="tw"><table><thead><tr><th>Name</th><th>Expires</th><th>Status</th></tr></thead><tbody>${e.certs.map((c) => { const dd = diffDays(T, c.exp); return `<tr><td>${esc(c.name)}</td><td>${fmtDY(c.exp)}</td><td><span class="pill ${dd < 0 ? "bad" : dd < 45 ? "warn" : "good"}">${dd < 0 ? "Expired" : dd < 45 ? "Due in " + dd + " days" : "Valid"}</span></td></tr>`; }).join("") || `<tr><td colspan="3" class="empty">None on file.</td></tr>`}</tbody></table></div></div>`,
    sched: `<div class="card"><h3>Next two weeks</h3><div class="list">${up.map((s) => `<div class="li"><div class="grow"><b>${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}</small></div></div>`).join("") || `<div class="empty">No upcoming shifts.</div>`}</div></div>`,
  };
  v.innerHTML = `${self ? "" : `<p style="margin:0 0 10px"><a href="#/people">← People</a></p>`}
  <div class="card"><div class="prof-head">${av(e, "lg")}<div class="grow"><h1 style="margin:0">${esc(nm(e))}</h1><div class="muted">${esc(posName(e.pos))} · ${esc(dept(e.dept).name)} · ${esc(prop(e.prop).short)}</div><div style="margin-top:6px">${statusPill(e)} <span class="pill">${e.type === "FT" ? "Full time" : "Part time"}</span></div></div>
    <div class="toolbar">${self ? `<button class="btn" data-act="edit-emp" data-id="${e.id}">Edit my details</button>` : `<button class="btn" data-act="edit-emp" data-id="${e.id}">Edit</button>${e.status !== "terminated" ? `<button class="btn" data-act="change-pay" data-id="${e.id}">Change job or pay</button><button class="btn danger" data-act="term" data-id="${e.id}">End employment</button>` : `<button class="btn" data-act="rehire" data-id="${e.id}">Rehire</button>`}`}</div></div>
  <div class="tabs">${tabs.map(([k, l]) => `<button data-act="ptab" data-t="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
  ${body[tab]}</div>`;
};
ACT.ptab = (b) => { ui.pTab = b.dataset.t; A.render(); };
ACT["edit-emp"] = (b) => {
  const e = E(b.dataset.id), self = role() === "employee";
  modal({
    title: self ? "Edit my details" : "Edit " + esc(nm(e)),
    body: `<div class="fields">${self ? "" : `<div class="field"><label>First name</label><input type="text" id="ee-f" value="${esc(e.first)}"></div><div class="field"><label>Last name</label><input type="text" id="ee-l" value="${esc(e.last)}"></div>`}
      <div class="field"><label>Email</label><input type="email" id="ee-e" value="${esc(e.email)}"></div><div class="field"><label>Phone</label><input type="tel" id="ee-p" value="${esc(e.phone)}"></div>
      <div class="field full"><label>Address</label><input type="text" id="ee-a" value="${esc(e.address)}"></div>
      <div class="field"><label>Emergency contact</label><input type="text" id="ee-en" value="${esc(e.emergency.name)}"></div><div class="field"><label>Relationship</label><input type="text" id="ee-er" value="${esc(e.emergency.rel)}"></div><div class="field"><label>Their phone</label><input type="tel" id="ee-ep" value="${esc(e.emergency.phone)}"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ee-ok">Save</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ee-ok", m).onclick = () => {
      if (!self) { e.first = $("#ee-f", m).value.trim() || e.first; e.last = $("#ee-l", m).value.trim() || e.last; }
      e.email = $("#ee-e", m).value.trim(); e.phone = $("#ee-p", m).value.trim(); e.address = $("#ee-a", m).value.trim();
      e.emergency = { name: $("#ee-en", m).value.trim(), rel: $("#ee-er", m).value.trim(), phone: $("#ee-ep", m).value.trim() };
      log(`Updated personal details for ${nm(e)}`); closeModal(); refresh(); toast("Saved"); }; },
  });
};
ACT["change-pay"] = (b) => {
  const e = E(b.dataset.id);
  modal({
    title: "Change job or pay",
    body: `<div class="fields"><div class="field"><label>Hotel</label><select id="cp-h">${S().props.map((p) => `<option value="${p.id}" ${p.id === e.prop ? "selected" : ""}>${esc(p.short)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="cp-p">${Object.entries(POS).map(([k, p]) => `<option value="${k}" ${k === e.pos ? "selected" : ""}>${esc(p.name)} (${esc(dept(p.dept).name)})</option>`).join("")}</select></div>
      <div class="field"><label>Employment</label><select id="cp-t"><option value="FT" ${e.type === "FT" ? "selected" : ""}>Full time</option><option value="PT" ${e.type === "PT" ? "selected" : ""}>Part time</option></select></div>
      <div class="field"><label>Pay type</label><select id="cp-pt"><option value="hourly" ${e.pay === "hourly" ? "selected" : ""}>Hourly</option><option value="salary" ${e.pay === "salary" ? "selected" : ""}>Salary</option></select></div>
      <div class="field"><label id="cp-rl">${e.pay === "salary" ? "Annual salary" : "Hourly rate"}</label><input type="number" id="cp-r" step="0.25" min="0" value="${e.wage}"></div>
      <div class="field"><label>Effective</label><input type="date" id="cp-d" value="${today()}"></div></div><div id="cp-i" class="mt"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="cp-ok">Save change</button>`,
    onMount: (m) => {
      const upd = () => { $("#cp-rl", m).textContent = $("#cp-pt", m).value === "salary" ? "Annual salary" : "Hourly rate"; const r = Number($("#cp-r", m).value); const ch = e.pay === $("#cp-pt", m).value && e.wage ? (r / e.wage - 1) * 100 : null; $("#cp-i", m).innerHTML = ch != null && Math.abs(ch) > 0.01 ? `<div class="banner ${ch > 15 ? "warn" : "info"}">That is a ${ch > 0 ? "raise" : "cut"} of ${Math.abs(ch).toFixed(1)}%.${ch > 15 ? " Raises over 15% need a second approval in production." : ""}</div>` : ""; };
      $$("input,select", m).forEach((x) => x.addEventListener("input", upd)); upd();
      $("[data-x2]", m).onclick = closeModal;
      $("#cp-ok", m).onclick = () => {
        const old = `${posName(e.pos)}, ${e.pay === "salary" ? money(e.wage, 0) : money(e.wage) + "/h"}`;
        e.prop = $("#cp-h", m).value; e.pos = $("#cp-p", m).value; e.dept = POS[e.pos].dept; e.type = $("#cp-t", m).value; e.pay = $("#cp-pt", m).value; e.wage = Number($("#cp-r", m).value) || e.wage; e.maxShifts = e.type === "FT" ? 5 : 3;
        log(`Changed ${nm(e)} from ${old} to ${posName(e.pos)}, ${e.pay === "salary" ? money(e.wage, 0) : money(e.wage) + "/h"} effective ${fmtDs($("#cp-d", m).value)}`); closeModal(); refresh(); toast("Job and pay updated");
      };
    },
  });
};
ACT.term = (b) => {
  const e = E(b.dataset.id);
  modal({
    title: "End employment for " + esc(nm(e)),
    body: `<div class="fields"><div class="field"><label>Last day worked</label><input type="date" id="tm-d" value="${today()}"></div><div class="field"><label>Reason</label><select id="tm-r"><option>Resigned</option><option>End of seasonal contract</option><option>Dismissed</option><option>Retired</option></select></div></div>
      <div class="banner warn mt" style="display:block">Future shifts become open shifts. A full system would also create the Record of Employment and pay out ${e.bal.vac} h of vacation (${money(e.bal.vac * A.rate(e))}).</div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn danger" id="tm-ok">End employment</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#tm-ok", m).onclick = () => {
      const d = $("#tm-d", m).value || today(); e.status = "terminated"; e.termDate = d; e.termReason = $("#tm-r", m).value;
      let n = 0; S().shifts.forEach((s) => { if (s.emp === e.id && s.date > d) { s.emp = null; n++; } });
      log(`Ended employment for ${nm(e)} (${e.termReason}); ${n} shifts posted as open`); closeModal(); refresh(); toast(`Done. ${n} shifts are now open.`); }; },
  });
};
ACT.rehire = (b) => { const e = E(b.dataset.id); e.status = "active"; delete e.termDate; log(`Rehired ${nm(e)}`); refresh(); toast("Rehired"); };
ACT["add-cert"] = (b) => {
  const e = E(b.dataset.id);
  modal({ title: "Add a certification", body: `<div class="fields"><div class="field full"><label>Name</label><input type="text" id="ac-n" list="ac-l"><datalist id="ac-l"><option>Smart Serve</option><option>Food Handler Certificate</option><option>Standard First Aid & CPR</option><option>WHMIS training</option><option>Working at heights</option><option>Cash handling</option></datalist></div><div class="field"><label>Expires</label><input type="date" id="ac-d" value="${addDays(today(), 365 * 3)}"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ac-ok">Add</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ac-ok", m).onclick = () => { const n = $("#ac-n", m).value.trim(); if (!n) return toast("Enter a name"); e.certs.push({ name: n, exp: $("#ac-d", m).value }); log(`Added ${n} for ${nm(e)}`); closeModal(); refresh(); }; } });
};
ACT["adj-bal"] = (b) => {
  const e = E(b.dataset.id);
  modal({ title: "Adjust balances", body: `<div class="fields">${[["vac", "Vacation"], ["sick", "Sick"], ["per", "Personal"]].map(([k, l]) => `<div class="field"><label>${l} (hours)</label><input type="number" id="ab-${k}" value="${e.bal[k]}" min="0"></div>`).join("")}<div class="field full"><label>Reason</label><input type="text" id="ab-r" placeholder="e.g. Carry-over approved by GM"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ab-ok">Save</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ab-ok", m).onclick = () => { ["vac", "sick", "per"].forEach((k) => (e.bal[k] = Math.max(0, Number($("#ab-" + k, m).value) || 0))); log(`Adjusted ${nm(e)}'s balances: ${$("#ab-r", m).value || "no reason given"}`); closeModal(); refresh(); toast("Balances updated"); }; } });
};

// New hire
ACT["new-emp"] = () => {
  const T = today();
  modal({
    title: "Add a new hire",
    body: `<div class="fields"><div class="field"><label>First name</label><input type="text" id="nh-f"></div><div class="field"><label>Last name</label><input type="text" id="nh-l"></div>
      <div class="field"><label>Hotel</label><select id="nh-h">${S().props.filter((p) => inScope(p.id)).map((p) => `<option value="${p.id}">${esc(p.short)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="nh-p">${Object.entries(POS).filter(([, p]) => p.wage).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Employment</label><select id="nh-t"><option value="FT">Full time</option><option value="PT">Part time</option></select></div>
      <div class="field"><label>Hourly rate</label><input type="number" id="nh-r" step="0.25"></div>
      <div class="field"><label>Start date</label><input type="date" id="nh-d" value="${addDays(T, 14)}"></div>
      <div class="field"><label>Personal email</label><input type="email" id="nh-e" placeholder="for the welcome email"></div></div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Saving creates the profile, a time-clock PIN and an onboarding checklist. In production the new hire gets an email to fill in their own forms.</p>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="nh-ok">Create and start onboarding</button>`,
    onMount: (m) => {
      const setR = () => ($("#nh-r", m).value = POS[$("#nh-p", m).value].wage); setR();
      $("#nh-p", m).onchange = setR;
      $("[data-x2]", m).onclick = closeModal;
      $("#nh-ok", m).onclick = () => {
        const f = $("#nh-f", m).value.trim(), l = $("#nh-l", m).value.trim();
        if (!f || !l) return toast("Enter a first and last name");
        const pos = $("#nh-p", m).value, no = Math.max(...S().emps.map((x) => x.no)) + 1;
        const e = { id: "e" + no, no, first: f, last: l, prop: $("#nh-h", m).value, dept: POS[pos].dept, pos, type: $("#nh-t", m).value, pay: "hourly", wage: Number($("#nh-r", m).value) || POS[pos].wage, hire: $("#nh-d", m).value || addDays(T, 14), status: "onboarding",
          birthday: "01-01", email: $("#nh-e", m).value.trim() || `${f}.${l}`.toLowerCase().replace(/[^a-z.]/g, "") + "@maplelake.example", phone: "", pin: String(1000 + ((no * 7919) % 9000)).slice(0, 4), maxShifts: $("#nh-t", m).value === "FT" ? 5 : 3, avail: [0, 1, 2, 3, 4, 5, 6].map(() => "any"),
          bal: { vac: 0, sick: 0, per: 0 }, certs: [], emergency: { name: "", rel: "", phone: "" }, address: "", union: false };
        S().emps.push(e);
        S().onboarding[e.id] = { started: T, tasks: onboardingTasks(e) };
        log(`Added new hire ${nm(e)} as ${posName(pos)}`); closeModal(); save(); go("#/onboarding"); toast(`${f} added. Onboarding has started.`);
      };
    },
  });
};
function onboardingTasks(e) {
  const t = ["Offer letter signed", "Personal details and SIN", "TD1 federal and Ontario tax forms", "Direct deposit details", "Emergency contact", "Uniform and name badge issued", "Locker and key card", "PMS and email accounts created", "Health and safety awareness training", "WHMIS training", "Department orientation shift", "Buddy assigned", "30-day check-in"];
  if (e.dept === "fb") t.splice(9, 0, "Smart Serve uploaded"); if (e.dept === "kt") t.splice(9, 0, "Food Handler Certificate uploaded");
  return t.map((x) => ({ t: x, done: false, owner: /letter|PMS|Uniform|Locker|Buddy|check-in|orientation/.test(x) ? "Manager" : /SIN|TD1|Direct|Emergency|uploaded/.test(x) ? "Employee" : "HR" }));
}

// ---------- Onboarding ----------
VIEWS.onboarding = (v) => {
  const list = S().emps.filter((e) => e.status === "onboarding" && inScope(e.prop) && S().onboarding[e.id]);
  const recent = S().emps.filter((e) => e.status === "active" && inScope(e.prop) && S().onboarding[e.id]);
  const card = (e) => { const ob = S().onboarding[e.id]; const done = ob.tasks.filter((t) => t.done).length; const n = ob.tasks.length; const dd = diffDays(today(), e.hire);
    return `<div class="card" style="cursor:pointer" data-act="ob-open" data-id="${e.id}"><div style="display:flex;gap:12px;align-items:center">${av(e)}<div style="flex:1;min-width:0"><b>${esc(nm(e))}</b><div class="muted" style="font-size:13px">${esc(posName(e.pos))} · ${esc(prop(e.prop).short)}</div></div><span class="pill ${dd < 0 ? "warn" : "info"}">${dd > 0 ? "Starts in " + dd + " days" : dd === 0 ? "Starts today" : "Started " + fmtDs(e.hire)}</span></div>
      <div class="bar" style="margin-top:14px"><i class="${done === n ? "good" : ""}" style="width:${(done / n) * 100}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">${done} of ${n} steps done${done < n ? ` · next: ${esc(ob.tasks.find((t) => !t.done).t)}` : " · ready to activate"}</div></div>`; };
  v.innerHTML = `<div class="ph"><div><h1>Onboarding</h1><p>New hires and their checklists. HR, the manager and the new hire each own their steps.</p></div><button class="btn primary" data-act="new-emp">+ Add new hire</button></div>
    ${list.length ? `<div class="grid g3">${list.map(card).join("")}</div>` : `<div class="card empty">No one is onboarding right now.</div>`}
    ${recent.length ? `<h2 class="mt">Recently completed</h2><div class="grid g3">${recent.map(card).join("")}</div>` : ""}`;
};
ACT["ob-open"] = (b) => {
  const e = E(b.dataset.id), ob = S().onboarding[e.id];
  const draw = (m) => {
    const done = ob.tasks.filter((t) => t.done).length;
    $(".mb", m).innerHTML = `<p class="muted">${esc(posName(e.pos))} · ${esc(prop(e.prop).short)} · starts ${fmtDY(e.hire)}</p><div class="bar"><i class="${done === ob.tasks.length ? "good" : ""}" style="width:${(done / ob.tasks.length) * 100}%"></i></div>
      ${["HR", "Manager", "Employee"].map((o) => `<h3 class="mt">${o === "Employee" ? "New hire" : o}</h3>${ob.tasks.map((t, i) => (t.owner === o ? `<label class="chk" style="display:flex;padding:6px 0"><input type="checkbox" data-i="${i}" ${t.done ? "checked" : ""}> <span ${t.done ? 'style="text-decoration:line-through;color:var(--ink-3)"' : ""}>${esc(t.t)}</span></label>` : "")).join("")}`).join("")}`;
    $$("input[type=checkbox]", m).forEach((c) => (c.onchange = () => { ob.tasks[c.dataset.i].done = c.checked; log(`${c.checked ? "Completed" : "Reopened"} "${ob.tasks[c.dataset.i].t}" for ${nm(e)}`); save(); draw(m); }));
    const btn = $("#ob-act", m); if (btn) btn.disabled = e.status !== "onboarding" || done < ob.tasks.length;
  };
  modal({ title: "Onboarding · " + esc(nm(e)), body: "", foot: `<button class="btn" data-x2>Close</button>${e.status === "onboarding" ? `<button class="btn good" id="ob-act">Mark as active employee</button>` : ""}`,
    onMount: (m) => { draw(m); A.setModalClose(() => A.render()); $("[data-x2]", m).onclick = closeModal;
      const btn = $("#ob-act", m); if (btn) btn.onclick = () => { e.status = "active"; e.bal = { vac: 0, sick: 24, per: 8 }; log(`Activated ${nm(e)} after onboarding`); closeModal(); toast(`${e.first} is now active and can be scheduled`); }; } });
};

// ---------- Reports ----------
const RANGES = { wk: "This week", lwk: "Last week", pp: "This pay period", lpp: "Last pay period", d28: "Last 28 days" };
function range(k) {
  const T = today(), ws = weekStart(T), ps = periodStart(T);
  return { wk: [ws, addDays(ws, 6)], lwk: [addDays(ws, -7), addDays(ws, -1)], pp: [ps, addDays(ps, 13)], lpp: [addDays(ps, -14), addDays(ps, -1)], d28: [addDays(T, -27), T] }[k];
}
VIEWS.reports = (v) => {
  const [from, to] = range(ui.repRange), T = today(), pid = scope();
  const props = S().props.filter((p) => inScope(p.id));
  const emps = activeEmps().filter((e) => inScope(e.prop));
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  // Actual cost for past days, scheduled for future days
  const dayActual = (d, filter = () => true) => {
    if (d < T) return S().punches.filter((c) => c.date === d && filter(E(c.emp))).reduce((a, c) => { const e = E(c.emp); return a + (punchMin(c) / 60) * A.rate(e); }, 0);
    return S().shifts.filter((s) => s.date === d && s.emp && filter(E(s.emp))).reduce((a, s) => a + shiftCost(s), 0);
  };
  const inP = (e) => e && inScope(e.prop);
  const sched = days.map((d) => S().shifts.filter((s) => s.date === d && inScope(s.prop)).reduce((a, s) => a + shiftCost(s), 0));
  const actual = days.map((d) => dayActual(d, inP));
  const budget = days.map((d) => props.reduce((a, p) => a + (S().budget[p.id][d] || 0), 0));
  const occRooms = days.map((d) => props.reduce((a, p) => a + p.rooms * (S().forecast[p.id][d] || 0), 0));
  const cpor = actual.map((x, i) => x / Math.max(1, occRooms[i]));
  const byDept = S().depts.map((dp) => ({ dp, cost: days.reduce((a, d) => a + dayActual(d, (e) => inP(e) && e.dept === dp.id), 0), hrs: days.reduce((a, d) => a + (d < T ? S().punches.filter((c) => c.date === d && inP(E(c.emp)) && E(c.emp).dept === dp.id).reduce((b, c) => b + punchMin(c), 0) : S().shifts.filter((s) => s.date === d && s.emp && inScope(s.prop) && s.dept === dp.id).reduce((b, s) => b + shiftMin(s), 0)), 0) }));
  // Overtime by person (weeks fully inside the range)
  const ot = emps.filter((e) => e.pay === "hourly").map((e) => {
    let m = 0; for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) { const wm = S().punches.filter((c) => c.emp === e.id && c.date >= ws && c.date <= addDays(ws, 6) && !HOLIDAYS[c.date]).reduce((a, c) => a + punchMin(c), 0); m += Math.max(0, wm - S().settings.otWeekly * 60); }
    return { e, m, cost: (m / 60) * e.wage * 1.5 };
  }).filter((x) => x.m > 0).sort((a, b) => b.m - a.m);
  const excBy = S().depts.map((dp) => { const c = { late: 0, missed: 0, noshow: 0, nobreak: 0, early: 0, unsched: 0 }; emps.filter((e) => e.dept === dp.id).forEach((e) => days.forEach((d) => { if (d < T) exceptionsFor(e.id, d).forEach((x) => c[x.k]++); })); return { dp, c }; });
  const head = S().depts.map((dp) => ({ dp, ft: emps.filter((e) => e.dept === dp.id && e.type === "FT" && e.status === "active").length, pt: emps.filter((e) => e.dept === dp.id && e.type === "PT" && e.status === "active").length, ob: emps.filter((e) => e.dept === dp.id && e.status === "onboarding").length }));
  const terms = S().emps.filter((e) => e.status === "terminated" && inScope(e.prop)).length;
  const totAct = actual.reduce((a, b) => a + b, 0), totBud = budget.reduce((a, b) => a + b, 0);
  const totHrs = byDept.reduce((a, b) => a + b.hrs, 0);
  const totOcc = occRooms.reduce((a, b) => a + b, 0);
  v.innerHTML = `<div class="ph"><div><h1>Reports</h1><p>${esc(pid === "all" ? "All hotels" : prop(pid).name)} · ${fmtDs(from)} – ${fmtDY(to)}. Past days use actual punches; future days use the schedule.</p></div>
    <div class="toolbar"><select id="rr" aria-label="Date range">${Object.entries(RANGES).map(([k, l]) => `<option value="${k}" ${ui.repRange === k ? "selected" : ""}>${l}</option>`).join("")}</select><button class="btn" onclick="window.print()">Print</button></div></div>
  <div class="grid g4 keep2">
    <div class="kpi ${totAct > totBud ? "alert" : "ok"}"><div class="l">Labour cost vs budget</div><div class="v">${m0(totAct)}</div><div class="s">Budget ${m0(totBud)} · ${totAct > totBud ? "+" : "−"}${pct(Math.abs(totAct / Math.max(1, totBud) - 1), 1)}</div></div>
    <div class="kpi"><div class="l">Labour hours</div><div class="v">${Math.round(totHrs / 60).toLocaleString("en-CA")}</div><div class="s">${(totHrs / 60 / Math.max(1, totOcc)).toFixed(2)} h per occupied room</div></div>
    <div class="kpi"><div class="l">Cost per occupied room</div><div class="v">${money(totAct / Math.max(1, totOcc))}</div><div class="s">Target ${money(props.reduce((a, p) => a + S().settings.cpor[p.id] * p.rooms, 0) / props.reduce((a, p) => a + p.rooms, 0))}</div></div>
    <div class="kpi ${ot.length ? "alert" : ""}"><div class="l">Overtime cost</div><div class="v">${m0(ot.reduce((a, x) => a + x.cost, 0))}</div><div class="s">${ot.length} people · ${h1(ot.reduce((a, x) => a + x.m, 0))}</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="card-h"><h2>Labour cost by day</h2><button class="btn sm" data-act="rep-csv" data-r="daily">CSV</button></div><div class="chart"><canvas id="r1"></canvas></div></div>
    <div class="card"><div class="card-h"><h2>Cost per occupied room</h2><span class="muted" style="font-size:13px">Lower is better</span></div><div class="chart"><canvas id="r2"></canvas></div></div>
    <div class="card"><div class="card-h"><h2>Cost and hours by department</h2><button class="btn sm" data-act="rep-csv" data-r="dept">CSV</button></div><div class="chart sm"><canvas id="r3"></canvas></div>
      <div class="tw"><table><thead><tr><th>Department</th><th class="n">Hours</th><th class="n">Cost</th><th class="n">Share</th></tr></thead><tbody>${byDept.filter((x) => x.hrs).map((x) => `<tr><td><span class="dot" style="background:${x.dp.color}"></span>${esc(x.dp.name)}</td><td class="n">${Math.round(x.hrs / 60)}</td><td class="n">${m0(x.cost)}</td><td class="n">${pct(x.cost / Math.max(1, totAct))}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Attendance exceptions</h2><button class="btn sm" data-act="rep-csv" data-r="exc">CSV</button></div><div class="chart sm"><canvas id="r4"></canvas></div>
      <p class="muted" style="font-size:13px;margin:10px 0 0">Late means more than ${S().settings.graceMin} minutes after the shift start.</p></div>
    <div class="card"><div class="card-h"><h2>Overtime by person</h2><button class="btn sm" data-act="rep-csv" data-r="ot">CSV</button></div>
      <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th class="n">OT hours</th><th class="n">OT cost</th></tr></thead><tbody>${ot.slice(0, 10).map((x) => `<tr class="click" data-act="open-person" data-id="${x.e.id}"><td>${esc(nm(x.e))}<br><small>${esc(prop(x.e.prop).short)}</small></td><td class="hide-sm">${esc(dept(x.e.dept).name)}</td><td class="n">${(x.m / 60).toFixed(1)}</td><td class="n">${money(x.cost)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No overtime in this range.</td></tr>`}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Headcount</h2><button class="btn sm" data-act="rep-csv" data-r="head">CSV</button></div>
      <div class="tw"><table><thead><tr><th>Department</th><th class="n">Full time</th><th class="n">Part time</th><th class="n">Onboarding</th></tr></thead><tbody>${head.map((x) => `<tr><td><span class="dot" style="background:${x.dp.color}"></span>${esc(x.dp.name)}</td><td class="n">${x.ft}</td><td class="n">${x.pt}</td><td class="n">${x.ob || "–"}</td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td class="n">${head.reduce((a, x) => a + x.ft, 0)}</td><td class="n">${head.reduce((a, x) => a + x.pt, 0)}</td><td class="n">${head.reduce((a, x) => a + x.ob, 0)}</td></tr></tfoot></table></div>
      <p class="muted" style="font-size:13px;margin:10px 0 0">${terms} former employee${terms === 1 ? "" : "s"} on file.</p></div>
  </div>`;
  $("#rr").onchange = (e) => { ui.repRange = e.target.value; A.render(); };
  const labels = days.map((d) => (days.length > 14 ? fmtDs(d) : DOW[dow(d)] + " " + d.slice(8)));
  const money0 = { ticks: { callback: (x) => "$" + (x >= 1000 ? (x / 1000).toFixed(1) + "k" : x) }, grid: { color: "#eef1f4" } };
  chart($("#r1"), { type: "bar", data: { labels, datasets: [{ label: "Actual (past) / scheduled (future)", data: actual.map(Math.round), backgroundColor: days.map((d) => (d < T ? "#2a78d6" : "#9cc3ee")), borderRadius: 4, order: 2 }, { label: "Budget", type: "line", data: budget, borderColor: "#eb6834", pointRadius: 2, tension: 0.25, order: 1 }] }, options: { scales: { y: money0, x: { grid: { display: false } } } } });
  chart($("#r2"), { type: "line", data: { labels, datasets: [{ label: "Cost per occupied room", data: cpor.map((x) => Math.round(x * 100) / 100), borderColor: "#1f4e79", backgroundColor: "rgba(42,120,214,.12)", fill: true, tension: 0.3, pointRadius: 2 }, { label: "Target", data: days.map(() => props.reduce((a, p) => a + S().settings.cpor[p.id] * p.rooms, 0) / props.reduce((a, p) => a + p.rooms, 0)), borderColor: "#1baf7a", borderDash: [5, 4], pointRadius: 0 }] }, options: { scales: { y: { ticks: { callback: (x) => "$" + x }, grid: { color: "#eef1f4" } }, x: { grid: { display: false } } } } });
  const bd = byDept.filter((x) => x.hrs);
  chart($("#r3"), { type: "bar", data: { labels: bd.map((x) => x.dp.name), datasets: [{ label: "Cost", data: bd.map((x) => Math.round(x.cost)), backgroundColor: bd.map((x) => x.dp.color), borderRadius: 4 }] }, options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: money0, y: { grid: { display: false } } } } });
  const ek = [["late", "Late", "#eda100"], ["missed", "Missed punch", "#b42318"], ["noshow", "No-show", "#7a1d14"], ["nobreak", "No meal break", "#8b5cf6"], ["early", "Left early", "#2a78d6"]];
  chart($("#r4"), { type: "bar", data: { labels: excBy.map((x) => x.dp.name), datasets: ek.map(([k, l, c]) => ({ label: l, data: excBy.map((x) => x.c[k]), backgroundColor: c, borderRadius: 3 })) }, options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 }, grid: { color: "#eef1f4" } } } } });
  A._rep = { days, sched, actual, budget, occRooms, byDept, ot, excBy, head };
};
ACT["rep-csv"] = (b) => {
  const r = A._rep; const k = b.dataset.r;
  if (k === "daily") csv("labour-by-day.csv", [["Date", "Actual or scheduled cost", "Scheduled cost", "Budget", "Occupied rooms (forecast)", "Cost per occupied room"], ...r.days.map((d, i) => [d, r.actual[i].toFixed(2), r.sched[i].toFixed(2), r.budget[i], r.occRooms[i].toFixed(0), (r.actual[i] / Math.max(1, r.occRooms[i])).toFixed(2)])]);
  if (k === "dept") csv("labour-by-department.csv", [["Department", "Hours", "Cost"], ...r.byDept.map((x) => [x.dp.name, (x.hrs / 60).toFixed(1), x.cost.toFixed(2)])]);
  if (k === "ot") csv("overtime.csv", [["Employee #", "Name", "Hotel", "Department", "OT hours", "OT cost"], ...r.ot.map((x) => [x.e.no, nm(x.e), prop(x.e.prop).short, dept(x.e.dept).name, (x.m / 60).toFixed(2), x.cost.toFixed(2)])]);
  if (k === "exc") csv("attendance-exceptions.csv", [["Department", "Late", "Missed punch", "No-show", "No meal break", "Left early", "Unscheduled"], ...r.excBy.map((x) => [x.dp.name, x.c.late, x.c.missed, x.c.noshow, x.c.nobreak, x.c.early, x.c.unsched])]);
  if (k === "head") csv("headcount.csv", [["Department", "Full time", "Part time", "Onboarding"], ...r.head.map((x) => [x.dp.name, x.ft, x.pt, x.ob])]);
};

// ---------- Settings ----------
VIEWS.settings = (v) => {
  const st = S().settings, hr = role() === "hr";
  v.innerHTML = `<div class="ph"><div><h1>Settings</h1><p>Pay rules, hotels and the audit trail.${hr ? "" : " Pay rules can be changed by HR."}</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Pay and attendance rules</h2><div class="fields mt">
      <div class="field"><label>Weekly overtime after (hours)</label><input type="number" id="st-ot" value="${st.otWeekly}" min="35" max="60" ${hr ? "" : "disabled"}><small>Ontario's default is 44</small></div>
      <div class="field"><label>Late after (minutes)</label><input type="number" id="st-g" value="${st.graceMin}" min="0" max="30" ${hr ? "" : "disabled"}></div>
      <div class="field"><label>Meal break required after (hours)</label><input type="number" id="st-b" value="${st.breakAfterHrs}" min="3" max="8" ${hr ? "" : "disabled"}></div>
      <div class="field"><label>Part-time vacation pay (%)</label><input type="number" id="st-v" value="${st.vacPayPct}" min="4" max="10" step="0.5" ${hr ? "" : "disabled"}></div>
      ${S().props.map((p) => `<div class="field"><label>${esc(p.short)} labour target per occupied room ($)</label><input type="number" data-cpor="${p.id}" value="${st.cpor[p.id]}" min="10" max="120" ${hr ? "" : "disabled"}></div>`).join("")}
    </div>${hr ? `<button class="btn primary mt" data-act="st-save">Save rules</button>` : ""}</div>
    <div class="card"><h2>Hotels</h2><div class="tw"><table><thead><tr><th>Hotel</th><th class="n">Rooms</th><th class="n">Staff</th></tr></thead><tbody>${S().props.map((p) => `<tr><td>${esc(p.name)}<br><small>${esc(p.city)}, Ontario</small></td><td class="n">${p.rooms}</td><td class="n">${activeEmps().filter((e) => e.prop === p.id).length}</td></tr>`).join("")}</tbody></table></div>
      <h3 class="mt">Demo data</h3><p class="muted" style="font-size:13.5px">Everything is stored only in this browser. Reset to start again with a fresh, current sample.</p>
      <div class="toolbar"><button class="btn danger" data-act="reset">Reset demo data</button><button class="btn" data-act="export-json">Download all data (JSON)</button></div></div>
    <div class="card" style="grid-column:1/-1"><div class="card-h"><h2>Audit trail</h2><span class="muted" style="font-size:13px">Every change, who made it and when</span></div>
      <div class="tw" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${S().audit.slice(0, 150).map((a) => `<tr><td class="nowrap">${new Date(a.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td class="nowrap">${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card" style="grid-column:1/-1"><h2>About this demo</h2>
      <p>This is a working prototype of a hotel workforce system: scheduling with labour budgets, a time clock and kiosk, timesheets with exception handling, a bi-weekly payroll preview, time off, people records, onboarding, approvals and reports, for managers, employees and HR. It runs entirely in the browser on fictional data.</p>
      <p style="margin:0"><b>For a production version:</b> a server and database with single sign-on and role-based access per hotel; CRA payroll tables and a bank deposit file; Record of Employment and T4 slips; geofenced mobile punches and wall-mounted kiosks; push and SMS notifications; integration with the PMS for live occupancy forecasts; union rules and seniority; and full audit logging and backups.</p></div>
  </div>`;
};
ACT["st-save"] = () => {
  const st = S().settings;
  st.otWeekly = Number($("#st-ot").value) || 44; st.graceMin = Number($("#st-g").value) || 0; st.breakAfterHrs = Number($("#st-b").value) || 5; st.vacPayPct = Number($("#st-v").value) || 4;
  $$("[data-cpor]").forEach((i) => (st.cpor[i.dataset.cpor] = Number(i.value) || st.cpor[i.dataset.cpor]));
  S().props.forEach((p) => Object.keys(S().forecast[p.id]).forEach((d) => (S().budget[p.id][d] = Math.round(p.rooms * S().forecast[p.id][d] * st.cpor[p.id]))));
  log("Changed pay and attendance rules"); refresh(); toast("Rules saved. Pay and budgets are recalculated.");
};
ACT.reset = () => confirmBox("Reset demo data?", "This replaces everything in this browser with a fresh sample company. Your changes will be lost.", "Reset", A.resetDemo, true);
ACT["export-json"] = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S(), null, 1)], { type: "application/json" })); a.download = "workforce-demo-data.json"; document.body.appendChild(a); a.click(); a.remove(); };

A.render();
})();
